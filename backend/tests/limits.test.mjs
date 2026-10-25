// Rate limits and quotas from 0002: normal use goes through, too much is refused with a clear message.
// "An hour later" is simulated by moving the counted events back in time.
import { freshDb, helpers } from './db.mjs';

const db = await freshDb();
const { psql, asUser, ok, signup, fails } = helpers(db);
let s, out, e;

const ago = (action, interval) => psql(`update app.rate_events set at = at - interval '${interval}' where action = '${action}'`);
const sendInvite = (uid, email) => asUser(uid, `select public.send_friend_request('${email}')`);
const users = async (prefix, n) => { const ids = []; for (let i = 0; i < n; i++) ids.push(await signup(`${prefix}${i}@example.com`)); return ids; };
// Makes two people friends directly, the way an accepted invite would.
const befriend = (a, b) => psql(`insert into public.friendships values ('${a < b ? a : b}', '${a < b ? b : a}')`);

// ---- send_friend_request: 10 per hour, 30 per day, 3 times the same email per week ----
console.log('friend requests');
const A = await signup('ana@example.com');
let sent = 0;
for (let i = 0; i < 10; i++) if ((await sendInvite(A, `hour${i}@example.com`))[0]) sent++;
ok(sent === 10, '10 invites in an hour go through', String(sent));
[s, , e] = await sendInvite(A, 'hour10@example.com');
ok(!s && e.includes('up to 10 friend requests per hour') && e.includes('rate_limited'), 'the 11th in the same hour is refused', e);
ok((await psql("select count(*) from public.friend_requests where to_email = 'hour10@example.com'"))[1] === '0', 'and nothing was saved');
await ago('friend_request', '61 minutes');
ok((await sendInvite(A, 'later0@example.com'))[0], 'an hour later invites work again');
for (let i = 1; i < 10; i++) await sendInvite(A, `later${i}@example.com`);
await ago('friend_request', '61 minutes');
for (let i = 0; i < 10; i++) await sendInvite(A, `third${i}@example.com`);
await ago('friend_request', '61 minutes');
ok((await psql(`select count(*) from app.rate_events where user_id = '${A}' and action = 'friend_request'`))[1] === '30', '30 invites in one day so far');
[s, , e] = await sendInvite(A, 'day31@example.com');
ok(!s && e.includes('up to 30 friend requests per day'), 'the 31st in the same day is refused', e);
await ago('friend_request', '1 day');
ok((await sendInvite(A, 'nextday@example.com'))[0], 'the next day invites work again');

const B = await signup('bojan@example.com');
for (let i = 0; i < 3; i++) [s, , e] = await sendInvite(B, 'same@example.com');
ok(s, 'the same email can be invited (re-sent) 3 times in a week', e);
[s, , e] = await sendInvite(B, 'same@example.com');
ok(!s && e.includes('same email up to 3 times per week'), 'a 4th invite to the same email that week is refused', e);
ok((await sendInvite(B, 'other@example.com'))[0], 'other emails are not affected');
await ago('friend_request_same_email', '7 days');
ok((await sendInvite(B, 'same@example.com'))[0], 'a week later the same email can be invited again');

// ---- quota: at most 50 unanswered invites at a time ----
console.log('pending invites');
const P = await signup('pending@example.com');
for (let i = 0; i < 50; i++) {
  await psql(`insert into public.friend_requests (from_user, to_email) values ('${P}', 'wait${i}@example.com')`);
}
[s, , e] = await sendInvite(P, 'wait50@example.com');
ok(!s && e.includes('50 invites waiting') && e.includes('quota'), 'with 50 invites waiting, a new one is refused', e);
ok((await sendInvite(P, 'wait0@example.com'))[0], 're-sending one of the 50 still works');
await asUser(P, "delete from public.friend_requests where to_email = 'wait1@example.com'");
ok((await sendInvite(P, 'wait50@example.com'))[0], 'after cancelling one, a new invite goes through');

