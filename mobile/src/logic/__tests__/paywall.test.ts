import { isLocked } from '@/auth/access';
import { TEST_PLANS } from '@/auth/testStore';

import {
  bestValue,
  ctaNote,
  ctaText,
  defaultPlan,
  failCard,
  failReason,
  finePrint,
  header,
  offeredTrial,
  planCard,
  restoredRows,
  successView,
  timeline,
  trialDaysOf,
  trialReminderAt,
  trialReminderText,
  type PlanOption,
  type StoreEntitlement,
} from '../paywall';

const DAY = 86400000;
// Oct 29, 2026, 14:00 local: the design's day ("Day 5 · Nov 3", "Day 7 · Nov 5")
const NOW = new Date(2026, 9, 29, 14, 0).getTime();
const [YEAR, MONTH, LIFE] = TEST_PLANS;
const noTrial = TEST_PLANS.map((p) => ({ ...p, trialDays: null }));

describe('plans screen (06)', () => {
  test('yearly is picked first; with a trial the top says the free week', () => {
    expect(defaultPlan(TEST_PLANS)?.kind).toBe('yearly');
    expect(defaultPlan([MONTH, LIFE])?.kind).toBe('monthly');
    expect(offeredTrial(TEST_PLANS)).toBe(7);
    expect(header(7)).toEqual({ badge: '7 DAYS FREE', title: 'Lock in for a week.\nOn us.', sub: 'Your bank account called. It wants you to lock in.' });
  });

  test('cards: the billed price is the big one, the monthly figure is the small line', () => {
    expect(planCard(YEAR, TEST_PLANS)).toEqual({ name: 'Yearly', sub: "That's $3.75 a month", price: '$45', unit: ' / year' });
    expect(planCard(MONTH, TEST_PLANS)).toEqual({ name: 'Monthly', sub: 'Cancel anytime', price: '$6.99', unit: ' / month' });
    expect(planCard(LIFE, TEST_PLANS)).toEqual({ name: 'Lifetime', sub: 'Pay once. No free week.', price: '$69', unit: ' once' });
    expect(bestValue(TEST_PLANS)).toBe('BEST VALUE · SAVE 46%');
  });

  test('the saving is worked out from the store prices, never written in', () => {
    const eur = [
      { ...YEAR, price: 49.99, priceString: '€49.99' },
      { ...MONTH, price: 7.99, priceString: '€7.99' },
    ];
    expect(bestValue(eur)).toBe('BEST VALUE · SAVE 47%'); // 1 - 49.99 / 95.88
    expect(bestValue([YEAR])).toBe('BEST VALUE');
  });

  test('the button and the line under it follow the picked plan', () => {
    expect(ctaText(YEAR)).toBe('Start my free week');
    expect(ctaNote(YEAR)).toBe('Free for 7 days, then $45 a year. Cancel anytime.');
    expect(ctaText(MONTH)).toBe('Start my free week');
    expect(ctaNote(MONTH)).toBe('Free for 7 days, then $6.99 a month. Cancel anytime.');
    expect(ctaText(LIFE)).toBe('Buy for $69');
    expect(ctaNote(LIFE)).toBe('One payment of $69. No subscription.');
  });

  test('trial already used: no free week anywhere on the screen', () => {
    expect(offeredTrial(noTrial)).toBeNull();
    expect(header(null).badge).toBeNull();
    expect(ctaText(noTrial[0])).toBe('Subscribe for $45 a year');
    expect(ctaNote(noTrial[1])).toBe('$6.99 a month, renews automatically. Cancel anytime.');
    expect(planCard(noTrial[2], noTrial).sub).toBe('Pay once. Yours for good.');
    expect(finePrint(null)).not.toMatch(/trial/);
    expect(finePrint(7)).toMatch(/Cancel at least 24 hours before the trial ends/);
  });

  test('how the free week works: dates from today, reminder 2 days before the end', () => {
    expect(timeline(NOW, 7)).toEqual({
      title: 'How the free week works',
      rows: [
        { label: 'Today', text: 'Everything unlocked. Nothing charged.' },
        { label: 'Day 5 · Nov 3', text: 'We remind you that the trial is ending.' },
        { label: 'Day 7 · Nov 5', text: 'Your plan starts. Cancel before this and you pay nothing.' },
      ],
    });
    expect(timeline(NOW, 14).rows[2].label).toBe('Day 14 · Nov 12');
  });

  test('trial length comes from the store intro offer (free ones only)', () => {
    expect(trialDaysOf({ price: 0, periodUnit: 'WEEK', periodNumberOfUnits: 1, cycles: 1 })).toBe(7);
    expect(trialDaysOf({ price: 0, periodUnit: 'DAY', periodNumberOfUnits: 3, cycles: 1 })).toBe(3);
    expect(trialDaysOf({ price: 0.99, periodUnit: 'WEEK', periodNumberOfUnits: 1, cycles: 1 })).toBeNull();
    expect(trialDaysOf(null)).toBeNull();
  });
});

const trialEnt = (start: number): StoreEntitlement => ({ active: true, trial: true, until: start + 7 * DAY, product: 'lockin_yearly', willRenew: true });

