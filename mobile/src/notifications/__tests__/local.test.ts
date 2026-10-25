// Planning the local notifications on the phone, with expo-notifications replaced by a stand-in that keeps
// what was scheduled (the real one needs a phone).
jest.mock('expo-notifications', () => {
  const planned = new Map<string, unknown>();
  const perm = { granted: false, status: 'undetermined' };
  return {
    __planned: planned,
    __perm: perm,
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(async () => null),
    getPermissionsAsync: jest.fn(async () => ({ ...perm })),
    requestPermissionsAsync: jest.fn(async () => {
      perm.granted = true;
      perm.status = 'granted';
      return { ...perm };
    }),
    getAllScheduledNotificationsAsync: jest.fn(async () => [...planned.entries()].map(([identifier, r]) => ({ identifier, ...(r as object) }))),
    cancelScheduledNotificationAsync: jest.fn(async (id: string) => void planned.delete(id)),
    scheduleNotificationAsync: jest.fn(async (r: { identifier: string }) => {
      planned.set(r.identifier, r);
      return r.identifier;
    }),
    SchedulableTriggerInputTypes: { DATE: 'date' },
    AndroidImportance: { DEFAULT: 3, HIGH: 4 },
    IosAuthorizationStatus: { PROVISIONAL: 3 },
  };
});

import * as Notifications from 'expo-notifications';

import { NUDGES, NUDGES_GENTLE } from '@/logic/nudges';
import { REMINDER_TITLE } from '@/logic/settings';
import { initialState, type AppState } from '@/logic/types';

import { askPermission, hasPermission, syncLocalNotifications } from '../local';

const mock = Notifications as unknown as { __planned: Map<string, { content: { title?: string; body: string }; trigger: { date: number } }>; __perm: { granted: boolean; status: string } };
const NOW = new Date(2026, 9, 25, 10, 30).getTime();
const state = (over: Partial<AppState>): AppState => ({ ...initialState, ...over });
const ids = () => [...mock.__planned.keys()].sort();

beforeEach(() => {
  mock.__planned.clear();
  mock.__perm.granted = false;
  mock.__perm.status = 'undetermined';
  jest.clearAllMocks();
});

test('nothing is planned and nothing is asked while the permission is not given', async () => {
  await syncLocalNotifications(state({ rem: { on: true, time: '20:00' }, nag: { on: true, every: 6 } }), NOW);
  expect(mock.__planned.size).toBe(0);
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled(); // never at start-up
  expect(await hasPermission()).toBe(false);
});

test('the permission is asked only through askPermission (a tap on a switch)', async () => {
  expect(await askPermission()).toBe(true);
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(await askPermission()).toBe(true);
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1); // already granted: not asked again
});

test('reminder and nudges are planned, within the iOS limit of 64', async () => {
  mock.__perm.granted = true;
  await syncLocalNotifications(state({ rem: { on: true, time: '20:00' }, nag: { on: true, every: 6 }, roast: 0 }), NOW);
  const all = ids();
  expect(all.filter((i) => i.startsWith('rem-')).length).toBe(10);
  expect(all.filter((i) => i.startsWith('nudge-')).length).toBe(29);
  expect(all.length).toBeLessThanOrEqual(64);
  const rem = mock.__planned.get(all.find((i) => i.startsWith('rem-'))!)!;
  expect(rem.content.title).toBe(REMINDER_TITLE);
  const nudge = mock.__planned.get(all.find((i) => i.startsWith('nudge-'))!)!;
  expect(NUDGES_GENTLE).toContain(nudge.content.body); // Gentle roast level
  expect([...mock.__planned.values()].every((r) => r.trigger.date > NOW)).toBe(true);
});

test('No mercy uses its texts; nothing at night', async () => {
  mock.__perm.granted = true;
  await syncLocalNotifications(state({ nag: { on: true, every: 6 }, roast: 2 }), NOW);
  const bodies = [...mock.__planned.values()].map((r) => r.content.body);
  const allTexts = NUDGES.map((x) => x.replace(/^!/, ''));
  expect(bodies.every((b) => allTexts.includes(b))).toBe(true);
  expect([...mock.__planned.values()].every((r) => { const h = new Date(r.trigger.date).getHours(); return h >= 9 && h < 23; })).toBe(true);
});

test('planning again replaces ours (no doubles), and turning off removes them', async () => {
  mock.__perm.granted = true;
  mock.__planned.set('someone-else', { content: { body: 'x' }, trigger: { date: NOW + 1 } });
  const s = state({ rem: { on: true, time: '20:00' }, nag: { on: true, every: 12 } });
  await syncLocalNotifications(s, NOW);
  const first = mock.__planned.size;
  await syncLocalNotifications(s, NOW);
  expect(mock.__planned.size).toBe(first);
  await syncLocalNotifications(state({ rem: { on: false, time: '20:00' }, nag: { on: false, every: 12 } }), NOW);
  expect(ids()).toEqual(['someone-else']); // only ours are touched
});

test('logged something today: no reminder today', async () => {
  mock.__perm.granted = true;
  await syncLocalNotifications(state({ rem: { on: true, time: '20:00' }, exp: [{ amt: 3, cat: 'Coffee', t: NOW - 1000, note: 'x' }] }), NOW);
  const first = Math.min(...[...mock.__planned.values()].map((r) => r.trigger.date));
  expect(new Date(first).getDate()).toBe(26);
});
