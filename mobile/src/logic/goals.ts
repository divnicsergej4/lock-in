// Shared goals: everything the screens show, worked out from what the server lets a member read (goals,
// members, contributions, nudges, display names). No extra tables: pins, pace, squad streak and fair share are
// computed here (Andrija, 28 October 2026). Pure functions, so they are tested without a phone or a server.

import { DAY_MS } from './dates';
import { fmt } from './format';

// ---------------------------------------------------------------------------
// What comes from the server
// ---------------------------------------------------------------------------
export type Goal = {
  id: string;
  name: string;
  target: number;
  currency: string; // three capital letters
  deadline: string | null; // 'YYYY-MM-DD'
  created_at: string;
};
export type Member = { goal_id: string; user_id: string; joined_at: string; added_by: string | null };
export type Contribution = { id: string; goal_id: string; user_id: string; amount: number; note: string | null; created_at: string };
export type Nudge = { id: string; goal_id: string; from_user: string; to_user: string; created_at: string };
export type FriendRequest = { id: string; from_user: string; to_email: string; status: string; created_at: string };

export type Snapshot = {
  me: string;
  names: Record<string, string | null>; // display names of everyone the server lets me see
  friends: string[];
  requestsIn: FriendRequest[]; // pending, sent to me
  requestsOut: FriendRequest[]; // pending, sent by me
  goals: Goal[];
  members: Member[];
  contributions: Contribution[];
  nudges: Nudge[];
};

export const emptySnapshot = (me: string): Snapshot => ({
  me, names: {}, friends: [], requestsIn: [], requestsOut: [], goals: [], members: [], contributions: [], nudges: [],
});

// ---------------------------------------------------------------------------
// Money, names, colours, time
// ---------------------------------------------------------------------------
/** Member colours in the order they joined (Andrija's palette), then round again. */
export const MEMBER_COLORS = ['#22e07a', '#5aa9f0', '#ff7eb6', '#ffab3d'] as const;
export const GOLD = '#f5c84b';
export const PINS = [25, 50, 75, 100] as const;

const PREFIX: Record<string, string> = { USD: '$', GBP: '£', CAD: 'C$', AUD: 'A$', JPY: '¥' };
const SUFFIX: Record<string, string> = { EUR: '€', SEK: 'kr', NOK: 'kr', DKK: 'kr', PLN: 'zł', CZK: 'Kč', HUF: 'Ft', TRY: '₺' };

/** "1,240 €", "$1,240", "1,240 RSD". Whole amounts without decimals, others with up to two. */
export function money(n: number, currency: string): string {
  const v = fmt(Math.round(n * 100) / 100);
  if (PREFIX[currency]) return (n < 0 ? '-' : '') + PREFIX[currency] + fmt(Math.abs(Math.round(n * 100) / 100));
  return v + ' ' + (SUFFIX[currency] ?? currency);
}

/** Only the number, as on "Rest of my share · 147". */
export const amount = (n: number) => fmt(Math.round(n * 100) / 100);

/** The currency in words, for "Every euro anyone puts in fills the ring." */
const WORDS: Record<string, string> = {
  EUR: 'euro', USD: 'dollar', GBP: 'pound', CHF: 'franc', RSD: 'dinar', BAM: 'mark', MKD: 'denar', JPY: 'yen',
  CAD: 'dollar', AUD: 'dollar', SEK: 'krona', NOK: 'krone', DKK: 'krone', PLN: 'zloty', CZK: 'koruna',
  HUF: 'forint', RON: 'leu', TRY: 'lira', BGN: 'lev',
};
export const currencyWord = (code: string) => WORDS[code] ?? 'coin';

export function introText(currency: string): string {
  return `Pick one thing to save for with your people. Every ${currencyWord(currency)} anyone puts in fills the ring. Hit the goal and the lock opens.`;
}

export const nameOf = (s: Snapshot, uid: string): string => s.names[uid] || 'Someone';
export const initial = (name: string) => (Array.from(name.trim())[0] ?? '?').toUpperCase();

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
/** Monday 00:00 of the week t is in (weeks start on Monday). */
export function weekStart(t: number): number {
  const d = new Date(startOfDay(t));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}
const addDays = (t: number, n: number) => {
  const d = new Date(t);
  d.setDate(d.getDate() + n);
  return d.getTime();
};
const daysBetween = (a: number, b: number) => Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS);