describe('after the purchase (09) and the reminder', () => {
  test('dates come from the real trial end, not from when the screen was opened', () => {
    const boughtLater = NOW + 3 * DAY; // the plans screen was open since Oct 29, bought Nov 1
    const v = successView(trialEnt(boughtLater), 'yearly', '$45');
    expect(v.rows).toEqual([
      { label: 'Free until', value: 'Nov 8' },
      { label: 'Then', value: '$45 a year' },
    ]);
    expect(new Date(v.reminder!).getDate()).toBe(6);
    expect(v.sub).toBe('Your free week starts now. Everything is unlocked.');
  });

  test('the reminder goes off at 10:00 on day 5, only for a trial that will renew', () => {
    const at = trialReminderAt(trialEnt(NOW), NOW)!;
    const d = new Date(at);
    expect([d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([10, 3, 10, 0]);
    expect(trialReminderAt({ ...trialEnt(NOW), willRenew: false }, NOW)).toBeNull(); // already cancelled
    expect(trialReminderAt({ ...trialEnt(NOW), trial: false }, NOW)).toBeNull();
    expect(trialReminderAt(trialEnt(NOW), at + 1)).toBeNull(); // passed
    expect(trialReminderAt(null, NOW)).toBeNull();
    expect(trialReminderText(NOW + 7 * DAY).body).toBe('Your plan starts on Nov 5. Cancel before then and you pay nothing.');
  });

  test('lifetime and a paid plan: no trial rows and no reminder', () => {
    const life = successView({ active: true, trial: false, until: null, product: 'lockin_lifetime', willRenew: false }, 'lifetime', '$69');
    expect(life.rows).toEqual([
      { label: 'Plan', value: 'Lifetime' },
      { label: 'Paid', value: '$69 once' },
    ]);
    expect(life.reminder).toBeNull();
    expect(life.cancelNote).toBe(false);
    const paid = successView({ active: true, trial: false, until: new Date(2027, 2, 12).getTime(), product: 'y', willRenew: true }, 'yearly', '$45');
    expect(paid.rows).toEqual([
      { label: 'Plan', value: 'Yearly' },
      { label: 'Renews', value: 'Mar 12, 2027' },
    ]);
  });

  test('restore (11): plan and renewal date', () => {
    expect(restoredRows({ active: true, trial: false, until: new Date(2027, 2, 12).getTime(), product: 'y', willRenew: true }, 'yearly')).toEqual([
      { label: 'Plan', value: 'Yearly' },
      { label: 'Renews', value: 'Mar 12, 2027' },
    ]);
    expect(restoredRows({ active: true, trial: false, until: null, product: 'l', willRenew: false }, 'lifetime')).toEqual([{ label: 'Plan', value: 'Lifetime' }]);
  });
});

describe('it did not go through (10)', () => {
  test('store errors map to the right card', () => {
    expect(failReason('1')).toBe('cancelled');
    expect(failReason(undefined, true)).toBe('cancelled');
    expect(failReason('20')).toBe('pending');
    expect(failReason('10')).toBe('network');
    expect(failReason('35')).toBe('network');
    expect(failReason('2')).toBe('declined');
    expect(failReason('3')).toBe('declined');
  });

  test('card texts, exactly as in the design', () => {
    expect(failCard('cancelled', 'App Store')).toMatchObject({
      title: 'Changed your mind? Fair.',
      text: 'You closed the payment window before it finished. Your setup is saved, so you can pick up right where you left off.',
    });
    expect(failCard('declined', 'App Store')).toMatchObject({ title: 'Your card said no. Rude.', text: 'Check your payment method in App Store settings.' });
    expect(failCard('declined', 'Google Play').text).toBe('Check your payment method in Google Play settings.');
    expect(failCard('pending', 'App Store')).toMatchObject({ title: 'Waiting for approval.', text: "We'll unlock everything as soon as it's approved." });
  });
});

describe('who is locked out', () => {
  const none = { kind: 'none' } as const;
  const active = { kind: 'active', until: null } as const;
  const out = { kind: 'signed-out' } as const;
  test('signed in: the server (and RevenueCat) decide', () => {
    expect(isLocked(true, none, null, false)).toBe(true);
    expect(isLocked(true, active, null, false)).toBe(false);
    expect(isLocked(true, { kind: 'unknown' }, null, true)).toBe(false); // offline: not locked
    expect(isLocked(true, { kind: 'checking' }, null, true)).toBe(false);
  });
  test('no account: the store decides; without a store nobody is locked', () => {
    expect(isLocked(false, out, { active: false }, true)).toBe(true);
    expect(isLocked(false, out, { active: true }, true)).toBe(false);
    expect(isLocked(false, out, null, true)).toBe(false); // could not ask
    expect(isLocked(false, out, { active: false }, false)).toBe(false); // no RevenueCat keys in this build
  });
});

test('test plans are only the design prices, and the screen never makes up a price', () => {
  const p: PlanOption = { kind: 'yearly', id: 'x', price: 30, priceString: '£30', perMonthString: '£2.50', trialDays: 7 };
  expect(ctaNote(p)).toBe('Free for 7 days, then £30 a year. Cancel anytime.');
  expect(planCard(p, [p]).sub).toBe("That's £2.50 a month");
});
