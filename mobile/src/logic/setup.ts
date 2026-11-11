// "Start in 10 seconds": the setup form at the end of the intro (prototype handler s-go).

import { day0 } from './dates';
import { parseAmount } from './format';
import { clone, fail, type ActionResult, type AppState } from './types';

export interface SetupInput {
  amount: string; // how much money the user has
  cur: string;
  cur2?: string; // second currency ('' = none)
  amount2?: string; // balance in the second currency
  income?: string; // monthly income (optional)
  save?: string; // how much to save monthly
  age?: string; // optional, just for info
}

/** The currency list of the setup form, in the prototype's order. */
export const CURRENCIES: [string, string][] = [
  ['EUR', 'Euro'],
  ['USD', 'US dollar'],
  ['GBP', 'British pound'],
  ['CHF', 'Swiss franc'],
  ['RSD', 'Serbian dinar'],
  ['BAM', 'Convertible mark'],
  ['MKD', 'Macedonian denar'],
  ['JPY', 'Japanese yen'],
  ['CAD', 'Canadian dollar'],
  ['AUD', 'Australian dollar'],
  ['SEK', 'Swedish krona'],
  ['NOK', 'Norwegian krone'],
  ['DKK', 'Danish krone'],
  ['PLN', 'Polish zloty'],
  ['CZK', 'Czech koruna'],
  ['HUF', 'Hungarian forint'],
  ['RON', 'Romanian leu'],
  ['TRY', 'Turkish lira'],
  ['BGN', 'Bulgarian lev'],
];

export const currencyLabel = (code: string) => {
  const c = CURRENCIES.find((x) => x[0] === code);
  return c ? c[0] + ' (' + c[1] + ')' : code;
};

/** Starts the app with what the user typed. Everything before stays as it was (theme, roast level...). */
export function completeSetup(s: AppState, input: SetupInput, now: number): ActionResult {
  const a = parseAmount(input.amount);
  if (!(a > 0)) return fail('Enter how much money you have');
  const n = clone(s);
  n.income = parseAmount(input.income ?? '') || 0;
  const age = parseInt(input.age ?? '', 10);
  if (age >= 10 && age < 120) n.age = age;
  else delete n.age;
  n.plan = { items: {}, save: parseAmount(input.save ?? '') || 0 };
  n.t0 = now;
  n.tk0 = day0(now);
  n.chk = {};
  n.start = a;
  n.cur = input.cur;
  n.cur2 = input.cur2 && input.cur2 !== input.cur ? input.cur2 : null;
  n.start2 = n.cur2 ? parseAmount(input.amount2 ?? '') || 0 : 0;
  return { ok: true, state: n, toast: '' };
}
