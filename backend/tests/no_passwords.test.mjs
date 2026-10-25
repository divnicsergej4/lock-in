// Migration 0003: no account can ever sign in with a password, and code / Google / Apple sign-in still work.
//
// The Auth server (Supabase Auth, github.com/supabase/auth) cannot run here, so `auth` below does what it does in
// the database for each request, step by step as in its code (internal/api/{signup,magic_link,verify,token,
// external}.go, internal/models/user.go): the same rows read, the same columns written (it uses UpdateOnly with a
// list of columns), as the same role (supabase_auth_admin), and the same password check (User.Authenticate:
// NULL or "" is "no password" and fails before any comparison). The real hash is bcrypt; here it is sha256,
// which does not matter for what is tested: whether a stored password exists and is checked.
//
// The same scenarios also run on a database without 0003, to show that the test sees the problem it is for.
import crypto from 'node:crypto';
import { applyMigration, freshDb, helpers } from './db.mjs';

const hash = (pw) => 'sha256$' + crypto.createHash('sha256').update(pw).digest('hex');
const random = () => crypto.randomBytes(24).toString('hex');
const code6 = () => String(crypto.randomInt(0, 1e6)).padStart(6, '0');
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** What the Auth server does in the database. Every call returns { ok, error? } like the API. */
function authServer(db) {
  async function as(sql) {
    await db.exec('begin; set local role supabase_auth_admin;');
    try {
      const r = await db.query(sql);
      await db.exec('commit');
      return r.rows;
    } catch (e) {
      await db.exec('rollback');
      throw e;
    }
  }
  const find = async (email) => (await as(`select * from auth.users where email = ${q(email)}`))[0] ?? null;
  const mail = {}; // the last code emailed to each address

  // models.NewUser + Create: the password hashed, or "" when there is none.
  const insertUser = (email, password, confirmed = false) =>
    as(`insert into auth.users (email, encrypted_password, email_confirmed_at, confirmation_token)
        values (${q(email)}, ${q(password ? hash(password) : '')}, ${confirmed ? 'now()' : 'null'}, '') returning *`);

  // models.User.Authenticate
  const authenticate = (user, password) => {
    const h = user.encrypted_password;
    if (h == null || h === '') return false;
    return h === hash(password);
  };

  return {
    // POST /signup with email + password ("Confirm email" on). An existing unconfirmed user is not changed.
    async signUp(email, password) {
      const user = await find(email);
      if (user?.email_confirmed_at) return { ok: true }; // obfuscated, nothing changes
      if (!user) await insertUser(email, password);
      const u = await find(email);
      const c = code6();
      await as(`update auth.users set confirmation_token = ${q(c)} where id = ${q(u.id)}`); // sendConfirmation
      mail[email] = c;
      return { ok: true };
    },

    // POST /otp (signInWithOtp): a new or unconfirmed user is signed up with a temporary password, then a code is sent.
    async sendCode(email) {
      let user = await find(email);
      if (!user || !user.email_confirmed_at) return this.signUp(email, random());
      const c = code6();
      await as(`update auth.users set recovery_token = ${q(c)} where id = ${q(user.id)}`); // sendMagicLink
      mail[email] = c;
      return { ok: true };
    },

    // POST /verify type=email (verifyOtp): signupVerify (Confirm) or the magic link / recovery path.
    async verifyCode(email, code) {
      const user = await find(email);
      if (!user || !code) return { ok: false, error: 'otp_expired' };
      if (user.confirmation_token === code) {
        await as(`update auth.users set confirmation_token = '', email_confirmed_at = now() where id = ${q(user.id)}`);
      } else if (user.recovery_token === code) {
        await as(`update auth.users set recovery_token = '', email_confirmed_at = coalesce(email_confirmed_at, now())
                  where id = ${q(user.id)}`);
      } else return { ok: false, error: 'otp_expired' };
      await as(`update auth.users set last_sign_in_at = now() where id = ${q(user.id)}`);
      return { ok: true, id: user.id };
    },

    // POST /token?grant_type=password (signInWithPassword): password first, then "email not confirmed".
    async signInWithPassword(email, password) {
      const user = await find(email);
      if (!user || !authenticate(user, password)) return { ok: false, error: 'invalid_credentials' };
      if (!user.email_confirmed_at) return { ok: false, error: 'email_not_confirmed' };
      await as(`update auth.users set last_sign_in_at = now() where id = ${q(user.id)}`);
      return { ok: true };
    },

    // PUT /user { password } (updateUser) for a signed-in user: UpdatePassword.
    async setPassword(id, password) {
      await as(`update auth.users set encrypted_password = ${q(hash(password))}, confirmation_token = '',
                recovery_token = '' where id = ${q(id)}`);
      return { ok: true };
    },

    // signInWithIdToken (Apple) / the Google callback: the provider vouches for the email.
    async signInWithProvider(provider, email) {
      let user = await find(email);
      if (user && !user.email_confirmed_at) {
        // RemoveUnconfirmedIdentities: an unconfirmed account's password is reset, then the account is confirmed.
        await as(`update auth.users set encrypted_password = null where id = ${q(user.id)}`);
        await as(`update auth.users set email_confirmed_at = now() where id = ${q(user.id)}`);
      } else if (!user) {
        [user] = await insertUser(email, '', true);
      }
      await as(`update auth.users set raw_app_meta_data = raw_app_meta_data || ${q(JSON.stringify({ provider }))}::jsonb,
                last_sign_in_at = now() where id = ${q(user.id)}`);
      return { ok: true, id: user.id };
    },

    // Dashboard > Authentication > Users > Add user, with a password and "Auto Confirm User".
    adminCreateUser: (email, password) => insertUser(email, password, true),

    lastCode: (email) => mail[email],
    find,
  };
}

