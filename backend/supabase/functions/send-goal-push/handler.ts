// Sends shared-goal notifications. pg_cron calls this every minute with the secret Authorization value
// (PUSH_CRON_AUTH); the database decides what may go out (claim_goal_pushes: at most one notification per
// person per goal every 10 minutes, waiting events merged into it). This builds the text and sends it through
// the Expo Push API, 100 per request. If Expo cannot be reached, the events are put back for the next run;
// phones Expo says no longer exist are dropped.

import { sameSecret } from '../_shared/secret.ts';
import { safeName } from '../_shared/text.ts';

export type GoalEvent = { kind: 'paid' | 'joined' | 'left'; actor: string | null; actor_name: string | null; amount: number | null };
export type Group = {
  ids: number[];
  recipient: string;
  goal_id: string;
  goal_name: string | null;
  currency: string | null;
  events: GoalEvent[];
  tokens: string[];
};
export type PushMessage = { to: string; title: string; body: string; data: { goal_id: string; url: string }; sound: 'default'; channelId: string; priority: 'high' };
export type Ticket = { status: 'ok' | 'error'; id?: string; details?: { error?: string } };

export type Deps = {
  expectedAuth: string | undefined;
  claim: () => Promise<Group[]>;
  // One request of at most 100 messages; null when the Expo Push API could not be reached or failed (5xx / 429).
  send: (messages: PushMessage[]) => Promise<Ticket[] | null>;
  release: (ids: number[]) => Promise<void>;
  dropTokens: (tokens: string[]) => Promise<void>;
};

export const CHANNEL = 'shared-goals';
const MAX_PARTS = 3;

/** "€50", "€12.50", "RSD 1,200": no decimals when the amount is whole. */
export function money(amount: number, currency: string | null): string {
  const whole = Math.round(amount * 100) % 100 === 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: currency || 'EUR', minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(whole ? 0 : 2)} ${currency ?? ''}`.trim();
  }
}

/**
 * The text for one person and one goal. One thing happened: "Marko added €50 to Summer trip", "Ana joined Summer
 * trip", "Eva left Summer trip". Several (merged): payments per person are added up,
 * "Summer trip: Marko added €120 (3 payments), Ana joined, Eva left", at most 3 parts, then "and N more".
 */
export function goalText(g: Pick<Group, 'goal_name' | 'currency' | 'events'>): string {
  const goal = Array.from((g.goal_name ?? '').trim()).slice(0, 60).join('') || 'your shared goal';
  const parts: { kind: GoalEvent['kind']; name: string; sum: number; n: number }[] = [];
  for (const e of g.events) {
    const name = safeName(e.actor_name) || 'Someone';
    const same = e.kind === 'paid' ? parts.find((p) => p.kind === 'paid' && p.name === name) : undefined;
    if (same) {
      same.sum += Number(e.amount) || 0;
      same.n += 1;
    } else parts.push({ kind: e.kind, name, sum: Number(e.amount) || 0, n: 1 });
  }
  const say = (p: (typeof parts)[number], withGoal: boolean) => {
    if (p.kind === 'paid') return `${p.name} added ${money(p.sum, g.currency)}${withGoal ? ` to ${goal}` : ''}${p.n > 1 ? ` (${p.n} payments)` : ''}`;
    return `${p.name} ${p.kind}${withGoal ? ` ${goal}` : ''}`;
  };
  if (parts.length === 1) return say(parts[0], true);
  const shown = parts.slice(0, MAX_PARTS).map((p) => say(p, false));
  const more = parts.length - MAX_PARTS;
  return `${goal}: ${shown.join(', ')}${more > 0 ? ` and ${more} more` : ''}`;
}

export function messagesFor(groups: Group[]): { message: PushMessage; ids: number[] }[] {
  return groups.flatMap((g) =>
    g.tokens.map((to) => ({
      ids: g.ids,
      message: {
        to,
        title: 'Lock In',
        body: goalText(g),
        data: { goal_id: g.goal_id, url: 'lockin://savings' },
        sound: 'default' as const,
        channelId: CHANNEL,
        priority: 'high' as const,
      },
    })),
  );
}

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (!deps.expectedAuth || deps.expectedAuth.length < 32) return reply(500, { error: 'cron secret not configured' });
  if (req.method !== 'POST') return reply(405, { error: 'method not allowed' });
  if (!sameSecret(req.headers.get('authorization') ?? '', deps.expectedAuth)) return reply(401, { error: 'unauthorized' });

  const groups = await deps.claim();
  const all = messagesFor(groups);
  let sent = 0;
  const failed = new Set<number>();
  const gone = new Set<string>();
  for (let i = 0; i < all.length; i += 100) {
    const chunk = all.slice(i, i + 100);
    const tickets = await deps.send(chunk.map((c) => c.message));
    if (!tickets) {
      for (const c of chunk) for (const id of c.ids) failed.add(id);
      continue;
    }
    tickets.forEach((t, k) => {
      if (t.status === 'ok') sent += 1;
      else if (t.details?.error === 'DeviceNotRegistered') gone.add(chunk[k].message.to);
    });
  }
  if (failed.size) await deps.release([...failed]);
  if (gone.size) await deps.dropTokens([...gone]);
  return reply(failed.size ? 502 : 200, { groups: groups.length, sent, retry_later: failed.size, dropped: gone.size });
}
