// Sends one real "Add a friend" invite on the real Supabase project, the way the app will once the screen exists:
// sign in with an email code, send_friend_request, then the Edge Function send-invite-email (Resend).
// Uses only the public URL and anon key. See docs/TESTIRANJE.md, part 5.5.
//
//   node scripts/send-test-invite.mjs <your email> <friend's email>
//
// Works only while CAPTCHA is off in Supabase (this script cannot solve Turnstile).
// SUPABASE_URL and SUPABASE_ANON_KEY come from the environment, or from mobile/.env.local
// (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY).
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const env = { ...process.env };
const local = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'mobile', '.env.local');
if (fs.existsSync(local)) {
  for (const line of fs.readFileSync(local, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !env[m[1]]) env[m[1]] = m[2];
  }
}
const url = (env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const key = env.SUPABASE_ANON_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const [email, friend] = process.argv.slice(2).map((s) => s?.trim().toLowerCase());
if (!url || !key || !email || !friend) {
  console.error('Usage: node scripts/send-test-invite.mjs <your email> <friend email>  (needs the Supabase URL and anon key)');
  process.exit(2);
}

async function call(p, body, token) {
  const res = await fetch(url + p, {
    method: 'POST',
    headers: { apikey: key, 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, ok: res.ok, body: await res.json().catch(() => ({})) };
}
const why = (b) => b.msg ?? b.message ?? b.error_description ?? b.error ?? JSON.stringify(b);
function fail(msg) {
  console.error(msg);
  process.exit(1);
}

// 1. Email code (same as "Send code" in the app)
const otp = await call('/auth/v1/otp', { email, create_user: true });
if (!otp.ok) {
  fail(/captcha/i.test(why(otp.body))
    ? 'FAIL: Supabase asks for CAPTCHA. This script works only while CAPTCHA is off (docs/TESTIRANJE.md, part 5.5).'
    : `FAIL: could not send the code: ${otp.status} ${why(otp.body)}`);
}
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const code = (await rl.question(`Code sent to ${email}. Type the 6 digits: `)).replace(/\D/g, '');
rl.close();

const verify = await call('/auth/v1/verify', { type: 'email', email, token: code });
if (!verify.ok || !verify.body.access_token) fail(`FAIL: code not accepted: ${verify.status} ${why(verify.body)}`);
const token = verify.body.access_token;
console.log(`Signed in as ${email}.`);

let failed = null;
try {
  // 2. The invite row (database rules and limits apply as for the app)
  const req = await call('/rest/v1/rpc/send_friend_request', { email: friend }, token);
  if (!req.ok) {
    failed = req.body.hint === 'no_access'
      ? `FAIL: ${email} has no trial or subscription. Run the SQL from docs/TESTIRANJE.md part 4, then try again.`
      : `FAIL: send_friend_request: ${req.status} ${why(req.body)}${req.body.hint ? ` (${req.body.hint})` : ''}`;
  } else {
    console.log(`Invite saved (request ${req.body}).`);

    // 3. The email (Edge Function send-invite-email -> Resend)
    const mail = await call('/functions/v1/send-invite-email', { request_id: req.body }, token);
    if (mail.ok && mail.body.sent) {
      console.log(`OK: invite email sent to ${friend}. Check that inbox (and spam).`);
    } else {
      failed = `FAIL: send-invite-email: ${mail.status} ${why(mail.body)}` +
        (mail.status === 404 && /function was not found/i.test(why(mail.body)) ? ' (the function is not deployed)' : '') +
        (mail.status === 502 ? ' (Resend refused it: see Edge Functions > send-invite-email > Logs)' : '');
    }
  }
} finally {
  // Ends this login only (the app on your phones stays signed in).
  await call('/auth/v1/logout?scope=local', {}, token).catch(() => {});
}
if (failed) fail(failed);
