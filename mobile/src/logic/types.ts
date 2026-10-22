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
};
