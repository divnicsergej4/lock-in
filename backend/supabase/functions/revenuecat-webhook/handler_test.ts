import { assertEquals } from 'jsr:@std/assert@1';
import { handle, sameSecret, type StoreUpdate } from './handler.ts';

const SECRET = 'Bearer ' + 'x'.repeat(40);
const USER = '6f1c2a3b-1234-4abc-8def-0123456789ab';

function setup(found = true) {
  const applied: StoreUpdate[] = [];
  return { applied, deps: { expectedAuth: SECRET, apply: async (u: StoreUpdate) => { applied.push(u); return found; } } };
}
const post = (body: unknown, auth: string | null = SECRET) =>
  new Request('https://x/functions/v1/revenuecat-webhook', {
    method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: auth === null ? {} : { authorization: auth },
  });
const event = (e: Record<string, unknown>) => ({ api_version: '1.0', event: { app_user_id: USER, event_timestamp_ms: 1_800_000_000_000, ...e } });

Deno.test('requests without the secret are refused and change nothing', async () => {
  const { applied, deps } = setup();
  const body = event({ type: 'INITIAL_PURCHASE', expiration_at_ms: 1_900_000_000_000 });
  assertEquals((await handle(post(body, null), deps)).status, 401);
  assertEquals((await handle(post(body, 'Bearer wrong'), deps)).status, 401);
  assertEquals((await handle(post(body, SECRET + 'x'), deps)).status, 401);
  assertEquals(applied.length, 0);
});

Deno.test('a missing or short secret on the server refuses everything', async () => {
  const { applied } = setup();
  const apply = async () => { applied.push({} as StoreUpdate); return true; };
  const body = event({ type: 'INITIAL_PURCHASE', expiration_at_ms: 1 });
  assertEquals((await handle(post(body, ''), { expectedAuth: '', apply })).status, 500);
  assertEquals((await handle(post(body, 'short'), { expectedAuth: 'short', apply })).status, 500);
  assertEquals(applied.length, 0);
});

Deno.test('only POST', async () => {
  const { deps } = setup();
  assertEquals((await handle(new Request('https://x', { headers: { authorization: SECRET } }), deps)).status, 405);
});

Deno.test('a trial or renewal sets access until the store expiration', async () => {
  const { applied, deps } = setup();
  const res = await handle(post(event({ type: 'INITIAL_PURCHASE', period_type: 'TRIAL', product_id: 'monthly', expiration_at_ms: 1_900_000_000_000 })), deps);
  assertEquals(res.status, 200);
  assertEquals(applied, [{ userId: USER, activeUntil: new Date(1_900_000_000_000).toISOString(), product: 'monthly', eventAt: new Date(1_800_000_000_000).toISOString() }]);
});

Deno.test('expiration and cancellation pass the store date through', async () => {
  const { applied, deps } = setup();
  await handle(post(event({ type: 'EXPIRATION', expiration_at_ms: 1_700_000_000_000 })), deps);
  await handle(post(event({ type: 'CANCELLATION', expiration_at_ms: 1_750_000_000_000 })), deps);
  assertEquals(applied.map((u) => u.activeUntil), [new Date(1_700_000_000_000).toISOString(), new Date(1_750_000_000_000).toISOString()]);
});

Deno.test('a lifetime purchase (no expiration) never runs out', async () => {
  const { applied, deps } = setup();
  await handle(post(event({ type: 'NON_RENEWING_PURCHASE', product_id: 'lifetime', expiration_at_ms: null })), deps);
  assertEquals(applied[0].activeUntil, 'infinity');
});

Deno.test('test events, anonymous ids and bad bodies change nothing', async () => {
  const { applied, deps } = setup();
  assertEquals((await handle(post(event({ type: 'TEST', expiration_at_ms: 1 })), deps)).status, 200);
  assertEquals((await handle(post(event({ type: 'RENEWAL', app_user_id: '$RCAnonymousID:abc', expiration_at_ms: 1 })), deps)).status, 200);
  assertEquals((await handle(post('not json'), deps)).status, 400);
  assertEquals((await handle(post('x'.repeat(70_000)), deps)).status, 413);
  assertEquals(applied.length, 0);
});

Deno.test('the user id is found among aliases', async () => {
  const { applied, deps } = setup();
  await handle(post(event({ type: 'RENEWAL', app_user_id: '$RCAnonymousID:abc', aliases: ['$RCAnonymousID:abc', USER], expiration_at_ms: 5 })), deps);
  assertEquals(applied[0].userId, USER);
});

Deno.test('secret comparison', () => {
  assertEquals(sameSecret('abc', 'abc'), true);
  assertEquals(sameSecret('abc', 'abd'), false);
  assertEquals(sameSecret('abc', 'abcd'), false);
  assertEquals(sameSecret('', 'a'), false);
});
