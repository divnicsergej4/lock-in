// App state. Mirrors the prototype's `S` object (index.html on `razvoj`), with English names.
// Personal spending lives only on the phone (see docs/PROJEKAT.md, section 5).

export type RoastLevel = 0 | 1 | 2; // 0 Gentle, 1 Normal, 2 No mercy
export type ThemeName = 'dark' | 'light';

export interface Expense {
  amt: number; // in the main currency
  cat: string;
  t: number; // timestamp (ms)
  note: string;
  sub?: boolean; // monthly subscription
  auto?: boolean; // added automatically by a recurring entry
  c2?: boolean; // paid in the second currency
  oa?: number; // original amount in the second currency
  env?: string; // envelope id it was paid from
  envAmt?: number;
}

export interface Income {
  amt: number;
  t: number;
  type: string; // 'Salary' | 'Gift'
  note: string;
  auto?: boolean;
  c2?: boolean;
  oa?: number;
}

export interface Envelope {
  id: string;
  n: string; // name
  b: number; // balance inside
  t: number; // target (0 = plain envelope, no goal)
  due: number; // deadline timestamp (0 = none)
}

export interface Recurring {
  k: 'o' | 'i'; // outgoing / incoming
  cat: string;
  amt: number;
  day: number; // day of month
  note?: string;
  last?: string; // month key of the last time it was applied
}

export interface AppState {
  v: 1; // storage version, for future migrations
  cur: string;
  cur2: string | null;
  start: number; // money the user had when they set up the app
  start2: number;
  added: number; // income added since
  income: number; // monthly income (0 = not set)
  age?: number;
  roast: RoastLevel;
  theme: ThemeName;
  exp: Expense[];
  ins: Income[];
  cats: string[]; // the user's own categories
  env: Envelope[];
  lim: Record<string, number>; // monthly limit per category
  rec: Recurring[];
  chk: Record<string, 1>; // "I didn't spend anything today" check-ins, by day key
  t0: number; // when the app was set up
  tk0: number; // first day the streak counts from
  plan: Plan;
  tierSeen?: number; // highest flame tier already celebrated
  fold?: Record<string, boolean>; // which foldable sections are open (e.g. "buy": Can I afford this?)
  drw?: 'o' | 'c'; // the envelope drawer: open or closed (shut)
  rem?: { on: boolean; time: string }; // daily reminder to log expenses ("HH:MM")
  remDis?: string; // day key on which the reminder was answered with "I didn't spend today"
  nag?: { on: boolean }; // "don't waste money" nudges (local notifications, logic/nudges.ts), off until turned on
  streakNag?: boolean; // the 20:00 streak notification, its own switch (can be the only one on)
  goalPush?: boolean; // shared goal alerts were turned on on this phone (the token itself is on the server)
  goalPushAsked?: boolean; // the first time in a goal, the app offered shared goal alerts (only once)
  unlockSeen?: Record<string, 1>; // shared goals whose "Unlocked." screen this phone has shown
  tutSeen?: number; // the guided tour has been shown (1)
  trialRem?: boolean; // the reminder 2 days before the free trial ends; on unless switched off (false)
  team?: { n: string; t: number; c: { who: string; amt: number; t?: number }[] }; // shared goal kept on the phone (demo)
}

export interface Plan {
  items: Record<string, number>; // planned spending per category this month
  save: number; // savings goal for the month
}

/** Result of a user action: the new state and the toast to show, or the error to show. */
export type ActionResult = { ok: true; state: AppState; toast: string } | { ok: false; error: string };

export const fail = (error: string): ActionResult => ({ ok: false, error });

/** Deep copy, so actions never change the state they were given. */
export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export const initialState: AppState = {
  v: 1,
  cur: 'EUR',
  cur2: null,
  start: 0,
  start2: 0,
  added: 0,
  income: 0,
  roast: 1,
  theme: 'dark',
  exp: [],
  ins: [],
  cats: [],
  env: [],
  lim: {},
  rec: [],
  chk: {},
  t0: 0,
  tk0: 0,
  plan: { items: {}, save: 0 },
};