// ---- quota: at most 200 friends ----
console.log('friends');
const F = await signup('popular@example.com');
const many = await users('friend', 201);
for (const u of many.slice(0, 199)) await befriend(F, u);
const X = many[199], Y = many[200];
[s, , e] = await sendInvite(F, 'friend199@example.com');
ok(s, 'with 199 friends you can still invite', e);
const [, reqId] = await psql(`select id from public.friend_requests where to_user = '${X}'`);
[s, , e] = await asUser(X, `select public.respond_friend_request('${reqId}', true)`);
ok(s, 'the 200th friend accepts', e);
ok((await psql(`select app.friend_count('${F}')`))[1] === '200', 'now 200 friends');
[s, , e] = await sendInvite(F, 'friend200@example.com');
ok(!s && e.includes('up to 200 friends'), 'with 200 friends a new invite is refused', e);
const [, yReq] = await psql(`insert into public.friend_requests (from_user, to_email, to_user) values ('${Y}', 'popular@example.com', '${F}') returning id`);
[s, , e] = await asUser(F, `select public.respond_friend_request('${yReq}', true)`);
ok(!s && e.includes('up to 200 friends'), 'with 200 friends accepting one more is refused', e);
const Z = await signup('fan@example.com');
const [, zReq] = await psql(`insert into public.friend_requests (from_user, to_email, to_user) values ('${F}', 'fan@example.com', '${Z}') returning id`);
[s, , e] = await asUser(Z, `select public.respond_friend_request('${zReq}', true)`);
ok(!s && e.includes('They already have 200 friends'), 'nobody can accept an invite from someone who already has 200 friends', e);
ok((await asUser(F, `select public.respond_friend_request('${yReq}', false)`))[0], 'declining still works at 200 friends');

// ---- respond_friend_request: 30 per hour ----
console.log('answering invites');
const R = await signup('responder@example.com');
const senders = await users('sender', 31);
const reqs = [];
for (const u of senders) reqs.push((await psql(`insert into public.friend_requests (from_user, to_email, to_user) values ('${u}', 'responder@example.com', '${R}') returning id`))[1]);
let answered = 0;
for (const id of reqs.slice(0, 30)) if ((await asUser(R, `select public.respond_friend_request('${id}', ${answered % 2 === 0})`))[0]) answered++;
ok(answered === 30, '30 answers (accept or decline) in an hour go through', String(answered));
[s, , e] = await asUser(R, `select public.respond_friend_request('${reqs[30]}', true)`);
ok(!s && e.includes('answer up to 30 friend requests per hour'), 'the 31st answer in the same hour is refused', e);
await ago('friend_response', '61 minutes');
ok((await asUser(R, `select public.respond_friend_request('${reqs[30]}', true)`))[0], 'an hour later it works again');

// ---- quota: at most 10 shared goals per person; create_goal: 30 per hour ----
console.log('goals');
const G = await signup('goals@example.com');
const goals = [];
for (let i = 0; i < 10; i++) { [s, out, e] = await asUser(G, `select public.create_goal('Goal ${i}', 100, 'EUR')`); if (s) goals.push(out); }
ok(goals.length === 10, 'one person can be in 10 shared goals', String(goals.length));
[s, , e] = await asUser(G, "select public.create_goal('Goal 11', 100, 'EUR')");
ok(!s && e.includes('up to 10 shared goals') && e.includes('quota'), 'an 11th goal is refused', e);
await asUser(G, `select public.leave_goal('${goals[0]}')`);
ok((await asUser(G, "select public.create_goal('Goal 11', 100, 'EUR')"))[0], 'after leaving one, a new goal can be made');

const H = await signup('hourly@example.com');
let created = 0;
for (let i = 0; i < 30; i++) {
  [s, out] = await asUser(H, `select public.create_goal('Hourly ${i}', 100, 'EUR')`);
  if (s) { created++; await asUser(H, `select public.leave_goal('${out}')`); }
}
ok(created === 30, '30 goals in an hour go through (making and leaving them)', String(created));
[s, , e] = await asUser(H, "select public.create_goal('One too many', 100, 'EUR')");
ok(!s && e.includes('create up to 30 shared goals per hour'), 'the 31st in the same hour is refused', e);

