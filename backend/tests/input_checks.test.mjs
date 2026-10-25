// What the database accepts (0004): text is never empty, only spaces, padded with spaces or full of control /
// invisible characters; lengths and amounts have limits; a currency is three capital letters; invite addresses
// are plain emails. And no function builds SQL out of strings.
import { freshDb, helpers } from './db.mjs';

const db = await freshDb();
const { psql, asUser, ok, signup, fails } = helpers(db);
let s, e;

const A = await signup('ana@example.com');
const [, G] = await asUser(A, "select public.create_goal('Greece', 2000, 'EUR')");
const lit = (t) => (t === null ? 'null' : `E'${t.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\t/g, '\\t')}'`);

const BAD_TEXT = {
  empty: '',
  'only spaces': '   ',
  'space at the start': ' Trip',
  'space at the end': 'Trip ',
  'a line break': 'Tr\nip',
  'a tab': 'Trip\t2',
  'a zero-width space': 'Trip​',
  'only a zero-width space': '​',
  'a right-to-left override': '‮pirt',
  'a soft hyphen': 'Tr­ip',
};

console.log('goal name');
for (const [why, t] of Object.entries(BAD_TEXT)) {
  [s, , e] = await asUser(A, `update public.goals set name = ${lit(t)} where id = '${G}'`);
  ok(!s && e.includes('goals_name_clean'), `refused: ${why}`, e);
}
[s, , e] = await asUser(A, `update public.goals set name = '${'x'.repeat(61)}' where id = '${G}'`);
ok(!s, 'refused: 61 characters', e);
for (const t of ['Summer trip to Greece 🇬🇷', 'Đir po Grčkoj', 'x'.repeat(60), 'A']) {
  [s, , e] = await asUser(A, `update public.goals set name = ${lit(t)} where id = '${G}'`);
  ok(s, `accepted: ${t.slice(0, 25)}`, e);
}
[s, , e] = await asUser(A, "select public.create_goal('   ', 100, 'EUR')");
ok(!s, 'create_goal with only spaces is refused', e);
[s, , e] = await asUser(A, "select public.create_goal('  Bike  ', 100, 'EUR')");
ok(s && (await psql("select count(*) from public.goals where name = 'Bike'"))[1] === '1', 'create_goal trims the name', e);

console.log('amounts and currency');
for (const [t, good] of [['0', false], ['-5', false], ['1000000000.01', false], ['99999999999', false], ['1000000000', true], ['0.01', true]]) {
  [s, , e] = await asUser(A, `update public.goals set target = ${t} where id = '${G}'`);
  ok(s === good, `goal target ${t}: ${good ? 'accepted' : 'refused'}`, e);
}
for (const [cur, good] of [['eur', false], ['EURO', false], ['E1R', false], ['', false], ['RSD', true]]) {
  [s, , e] = await asUser(A, `update public.goals set currency = '${cur}' where id = '${G}'`);
  ok(s === good, `currency "${cur}": ${good ? 'accepted' : 'refused'}`, e);
}
const pay = (amt, note = null) => asUser(A, `insert into public.contributions (goal_id, user_id, amount, note) values ('${G}', '${A}', ${amt}, ${lit(note)})`);
for (const [t, good] of [['0', false], ['-1', false], ['1000000000.01', false], ['1000000000', true], ['12.5', true]]) {
  [s, , e] = await pay(t);
  ok(s === good, `contribution ${t}: ${good ? 'accepted' : 'refused'}`, e);
}

console.log('contribution note');
for (const [why, t] of Object.entries(BAD_TEXT)) {
  [s, , e] = await pay(5, t);
  ok(!s && e.includes('contributions_note_clean'), `refused: ${why}`, e);
}
[s, , e] = await pay(5, 'x'.repeat(81));
ok(!s, 'refused: 81 characters', e);
ok((await pay(5, null))[0] && (await pay(5, 'for the hotel'))[0], 'no note, or a normal note, is accepted');

console.log('display name');
for (const [why, t] of Object.entries(BAD_TEXT)) {
  [s, , e] = await asUser(A, `update public.profiles set display_name = ${lit(t)} where id = '${A}'`);
  ok(!s && e.includes('profiles_display_name_clean'), `refused: ${why}`, e);
}
[s, , e] = await asUser(A, `update public.profiles set display_name = '${'x'.repeat(41)}' where id = '${A}'`);
ok(!s, 'refused: 41 characters', e);
[s, , e] = await asUser(A, `update public.profiles set display_name = 'Ana-Marija O''Brien' where id = '${A}'`);
ok(s, 'accepted: a normal name', e);
[s, , e] = await asUser(A, `update public.profiles set display_name = null where id = '${A}'`);
ok(s, 'accepted: no name (NULL)', e);
ok((await psql(`select display_name is null from public.profiles where id = '${await signup('new@example.com')}'`))[1] === 't',
  'a new account starts with no name (NULL, not "")');

console.log('invite address');
for (const to of ['eva@example.com<script>', 'eva"@example.com', 'eva@exa_mple.com', `${'x'.repeat(65)}@example.com`, `eva@${'x'.repeat(250)}.com`]) {
  [s, , e] = await asUser(A, `select public.send_friend_request(${lit(to)})`);
  ok(!s, `refused: ${to.slice(0, 40)}`, e);
}
ok((await psql("select count(*) from public.friend_requests"))[1] === '0', 'and none of them was saved');
[s, , e] = await asUser(A, "select public.send_friend_request('Eva.Petrovic+lockin@Example.co.uk')");
ok(s, 'a normal address is accepted (and saved lower-case)', e);

console.log('no SQL built from strings');
const [, dyn] = await psql(`select coalesce(string_agg(n.nspname || '.' || p.proname, ' '), '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                             where n.nspname in ('public', 'app') and p.prosrc ~* '\\mexecute\\M'`);
ok(dyn === '', 'no function in public or app uses EXECUTE (dynamic SQL)', dyn);
const [, open] = await psql(`select coalesce(string_agg(n.nspname || '.' || p.proname, ' '), '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                              where n.nspname in ('public', 'app') and p.prosecdef
                                and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`);
ok(open === '', 'every security definer function fixes its search_path', open);

console.log('fails', fails());
process.exit(fails() ? 1 : 0);
