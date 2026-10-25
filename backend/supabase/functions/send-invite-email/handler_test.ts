import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { type ClaimError, handle, inviteEmail } from './handler.ts';

const RID = '6f1c2a3b-1234-4abc-8def-0123456789ab';

function setup(claim: { to_email: string; from_name: string } | null, error: ClaimError | null = null, sendOk = true) {
  const sent: { to: string; subject: string; text: string }[] = [];
  const claims: string[] = [];
  return {
    sent, claims,
    deps: {
      claim: async (id: string) => { claims.push(id); return { data: claim, error }; },
      send: async (e: { to: string; subject: string; text: string }) => { sent.push(e); return sendOk; },
    },
  };
}
const post = (body: unknown, auth = 'Bearer user-token') =>
  new Request('https://x/functions/v1/send-invite-email', {
    method: 'POST', body: JSON.stringify(body), headers: auth ? { authorization: auth } : {},
  });

Deno.test('sends one email for an invite the database allows', async () => {
  const t = setup({ to_email: 'eva@example.com', from_name: 'Ana' });
  const res = await handle(post({ request_id: RID }), t.deps);
  assertEquals(res.status, 200);
  assertEquals(t.claims, [RID]);
  assertEquals(t.sent.length, 1);
  assertEquals(t.sent[0].to, 'eva@example.com');
  assertEquals(t.sent[0].subject, 'Ana invited you to Lock In');
});

Deno.test('over the limit: 429 with the message from the database, no email', async () => {
  const t = setup(null, { message: 'You can send up to 30 invite emails per day. Try again tomorrow.', hint: 'rate_limited', code: 'P0001' });
  const res = await handle(post({ request_id: RID }), t.deps);
  assertEquals(res.status, 429);
  assertStringIncludes((await res.json()).error, '30 invite emails per day');
  assertEquals(t.sent.length, 0);
});

Deno.test("someone else's invite, no subscription, not signed in: refused, no email", async () => {
  for (const [err, status] of [[{ message: 'request not found', code: 'P0002' }, 404], [{ message: 'subscription required', hint: 'no_access', code: 'P0001' }, 402]] as const) {
    const t = setup(null, err);
    assertEquals((await handle(post({ request_id: RID }), t.deps)).status, status);
    assertEquals(t.sent.length, 0);
  }
  const t = setup({ to_email: 'eva@example.com', from_name: 'Ana' });
  assertEquals((await handle(post({ request_id: RID }, ''), t.deps)).status, 401);
  assertEquals(t.claims.length, 0);
});

Deno.test('bad input never reaches the database', async () => {
  const t = setup({ to_email: 'eva@example.com', from_name: 'Ana' });
  assertEquals((await handle(post({ request_id: 'nope' }), t.deps)).status, 400);
  assertEquals((await handle(post({}), t.deps)).status, 400);
  assertEquals((await handle(new Request('https://x', { headers: { authorization: 'Bearer t' } }), t.deps)).status, 405);
  assertEquals(t.claims.length, 0);
});

Deno.test('the email provider failing gives 502', async () => {
  const t = setup({ to_email: 'eva@example.com', from_name: 'Ana' }, null, false);
  assertEquals((await handle(post({ request_id: RID }), t.deps)).status, 502);
});

Deno.test('names cannot break the subject line', () => {
  assertEquals(inviteEmail('a@b.co', 'Ana\r\nBcc: x@y.z').subject, 'Ana  Bcc: x@y.z invited you to Lock In');
  assertEquals(inviteEmail('a@b.co', '   ').subject, 'A friend invited you to Lock In');
});
