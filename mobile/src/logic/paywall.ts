// The plans screen and the screens after a purchase (docs/dizajn/placanje): every text that depends on the
// chosen plan, the trial and the store's answer. Prices, the trial length and the dates never come from here:
// prices from the store (RevenueCat offering), the trial's real start and end from the store's receipt.
// This file only turns them into words.

export type PlanKind = 'yearly' | 'monthly' | 'lifetime';
export type Store = 'App Store' | 'Google Play';

export interface PlanOption {
  kind: PlanKind;
  /** the store's product id */
  id: string;
  price: number;
  /** "$45", formatted by the store in the user's currency */
  priceString: string;
  /** yearly: the store's own "per month" price ("$3.75") */
  perMonthString: string | null;
  /** free trial this user can still get, in days (null: none, or already used) */
  trialDays: number | null;
}

/** What the store says about this phone's (or account's) plan: RevenueCat's "access" entitlement. */
export interface StoreEntitlement {
  active: boolean;
  /** in the free trial now */
  trial: boolean;
  /** when the trial or the paid period ends; null: lifetime */
  until: number | null;
  product: string;
  willRenew: boolean;
}

const DAY = 86400000;
/** The reminder before the trial ends: 2 days before (the plans screen promises it: "Day 5"). */
export const REMIND_BEFORE_DAYS = 2;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Nov 5" */
export const shortDate = (t: number) => {
  const d = new Date(t);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};
/** "Mar 12, 2027" */
export const longDate = (t: number) => `${shortDate(t)}, ${new Date(t).getFullYear()}`;

const UNIT: Record<PlanKind, string> = { yearly: 'year', monthly: 'month', lifetime: '' };
const NAME: Record<PlanKind, string> = { yearly: 'Yearly', monthly: 'Monthly', lifetime: 'Lifetime' };
export const planName = (k: PlanKind) => NAME[k];

/** Trial length from the store's intro offer (ISO period + count), in days; null if it is not a free trial. */
export function trialDaysOf(intro: { price: number; periodUnit: string; periodNumberOfUnits: number; cycles: number } | null): number | null {
  if (!intro || intro.price !== 0) return null;
  const per = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 }[intro.periodUnit.toUpperCase()];
  if (!per) return null;
  return per * intro.periodNumberOfUnits * Math.max(1, intro.cycles);
}

/** Which plan is picked first: yearly, as in the design (else the first one there is). */
export function defaultPlan(plans: PlanOption[]): PlanOption | null {
  return plans.find((p) => p.kind === 'yearly') ?? plans[0] ?? null;
}

/** The free trial the screen talks about (the subscriptions share it; null when there is none to get). */
export function offeredTrial(plans: PlanOption[]): number | null {
  return plans.find((p) => p.trialDays)?.trialDays ?? null;
}

/** "BEST VALUE · SAVE 46%": the yearly price against 12 months of the monthly one, from the store's prices. */
export function bestValue(plans: PlanOption[]): string {
  const y = plans.find((p) => p.kind === 'yearly');
  const m = plans.find((p) => p.kind === 'monthly');
  const save = y && m && m.price > 0 ? Math.floor((1 - y.price / (m.price * 12)) * 100) : 0;
  return save > 0 ? `BEST VALUE · SAVE ${save}%` : 'BEST VALUE';
}

/** One plan's card: name, the line under it, and the price (the price billed is the biggest text). */
export function planCard(p: PlanOption, plans: PlanOption[]): { name: string; sub: string; price: string; unit: string } {
  if (p.kind === 'yearly')
    return { name: 'Yearly', sub: p.perMonthString ? `That's ${p.perMonthString} a month` : 'Billed once a year', price: p.priceString, unit: ' / year' };
  if (p.kind === 'monthly') return { name: 'Monthly', sub: 'Cancel anytime', price: p.priceString, unit: ' / month' };
  return { name: 'Lifetime', sub: offeredTrial(plans) ? 'Pay once. No free week.' : 'Pay once. Yours for good.', price: p.priceString, unit: ' once' };
}

const weekOr = (days: number) => (days === 7 ? 'week' : `${days} days`);

/** The big button: always about the plan that is picked. */
export function ctaText(p: PlanOption): string {
  if (p.kind === 'lifetime') return `Buy for ${p.priceString}`;
  if (p.trialDays) return p.trialDays === 7 ? 'Start my free week' : `Start my ${p.trialDays}-day free trial`;
  return `Subscribe for ${p.priceString} a ${UNIT[p.kind]}`;
}

/** The line under the button: what happens and what it costs. */
export function ctaNote(p: PlanOption): string {
  if (p.kind === 'lifetime') return `One payment of ${p.priceString}. No subscription.`;
  if (p.trialDays) return `Free for ${p.trialDays} days, then ${p.priceString} a ${UNIT[p.kind]}. Cancel anytime.`;
  return `${p.priceString} a ${UNIT[p.kind]}, renews automatically. Cancel anytime.`;
}

/** The top of the plans screen: the free week, or (trial already used) the way back in. */
export function header(trialDays: number | null): { badge: string | null; title: string; sub: string } {
  if (trialDays)
    return {
      badge: `${trialDays} DAYS FREE`,
      title: trialDays === 7 ? 'Lock in for a week.\nOn us.' : `Lock in for ${trialDays} days.\nOn us.`,
      sub: 'Your bank account called. It wants you to lock in.',
    };
  return { badge: null, title: 'Your free week\nis over.', sub: 'Your spending is all still here. Pick a plan to keep locking in.' };
}