async function scenarios(db, label) {
  const auth = authServer(db);
  const out = {};

  // 1. A password account, before anyone signs in with a code.
  await auth.signUp('ana@example.com', 'ana-password-1');
  out.beforeCode = await auth.signInWithPassword('ana@example.com', 'ana-password-1');

  // 2. Pre-account takeover: Marko signs up with Eva's email and his password; later Eva signs in with a code.
  await auth.signUp('eva@example.com', 'markos-password');
  await auth.sendCode('eva@example.com');
  out.evaCode = await auth.verifyCode('eva@example.com', auth.lastCode('eva@example.com'));
  out.afterCode = await auth.signInWithPassword('eva@example.com', 'markos-password');

  // 3. A confirmed account made in the dashboard with a password.
  await auth.adminCreateUser('admin@example.com', 'dashboard-password');
  out.dashboard = await auth.signInWithPassword('admin@example.com', 'dashboard-password');

  // 4. Signed in with a code, then sets a password through the API (updateUser).
  await auth.sendCode('ivan@example.com');
  const ivan = await auth.verifyCode('ivan@example.com', auth.lastCode('ivan@example.com'));
  await auth.setPassword(ivan.id, 'ivans-new-password');
  out.updateUser = await auth.signInWithPassword('ivan@example.com', 'ivans-new-password');

  // 5. Unconfirmed password account, then the owner signs in with Google.
  await auth.signUp('zoe@example.com', 'someone-elses-password');
  out.zoeGoogle = await auth.signInWithProvider('google', 'zoe@example.com');
  out.zoePassword = await auth.signInWithPassword('zoe@example.com', 'someone-elses-password');

  out.stored = (await db.query(`select count(*)::int as n from auth.users where coalesce(encrypted_password, '') <> ''`)).rows[0].n;
  if (label) console.log(`  (${label})`);
  return { auth, out };
}

console.log('no passwords (0003)');
const db = await freshDb();
const { psql, asUser, ok, fails } = helpers(db);
const { auth, out } = await scenarios(db);

