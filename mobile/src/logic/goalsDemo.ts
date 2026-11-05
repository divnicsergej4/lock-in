// The shared goal in the demo (Andrija's design): "Summer trip to Greece" with Sergej (you), Marko and Ana,
// 520 + 400 + 320 of 2,000 €, due May 1, a 3-week squad streak, and Ana has not put anything in this week.
// Dates are relative to now, so the demo always looks the same. Nothing of it goes to the server.

import { weekStart, type Contribution, type Snapshot } from './goals';

const H = 3600e3;
const D = 24 * H;

export const DEMO_ME = 'demo-me';
export const DEMO_GOAL = 'demo-goal';

export function demoSnapshot(now: number): Snapshot {
  const ws = weekStart(now);
  const week = (n: number, day = 2) => ws - n * 7 * D + day * D + 18 * H; // n weeks back, on a Wednesday evening
  const iso = (t: number) => new Date(t).toISOString();
  const M = 'demo-marko';
  const A = 'demo-ana';
  const created = week(8, 0);
  let k = 0;
  const pay = (user_id: string, amount: number, t: number): Contribution => ({
    id: 'demo-c' + k++, goal_id: DEMO_GOAL, user_id, amount, note: null, created_at: iso(t),
  });
  const mine = Math.max(ws, Math.min(now - 3 * H, ws + 10 * H)); // this Monday morning (or just now)
  const next = new Date(now);
  const may1 = new Date(next.getFullYear() + (next.getMonth() >= 4 ? 1 : 0), 4, 1);
  const pad = (n: number) => (n < 10 ? '0' : '') + n;
  return {
    me: DEMO_ME,
    names: { [DEMO_ME]: 'Sergej', [M]: 'Marko', [A]: 'Ana', 'demo-luka': 'Luka' },
    friends: [M, A, 'demo-luka'],
    requestsIn: [],
    requestsOut: [],
    goals: [{
      id: DEMO_GOAL,
      name: 'Summer trip to Greece',
      target: 2000,
      currency: 'EUR',
      deadline: may1.getFullYear() + '-' + pad(may1.getMonth() + 1) + '-01',
      created_at: iso(created),
    }],
    members: [
      { goal_id: DEMO_GOAL, user_id: DEMO_ME, joined_at: iso(created), added_by: DEMO_ME },
      { goal_id: DEMO_GOAL, user_id: M, joined_at: iso(created + 60e3), added_by: DEMO_ME },
      { goal_id: DEMO_GOAL, user_id: A, joined_at: iso(week(3, 0) - 6 * H), added_by: DEMO_ME },
    ],
    contributions: [
      pay(M, 50, week(6)),
      pay(DEMO_ME, 100, week(4)), // week 4: Marko missed it, so the streak starts after
      pay(DEMO_ME, 100, week(3)), pay(M, 100, week(3, 3)), pay(A, 120, week(3, 4)),
      pay(DEMO_ME, 100, week(2)), pay(M, 100, week(2, 3)), pay(A, 100, week(2, 4)),
      pay(DEMO_ME, 100, week(1)), pay(A, 100, week(1, 1)), pay(M, 100, week(1, 3)),
      pay(DEMO_ME, 120, mine),
      pay(M, 50, Math.max(ws, now - 2 * H)),
    ].filter((c) => Date.parse(c.created_at) <= now),
    nudges: [],
  };
}