// ---- add_friend_to_goal: 30 per hour, at most 20 people per goal, friend in at most 10 goals ----
console.log('people in goals');
const M = await signup('maker@example.com');
const pals = await users('pal', 21);
for (const u of pals) await befriend(M, u);
const [, big] = await asUser(M, "select public.create_goal('Big trip', 5000, 'EUR')");
let added = 0;
for (const u of pals.slice(0, 19)) if ((await asUser(M, `select public.add_friend_to_goal('${big}', '${u}')`))[0]) added++;
ok(added === 19, 'a goal can have 20 people', String(added));
[s, , e] = await asUser(M, `select public.add_friend_to_goal('${big}', '${pals[19]}')`);
ok(!s && e.includes('up to 20 people'), 'a 21st person is refused', e);
ok((await asUser(M, `select public.add_friend_to_goal('${big}', '${pals[0]}')`))[0], 'adding someone who is already in the goal is still fine');

const busy = pals[20];
for (let i = 0; i < 10; i++) await asUser(busy, `select public.create_goal('Busy ${i}', 100, 'EUR')`);
const [, small] = await asUser(M, "select public.create_goal('Small', 100, 'EUR')");
[s, , e] = await asUser(M, `select public.add_friend_to_goal('${small}', '${busy}')`);
ok(!s && e.includes('already in 10 shared goals'), 'a friend who is already in 10 goals cannot be added', e);

await ago('goal_add_friend', '61 minutes');
const N = await signup('adder@example.com');
const buddies = await users('buddy', 31);
for (const u of buddies) await befriend(N, u);
const targets = [];
for (let i = 0; i < 3; i++) targets.push((await asUser(N, `select public.create_goal('Group ${i}', 100, 'EUR')`))[1]);
added = 0;
for (let i = 0; i < 30; i++) if ((await asUser(N, `select public.add_friend_to_goal('${targets[Math.floor(i / 15)]}', '${buddies[i]}')`))[0]) added++;
ok(added === 30, '30 people added to goals in an hour go through', String(added));
[s, , e] = await asUser(N, `select public.add_friend_to_goal('${targets[2]}', '${buddies[30]}')`);
ok(!s && e.includes('add up to 30 people to goals per hour'), 'the 31st in the same hour is refused', e);

// ---- contributions: 60 per hour; goal edits: 60 per hour ----
console.log('contributions and goal edits');
const S = await signup('saver@example.com');
const [, pot] = await asUser(S, "select public.create_goal('Pot', 10000, 'EUR')");
let saved = 0;
for (let i = 0; i < 60; i++) if ((await asUser(S, `insert into public.contributions (goal_id, user_id, amount) values ('${pot}', '${S}', 5)`))[0]) saved++;
ok(saved === 60, '60 contributions in an hour go through', String(saved));
[s, , e] = await asUser(S, `insert into public.contributions (goal_id, user_id, amount) values ('${pot}', '${S}', 5)`);
ok(!s && e.includes('save up to 60 contributions per hour'), 'the 61st in the same hour is refused', e);
[s, , e] = await asUser(S, `update public.contributions set note = 'x' where id = (select id from public.contributions where user_id = '${S}' limit 1)`);
ok(!s && e.includes('60 contributions per hour'), 'changing a contribution counts too', e);
await ago('contribution', '61 minutes');
ok((await asUser(S, `insert into public.contributions (goal_id, user_id, amount) values ('${pot}', '${S}', 5)`))[0], 'an hour later it works again');
ok((await psql(`insert into public.contributions (goal_id, user_id, amount) select '${pot}', '${S}', 1 from generate_series(1, 100)`))[0],
  'the server (no user in the token) is not limited');

let edits = 0;
for (let i = 0; i < 60; i++) if ((await asUser(S, `update public.goals set target = ${1000 + i} where id = '${pot}'`))[0]) edits++;
ok(edits === 60, '60 goal edits in an hour go through', String(edits));
[s, , e] = await asUser(S, `update public.goals set name = 'Spam' where id = '${pot}'`);
ok(!s && e.includes('edit shared goals up to 60 times per hour'), 'the 61st edit in the same hour is refused', e);

