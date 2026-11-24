// The guided tour's 38 steps (prototype tutSteps), with the prototype's English texts. A step lights up
// its targets (the prototype's selectors, by name: see registry.ts) on its tab; a step with `act` waits
// until the user has done it (checked every 200 ms), the others have a Next button.

import type { AppState } from '@/logic/types';

import type { tourBus } from './registry';

export interface TourCtx {
  s: AppState; // the app's data now
  tab: number; // the tab in front (0 Home, 1 Spending, 2 Savings, 3 More)
  v: Record<string, unknown>; // what a step noted when it started
  bus: typeof tourBus;
  has: (id: string) => boolean; // whether a target is on screen
}

export interface TourStep {
  c: string; // the text
  btn?: string; // the button's label (default Next)
  end?: boolean; // the last step
  tab?: number; // the tab it is on
  t?: string[]; // what it lights up
  pos?: 'up'; // the bubble prefers to sit above
  keep?: boolean; // keep the last target above the tab bar while it grows (the envelope card)
  sheet?: boolean; // a part of New entry: scrolled to the middle of the screen
  kb?: boolean; // the user types here (the keyboard is put away when a step without it comes)
  fields?: string[]; // the fields it types into, in order (the keyboard moves on to the next empty one)
  skip?: (x: TourCtx) => boolean;
  pre?: (x: TourCtx) => void;
  init?: (x: TourCtx) => void;
  act?: (x: TourCtx) => boolean;
}

export const NICE = 'Nice. ';
export const PAUSE_TEXT = 'Close this window first, then we carry on with the tour.';
export const TOUR_DONE = 'Tour finished. Practice entries were deleted.';
export const TOUR_SKIPPED = 'You can start the tour any time in More, Settings.';

