import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { type ClaimError, handle, inviteEmail, MAX_NAME, safeName } from './handler.ts';

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
  assertEquals(inviteEmail('a@b.co', 'Ana\r\nBcc: x@y.z').subject, 'Ana Bcc x y z invited you to Lock In');
  assertEquals(inviteEmail('a@b.co', '   ').subject, 'A friend invited you to Lock In');
  assertEquals(inviteEmail('a@b.co', null).subject, 'A friend invited you to Lock In');
});

Deno.test('a name can never become HTML, a link or an address', () => {
  const evil = [
    '<a href="https://evil.com/login">Click here</a>',
    '<script>alert(document.cookie)</script>',
    'https://evil.com/free-money',
    'www.evil.com',
    'Ana visit evil.com now',
    'ana@evil.com',
    'ｅｖｉｌ．ｃｏｍ', // full-width look-alikes
    'Ana‮moc.live', // right-to-left override
    '<img src=x onerror=alert(1)>',
    'Ana &lt;b&gt;',
    'javascript:alert(1)',
  ];
  for (const name of evil) {
    const e = inviteEmail('eva@example.com', name);
    const sender = e.subject.replace(' invited you to Lock In', '');
    assertEquals(/[<>"&@:/\\.‮]/.test(sender), false, `${name} -> ${sender}`);
    assertEquals(/[\r\n]/.test(e.subject), false, name);
    assertEquals(e.text.includes('evil.com'), false, name);
    assertEquals(e.text.includes('<'), false, name);
    assertEquals(e.text.includes('://'), false, name);
    assertEquals('html' in e, false); // plain text only
  }
  assertEquals(safeName('<a href="https://evil.com/login">Click here</a>'), 'a href https evil com login Click here a');
  assertEquals(safeName('<script>alert(1)</script>'), 'script alert 1 script');
  assertEquals(safeName('ｅｖｉｌ．ｃｏｍ'), 'evil com');
});

Deno.test("real names stay as they are, cut to 40 characters", () => {
  assertEquals(safeName('Ana-Marija O’Brien'), 'Ana-Marija O’Brien');
  assertEquals(safeName('Đorđe Šaković'), 'Đorđe Šaković');
  assertEquals(safeName('Сергеј'), 'Сергеј');
  assertEquals(safeName('  Ana   \n Marko  '), 'Ana Marko');
  const long = safeName('A'.repeat(30) + ' ' + 'B'.repeat(30));
  assertEquals(Array.from(long).length <= MAX_NAME, true);
  assertEquals(long, 'A'.repeat(30) + ' ' + 'B'.repeat(9));
});

Deno.test('an address that is not a plain email is not sent to', async () => {
  for (const to of ['eva@example.com<script>', '"eva"@example.com', 'eva@exa mple.com', 'eva@localhost']) {
    const t = setup({ to_email: to, from_name: 'Ana' });
    assertEquals((await handle(post({ request_id: RID }), t.deps)).status, 400, to);
    assertEquals(t.sent.length, 0);
  }
});
