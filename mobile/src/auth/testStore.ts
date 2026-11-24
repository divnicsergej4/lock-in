// Only for development while there is no store yet (no RevenueCat keys, __DEV__): the plans screen shows these
// plans with a "TEST PRICES" badge and lets you pick what the store answers, so every screen after the button
// can be seen on a phone. Nothing here unlocks anything: access still comes only from the server and RevenueCat.
// The real prices come from RevenueCat; these are the trial prices from the design (docs/dizajn/placanje).

import type { PlanKind, PlanOption, StoreEntitlement } from '@/logic/paywall';

export const TEST_PLANS: PlanOption[] = [
  { kind: 'yearly', id: 'test_yearly', price: 45, priceString: '$45', perMonthString: '$3.75', trialDays: 7 },
  { kind: 'monthly', id: 'test_monthly', price: 6.99, priceString: '$6.99', perMonthString: '$6.99', trialDays: 7 },
  { kind: 'lifetime', id: 'test_lifetime', price: 69, priceString: '$69', perMonthString: null, trialDays: null },
];

const DAY = 86400000;

/** What a store would answer for a purchase of `kind` made now. */
export function testEntitlement(kind: PlanKind, now: number): StoreEntitlement {
  if (kind === 'lifetime') return { active: true, trial: false, until: null, product: 'test_lifetime', willRenew: false };
  return { active: true, trial: true, until: now + 7 * DAY, product: `test_${kind}`, willRenew: true };
}