export const STEPS: TourStep[] = [
  { c: 'Let’s walk through the app together. You’ll try everything yourself, step by step.', btn: 'Start' },
  { c: 'Don’t worry: everything you enter during the tour is practice and gets deleted at the end.' },
  { tab: 0, t: ['bal-card'], c: 'This is your free money. Every expense you log comes straight off this number.' },
  { tab: 0, t: ['streak'], c: 'This is your flame. It grows every day you log your spending, and if you skip a day it goes out.' },
  { tab: 0, t: ['chal'], skip: (x) => !x.has('chal'), c: 'Challenge of the week: try 7 days without the category that eats most of your money.' },
  {
    tab: 0,
    t: ['mode'],
    sheet: true,
    c: 'Here you choose whether you log an expense or income. Keep Expense for now.',
    pre: (x) => x.bus.expenseMode?.(),
  },
  { tab: 0, t: ['e-amt'], pos: 'up', sheet: true, kb: true, fields: ['e-amt'], c: 'Type an amount, for example 350.', act: (x) => parseFloat(x.bus.amt.replace(/,/g, '')) > 0 },
  { tab: 0, t: ['e-note'], pos: 'up', sheet: true, kb: true, fields: ['e-note'], c: 'Now write what it was for, for example coffee with a friend.', act: (x) => x.bus.note.trim().length >= 2 },
  {
    tab: 0,
    t: ['chips'],
    pos: 'up',
    sheet: true,
    c: 'Pick the category this expense belongs to.',
    init: (x) => void (x.bus.chip = 0),
    act: (x) => !!x.bus.chip,
  },
  {
    tab: 0,
    t: ['more'],
    sheet: true,
    c: 'Extra options live here: your own category, a monthly subscription and paying from an envelope. Open them.',
    act: (x) => x.bus.more,
  },
  {
    tab: 0,
    t: ['e-go'],
    pos: 'up',
    sheet: true,
    c: 'Now tap Log expense.',
    init: (x) => void (x.v.ne = x.s.exp.length),
    act: (x) => x.s.exp.length > (x.v.ne as number),
  },
  { tab: 0, t: ['bal-card'], c: 'See? Your free money dropped right away, and today’s flame is lit.' },
  { tab: 0, t: ['buy'], c: 'Can I afford it? Tap to open.', act: (x) => !!(x.s.fold || {}).buy },
  {
    tab: 0,
    t: ['buy'],
    kb: true,
    fields: ['w-n', 'w-p'],
    c: 'Type what you want and what it costs, then tap Check.',
    init: (x) => void (x.v.wo = x.bus.wout),
    act: (x) => x.bus.wout !== x.v.wo && x.bus.wout.trim().length > 0,
  },
  { tab: 0, t: ['w-out'], c: 'Here you see whether you can afford it and how much it pushes back your goals.' },
  { t: ['nav1'], pos: 'up', c: 'Let’s go to Spending. Tap it below.', act: (x) => x.tab === 1 },
  { tab: 1, t: ['vzc'], c: 'These are your charts. The ring shows where most of your money goes this month.' },
  { tab: 1, t: ['vzc'], c: 'Swipe the window to the left to see the next chart.', act: (x) => x.bus.holoAct === 1 },
  {
    tab: 1,
    t: ['ln', 'ln-tip'],
    c: 'Hold your finger on the chart and slide it to see each day.',
    init: (x) => void (x.v.tip = x.bus.lnDay),
    act: (x) => x.bus.lnDay !== x.v.tip,
  },
  {
    tab: 1,
    t: ['vzc'],
    c: 'Swipe left once more and tap any day in the calendar.',
    init: (x) => x.bus.clearCalDay?.(),
    act: (x) => x.bus.holoAct === 2 && x.bus.calDay.trim().length > 0,
  },
  { tab: 1, t: ['tx-h2', 'flt', 'hist-li'], c: 'All changes: every entry is here. The pencil edits an entry, the cross deletes it.' },
  { tab: 1, t: ['lim'], c: 'Limits: set the most you want to spend on a category each month.' },
  { tab: 1, t: ['rec'], c: 'Recurring entries: rent, bills or salary get logged by themselves every month.' },
  { tab: 1, t: ['subs'], c: 'Subscriptions: all your monthly subscriptions in one place, and what they cost you in total.' },
  { tab: 1, t: ['pat'], c: 'Spotted: here the app shows you habits it notices in your spending.' },
  { t: ['nav2'], pos: 'up', c: 'Now Savings.', act: (x) => x.tab === 2 },
  { tab: 2, t: ['team'], c: 'Shared goal: save together with friends or your partner towards one goal.' },
  { tab: 2, t: ['env-h2', 'env-p', 'envf'], c: 'Envelopes: sort your money by purpose, like in a drawer. Free to assign is money not in any envelope yet.' },
  {
    tab: 2,
    t: ['env-new'],
    kb: true,
    fields: ['env-name'],
    c: 'Make your own envelope: open New envelope, type a name and tap Create envelope.',
    init: (x) => void (x.v.nv = (x.s.env || []).length),
    act: (x) => (x.s.env || []).length > (x.v.nv as number),
  },
  {
    tab: 2,
    keep: true,
    t: ['drw', 'fopen'],
    kb: true,
    fields: ['env-add'],
    skip: (x) => !x.bus.fopen,
    c: 'The envelope is out of the drawer. Put some money in: Add, type an amount, then OK.',
    init: (x) => {
      const E = x.s.env || [];
      x.v.eid = E.length ? E[E.length - 1].id : '';
    },
    act: (x) => {
      const e = (x.s.env || []).find((y) => y.id === x.v.eid);
      return !!e && e.b > 0;
    },
  },
  {
    tab: 2,
    t: ['drw', 'dfront'],
    skip: (x) => !x.has('dfront') || x.s.drw === 'c',
    c: 'Push the drawer handle up, or just tap it, to close the drawer.',
    act: (x) => x.s.drw === 'c',
  },
  { tab: 2, t: ['env-dist'], c: 'With this button you spread your free money over several envelopes at once.' },
  { tab: 2, t: ['plan'], c: 'Monthly plan: enter your planned costs and how much you want to save, and see how much you can spend.' },
  { t: ['nav3'], pos: 'up', c: 'And finally, More.', act: (x) => x.tab === 3 },
  { tab: 3, t: ['rep'], c: 'Monthly report: the whole month in one place, like a receipt.' },
  { tab: 3, t: ['bk'], c: 'Backup: save your data before you change phones or delete the app.' },
  { tab: 3, t: ['set'], c: 'Settings: salary, second currency, theme and reminder. You can also restart this tour from here.' },
  { c: 'That’s it. I’m deleting the practice entries now, so start logging your real spending.', btn: 'Finish', end: true },
];
