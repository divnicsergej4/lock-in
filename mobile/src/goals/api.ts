// Friends and shared goals on the server (migrations 0001–0006). Only the columns the app may read are named
// (select * on profiles is refused), and everything is checked again by the database: who may see or change
// what, limits and quotas. Errors the database meant for people (hint rate_limited / quota) are shown as they are.

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Contribution, FriendRequest, Goal, Member, Nudge, Snapshot } from '@/logic/goals';

export type Done<T = undefined> = { ok: true; data: T; note?: string } | { ok: false; error: string };
type DbError = { message: string; hint?: string | null; code?: string | null };

export const ENDED = "Your trial or plan has ended. You can still see this goal and leave it, but you can't put money in or change anything.";
export const OFFLINE = "Couldn't reach the server. Check your connection.";
export const BAD_NAME = 'Use 1 to 40 characters, no spaces at the start or end.';

/** What to show for an error from the database. */
export function errorText(e: DbError | null | undefined): string {
  if (!e) return OFFLINE;
  if (e.hint === 'rate_limited' || e.hint === 'quota') return e.message;
  if (e.hint === 'no_access') return ENDED;
  switch (e.message) {
    case 'invalid email':
      return "That doesn't look like an email.";
    case 'cannot add yourself':
      return "That's your own email.";
    case 'already friends':
      return "You're already friends.";
    case "You can't nudge yourself.":
      return e.message;
  }
  return OFFLINE;
}

const fail = (e: DbError | null | undefined): Done<never> => ({ ok: false, error: errorText(e) });
const num = (v: unknown) => Number(v) || 0;

export async function loadSnapshot(db: SupabaseClient, me: string): Promise<Done<Snapshot>> {
  const [profiles, friendships, requests, goals, members, contributions, nudges] = await Promise.all([
    db.from('profiles').select('id, display_name'),
    db.from('friendships').select('user_a, user_b'),
    db.from('friend_requests').select('id, from_user, to_email, status, created_at').eq('status', 'pending').order('created_at', { ascending: false }),
    db.from('goals').select('id, name, target, currency, deadline, created_at').order('created_at'),
    db.from('goal_members').select('goal_id, user_id, joined_at, added_by'),
    db.from('contributions').select('id, goal_id, user_id, amount, note, created_at').order('created_at'),
    db.from('goal_nudges').select('id, goal_id, from_user, to_user, created_at'),
  ]);
  const err = [profiles, friendships, requests, goals, members, contributions, nudges].find((r) => r.error)?.error;
  if (err) return fail(err);
  const names: Record<string, string | null> = {};
  for (const p of (profiles.data ?? []) as { id: string; display_name: string | null }[]) names[p.id] = p.display_name;
  const reqs = (requests.data ?? []) as FriendRequest[];
  return {
    ok: true,
    data: {
      me,
      names,
      friends: ((friendships.data ?? []) as { user_a: string; user_b: string }[]).map((f) => (f.user_a === me ? f.user_b : f.user_a)),
      requestsIn: reqs.filter((r) => r.from_user !== me),
      requestsOut: reqs.filter((r) => r.from_user === me),
      goals: ((goals.data ?? []) as Goal[]).map((g) => ({ ...g, target: num(g.target) })),
      members: (members.data ?? []) as Member[],
      contributions: ((contributions.data ?? []) as Contribution[]).map((c) => ({ ...c, amount: num(c.amount) })),
      nudges: (nudges.data ?? []) as Nudge[],
    },
  };
}

/** The tables whose changes come in live (Realtime sends each person only the rows they may see). */
export const LIVE_TABLES = ['goals', 'goal_members', 'contributions', 'friend_requests', 'friendships', 'goal_nudges'] as const;

// ---------------------------------------------------------------------------
// Friends
// ---------------------------------------------------------------------------
/** Invite by email: the request, then the email (send-invite-email). If they had invited me, we are friends now. */
export async function sendInvite(db: SupabaseClient, email: string): Promise<Done> {
  const { data: rid, error } = await db.rpc('send_friend_request', { email });
  if (error) return fail(error);
  const { data: row } = await db.from('friend_requests').select('status').eq('id', rid).maybeSingle();
  if ((row as { status?: string } | null)?.status === 'accepted') return { ok: true, data: undefined, note: "You're friends now" };
  const sent = await db.functions.invoke('send-invite-email', { body: { request_id: rid } });
  if (sent.error) return { ok: true, data: undefined, note: "Invite saved, but the email didn't go out. Try again later." };
  return { ok: true, data: undefined, note: 'Invite sent' };
}

