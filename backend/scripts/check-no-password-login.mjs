// Checks on the real Supabase project that signing in with a password is refused (migration 0003).
// Uses only the public URL and anon key, the same ones the app has. See docs/ZASTITA.md, part 4.
//
//   node scripts/check-no-password-login.mjs <test email> <test password>
//
// SUPABASE_URL and SUPABASE_ANON_KEY come from the environment, or from mobile/.env.local
// (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const env = { ...process.env };
const local = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'mobile', '.env.local');
if (fs.existsSync(local)) {
  for (const line of fs.readFileSync(local, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !env[m[1]]) env[m[1]] = m[2];
  }
}
const url = env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_ANON_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const [email, password] = process.argv.slice(2);
if (!url || !key || !email || !password) {
  console.error('Usage: node scripts/check-no-password-login.mjs <test email> <test password>  (needs the Supabase URL and anon key)');
  process.exit(2);
}

const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: key, 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const body = await res.json().catch(() => ({}));
const code = body.error_code ?? body.code ?? body.error;
if (res.ok) {
  console.error('FAIL: signed in with a password. Migration 0003 is not applied or the trigger is off.');
  process.exit(1);
}
if (code === 'invalid_credentials') {
  console.log('OK: password sign-in is refused ("Invalid login credentials").');
  process.exit(0);
}
console.error(`Unexpected answer ${res.status} ${code ?? ''}: ${body.msg ?? body.message ?? JSON.stringify(body)}`);
console.error(code === 'email_not_confirmed' ? 'This means the password matched: 0003 is not working.' : 'Check the URL, the key and the email.');
process.exit(1);
