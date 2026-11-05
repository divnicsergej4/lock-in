import { assertEquals } from 'jsr:@std/assert@1';
import { handle, type StoreUpdate } from './handler.ts';

const ANA = '6f1c2a3b-1234-4abc-8def-0123456789ab';
const MARKO = '0a1b2c3d-1234-4abc-8def-0123456789ab';
const NOW = Date.parse('2026-10-30T12:00:00Z');

function setup(entitlements: Record<string, unknown> | null) {
  const written: StoreUpdate[] = [];
  const asked: string[] = [];
  return {
    written,
    asked,
    deps: {
      whoAmI: async (auth: string) => ({ 'Bearer ana-token': ANA } as Record<string, string>)[auth] ?? null,
      subscriber: async (id: string) => {
        asked.push(id);
        return entitlements == null ? null : { subscriber: { entitlements } };
      },
      apply: async (u: StoreUpdate) => {
        written.push(u);
        return true;
      },
      now: () => NOW,
    },
  };
}
const post = (auth: string, body: unknown = {}) =>
  new Request('https://x/functions/v1/sync-store-access', { method: 'POST', body: JSON.stringify(body), headers: auth ? { authorization: auth } : {} });

Deno.test('a trial bought before signing in is written for the signed-in user', async () => {
  const t = setup({ access: { expires_date: '2026-11-06T12:00:00Z', product_identifier: 'lockin_yearly', purchase_date: '2026-10-30T12:00:00Z' } });
  const res = await handle(post('Bearer ana-token'), t.deps);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { active: true });
  assertEquals(t.written, [{ userId: ANA, activeUntil: '2026-11-06T12:00:00.000Z', product: 'lockin_yearly', eventAt: '2026-10-30T12:00:00.000Z' }]);
});

Deno.test('lifetime (no expiry) is written as infinity; a grace period counts', async () => {
  const t = setup({ access: { expires_date: null, product_identifier: 'lockin_lifetime' } });
  await handle(post('Bearer ana-token'), t.deps);
  assertEquals(t.written[0].activeUntil, 'infinity');
  const g = setup({ access: { expires_date: '2026-10-29T00:00:00Z', grace_period_expires_date: '2026-11-10T00:00:00Z', product_identifier: 'm' } });
  await handle(post('Bearer ana-token'), g.deps);
  assertEquals(g.written[0].activeUntil, '2026-11-10T00:00:00.000Z');
});

Deno.test('expired or no entitlement: nothing is written (this never shortens access)', async () => {
  const old = setup({ access: { expires_date: '2026-10-01T00:00:00Z', product_identifier: 'm' } });
  assertEquals(await (await handle(post('Bearer ana-token'), old.deps)).json(), { active: false });
  const none = setup({ other: { expires_date: null } });
  assertEquals(await (await handle(post('Bearer ana-token'), none.deps)).json(), { active: false });
  const bad = setup({ access: { expires_date: 'not a date' } });
  await handle(post('Bearer ana-token'), bad.deps);
  assertEquals([...old.written, ...none.written, ...bad.written], []);
});

Deno.test('only yourself: a user id in the body is ignored', async () => {
  const t = setup({ access: { expires_date: null } });
  await handle(post('Bearer ana-token', { user_id: MARKO, app_user_id: MARKO }), t.deps);
  assertEquals(t.asked, [ANA]);
  assertEquals(t.written[0].userId, ANA);
});

Deno.test('no login, a bad token or a GET: RevenueCat is not even asked', async () => {
  const t = setup({ access: { expires_date: null } });
  assertEquals((await handle(post(''), t.deps)).status, 401);
  assertEquals((await handle(post('Bearer nope'), t.deps)).status, 401);
  assertEquals((await handle(new Request('https://x', { headers: { authorization: 'Bearer ana-token' } }), t.deps)).status, 405);
  assertEquals(t.asked, []);
});

Deno.test('RevenueCat not reachable: 502, nothing written', async () => {
  const t = setup(null);
  assertEquals((await handle(post('Bearer ana-token'), t.deps)).status, 502);
  assertEquals(t.written, []);
});
