// The same 49 checks as test_shared_goals.py, run on PGlite so they work without a local Postgres or Python,
// and with every migration applied (so the limits from 0002 must not get in the way of normal use).
import { freshDb, helpers } from './db.mjs';

const db = await freshDb();
const { psql, asUser, ok, signup, fails } = helpers(db);
let s, out, e, rid, rid2, G, G2;

const A = await signup('ana@example.com'); const B = await signup('Bojan@Example.com'); const C = await signup('ceca@example.com');
const D = await signup('dule@example.com', false);

ok((await psql(`select email from public.profiles where id='${B}'`))[1] === 'bojan@example.com', 'signup creates a profile (email lower-cased)');

// ---- friends ----
[s, rid, e] = await asUser(A, "select public.send_friend_request('BOJAN@example.com')");
ok(s, 'A invites B by email', e);
[s, out, e] = await asUser(C, 'select count(*) from public.friend_requests');
ok(s && out === '0', 'C cannot see the invite between A and B', out + e);
[s, out, e] = await asUser(B, "select count(*) from public.friend_requests where status='pending'");
ok(out === '1', 'B sees the invite', out + e);
[s, out, e] = await asUser(C, `select public.respond_friend_request('${rid}', true)`);
ok(!s, 'C cannot accept an invite meant for B');
[s, out, e] = await asUser(B, `select public.respond_friend_request('${rid}', true)`);
ok(s, 'B accepts', e);
ok((await asUser(A, 'select count(*) from public.friendships'))[1] === '1', 'A and B are friends');
[s, out, e] = await asUser(A, "select public.send_friend_request('bojan@example.com')");
ok(!s && e.includes('already friends'), 'inviting an existing friend again is refused', e);
[s, out, e] = await asUser(A, "select public.send_friend_request('ana@example.com')");
ok(!s && e.includes('yourself'), 'cannot add yourself', e);
[s, out, e] = await asUser(A, "select public.send_friend_request('not an email')");
ok(!s && e.includes('invalid email'), 'bad email is refused', e);
[s, out, e] = await asUser(D, "select public.send_friend_request('ana@example.com')");
ok(!s && e.includes('subscription required'), 'no trial/subscription: cannot add friends', e);
[s, out, e] = await asUser(A, `insert into public.friendships values ('${[A, C].sort().join("','")}')`);
ok(!s, 'nobody can make a friendship without an accepted invite');

// invite before the other person has an account
[s, rid2, e] = await asUser(A, "select public.send_friend_request('eva@example.com')");
ok(s, 'A invites someone who has no account yet', e);
const E = await signup('eva@example.com');
ok((await asUser(E, "select count(*) from public.friend_requests where status='pending'"))[1] === '1', 'after signing up, Eva finds the invite waiting');
ok((await asUser(E, `select public.respond_friend_request('${rid2}', true)`))[0], 'Eva accepts');

// two people inviting each other: the second invite simply accepts the first
[s, , e] = await asUser(C, "select public.send_friend_request('bojan@example.com')"); ok(s, 'C invites B', e);
[s, , e] = await asUser(B, "select public.send_friend_request('ceca@example.com')"); ok(s, 'B invites C back', e);
ok((await asUser(B, `select count(*) from public.friendships where '${C}' in (user_a,user_b)`))[1] === '1', 'crossed invites become a friendship');

// ---- goals ----
[s, G, e] = await asUser(A, "select public.create_goal('Summer trip', 2000, 'eur')");
ok(s, 'A creates a goal', e);
ok((await asUser(A, `select currency from public.goals where id='${G}'`))[1] === 'EUR', 'currency stored in capitals');
[s, , e] = await asUser(A, `select public.add_friend_to_goal('${G}', '${B}')`); ok(s, 'A adds friend B', e);
[s, , e] = await asUser(A, `select public.add_friend_to_goal('${G}', '${C}')`);
ok(!s && e.includes('only friends'), 'A cannot add C (not friends)', e);
[s, , e] = await asUser(B, `select public.add_friend_to_goal('${G}', '${C}')`); ok(s, 'B (equal member) adds his own friend C', e);
ok((await asUser(D, 'select count(*) from public.goals'))[1] === '0', 'outsider D sees no goals');
[s, , e] = await asUser(A, `insert into public.goal_members (goal_id, user_id) values ('${G}', '${D}')`);
ok(!s, 'nobody can put people in a goal behind the rules');