// ---- invite email (used by the send-invite-email server function) ----
console.log('invite emails');
const I = await signup('inviter@example.com');
await psql(`update public.profiles set display_name = 'Ivan' where id = '${I}'`);
const [, inv] = await sendInvite(I, 'newbie@example.com');
[s, out, e] = await asUser(I, `select to_email || '|' || from_name from public.claim_invite_email('${inv}')`);
ok(s && out === 'newbie@example.com|Ivan', 'the server function gets the address and the name to send', out + e);
[s, , e] = await asUser(I, `select * from public.claim_invite_email('${inv}')`);
ok(!s && e.includes('already sent'), 'the same invite cannot be emailed twice', e);
[s, , e] = await asUser(B, `select * from public.claim_invite_email('${inv}')`);
ok(!s && e.includes('request not found'), "nobody can email someone else's invite", e);
await psql(`update public.friend_requests set emailed_at = emailed_at - interval '1 minute' where id = '${inv}'`);
await sendInvite(I, 'newbie@example.com');
ok((await asUser(I, `select * from public.claim_invite_email('${inv}')`))[0], 'after re-sending the invite, one more email is allowed');

const J = await signup('mailer@example.com');
let mailed = 0;
for (let i = 0; i < 31; i++) {
  const [, id] = await psql(`insert into public.friend_requests (from_user, to_email) values ('${J}', 'mail${i}@example.com') returning id`);
  [s, , e] = await asUser(J, `select * from public.claim_invite_email('${id}')`);
  if (s) mailed++;
}
ok(mailed === 30 && e.includes('up to 30 invite emails per day'), 'one person: 30 invite emails a day, the 31st is refused', `${mailed} ${e}`);

await psql("update app.rate_events set at = at - interval '1 day' where action = 'invite_email'");
await psql("update app.rate_limits set max_count = 5 where action = 'invite_email' and app_wide");
const crowd = await users('crowd', 6);
mailed = 0;
for (const u of crowd) {
  const [, id] = await psql(`insert into public.friend_requests (from_user, to_email) values ('${u}', 'x-${u}@example.com') returning id`);
  [s, , e] = await asUser(u, `select * from public.claim_invite_email('${id}')`);
  if (s) mailed++;
}
ok(mailed === 5 && e.includes('paused for today'), 'the whole app: emails stop at the daily cap (set to 5 for the test)', `${mailed} ${e}`);

// ---- store subscriptions written by the RevenueCat webhook ----
console.log('subscriptions from the store');
const T = await signup('trial@example.com', false);
const store = (until, at) => asUser(null, `select public.apply_store_event('${T}', ${until}, 'monthly', ${at})`, 'service_role');
[s, out, e] = await store("now() + interval '7 days'", "now() - interval '1 hour'");
ok(s && out === 't', 'the server records a trial', out + e);
ok((await asUser(T, 'select public.my_access() > now()'))[1] === 't', 'the user now has access');
await store("now() - interval '1 day'", "now() - interval '2 hours'");
ok((await asUser(T, 'select public.my_access() > now()'))[1] === 't', 'an older event that arrives late does not take access away');
await store("'infinity'", 'now()');
ok((await asUser(T, "select public.my_access() = 'infinity'"))[1] === 't', 'a lifetime purchase never runs out');
ok((await asUser(null, `select public.apply_store_event(gen_random_uuid(), now(), 'x', now())`, 'service_role'))[1] === 'f',
  'an unknown user is ignored');
[s, , e] = await asUser(T, `select public.apply_store_event('${T}', 'infinity', 'free', now())`);
ok(!s, 'the app cannot give itself a subscription');

// ---- the counters are private ----
console.log('privacy');
[s, , e] = await asUser(A, 'select count(*) from app.rate_events');
ok(!s, 'the app cannot read the counters');
[s, , e] = await asUser(A, "update app.rate_limits set max_count = 100000");
ok(!s, 'the app cannot change the limits');
[s, , e] = await asUser(A, `select app.rate_limit('${A}', 'friend_request')`);
ok(!s, 'the app cannot call the counting function directly');
[s] = await asUser(null, "select * from public.claim_invite_email(gen_random_uuid())", 'anon');
ok(!s, 'signed-out visitors cannot ask for invite emails');

[, out] = await psql(`select string_agg(n.nspname || '.' || c.relname, ', ') from pg_class c join pg_namespace n on n.oid = c.relnamespace
                        where n.nspname in ('public', 'app') and c.relkind in ('r', 'p') and not c.relrowsecurity`);
ok(out === '', 'row level security is on for every table', out);

console.log('fails', fails());
process.exit(fails() ? 1 : 0);
