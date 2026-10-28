import { assertEquals } from 'jsr:@std/assert@1';
import { type GoalEvent, goalText, type Group, handle, money, type PushMessage, type Ticket } from './handler.ts';

const SECRET = 'Bearer ' + 'x'.repeat(40);
const paid = (name: string | null, amount: number): GoalEvent => ({ kind: 'paid', actor: 'a', actor_name: name, amount });
const ev = (kind: 'joined' | 'left', name: string | null): GoalEvent => ({ kind, actor: 'a', actor_name: name, amount: null });
const group = (events: GoalEvent[], tokens = ['ExponentPushToken[aaaaaaaa]'], ids = [1]): Group =>
  ({ ids, recipient: 'r', goal_id: 'g1', goal_name: 'Summer trip', currency: 'EUR', events, tokens });

function setup(groups: Group[], send: (m: PushMessage[]) => Ticket[] | null = (m) => m.map(() => ({ status: 'ok' }))) {
  const sentBatches: PushMessage[][] = [];
  const released: number[][] = [];
  const dropped: string[][] = [];
  return {
    sentBatches, released, dropped,
    deps: {
      expectedAuth: SECRET,
      claim: async () => groups,
      send: async (m: PushMessage[]) => { sentBatches.push(m); return send(m); },
      release: async (ids: number[]) => { released.push(ids); },
      dropTokens: async (t: string[]) => { dropped.push(t); },
    },
  };
}
const post = (auth = SECRET) => new Request('https://x/functions/v1/send-goal-push', { method: 'POST', headers: { authorization: auth } });

Deno.test('one thing happened: the exact sentence', () => {
  assertEquals(goalText(group([paid('Marko', 50)])), 'Marko added €50 to Summer trip');
  assertEquals(goalText(group([paid('Marko', 12.5)])), 'Marko added €12.50 to Summer trip');
  assertEquals(goalText(group([ev('joined', 'Ana')])), 'Ana joined Summer trip');
  assertEquals(goalText(group([ev('left', 'Eva')])), 'Eva left Summer trip');
  assertEquals(goalText(group([ev('left', null)])), 'Someone left Summer trip');
});

Deno.test('many payments in 10 minutes become one notification', () => {
  const events = Array.from({ length: 20 }, () => paid('Marko', 5));
  assertEquals(goalText(group(events)), 'Marko added €100 to Summer trip (20 payments)');
  assertEquals(goalText(group([paid('Marko', 100), paid('Ana', 20), paid('Marko', 20), ev('joined', 'Iva')])),
    'Summer trip: Marko added €120 (2 payments), Ana added €20, Iva joined');
  assertEquals(goalText(group([ev('joined', 'A'), ev('joined', 'B'), ev('left', 'C'), ev('left', 'D'), paid('E', 1)])),
    'Summer trip: A joined, B joined, C left and 2 more');
});

Deno.test('nudges, pins and unlocking (0006)', () => {
  const e = (kind: GoalEvent['kind'], name: string | null, pct: number | null = null): GoalEvent => ({ kind, actor: 'a', actor_name: name, amount: null, pct });
  assertEquals(goalText(group([e('nudged', 'Luka')])), 'Luka nudged you: Summer trip is waiting on you 👀');
  assertEquals(goalText(group([e('nudged', null)])), 'Someone nudged you: Summer trip is waiting on you 👀');
  assertEquals(goalText(group([e('pin', null, 50)])), 'Summer trip: the 50% pin clicked');
  assertEquals(goalText(group([e('unlocked', null)])), 'Summer trip is unlocked 🔓 Now book it before anyone spends it.');
  assertEquals(goalText(group([paid('Marko', 50), e('pin', null, 50), e('nudged', 'Luka')])),
    'Summer trip: Marko added €50, the 50% pin clicked, Luka nudged you');
  assertEquals(goalText(group([paid('Marko', 50), e('pin', null, 75), e('unlocked', null)])),
    'Summer trip: Marko added €50, the 75% pin clicked, unlocked');
});

Deno.test('names cannot become links or markup; other currencies', () => {
  assertEquals(goalText(group([paid('<a href="https://evil.com">x</a>', 5)])).includes('evil.com'), false);
  assertEquals(goalText(group([ev('joined', 'www.evil.com')])), 'www evil com joined Summer trip');
  assertEquals(money(1200, 'RSD'), 'RSD 1,200'); // non-breaking space: the code never ends up alone on a line
  assertEquals(money(9.99, 'USD'), '$9.99');
});

Deno.test('wrong or missing secret: 401 and nothing is claimed or sent', async () => {
  const t = setup([group([paid('Marko', 50)])]);
  assertEquals((await handle(post('Bearer nope'), t.deps)).status, 401);
  assertEquals((await handle(post(''), t.deps)).status, 401);
  assertEquals((await handle(post(), { ...t.deps, expectedAuth: 'short' })).status, 500);
  assertEquals((await handle(new Request('https://x', { headers: { authorization: SECRET } }), t.deps)).status, 405);
  assertEquals(t.sentBatches.length, 0);
});

Deno.test('sends one message per phone, in requests of at most 100', async () => {
  const groups = Array.from({ length: 150 }, (_, i) => group([paid('Marko', 50)], [`ExponentPushToken[t${i}aaaaaa]`], [i]));
  const t = setup(groups);
  const res = await handle(post(), t.deps);
  assertEquals(res.status, 200);
  assertEquals(t.sentBatches.map((b) => b.length), [100, 50]);
  const m = t.sentBatches[0][0];
  assertEquals([m.title, m.body, m.channelId, m.data.url], ['Lock In', 'Marko added €50 to Summer trip', 'shared-goals', 'lockin://savings']);
  assertEquals((await res.json()).sent, 150);
});

Deno.test('Expo down: the events go back for the next run', async () => {
  const t = setup([group([paid('Marko', 50)], undefined, [7, 8])], () => null);
  const res = await handle(post(), t.deps);
  assertEquals(res.status, 502);
  assertEquals(t.released, [[7, 8]]);
});

Deno.test('a phone that no longer exists is dropped', async () => {
  const t = setup([group([paid('Marko', 50)], ['ExponentPushToken[gonegone]', 'ExponentPushToken[herehere]'])],
    (m) => m.map((x) => (x.to.includes('gone') ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok' })));
  await handle(post(), t.deps);
  assertEquals(t.dropped, [['ExponentPushToken[gonegone]']]);
  assertEquals(t.released.length, 0);
});