[s, , e] = await asUser(A, `insert into public.contributions (goal_id, user_id, amount) values ('${G}', '${A}', 500)`); ok(s, 'A puts in 500', e);
[s, , e] = await asUser(B, `insert into public.contributions (goal_id, user_id, amount) values ('${G}', '${B}', 300)`); ok(s, 'B puts in 300', e);
[s, , e] = await asUser(B, `insert into public.contributions (goal_id, user_id, amount) values ('${G}', '${A}', 999)`);
ok(!s, "B cannot log money in A's name");
[s, , e] = await asUser(E, `insert into public.contributions (goal_id, user_id, amount) values ('${G}', '${E}', 50)`);
ok(!s, 'Eva (not in the goal) cannot put money in');
[s, , e] = await asUser(C, `insert into public.contributions (goal_id, user_id, amount) values ('${G}', '${C}', -5)`);
ok(!s, 'negative amounts are refused');
[s, out, e] = await asUser(C, `update public.contributions set amount = 1 where user_id = '${A}' returning id`);
ok(s && out === '', "C cannot change A's contribution", out + e);
ok((await asUser(C, `select saved||'/'||members from public.goal_totals where goal_id='${G}'`))[1] === '800.00/3', 'totals: 800 saved, 3 members');
[s, , e] = await asUser(B, `update public.goals set target = 2500, name = 'Greece' where id = '${G}'`); ok(s, 'any member can edit the goal (no admin)', e);
[s, , e] = await asUser(B, `update public.goals set created_by = '${B}' where id = '${G}'`);
ok(!s, 'nobody can rewrite who created the goal');
ok((await asUser(C, 'select count(*) from public.profiles'))[1] === '3', 'C sees names of everyone in the goal (A, B and herself)');
[s, , e] = await asUser(A, `update public.profiles set email = 'x@y.z' where id = '${A}'`); ok(!s, 'email cannot be changed from the app');
[s, , e] = await asUser(A, `update public.profiles set display_name = 'Ana' where id = '${A}'`); ok(s, 'own display name can be changed', e);

// subscription runs out: can still look and leave, cannot change anything
await psql(`update public.subscriptions set active_until = now() - interval '1 minute' where user_id = '${C}'`);
[s, , e] = await asUser(C, `insert into public.contributions (goal_id, user_id, amount) values ('${G}', '${C}', 10)`);
ok(!s, 'after the trial ends without paying: no new contributions');
[s, out, e] = await asUser(C, `update public.goals set target = 1 where id = '${G}' returning id`);
ok(s && out === '', 'after the trial ends without paying: cannot edit the goal', out + e);

// leaving: your money in the goal is deleted, everything else stays
[s, , e] = await asUser(A, `select public.leave_goal('${G}')`); ok(s, 'A (who created it) leaves', e);
ok((await asUser(B, `select saved||'/'||members||'/'||name from public.goal_totals where goal_id='${G}'`))[1] === '300.00/2/Greece',
  "A's 500 is gone, goal stays for B and C with the same name");
ok((await asUser(A, `select count(*) from public.goals where id='${G}'`))[1] === '0', 'A no longer sees the goal');
[s, , e] = await asUser(C, `select public.leave_goal('${G}')`); ok(s, 'C leaves even with an expired subscription', e);
[s, , e] = await asUser(B, `select public.leave_goal('${G}')`); ok(s, 'B, the last one, leaves', e);
ok((await psql(`select count(*) from public.goals where id='${G}'`))[1] === '0', 'the empty goal is deleted');
ok((await psql(`select count(*) from public.contributions where goal_id='${G}'`))[1] === '0', 'and no money rows are left behind');

// deleting an account cleans up after itself
[s, G2, e] = await asUser(B, "select public.create_goal('Gift', 100, 'RSD')");
await asUser(B, `select public.add_friend_to_goal('${G2}', '${A}')`);
await asUser(A, `insert into public.contributions (goal_id, user_id, amount) values ('${G2}', '${A}', 40)`);
await psql(`delete from auth.users where id = '${A}'`);
ok((await asUser(B, `select saved||'/'||members from public.goal_totals where goal_id='${G2}'`))[1] === '0.00/1',
  'deleting an account removes that person and their money from goals');
ok((await psql(`select count(*) from public.friendships where '${A}' in (user_a, user_b)`))[1] === '0', 'and their friendships');

// anonymous (not signed in) gets nothing
[s] = await asUser(null, 'select count(*) from public.goals', 'anon');
ok(!s, 'signed-out visitors cannot read anything');

console.log('fails', fails());
process.exit(fails() ? 1 : 0);
