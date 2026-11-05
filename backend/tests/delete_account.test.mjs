// Deleting an account (Settings > Delete account -> the delete-account function -> auth.admin.deleteUser).
// The function only deletes the auth user; this checks that the database then removes everything that was
// that person's, keeps what belongs to others, and that the app itself cannot delete anyone.
import { freshDb, helpers } from './db.mjs';

const db = await freshDb();
const { psql, asUser, ok, signup, fails } = helpers(db);
let s, out, e;

const one = async (sql) => (await psql(sql))[1];
const befriend = (a, b) => psql(`insert into public.friendships values ('${a < b ? a : b}', '${a < b ? b : a}')`);

console.log('delete account');
const ANA = await signup('ana@example.com');
const MARKO = await signup('marko@example.com');
const EVA = await signup('eva@example.com');
await befriend(ANA, MARKO);
await befriend(ANA, EVA);
await befriend(MARKO, EVA);

// A goal Ana shares with Marko, and one only she is in.
[s, out, e] = await asUser(ANA, "select public.create_goal('Greece', 2000, 'EUR')");
const TRIP = out;
ok(s, 'Ana makes a shared goal', e);
[s, , e] = await asUser(ANA, `select public.add_friend_to_goal('${TRIP}', '${MARKO}')`);
ok(s, 'and adds Marko', e);
const [, SOLO] = await asUser(ANA, "select public.create_goal('Bike', 500, 'EUR')");
await asUser(ANA, `insert into public.contributions (goal_id, user_id, amount) values ('${TRIP}', '${ANA}', 520), ('${SOLO}', '${ANA}', 50)`);
[s, , e] = await asUser(MARKO, `insert into public.contributions (goal_id, user_id, amount) values ('${TRIP}', '${MARKO}', 400)`);
ok(s, 'both pay in', e);
// Requests: Ana invited someone without an account, Eva's friend invited Ana, and Marko's goal with Eva.
await asUser(ANA, "select public.send_friend_request('newbie@example.com')");
const ZOE = await signup('zoe@example.com');
await asUser(ZOE, "select public.send_friend_request('ana@example.com')");
const [, OTHER] = await asUser(MARKO, "select public.create_goal('Gift', 100, 'EUR')");
await asUser(MARKO, `select public.add_friend_to_goal('${OTHER}', '${EVA}')`);

// The app (signed in as Ana, or anyone) cannot delete users on its own: only the server function can.
[s, , e] = await asUser(ANA, `delete from auth.users where id = '${ANA}'`);
ok(!s, 'the app cannot delete from auth.users directly', e);
[s, , e] = await asUser(null, `delete from auth.users where id = '${ANA}'`, 'anon');
ok(!s, 'nor can a signed-out visitor', e);
ok(await one(`select count(*) from auth.users where id = '${ANA}'`) === '1', 'Ana is still there');

// What deleteUser does on the server.
[s, , e] = await psql(`delete from auth.users where id = '${ANA}'`);
ok(s, 'the server deletes the auth user without any error from the cascades', e);

const left = async (table, col) => one(`select count(*) from ${table} where ${col} = '${ANA}'`);
ok(await left('public.profiles', 'id') === '0', 'her profile is gone');
ok(await left('public.subscriptions', 'user_id') === '0', 'her subscription row is gone');
ok(await one(`select count(*) from public.friendships where '${ANA}' in (user_a, user_b)`) === '0', 'her friendships are gone');
ok(await one(`select count(*) from public.friend_requests where from_user = '${ANA}' or to_user = '${ANA}'`) === '0',
  'friend requests she sent or got are gone');
ok(await left('public.goal_members', 'user_id') === '0', 'she is out of every goal');
ok(await one(`select count(*) from public.contributions where user_id = '${ANA}'`) === '0', 'her contributions are gone');
ok(await one(`select count(*) from public.goals where id = '${SOLO}'`) === '0', 'the goal only she was in is gone');
ok(await one(`select count(*) from public.goals where id = '${TRIP}'`) === '1', 'the goal she shared with Marko stays');
[s, out, e] = await asUser(MARKO, `select saved, members from public.goal_totals where goal_id = '${TRIP}'`);
ok(s && out === '400.00|1', 'Marko still sees the goal with only his own 400 and one member', out || e);
ok(await one(`select count(*) from public.goals where id = '${TRIP}' and created_by is null`) === '1',
  'the goal no longer points at her (created_by is cleared)');
ok(await one(`select count(*) from public.goal_members where added_by = '${ANA}'`) === '0', 'nor does Marko\'s membership');
ok(await one(`select count(*) from public.friendships where user_a = least('${MARKO}'::uuid, '${EVA}'::uuid)
                and user_b = greatest('${MARKO}'::uuid, '${EVA}'::uuid)`) === '1', 'other people\'s friendships are untouched');
ok(await one(`select count(*) from public.goal_members where goal_id = '${OTHER}'`) === '2', 'other people\'s goals are untouched');
ok(await one(`select count(*) from app.rate_events where user_id = '${ANA}'`) === '0', 'the rate counters no longer name her');

// Signing up again with the same email starts from nothing.
const ANA2 = await signup('ana@example.com', false);
ok(ANA2 && ANA2 !== ANA, 'the same email can sign up again as a new account');
[s, out] = await asUser(ANA2, 'select count(*) from public.goals');
ok(s && out === '0', 'and sees none of the old goals', out);
[s, out] = await asUser(ANA2, 'select public.my_access()');
ok(s && out === '', 'and has no trial or subscription from before', out);

// Any future table that points at auth.users must clean up after a deleted user too.
[, out] = await psql(`select string_agg(conrelid::regclass::text, ', ') from pg_constraint
                       where contype = 'f' and confrelid = 'auth.users'::regclass and confdeltype not in ('c', 'n')`);
ok(out === '', 'every foreign key to auth.users is on delete cascade or set null', out);

console.log('fails', fails());
process.exit(fails() ? 1 : 0);