/** "How the free week works": today, the reminder, the day the plan starts (counted from now: the trial starts with the purchase). */
export function timeline(now: number, trialDays: number): { title: string; rows: { label: string; text: string }[] } {
  const remindDay = trialDays - REMIND_BEFORE_DAYS;
  return {
    title: `How the free ${weekOr(trialDays)} works`,
    rows: [
      { label: 'Today', text: 'Everything unlocked. Nothing charged.' },
      { label: `Day ${remindDay} · ${shortDate(now + remindDay * DAY)}`, text: 'We remind you that the trial is ending.' },
      { label: `Day ${trialDays} · ${shortDate(now + trialDays * DAY)}`, text: 'Your plan starts. Cancel before this and you pay nothing.' },
    ],
  };
}

/** The small print under the links. */
export function finePrint(trialDays: number | null): string {
  return (
    'Yearly and monthly plans renew automatically until you cancel in your App Store or Google Play settings.' +
    (trialDays ? ' Cancel at least 24 hours before the trial ends and you won\'t be charged.' : '')
  );
}

/** The day of the reminder: 2 days before the trial's real end. */
export const reminderDay = (until: number) => until - REMIND_BEFORE_DAYS * DAY;

/**
 * When the reminder goes off: 10:00 on that day (never at night; it is still at least 2 days before the plan
 * starts). null when there is nothing to remind of (not a trial, already cancelled) or that moment has passed.
 */
export function trialReminderAt(e: StoreEntitlement | null, now: number): number | null {
  if (!e || !e.active || !e.trial || !e.willRenew || e.until == null) return null;
  const d = new Date(reminderDay(e.until));
  d.setHours(10, 0, 0, 0);
  const at = d.getTime();
  return at > now ? at : null;
}

export function trialReminderText(until: number): { title: string; body: string } {
  return {
    title: 'Your free week ends in 2 days',
    body: `Your plan starts on ${shortDate(until)}. Cancel before then and you pay nothing.`,
  };
}

/** "You're locked in.": what was just bought. */
export function successView(e: StoreEntitlement, kind: PlanKind | null, price: string | null): {
  sub: string;
  rows: { label: string; value: string }[];
  reminder: number | null; // the reminder day to offer (trial only)
  cancelNote: boolean;
} {
  if (e.until == null)
    return { sub: "It's yours for good. Everything is unlocked.", rows: [{ label: 'Plan', value: 'Lifetime' }, ...(price ? [{ label: 'Paid', value: `${price} once` }] : [])], reminder: null, cancelNote: false };
  const then = price && kind && kind !== 'lifetime' ? `${price} a ${UNIT[kind]}` : null;
  if (e.trial)
    return {
      sub: 'Your free week starts now. Everything is unlocked.',
      rows: [{ label: 'Free until', value: shortDate(e.until) }, ...(then ? [{ label: 'Then', value: then }] : [])],
      reminder: reminderDay(e.until),
      cancelNote: true,
    };
  return {
    sub: 'Your plan is active. Everything is unlocked.',
    rows: [{ label: 'Plan', value: kind ? NAME[kind] : 'Active' }, { label: e.willRenew ? 'Renews' : 'Ends', value: longDate(e.until) }],
    reminder: null,
    cancelNote: true,
  };
}

/** "Welcome back.": the plan that was found. */
export function restoredRows(e: StoreEntitlement, kind: PlanKind | null): { label: string; value: string }[] {
  const plan = { label: 'Plan', value: e.until == null ? 'Lifetime' : kind ? NAME[kind] : 'Active' };
  if (e.until == null) return [plan];
  return [plan, { label: e.trial ? 'Free until' : e.willRenew ? 'Renews' : 'Ends', value: e.trial ? shortDate(e.until) : longDate(e.until) }];
}

export type FailReason = 'cancelled' | 'declined' | 'pending' | 'network';

/** The store's error (RevenueCat PURCHASES_ERROR_CODE) → which card "That didn't go through." shows. */
export function failReason(code: string | undefined, userCancelled?: boolean | null): FailReason {
  if (userCancelled || code === '1') return 'cancelled'; // PURCHASE_CANCELLED_ERROR
  if (code === '20') return 'pending'; // PAYMENT_PENDING_ERROR (Ask to Buy, slow card)
  if (code === '10' || code === '35' || code === '32') return 'network'; // NETWORK, OFFLINE_CONNECTION, PRODUCT_REQUEST_TIMED_OUT
  return 'declined';
}

export function failCard(r: FailReason, store: Store): { title: string; text: string; icon: 'alert' | 'card' | 'clock' | 'wifi' } {
  switch (r) {
    case 'cancelled':
      return { title: 'Changed your mind? Fair.', text: 'You closed the payment window before it finished. Your setup is saved, so you can pick up right where you left off.', icon: 'alert' };
    case 'declined':
      return { title: 'Your card said no. Rude.', text: `Check your payment method in ${store} settings.`, icon: 'card' };
    case 'pending':
      return { title: 'Waiting for approval.', text: "We'll unlock everything as soon as it's approved.", icon: 'clock' };
    case 'network':
      return { title: `Couldn't reach the ${store}.`, text: 'Check your connection and try again.', icon: 'wifi' };
  }
}

/** Restore found nothing on this store account. */
export function notFoundText(store: Store): { title: string; text: string } {
  const who = store === 'App Store' ? 'Apple ID' : 'Google account';
  return {
    title: 'No purchase found',
    text: `We couldn't find a Lock In plan on this ${who}. If you bought it with a different ${who}, sign in with that one in your phone's settings and try again.`,
  };
}
