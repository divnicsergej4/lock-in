// Who sees what (0004): other people see only a display name, an email is seen by nobody but its owner,
// and sending an invite does not tell you whether that email has an account.
import { freshDb, helpers } from './db.mjs';

const db = await freshDb();
const { psql, asUser, ok, signup, fails } = helpers(db);
let s, out, e;

const befriend = (a, b) => psql(`insert into public.friendships values ('${a < b ? a : b}', '${a < b ? b : a}')`);
const name = (uid, n) => psql(`update public.profiles set display_name = '${n}' where id = '${uid}'`);

console.log('who sees what');
const ANA = await signup('ana@example.com');
const BOJAN = await signup('bojan@example.com');
const CECA = await signup('ceca@example.com');
const DUSAN = await signup('dusan@example.com');
const EMA = await signup('ema@example.com');
for (const [u, n] of [[ANA, 'Ana'], [BOJAN, 'Bojan'], [CECA, 'Ceca'], [DUSAN, 'Dusan'], [EMA, 'Ema']]) await name(u, n);
await befriend(ANA, BOJAN);
await befriend(ANA, CECA);
// Ana makes a goal with Bojan and Ceca: Bojan and Ceca are not friends, they only share the goal.
const [, GOAL] = await asUser(ANA, "select public.create_goal('Greece', 2000, 'EUR')");
await asUser(ANA, `select public.add_friend_to_goal('${GOAL}', '${BOJAN}')`);
await asUser(ANA, `select public.add_friend_to_goal('${GOAL}', '${CECA}')`);
// Dusan invites Bojan (pending).
const [, REQ] = await asUser(DUSAN, "select public.send_friend_request('bojan@example.com')");

// ---- emails ----
[s, , e] = await asUser(BOJAN, 'select email from public.profiles');
ok(!s && e.includes('permission denied'), 'no one can read emails from profiles, not even their own', e);
[s, , e] = await asUser(CECA, `select email from public.profiles where id = '${BOJAN}'`);
ok(!s, 'a goal member who is not a friend cannot read the email', e);
[s, , e] = await asUser(ANA, `select email from public.profiles where id = '${BOJAN}'`);
ok(!s, 'a friend cannot read it either (the stricter choice)', e);
[s, , e] = await asUser(ANA, 'select * from public.profiles');
ok(!s, 'select * is refused too, so the app always names the columns', e);

// ---- names ----
const names = async (uid) => (await asUser(uid, 'select display_name from public.profiles order by display_name'))[1].split('\n').join(',');
ok(await names(BOJAN) === 'Ana,Bojan,Ceca,Dusan', 'Bojan sees himself, his friend, a goal member and who invited him', await names(BOJAN));
ok(await names(CECA) === 'Ana,Bojan,Ceca', 'Ceca sees the goal members by name, not strangers', await names(CECA));
ok(await names(DUSAN) === 'Dusan', 'whoever sends an invite does not see the other person', await names(DUSAN));
ok(await names(EMA) === 'Ema', 'a stranger sees only herself', await names(EMA));
await asUser(BOJAN, `select public.respond_friend_request('${REQ}', false)`);
ok(!(await names(BOJAN)).includes('Dusan'), 'after declining, Dusan is no longer visible to Bojan');

// ---- invites do not reveal accounts ----
await asUser(DUSAN, "select public.send_friend_request('ema@example.com')");
await asUser(DUSAN, "select public.send_friend_request('nobody@example.com')");
[s, , e] = await asUser(DUSAN, 'select to_user from public.friend_requests');
ok(!s, 'the sender cannot read to_user', e);
[s, , e] = await asUser(EMA, 'select to_user from public.friend_requests');
ok(!s, 'nor can the recipient (the app does not need it)', e);
[s, out, e] = await asUser(DUSAN, `select to_email || '|' || status from public.friend_requests where status = 'pending' order by to_email`);
ok(s && out === 'ema@example.com|pending\nnobody@example.com|pending',
  'an invite to an account and one to an unknown email look exactly the same to the sender', out || e);
[s, out] = await asUser(EMA, `select count(*) from public.friend_requests where from_user = '${DUSAN}'`);
ok(s && out === '1', 'the recipient sees the invite');

// ---- the invite email ----
const ZORA = await signup('zora@example.com');
const [, zReq] = await asUser(ZORA, "select public.send_friend_request('friend@example.com')");
[s, out, e] = await asUser(ZORA, `select to_email || '|' || coalesce(from_name, '(none)') from public.claim_invite_email('${zReq}')`);
ok(s && out === 'friend@example.com|(none)', 'without a display name the invite email gets no name, never the sender\'s email', out || e);
const [, aReq] = await asUser(ANA, "select public.send_friend_request('friend@example.com')");
[s, out] = await asUser(ANA, `select from_name from public.claim_invite_email('${aReq}')`);
ok(s && out === 'Ana', 'with a display name it gets the name', out);

// ---- every column the app can read, everywhere (a new leak would show up here) ----
[, out] = await psql(`select string_agg(table_name || '.' || column_name, ' ' order by table_name, column_name)
                        from information_schema.column_privileges
                       where table_schema = 'public' and grantee = 'authenticated' and privilege_type = 'SELECT'`);
const allowed = [
  'contributions.amount', 'contributions.created_at', 'contributions.goal_id', 'contributions.id', 'contributions.note', 'contributions.user_id',
  'friend_requests.created_at', 'friend_requests.emailed_at', 'friend_requests.from_user', 'friend_requests.id', 'friend_requests.responded_at',
  'friend_requests.status', 'friend_requests.to_email',
  'friendships.created_at', 'friendships.user_a', 'friendships.user_b',
  'goal_members.added_by', 'goal_members.goal_id', 'goal_members.joined_at', 'goal_members.user_id',
  'goal_totals.currency', 'goal_totals.goal_id', 'goal_totals.members', 'goal_totals.name', 'goal_totals.saved', 'goal_totals.target',
  'goals.created_at', 'goals.created_by', 'goals.currency', 'goals.id', 'goals.name', 'goals.target', 'goals.updated_at',
  'profiles.display_name', 'profiles.id',
  'subscriptions.active_until', 'subscriptions.product', 'subscriptions.updated_at', 'subscriptions.user_id',
].join(' ');
ok(out === allowed, 'the app can read exactly these columns and no others (no email, no to_user)', out);
[, out] = await psql(`select count(*) from information_schema.column_privileges where table_schema = 'public' and grantee = 'anon'`);
ok(out === '0', 'a signed-out visitor can read nothing', out);
[, out] = await psql(`select string_agg(p.proname, ' ' order by p.proname) from pg_proc p
                       where p.pronamespace = 'public'::regnamespace and has_function_privilege('authenticated', p.oid, 'execute')`);
ok(out === 'add_friend_to_goal claim_invite_email create_goal leave_goal my_access respond_friend_request send_friend_request',
  'the app can call exactly these RPCs', out);
[, out] = await psql(`select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')`);
ok(out === '0', 'a signed-out visitor can call no RPC', out);
[, out] = await psql(`select coalesce(string_agg(p.proname, ' '), '') from pg_proc p where p.pronamespace = 'public'::regnamespace
                       and pg_get_function_result(p.oid) ilike '%email%' and p.proname <> 'claim_invite_email'`);
ok(out === '', 'no RPC except claim_invite_email (your own invite) returns an email', out);

console.log('fails', fails());
process.exit(fails() ? 1 : 0);
