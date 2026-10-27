// Roasts and critiques. Andrija's texts: copy EXACTLY (typos, spacing, emoji). Source of truth: docs/FORE.md.
// Lines starting with "!" are the hard ones: only at "No mercy", and there they come up ~70% of the time.

import { fmt, pick } from './format';
import { currentBalance, monthByCategory, monthSpent, monthlyIncome, todayCount } from './money';
import type { AppState, Expense } from './types';

export const ROASTS: Record<string, string[]> = {
  Groceries: ["hell yeahh, groceries! cooking at home is the strongest move 💪", "smart. a home meal is half the price 🗿", "an expense I approve, just don't throw half of it out of the fridge"],
  Food: ["you're cooking today, you ate expensive enough yesterday 🥀", "did you know that home cooking is a free glitch, try it", "delivery AGAIN? your stove feels neglected🥀", "food is a need, but that price was a choice bro..."],
  Coffee: ["that coffee could've been part of your goal gng", "third coffee today? you aren't sleeping but neither is your money🥀"],
  Clothes: ["bro you didn't need that🥀you have enough mf clothes", "more shirts? your closet already has its own zip code😭", "!do you wear the same shirt 4 days straight and buy a new one? smh"],
  Shoes: ["more sneakers? you only have two feet bro🥀", "your old sneakers are still breathing, let them live...", "you own 5 pairs and wear 1, math doesn't lie"],
  Gym: ["the only expense I approve 💪 just actually go", "the gym is the only expense your body pays back. respect", "PROTEIN PROTEIN PROTEIN!! JUST GIVE ME PROTEEEIINN"],
  Transportation: ["fuel or a ticket, ok. but a taxi for 500 meters?", "transport is necessary, just don't be lazy on short trips and walk instead", "you do remember you have legs... do you?"],
  Bills: ["what must be done isn’t hard, right?", "a paid bill is peace of mind, this is a good expense"],
  'Nights out': ["going out is expensive, and tomorrow your head hurts too", "a night out without a plan is money with no return", "!if you spent that much money i hope that you will  be drunk...at least", "Jarvis, more alcohol..."],
  // {age} = the user's age rounded down to tens (20, 30, 40...); under 20 or no age given, this one is never shown
  Gaming: ["!a grown ahh man buying games at {age}+ years old?😭✌️ just ask yourself what are you doing with your life and LOCK IN", "a $15 skin? you're literally watching money disappear", "!buying a game you won't finish, i know you bruh...", "your backlog is already as long as a loan gang"],
  Other: ["you spent today like money grows in your backyard or sum", "bro, the goal won't wait", "every small purchase is a big one by the end of the month, remember that", "logged. not pretty, but honest.", "!brooo you DON'T need that shi🥀🥀🥀"],
};

/** Categories without their own lines (Rent and the user's own). {c} = category name. */
export const ROASTS_ANY_CATEGORY = ["{c}? again? that's a permanent budget line by now 🥀", "{c} is your favorite way to make money vanish", "gng, {c} doesn't build savings, just so you know...", "I know you love {c}, but your goal is watching from the dark, disappointed"];

/** Gentle: instead of the roast. */
export const GENTLE = ["logged, just watch your goal 🙂", "okay, see you at savings 💚", "ok, but remember what you're saving for 🙂"];

/** No mercy: added at the end. */
export const NO_MERCY_TAIL = ["Not even your mom would approve.", "Future you hates you."];

export const MSG_IN_THE_RED = 'bro, you\'re in the red. stop. 🥀🥀🥀';
export const MSG_OVER_30 = "that's over 30% of everything you have, are you really sure????";
export const MSG_THIRD_TODAY = 'third expense today bro...lock your phone 🥀';
export const MSG_WHOLE_INCOME = "you've spent your whole monthly income bro. stop it. now.";
export const MSG_OVER_80 = 'over 80% of your monthly income is already gone 😭😭😭✌️';
export const msgOverLimit = (cat: string, spent: string, limit: string) => `you went over your monthly limit for ${cat} (${spent} / ${limit}) 🥀🥀`;
export const msgNearLimit = (cat: string, spent: string, limit: string) => `you're close to your limit for ${cat}: ${spent} / ${limit} 🥀`;

/** Big-expense threshold: share of everything the user has. */
export const BIG_EXPENSE_SHARE = 0.3;

/** Age rounded down to tens; 0 = the age line is never used (under 20 or not given). */
export function ageDecade(age: number | undefined): number {
  const a = Number(age);
  return a >= 20 && a < 120 ? Math.floor(a / 10) * 10 : 0;
}

/** One roast line for a category (prototype pickM). */
export function pickRoast(cat: string, s: Pick<AppState, 'roast' | 'age'>, rand: () => number = Math.random): string {
  const noMercy = s.roast === 2;
  const dec = ageDecade(s.age);
  const all = (ROASTS[cat] || []).filter((x) => x.indexOf('{age}') < 0 || dec);
  const hard = all.filter((x) => x[0] === '!');
  const normal = all.filter((x) => x[0] !== '!');
  const src = noMercy && hard.length && (rand() < 0.7 || !normal.length) ? hard : normal;
  if (!src.length) return pick(ROASTS_ANY_CATEGORY, rand).replace('{c}', cat);
  return pick(src, rand).replace(/^!/, '').replace('{age}', String(dec));
}

/**
 * The message shown after an expense is logged. `s` already contains the expense.
 * Same order of checks as the prototype: special situations win over the category line,
 * the roast level is applied next, and a category limit warning wins over everything.
 */
export function expenseMessage(s: AppState, e: Expense, now: number, rand: () => number = Math.random): string {
  const bal = currentBalance(s);
  const everything = s.start + (s.added || 0);
  const big = e.amt > everything * BIG_EXPENSE_SHARE;
  let m: string;
  if (bal < 0) m = MSG_IN_THE_RED;
  else if (big) m = MSG_OVER_30;
  else m = pickRoast(e.cat, s, rand);
  if (bal >= 0 && !big && todayCount(s, now) === 3) m = MSG_THIRD_TODAY;
  const mi = monthlyIncome(s);
  if (mi > 0 && bal >= 0) {
    const rr = monthSpent(s, now) / mi;
    if (rr >= 1) m = MSG_WHOLE_INCOME;
    else if (rr >= 0.8) m = MSG_OVER_80;
  }
  const level = s.roast == null ? 1 : s.roast;
  if (bal >= 0 && level === 0) m = pick(GENTLE, rand);
  else if (bal >= 0 && level === 2) m += ' ' + pick(NO_MERCY_TAIL, rand);
  const limit = (s.lim || {})[e.cat];
  if (limit) {
    const spent = monthByCategory(s, 0, now).byCat[e.cat] || 0;
    if (spent > limit) m = msgOverLimit(e.cat, fmt(spent), fmt(limit));
    else if (spent >= limit * 0.8) m = msgNearLimit(e.cat, fmt(spent), fmt(limit));
  }
  return m;
}