/** 'YYYY-MM-DD' as a local date (midnight). */
export function parseDay(d: string): number {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).getTime();
}
export function dayString(t: number): string {
  const d = new Date(t);
  const p = (n: number) => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/** "May 1" (this year, or within the next ten months, as in the design); otherwise "May 1, 2028". */
export function shortDate(t: number, now: number): string {
  const d = new Date(t);
  const s = MONTHS[d.getMonth()] + ' ' + d.getDate();
  const near = d.getFullYear() === new Date(now).getFullYear() || (t > now && t - now < 300 * DAY_MS);
  return near ? s : s + ', ' + d.getFullYear();
}

/** Activity times: "now", "5m ago", "2h ago", "yesterday", "Mon", "Oct 12". */
export function timeAgo(t: number, now: number): string {
  const min = Math.floor((now - t) / 60000);
  if (min < 1) return 'now';
  if (min < 60) return min + 'm ago';
  const days = daysBetween(t, now);
  if (days === 0 || min < 6 * 60) return Math.floor(min / 60) + 'h ago';
  if (days === 1) return 'yesterday';
  if (days < 7) return WEEKDAYS[new Date(t).getDay()];
  return shortDate(t, now);
}

/** "today", "yesterday", "Oct 12" (the friend request card). */
export function dayLabel(t: number, now: number): string {
  const days = daysBetween(t, now);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return shortDate(t, now);
}

/** How long it took: "1 day", "5 days", "3 weeks", "1 month", "6 months". */
export function duration(from: number, to: number): string {
  const days = Math.max(1, daysBetween(from, to));
  const months = Math.round(days / 30.44);
  if (months >= 1 && days >= 28) return months === 1 ? '1 month' : months + ' months';
  if (days >= 14) return Math.round(days / 7) + ' weeks';
  return days === 1 ? '1 day' : days + ' days';
}

export const people = (n: number) => (n === 1 ? '1 person' : n + ' people');
const plural = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many);

// ---------------------------------------------------------------------------
// One goal
// ---------------------------------------------------------------------------
export type MemberView = {
  id: string;
  name: string;
  initial: string;
  color: string;
  isMe: boolean;
  total: number;
  thisWeek: boolean; // put something in this week
  nudgedToday: boolean; // I nudged them in the last 24 hours (the server allows one a day)
};

export type Pace =
  | { kind: 'done' }
  | { kind: 'past-due'; left: number }
  | { kind: 'on-track' | 'behind'; perWeekEach: number; by: number }
  | { kind: 'no-date'; eta: number | null };

export type ActivityPart = { t: string; role: 'name' | 'text' | 'gold' };
export type Activity = {
  key: string;
  kind: 'paid' | 'joined' | 'pin' | 'unlocked' | 'nudge';
  at: number;
  color: string;
  parts: ActivityPart[];
  contributionId?: string; // my own entry: can be changed or deleted
};

export type GoalView = {
  goal: Goal;
  members: MemberView[];
  me: MemberView | null;
  saved: number;
  pct: number; // 0..100, whole, capped
  left: number; // still to go (0 when reached)
  fair: number; // target / members
  passed: number[]; // pins passed (25, 50, 75, 100)
  next: number | null; // next pin
  nextAway: number; // money to the next pin
  unlocked: boolean;
  unlockedAt: number | null;
  pace: Pace;
  streak: number; // weeks in a row in which every member put something in
  missing: string[]; // members who have not put anything in this week
  activity: Activity[];
};

export function membersOf(s: Snapshot, goalId: string): Member[] {
  return s.members
    .filter((m) => m.goal_id === goalId)
    .sort((a, b) => Date.parse(a.joined_at) - Date.parse(b.joined_at) || (a.user_id < b.user_id ? -1 : 1));
}

/** Rounded like the design (1,290 of 2,000 is 65%), but never 100% before the goal is reached. */
export function percent(saved: number, target: number): number {
  if (saved >= target - 1e-9) return 100;
  return Math.min(99, Math.round((saved / target) * 100));
}

/** Which pins a total has passed. */
export function pinsPassed(saved: number, target: number): number[] {
  return PINS.filter((p) => saved >= (target * p) / 100 - 1e-9);
}

/** The next pin and how far it is. */
export function nextPin(saved: number, target: number): { pin: number | null; away: number } {
  const pin = PINS.find((p) => saved < (target * p) / 100 - 1e-9) ?? null;
  return { pin, away: pin == null ? 0 : Math.max(0, Math.round(((target * pin) / 100 - saved) * 100) / 100) };
}

/**
 * Weeks in a row (Monday to Sunday) in which every member put something in. Members count from the week they
 * joined; weeks before the goal existed are not counted. This week counts once everyone is in; until then it
 * does not break the streak.
 */
