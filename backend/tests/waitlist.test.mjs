// The launch list (0008): a signed-out visitor can leave an email and nothing else; nobody reads the list through
// the API; an address is stored once and a repeat looks the same; the whole list has an hourly and a daily cap.
import { freshDb, helpers } from './db.mjs';

const db = await freshDb();
const { psql, asUser, ok, signup, fails } = helpers(db);
const anon = (sql) => asUser(null, sql, 'anon');
let s, out, e;

console.log('joining');
[s, , e] = await anon("select public.join_waitlist('  Anna@Example.com ', 'Instagram')");
ok(s, 'a signed-out visitor can join', e);
[, out] = await psql("select email || '|' || coalesce(source, '') from app.waitlist");
ok(out === 'anna@example.com|instagram', 'the address is stored trimmed and in lower case, with where they came from', out);
const [, first] = await psql("select created_at from app.waitlist where email = 'anna@example.com'");
[s, , e] = await anon("select public.join_waitlist('anna@example.com', 'tiktok')");
ok(s, 'joining again looks the same (the form never tells whether an address is on the list)', e);
[, out] = await psql("select count(*) || '|' || min(source) from app.waitlist");
const [, again] = await psql("select created_at from app.waitlist where email = 'anna@example.com'");
ok(out === '1|instagram' && again === first, 'a repeat changes nothing', `${out} ${first} ${again}`);
[s, , e] = await anon("select public.join_waitlist('mark@example.com')");
[, out] = await psql("select coalesce(source, '(none)') from app.waitlist where email = 'mark@example.com'");
ok(s && out === '(none)', 'where they came from is optional', out || e);
[s, , e] = await anon("select public.join_waitlist('ben@example.com', '<script>')");
[, out] = await psql("select coalesce(source, '(none)') from app.waitlist where email = 'ben@example.com'");
ok(s && out === '(none)', 'a strange source is dropped, the address still joins', out || e);

console.log('refused addresses');
for (const bad of ['', '   ', 'anna', 'anna@', '@example.com', 'anna@example', 'an na@example.com', 'a@b@c.com', `${'a'.repeat(250)}@example.com`]) {
  [s, , e] = await anon(`select public.join_waitlist('${bad}')`);
  ok(!s && e.includes('Enter a valid email address.'), `refused: "${bad.length > 30 ? bad.slice(0, 12) + '…' : bad}"`, e);
}
[s, , e] = await anon('select public.join_waitlist(null)');
ok(!s && e.includes('Enter a valid email address.'), 'refused: no address', e);

console.log('nobody reads the list');
[s, , e] = await anon('select * from app.waitlist');
ok(!s, 'a signed-out visitor cannot read it', e);
const A = await signup('cleo@example.com');
[s, , e] = await asUser(A, 'select * from app.waitlist');
ok(!s, 'a signed-in user cannot read it', e);
[s, , e] = await anon("insert into app.waitlist (email) values ('x@example.com')");
ok(!s, 'nobody writes it except through join_waitlist', e);
[s, , e] = await anon("delete from app.waitlist");
ok(!s, 'nobody deletes from it through the API', e);
[s, , e] = await asUser(A, "select public.join_waitlist('dan@example.com')");
ok(!s, 'the app (signed in) cannot call join_waitlist: only the website does', e);

console.log('caps');
await psql("insert into app.waitlist (email) select 'bot' || g || '@example.com' from generate_series(1, 296) g");
[, out] = await psql("select count(*) from app.waitlist where created_at > now() - interval '1 hour'");
ok(out === '299', 'set up: 299 sign-ups in the last hour', out);
[s, , e] = await anon("select public.join_waitlist('ivy@example.com')");
ok(s, 'the 300th sign-up of the hour gets in', e);
[s, , e] = await anon("select public.join_waitlist('jake@example.com')");
ok(!s && e.includes('Too many sign-ups right now.'), 'the 301st waits (hourly cap)', e);
[s, , e] = await anon("select public.join_waitlist('anna@example.com')");
ok(s, 'an address already on the list still gets the same answer during the cap', e);
await psql("update app.waitlist set created_at = now() - interval '2 hours'");
[s, , e] = await anon("select public.join_waitlist('jake@example.com')");
ok(s, 'an hour later it gets in', e);
await psql("insert into app.waitlist (email, created_at) select 'old' || g || '@example.com', now() - interval '3 hours' from generate_series(1, 1699) g");
[, out] = await psql("select count(*) from app.waitlist where created_at > now() - interval '1 day'");
ok(out === '2000', 'set up: 2,000 sign-ups today', out);
[s, , e] = await anon("select public.join_waitlist('kate@example.com')");
ok(!s && e.includes('Too many sign-ups right now.'), 'the 2,001st of the day waits (daily cap)', e);

console.log('fails', fails());
process.exit(fails() ? 1 : 0);