ok(out.beforeCode.error === 'invalid_credentials', 'password sign-up: signing in with that password fails even before confirming (not just "email not confirmed")', JSON.stringify(out.beforeCode));
ok(out.evaCode.ok, 'Eva can sign in with the code on an account someone made with her email');
ok(out.afterCode.error === 'invalid_credentials', 'after her code sign-in, the password Marko set does not work', JSON.stringify(out.afterCode));
ok(out.dashboard.error === 'invalid_credentials', 'a confirmed account made with a password in the dashboard cannot sign in with it', JSON.stringify(out.dashboard));
ok(out.updateUser.error === 'invalid_credentials', 'a password set later with updateUser does not work', JSON.stringify(out.updateUser));
ok(out.zoeGoogle.ok && out.zoePassword.error === 'invalid_credentials', 'Google on an unconfirmed password account works, the old password does not');
ok(out.stored === 0, 'no row in auth.users has a password', String(out.stored));

// Code, Google and Apple keep working.
let r = await auth.sendCode('new@example.com');
r = r.ok && (await auth.verifyCode('new@example.com', auth.lastCode('new@example.com')));
ok(r.ok, 'a new email signs up and in with a code');
const NEW = r.id;
await auth.sendCode('new@example.com');
ok((await auth.verifyCode('new@example.com', '000000x')).error === 'otp_expired', 'a wrong code is still refused');
ok((await auth.verifyCode('new@example.com', auth.lastCode('new@example.com'))).ok, 'and the same account signs in with a code again');
ok((await auth.signInWithProvider('google', 'new@example.com')).id === NEW, 'Google with the same email is the same account');
r = await auth.signInWithProvider('apple', 'abc123@privaterelay.appleid.com');
ok(r.ok && r.id !== NEW, 'Apple (hidden email) makes its own account');
ok((await auth.signInWithProvider('apple', 'abc123@privaterelay.appleid.com')).id === r.id, 'and signs in again');
[, out.row] = await psql(`select email_confirmed_at is not null as c, last_sign_in_at is not null as l, raw_app_meta_data->>'provider' as p
                          from auth.users where id = '${NEW}'`);
ok(out.row === 't|t|google', 'the trigger keeps everything else the Auth server writes', out.row);
[, out.profiles] = await psql(`select count(*) from public.profiles where email in ('new@example.com', 'eva@example.com', 'abc123@privaterelay.appleid.com')`);
ok(out.profiles === '3', 'new accounts still get their profile (0001 trigger) when the Auth server creates them', out.profiles);

// The trigger itself.
// tgtype bits: 1 for each row, 2 before, 4 insert, 16 update
[, out.trig] = await psql(`select tgtype & 23 from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'no_password' and tgenabled = 'O'`);
ok(out.trig === '23', 'no_password runs BEFORE INSERT OR UPDATE, FOR EACH ROW, on auth.users, and is on', out.trig);
let s, e;
[s, , e] = await asUser(NEW, 'select app.no_password()');
ok(!s, 'the app cannot call the trigger function', e);
[s, , e] = await psql(`update auth.users set encrypted_password = 'sha256$x' where id = '${NEW}' returning encrypted_password`);
ok(s && (await psql(`select encrypted_password from auth.users where id = '${NEW}'`))[1] === '', 'even the database owner cannot store a password', e);

// Accounts that existed before 0003 lose their password when it is applied.
const old = await freshDb({ before: '0003' });
const oldAuth = authServer(old);
await oldAuth.adminCreateUser('early@example.com', 'early-password');
ok((await oldAuth.signInWithPassword('early@example.com', 'early-password')).ok, 'before 0003 a password account signs in with its password');
await applyMigration(old, '0003');
ok((await oldAuth.signInWithPassword('early@example.com', 'early-password')).error === 'invalid_credentials', 'after applying 0003 the same password no longer works');

// Without 0003 the same scenarios show the problem, so the checks above test the real thing.
const before = await freshDb({ before: '0003' });
const { out: was } = await scenarios(before, 'control: the same steps without 0003');
ok(was.afterCode.ok, 'without 0003: Marko signs in to Eva\'s account with his password after she confirmed it with a code');
ok(was.beforeCode.error === 'email_not_confirmed' && was.dashboard.ok && was.updateUser.ok,
  'without 0003: passwords are checked and work', JSON.stringify([was.beforeCode, was.dashboard, was.updateUser]));
ok(was.stored > 0, 'without 0003: passwords are stored');

console.log('fails', fails());
process.exit(fails() ? 1 : 0);