export function squadStreak(members: Member[], contributions: Contribution[], created: number, now: number): { weeks: number; missing: string[] } {
  const paidIn = (uid: string, from: number, to: number) =>
    contributions.some((c) => c.user_id === uid && Date.parse(c.created_at) >= from && Date.parse(c.created_at) < to);
  const complete = (from: number, to: number) => {
    const due = members.filter((m) => Date.parse(m.joined_at) < to);
    return due.length > 0 && due.every((m) => paidIn(m.user_id, from, to));
  };
  const thisWeek = weekStart(now);
  const missing = members.filter((m) => !paidIn(m.user_id, thisWeek, addDays(thisWeek, 7))).map((m) => m.user_id);
  let weeks = missing.length === 0 && members.length > 0 ? 1 : 0;
  for (let w = addDays(thisWeek, -7); addDays(w, 7) > created; w = addDays(w, -7)) {
    if (!complete(w, addDays(w, 7))) break;
    weeks += 1;
  }
  return { weeks, missing };
}

/**
 * On track or behind (with a due date), or when it will be done at this pace (without one). The pace is what the
 * group put in over the last four weeks (or since the goal was made, if that is sooner), per week.
 */
export function pace(goal: Goal, saved: number, memberCount: number, contributions: Contribution[], now: number): Pace {
  const left = goal.target - saved;
  if (left <= 0) return { kind: 'done' };
  const ageWeeks = Math.min(4, Math.max(1, (now - Date.parse(goal.created_at)) / (7 * DAY_MS)));
  const since = now - ageWeeks * 7 * DAY_MS;
  const recent = contributions.filter((c) => Date.parse(c.created_at) >= since).reduce((a, c) => a + c.amount, 0);
  const weekly = recent / ageWeeks;
  if (goal.deadline) {
    const by = parseDay(goal.deadline);
    const daysLeft = daysBetween(now, by);
    if (daysLeft < 0) return { kind: 'past-due', left };
    const weeksLeft = Math.max(1, Math.ceil((daysLeft + 1) / 7));
    const needed = left / weeksLeft;
    return { kind: weekly >= needed - 1e-9 ? 'on-track' : 'behind', perWeekEach: Math.ceil(needed / Math.max(1, memberCount)), by };
  }
  return { kind: 'no-date', eta: weekly > 0 ? now + (left / weekly) * 7 * DAY_MS : null };
}

export function goalView(s: Snapshot, goalId: string, now: number): GoalView | null {
  const goal = s.goals.find((g) => g.id === goalId);
  if (!goal) return null;
  const mem = membersOf(s, goalId);
  const ids = new Set(mem.map((m) => m.user_id));
  const cons = s.contributions.filter((c) => c.goal_id === goalId && ids.has(c.user_id));
  const saved = Math.round(cons.reduce((a, c) => a + c.amount, 0) * 100) / 100;
  const ws = weekStart(now);
  const color = (i: number) => MEMBER_COLORS[i % MEMBER_COLORS.length];
  const members: MemberView[] = mem.map((m, i) => {
    const name = m.user_id === s.me ? s.names[s.me] || 'You' : nameOf(s, m.user_id);
    return {
      id: m.user_id,
      name,
      initial: initial(name),
      color: color(i),
      isMe: m.user_id === s.me,
      total: Math.round(cons.filter((c) => c.user_id === m.user_id).reduce((a, c) => a + c.amount, 0) * 100) / 100,
      thisWeek: cons.some((c) => c.user_id === m.user_id && Date.parse(c.created_at) >= ws),
      nudgedToday: s.nudges.some(
        (n) => n.goal_id === goalId && n.from_user === s.me && n.to_user === m.user_id && now - Date.parse(n.created_at) < DAY_MS,
      ),
    };
  });
  const colorOf = (uid: string) => members.find((m) => m.id === uid)?.color ?? GOLD;
  const nameIn = (uid: string) => (uid === s.me ? 'You' : nameOf(s, uid));
  const { weeks, missing } = squadStreak(mem, cons, Date.parse(goal.created_at), now);
  const np = nextPin(saved, goal.target);
  const passed = pinsPassed(saved, goal.target);

  // Activity: payments, people joining, nudges, and the moments the running total passed a pin
  const act: Activity[] = [];
  for (const c of cons) {
    act.push({
      key: 'c' + c.id,
      kind: 'paid',
      at: Date.parse(c.created_at),
      color: colorOf(c.user_id),
      parts: [{ t: `${nameIn(c.user_id)} put in ${money(c.amount, goal.currency)}`, role: 'name' }],
      contributionId: c.user_id === s.me ? c.id : undefined,
    });
  }
  for (const m of mem) {
    act.push({ key: 'm' + m.user_id, kind: 'joined', at: Date.parse(m.joined_at), color: colorOf(m.user_id), parts: [{ t: nameIn(m.user_id), role: 'name' }, { t: ' joined the goal', role: 'text' }] });
  }
  for (const n of s.nudges.filter((x) => x.goal_id === goalId)) {
    const parts: ActivityPart[] =
      n.to_user === s.me
        ? [{ t: nameOf(s, n.from_user), role: 'name' }, { t: ' nudged you', role: 'text' }]
        : [{ t: 'You', role: 'name' }, { t: ' nudged ', role: 'text' }, { t: nameOf(s, n.to_user), role: 'name' }];
    act.push({ key: 'n' + n.id, kind: 'nudge', at: Date.parse(n.created_at), color: colorOf(n.from_user), parts });
  }
  let run = 0;
  let unlockedAt: number | null = null;
  const done = new Set<number>();
  for (const c of [...cons].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))) {
    run += c.amount;
    for (const p of PINS) {
      if (done.has(p) || run < (goal.target * p) / 100 - 1e-9) continue;
      done.add(p);
      const at = Date.parse(c.created_at) + 1; // right after the payment that did it
      if (p === 100) {
        unlockedAt = at;
        act.push({ key: 'p100', kind: 'unlocked', at, color: GOLD, parts: [{ t: 'The lock opened', role: 'name' }] });
      } else {
        act.push({ key: 'p' + p, kind: 'pin', at, color: GOLD, parts: [{ t: 'The ', role: 'name' }, { t: `${p}% pin`, role: 'gold' }, { t: ' clicked', role: 'name' }] });
      }
    }
  }
  act.sort((a, b) => b.at - a.at || (a.key < b.key ? 1 : -1));

  return {
    goal,
    members,
    me: members.find((m) => m.isMe) ?? null,
    saved,
    pct: percent(saved, goal.target),
    left: Math.max(0, Math.round((goal.target - saved) * 100) / 100),
    fair: Math.round((goal.target / Math.max(1, members.length)) * 100) / 100,
    passed,
    next: np.pin,
    nextAway: np.away,
    unlocked: saved >= goal.target - 1e-9,
    unlockedAt: saved >= goal.target - 1e-9 ? unlockedAt : null,
    pace: pace(goal, saved, members.length, cons, now),
    streak: weeks,
    missing,
    activity: act,
  };
}