export async function respondInvite(db: SupabaseClient, id: string, accept: boolean): Promise<Done> {
  const { error } = await db.rpc('respond_friend_request', { request_id: id, accept });
  return error ? fail(error) : { ok: true, data: undefined, note: accept ? "You're friends now" : 'Request declined' };
}

export async function cancelInvite(db: SupabaseClient, id: string): Promise<Done> {
  const { error } = await db.from('friend_requests').delete().eq('id', id);
  return error ? fail(error) : { ok: true, data: undefined, note: 'Invite canceled' };
}

export async function setName(db: SupabaseClient, me: string, name: string): Promise<Done> {
  const { error } = await db.from('profiles').update({ display_name: name }).eq('id', me);
  if (error) return { ok: false, error: error.code === '23514' ? BAD_NAME : errorText(error) };
  return { ok: true, data: undefined };
}

/** "What should friends call you?": 1 to 40 characters, no space at either end (same rule as the database). */
export function nameOk(name: string): boolean {
  const n = Array.from(name).length;
  return n >= 1 && n <= 40 && name.trim() === name && !/[\u0000-\u001f\u007f­؜᠎​-‏‪-‮⁠-⁯﻿]/.test(name);
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------
export async function createGoal(
  db: SupabaseClient,
  g: { name: string; target: number; currency: string; deadline: string | null },
  friends: string[],
): Promise<Done<string>> {
  const { data: id, error } = await db.rpc('create_goal', { name: g.name, target: g.target, currency: g.currency, deadline: g.deadline });
  if (error) return fail(error);
  for (const f of friends) {
    const r = await db.rpc('add_friend_to_goal', { goal_id: id, friend_id: f });
    if (r.error) return { ok: true, data: id as string, note: errorText(r.error) };
  }
  return { ok: true, data: id as string };
}

export async function editGoal(db: SupabaseClient, id: string, g: { name: string; target: number; deadline: string | null }): Promise<Done> {
  const { data, error } = await db.from('goals').update(g).eq('id', id).select('id');
  if (error) return fail(error);
  // RLS silently skips the row when the plan ran out
  if (!data?.length) return { ok: false, error: ENDED };
  return { ok: true, data: undefined, note: 'Saved' };
}

export async function addToGoal(db: SupabaseClient, goalId: string, friendId: string): Promise<Done> {
  const { error } = await db.rpc('add_friend_to_goal', { goal_id: goalId, friend_id: friendId });
  return error ? fail(error) : { ok: true, data: undefined };
}

export async function leaveGoal(db: SupabaseClient, goalId: string): Promise<Done> {
  const { error } = await db.rpc('leave_goal', { goal_id: goalId });
  return error ? fail(error) : { ok: true, data: undefined, note: 'You left the goal' };
}

export async function putIn(db: SupabaseClient, me: string, goalId: string, amount: number): Promise<Done> {
  const { error } = await db.from('contributions').insert({ goal_id: goalId, user_id: me, amount });
  if (error) return { ok: false, error: error.code === '42501' ? ENDED : errorText(error) };
  return { ok: true, data: undefined };
}

export async function editEntry(db: SupabaseClient, id: string, amount: number): Promise<Done> {
  const { data, error } = await db.from('contributions').update({ amount }).eq('id', id).select('id');
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: ENDED };
  return { ok: true, data: undefined, note: 'Saved' };
}

export async function deleteEntry(db: SupabaseClient, id: string): Promise<Done> {
  const { error } = await db.from('contributions').delete().eq('id', id);
  return error ? fail(error) : { ok: true, data: undefined, note: 'Deleted' };
}

export async function nudge(db: SupabaseClient, goalId: string, friendId: string): Promise<Done> {
  const { error } = await db.rpc('nudge', { goal_id: goalId, friend_id: friendId });
  return error ? fail(error) : { ok: true, data: undefined };
}

export async function nudgeAlerts(db: SupabaseClient): Promise<boolean | null> {
  const { data, error } = await db.rpc('nudge_alerts');
  return error ? null : !!data;
}

export async function setNudgeAlerts(db: SupabaseClient, allowed: boolean): Promise<Done> {
  const { error } = await db.rpc('set_nudge_alerts', { allowed });
  return error ? fail(error) : { ok: true, data: undefined };
}
