import { assertEquals } from 'jsr:@std/assert@1';
import { handle } from './handler.ts';

const ANA = '6f1c2a3b-1234-4abc-8def-0123456789ab';
const MARKO = '0a1b2c3d-1234-4abc-8def-0123456789ab';

function setup(tokens: Record<string, string>, deleteOk = true) {
  const deleted: string[] = [];
  return {
    deleted,
    deps: {
      whoAmI: async (auth: string) => tokens[auth] ?? null,
      deleteUser: async (id: string) => { if (deleteOk) deleted.push(id); return deleteOk; },
    },
  };
}
const post = (auth: string, body: unknown = {}) =>
  new Request('https://x/functions/v1/delete-account', {
    method: 'POST', body: JSON.stringify(body), headers: auth ? { authorization: auth } : {},
  });

Deno.test('deletes the signed-in user', async () => {
  const t = setup({ 'Bearer ana-token': ANA });
  const res = await handle(post('Bearer ana-token'), t.deps);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { deleted: true });
  assertEquals(t.deleted, [ANA]);
});

Deno.test('a user id in the body is ignored: you can only delete yourself', async () => {
  const t = setup({ 'Bearer ana-token': ANA });
  await handle(post('Bearer ana-token', { user_id: MARKO, id: MARKO }), t.deps);
  assertEquals(t.deleted, [ANA]);
});

Deno.test('no login, a bad or signed-out token, or a GET: nothing is deleted', async () => {
  const t = setup({ 'Bearer ana-token': ANA });
  assertEquals((await handle(post(''), t.deps)).status, 401);
  assertEquals((await handle(post('ana-token'), t.deps)).status, 401);
  assertEquals((await handle(post('Bearer '), t.deps)).status, 401);
  assertEquals((await handle(post('Bearer expired-or-signed-out'), t.deps)).status, 401);
  const get = new Request('https://x/functions/v1/delete-account', { headers: { authorization: 'Bearer ana-token' } });
  assertEquals((await handle(get, t.deps)).status, 405);
  assertEquals(t.deleted, []);
});

Deno.test('the auth server refusing gives 502, so the app does not say the account is gone', async () => {
  const t = setup({ 'Bearer ana-token': ANA }, false);
  assertEquals((await handle(post('Bearer ana-token'), t.deps)).status, 502);
});