// ---------------------------------------------------------------------------
// Texts built from a goal
// ---------------------------------------------------------------------------
/** "3 people · due May 1" */
export function peopleLine(v: GoalView, now: number): string {
  return people(v.members.length) + (v.goal.deadline ? ' · due ' + shortDate(parseDay(v.goal.deadline), now) : '');
}

/** "of 2,000 € · 62% · 760 € to go" */
export function ofLine(v: GoalView): string {
  return `of ${money(v.goal.target, v.goal.currency)} · ${v.pct}%` + (v.left > 0 ? ` · ${money(v.left, v.goal.currency)} to go` : '');
}

/** The pin chips under the amount: "25% pin", "50% pin", "75% next · 260 € away". */
export function pinChips(v: GoalView): { t: string; passed: boolean }[] {
  const chips = v.passed.filter((p) => p < 100).map((p) => ({ t: `${p}% pin`, passed: true }));
  if (v.next != null) chips.push({ t: `${v.next}% next · ${money(v.nextAway, v.goal.currency)} away`, passed: false });
  return chips;
}

/** The pace card: its label and the sentence. */
export function paceCard(v: GoalView, now: number): { label: string; good: boolean; text: string } {
  const p = v.pace;
  const cur = v.goal.currency;
  switch (p.kind) {
    case 'done':
      return { label: 'Done', good: true, text: 'You hit the goal.' };
    case 'past-due':
      return { label: 'Past due', good: false, text: `${money(p.left, cur)} still to go.` };
    case 'on-track':
    case 'behind':
      return {
        label: p.kind === 'on-track' ? 'On track' : 'Behind',
        good: p.kind === 'on-track',
        text: `${money(p.perWeekEach, cur)} a week each gets you there by ${shortDate(p.by, now)}.`,
      };
    case 'no-date': {
      if (p.eta == null) return { label: 'No due date', good: true, text: 'Put money in to see your pace.' };
      const d = new Date(p.eta);
      return { label: 'No due date', good: true, text: `At this pace: ~${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
    }
  }
}

/** The squad streak card: "3-week squad streak" and who is still up this week. */
export function streakCard(v: GoalView): { title: string; text: string } {
  const title = v.streak > 0 ? `${v.streak}-week squad streak` : 'No squad streak yet';
  const lead = v.streak > 0 ? 'Everyone put something in.' : 'Every week everyone puts something in, the streak grows.';
  if (v.missing.length === 0) return { title, text: 'Everyone put something in this week.' };
  const meMissing = v.missing.includes(v.me?.id ?? '');
  const others = v.missing.filter((id) => id !== v.me?.id).map((id) => v.members.find((m) => m.id === id)?.name ?? 'Someone');
  let up: string;
  if (meMissing && others.length === 0) up = "You're up this week.";
  else if (meMissing) up = `You${others.length > 1 ? ', ' + others.slice(0, -1).join(', ') : ''} and ${others[others.length - 1]} are up this week.`;
  else if (others.length === 1) up = `${others[0]}, you're up this week.`;
  else if (others.length <= 3) up = `${others.slice(0, -1).join(', ')} and ${others[others.length - 1]}, you're up this week.`;
  else up = `${others[0]}, ${others[1]} and ${others.length - 2} more, you're up this week.`;
  return { title, text: lead + ' ' + up };
}

export type Tag = { t: string; look: 'green' | 'red' | 'flame' | 'gold' | 'outline' };

/** The chips on a goal card in the list. */
export function goalTags(v: GoalView, now: number): Tag[] {
  const tags: Tag[] = [];
  if (v.unlocked) tags.push({ t: 'Unlocked', look: 'gold' });
  else if (v.pct >= 75) tags.push({ t: `${money(v.left, v.goal.currency)} to unlock`, look: 'gold' });
  else if (v.pace.kind === 'on-track') tags.push({ t: 'On track', look: 'green' });
  else if (v.pace.kind === 'behind') tags.push({ t: 'Behind', look: 'red' });
  if (!v.unlocked && v.pace.kind === 'past-due') tags.push({ t: 'Past due', look: 'red' });
  if (v.streak > 0) tags.push({ t: plural(v.streak, 'week', 'weeks'), look: 'flame' });
  if (!v.unlocked && v.goal.deadline) {
    const d = daysBetween(now, parseDay(v.goal.deadline));
    if (d === 0) tags.push({ t: 'Due today', look: 'outline' });
    else if (d === 1) tags.push({ t: 'Due tomorrow', look: 'outline' });
    else if (d > 1 && d <= 30) tags.push({ t: `Due in ${d} days`, look: 'outline' });
  }
  return tags.slice(0, 3);
}

/** "Marko put in 50 € · 2h ago" on the card (or "No money in yet"). */
export function lastActivity(v: GoalView, now: number): { parts: ActivityPart[]; when: string } | null {
  const a = v.activity[0];
  if (!a) return null;
  // on the card the name is bold and the rest muted
  const parts: ActivityPart[] = a.kind === 'paid'
    ? (() => {
        const [who, ...rest] = a.parts[0].t.split(' put in ');
        return [{ t: who, role: 'name' as const }, { t: ' put in ' + rest.join(' put in '), role: 'text' as const }];
      })()
    : a.parts.map((p) => ({ ...p, role: p.role === 'gold' ? ('text' as const) : p.role }));
  return { parts, when: timeAgo(a.at, now) };
}

/** "2 goals · 3 friends" */
export function goalsHeader(goals: number, friends: number): string {
  return plural(goals, 'goal', 'goals') + ' · ' + plural(friends, 'friend', 'friends');
}

/** What "Put money in" shows for an amount. */
export function putPreview(v: GoalView, amt: number): { after: number; pct: number; line: string; note: string | null; streak: boolean; rest: number } {
  const after = Math.round((v.saved + Math.max(0, amt)) * 100) / 100;
  const pct = percent(after, v.goal.target);
  const np = nextPin(after, v.goal.target);
  let note: string | null = null;
  if (!v.unlocked && after >= v.goal.target - 1e-9) note = 'This opens the lock 🔓';
  else if (np.pin != null) note = `Next pin at ${np.pin}%: ${money(np.away, v.goal.currency)} away`;
  return {
    after,
    pct,
    line: `${amount(after)} / ${money(v.goal.target, v.goal.currency)} · ${pct}%`,
    note,
    streak: !!v.me && !v.me.thisWeek,
    rest: v.me ? Math.max(0, Math.round(v.fair - v.me.total)) : 0, // whole, like "Fair share 667 € each"
  };
}

/** The text under "Leave goal". */
export function leaveText(v: GoalView): string {
  if (v.members.length <= 1) return "You're the only one here. If you leave, the goal is deleted.";
  return `If you leave, your ${money(v.me?.total ?? 0, v.goal.currency)} is taken out of this goal. Everyone else keeps going.`;
}
