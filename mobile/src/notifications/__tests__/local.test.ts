// Planning the local notifications on the phone, with expo-notifications replaced by a stand-in that keeps
// what was scheduled (the real one needs a phone).
jest.mock('../expoLocal', () => {
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

import * as Notifications from '../expoLocal';

import { NUDGES, STREAK_NUDGE } from '@/logic/nudges';
import { REMINDER_TITLE } from '@/logic/settings';
import { initialState, type AppState } from '@/logic/types';

import { askPermission, hasPermission, syncLocalNotifications } from '../local';

const mock = Notifications as unknown as { __planned: Map<string, { content: { title?: string; body: string }; trigger: { date: number } }>; __perm: { granted: boolean; status: string } };
const NOW = new Date(2026, 9, 25, 10, 30).getTime();
const state = (over: Partial<AppState>): AppState => ({ ...initialState, streakNag: !!over.nag?.on, ...over });
const ids = () => [...mock.__planned.keys()].sort();

beforeEach(() => {
  mock.__planned.clear();
  mock.__perm.granted = false;
  mock.__perm.status = 'undetermined';
  jest.clearAllMocks();
});

test('nothing is planned and nothing is asked while the permission is not given', async () => {
  await syncLocalNotifications(state({ rem: { on: true, time: '20:00' }, nag: { on: true } }), NOW);
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
  await syncLocalNotifications(state({ rem: { on: true, time: '20:00' }, nag: { on: true } }), NOW);
  const all = ids();
  expect(all.filter((i) => i.startsWith('rem-')).length).toBe(10);
  expect(all.filter((i) => i.startsWith('nudge-')).length).toBe(29); // at 10:30 today's 9:00 is gone: 15 + 20, then 9 days × 3
  expect(all.length).toBeLessThanOrEqual(64);
  const rem = mock.__planned.get(all.find((i) => i.startsWith('rem-'))!)!;
  expect(rem.content.title).toBe(REMINDER_TITLE);
  expect([...mock.__planned.values()].every((r) => r.trigger.date > NOW)).toBe(true);
});

test('Andrija’s texts go out as they are; 20:00 is the streak one; nothing at night', async () => {
  mock.__perm.granted = true;
  await syncLocalNotifications(state({ nag: { on: true } }), NOW);
  for (const r of mock.__planned.values()) {
    const h = new Date(r.trigger.date).getHours();
    expect(h >= 9 && h < 23).toBe(true);
    if (h === 20) expect(r.content.body).toBe(STREAK_NUDGE);
    else expect(NUDGES).toContain(r.content.body);
  }
});

test('logging something today drops the rest of today’s nudges and plans one at 21:00', async () => {
  mock.__perm.granted = true;
  await syncLocalNotifications(state({ nag: { on: true } }), NOW);
  await syncLocalNotifications(state({ nag: { on: true }, exp: [{ amt: 3, cat: 'Coffee', t: NOW - 1000, note: 'x' }] }), NOW);
  const today = [...mock.__planned.values()].filter((r) => new Date(r.trigger.date).getDate() === 25);
  expect(today.map((r) => new Date(r.trigger.date).getHours())).toEqual([21]);
});

test('planning again replaces ours (no doubles), and turning off removes them', async () => {
  mock.__perm.granted = true;
  mock.__planned.set('someone-else', { content: { body: 'x' }, trigger: { date: NOW + 1 } });
  const s = state({ rem: { on: true, time: '20:00' }, nag: { on: true } });
  await syncLocalNotifications(s, NOW);
  const first = mock.__planned.size;
  await syncLocalNotifications(s, NOW);
  expect(mock.__planned.size).toBe(first);
  await syncLocalNotifications(state({ rem: { on: false, time: '20:00' }, nag: { on: false } }), NOW);
  expect(ids()).toEqual(['someone-else']); // only ours are touched
});

test('logged something today: no reminder today', async () => {
  mock.__perm.granted = true;
  await syncLocalNotifications(state({ rem: { on: true, time: '20:00' }, exp: [{ amt: 3, cat: 'Coffee', t: NOW - 1000, note: 'x' }] }), NOW);
  const first = Math.min(...[...mock.__planned.values()].map((r) => r.trigger.date));
  expect(new Date(first).getDate()).toBe(26);
});
