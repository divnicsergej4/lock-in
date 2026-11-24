// Shared-goal push notifications (0005): tokens are private, the right people get the right events, the one who
// did it gets nothing, an expired member only hears about people leaving, and at most one notification per
// person per goal goes out every 10 minutes. "10 minutes later" is simulated by moving sent_at back.
import { freshDb, helpers } from './db.mjs';

const db = await freshDb();
const { psql, asUser, ok, signup, fails } = helpers(db);
let s, out, e;

const tok = (n) => `ExponentPushToken[device${n}aaaa]`;
const befriend = (a, b) => psql(`insert into public.friendships values ('${a < b ? a : b}', '${a < b ? b : a}')`);
const register = (uid, n, platform = 'ios') => asUser(uid, `select public.register_push_token('${tok(n)}', '${platform}')`);
const claim = async () => {
  const [ok_, txt, err] = await asUser(null, `select coalesce(jsonb_agg(jsonb_build_object('to', recipient, 'goal', goal_name,
      'cur', currency, 'events', events, 'tokens', tokens, 'ids', ids)), '[]')::text from public.claim_goal_pushes()`, 'service_role');
  if (!ok_) throw new Error(err);
  return JSON.parse(txt);
};
const later = () => psql(`update app.push_events set sent_at = sent_at - interval '11 minutes' where sent_at is not null`);
const pending = async (uid) => (await psql(`select count(*) from app.push_events where recipient = '${uid}' and sent_at is null`))[1];

console.log('push tokens');
const ANNA = await signup('anna@example.com');
const MARK = await signup('mark@example.com');
const EVA = await signup('eva@example.com');
const IVY = await signup('ivy@example.com'); // in the goal, alerts off (no token)
for (const [u, n] of [[ANNA, 'Anna'], [MARK, 'Mark'], [EVA, 'Eva'], [IVY, 'Ivy']]) await psql(`update public.profiles set display_name = '${n}' where id = '${u}'`);

[s, , e] = await register(ANNA, 1);
ok(s, 'a signed-in user registers this phone', e);
[s, , e] = await asUser(null, `select public.register_push_token('${tok(9)}', 'ios')`, 'anon');
ok(!s, 'a signed-out visitor cannot register a token', e);
for (const bad of ['hello', 'ExponentPushToken[]', "ExponentPushToken[x'); drop table x;--]", 'ExponentPushToken[abc def gh]']) {
  [s, , e] = await asUser(ANNA, `select public.register_push_token(${`'${bad.replace(/'/g, "''")}'`}, 'ios')`);
  ok(!s && e.includes('invalid push token'), `refused token: ${bad.slice(0, 30)}`, e);
}
[s, , e] = await asUser(ANNA, `select public.register_push_token('${tok(2)}', 'windows')`);
ok(!s, 'refused platform', e);
await register(MARK, 3);
await register(EVA, 4);
[s, out] = await asUser(ANNA, 'select token from public.push_tokens');
ok(s && out === tok(1), 'Anna sees only her own token', out);
[s, , e] = await asUser(ANNA, `delete from public.push_tokens where token = '${tok(3)}'`);
ok((await psql(`select count(*) from public.push_tokens where token = '${tok(3)}'`))[1] === '1', 'and cannot remove anyone else\'s', e);
[s, , e] = await asUser(ANNA, `insert into public.push_tokens (token, user_id, platform) values ('${tok(5)}', '${MARK}', 'ios')`);
ok(!s, 'nor write a token for someone else directly', e);
[s, , e] = await asUser(ANNA, `update public.push_tokens set user_id = '${ANNA}' where token = '${tok(3)}'`);
ok(!s, 'nor take someone else\'s token', e);
[s, , e] = await asUser(ANNA, 'select user_id from public.push_tokens');
ok(!s, 'user_id is not even readable', e);
// The same phone signs in to another account: it moves (the old account no longer gets alerts there).
await register(IVY, 1);
ok((await psql(`select user_id from public.push_tokens where token = '${tok(1)}'`))[1] === IVY, 'a phone that signs in to another account moves to it');
await asUser(IVY, `select public.unregister_push_token('${tok(1)}')`);
ok((await psql(`select count(*) from public.push_tokens where user_id = '${IVY}'`))[1] === '0', 'unregister (alerts off / sign out) removes it');
await register(ANNA, 1);
for (let i = 10; i < 29; i++) await register(EVA, i); // with the first one: 20 this hour
ok((await psql(`select count(*) from public.push_tokens where user_id = '${EVA}'`))[1] === '10', 'at most 10 phones per person (the oldest go)');
[s, , e] = await register(EVA, 30);
ok(!s && e.includes('up to 20 times per hour'), 'the 21st registration in an hour is refused', e);
await psql(`delete from public.push_tokens where user_id = '${EVA}'`);
await psql(`update app.rate_events set at = at - interval '2 hours' where action = 'push_token'`);
await register(EVA, 4);

console.log('who gets what');
for (const [a, b] of [[ANNA, MARK], [ANNA, EVA], [ANNA, IVY]]) await befriend(a, b);
const [, G] = await asUser(ANNA, "select public.create_goal('Summer trip', 2000, 'EUR')");
ok((await psql('select count(*) from app.push_events'))[1] === '0', 'making a goal alone notifies nobody');
await asUser(ANNA, `select public.add_friend_to_goal('${G}', '${MARK}')`);
ok((await psql('select count(*) from app.push_events'))[1] === '0', 'Anna adds Mark: no one else is in the goal yet, Anna did it, Mark is the one who joined');
await asUser(ANNA, `select public.add_friend_to_goal('${G}', '${EVA}')`);
[, out] = await psql(`select recipient || ' ' || kind from app.push_events`);
ok(out === `${MARK} joined`, 'Eva joins: only Mark hears about it (not Anna, who added her, not Eva)', out);

let msgs = await claim();
ok(msgs.length === 1 && msgs[0].to === MARK && msgs[0].goal === 'Summer trip' && msgs[0].cur === 'EUR' && msgs[0].tokens[0] === tok(3)
  && msgs[0].events.length === 1 && msgs[0].events[0].kind === 'joined' && msgs[0].events[0].actor_name === 'Eva',
  'the function gets: Mark, his phone, "Eva joined Summer trip"', JSON.stringify(msgs));
await asUser(ANNA, `select public.add_friend_to_goal('${G}', '${IVY}')`);
ok((await pending(IVY)) === '0', 'Ivy has alerts off: nothing is queued for her');
[, out] = await psql(`select string_agg(recipient::text, ' ' order by recipient) from app.push_events where kind = 'joined' and actor = '${IVY}'`);
ok(out === [MARK, EVA].sort().join(' '), 'Ivy joining is queued for Mark and Eva (not Anna, who added her)', out);

// Mark pays: Anna and Eva are told, Mark is not.
await asUser(MARK, `insert into public.contributions (goal_id, user_id, amount) values ('${G}', '${MARK}', 50)`);
[, out] = await psql(`select string_agg(recipient::text, ' ' order by recipient) from app.push_events where kind = 'paid'`);
ok(out === [ANNA, EVA].sort().join(' '), 'Mark pays: Anna and Eva get it, not Mark', out);
ok((await psql(`select amount || ' ' || actor_name from app.push_events where kind = 'paid' limit 1`))[1] === '50.00 Mark', 'with who and how much');

console.log('no spam: one per person per goal every 10 minutes');
msgs = await claim();
const forAna = msgs.find((m) => m.to === ANNA);
const forEva = msgs.find((m) => m.to === EVA);
ok(forAna && forAna.events.map((x) => x.kind).join() === 'paid', 'Anna gets "Mark added 50"', JSON.stringify(forAna));
ok(forEva && forEva.events.map((x) => x.kind).join() === 'joined,paid', 'Eva gets her two waiting events in one (Ivy joined, Mark paid)', JSON.stringify(forEva));
ok(!msgs.some((m) => m.to === MARK), 'Mark was notified a moment ago, so his Ivy-joined waits', JSON.stringify(msgs.map((m) => m.to)));
for (let i = 0; i < 20; i++) await asUser(MARK, `insert into public.contributions (goal_id, user_id, amount) values ('${G}', '${MARK}', 5)`);
ok((await claim()).length === 0, '20 more payments right after: nobody gets anything yet');
ok((await pending(ANNA)) === '20', 'they wait for Anna', await pending(ANNA));
await later();
msgs = await claim();
const anaBatch = msgs.find((m) => m.to === ANNA);
ok(anaBatch && anaBatch.events.length === 20, '10 minutes later Anna gets ONE notification with all 20', JSON.stringify(anaBatch?.events.length));
ok(msgs.find((m) => m.to === MARK)?.events.length === 1, 'and Mark gets the Ivy-joined he was waiting for');
ok((await claim()).length === 0, 'nothing twice');

console.log('expired, leaving, deleting');
await psql(`update public.subscriptions set active_until = now() - interval '1 day' where user_id = '${EVA}'`);
await later();
await asUser(ANNA, `insert into public.contributions (goal_id, user_id, amount) values ('${G}', '${ANNA}', 10)`);
ok((await pending(EVA)) === '0', 'Eva\'s plan ran out: she is not told about payments');
await asUser(MARK, `select public.leave_goal('${G}')`);
[, out] = await psql(`select string_agg(recipient::text || ':' || kind, ' ' order by recipient) from app.push_events where sent_at is null and kind = 'left'`);
ok(out === [ANNA, EVA].sort().map((u) => `${u}:left`).join(' '), 'Mark leaves: Anna and Eva are told, Eva too although her plan ran out', out);
msgs = await claim();
ok(!msgs.some((m) => m.to === MARK), 'Mark, who left, gets nothing more from this goal');
[s, , e] = await asUser(ANNA, 'select * from public.claim_goal_pushes()');
ok(!s, 'the app cannot call claim_goal_pushes', e);
[s, , e] = await asUser(ANNA, `select public.drop_push_tokens(array['${tok(3)}'])`);
ok(!s, 'nor drop_push_tokens', e);
[s, , e] = await asUser(ANNA, 'select count(*) from app.push_events');
ok(!s, 'nor read the queue', e);

// The Expo Push API was down: release puts them back; they go out next time.
await later();
await asUser(ANNA, `insert into public.contributions (goal_id, user_id, amount) values ('${G}', '${ANNA}', 7)`);
await psql(`update public.subscriptions set active_until = now() + interval '7 days' where user_id = '${EVA}'`);
await asUser(ANNA, `insert into public.contributions (goal_id, user_id, amount) values ('${G}', '${ANNA}', 8)`);
msgs = await claim();
const evaIds = msgs.find((m) => m.to === EVA)?.ids ?? [];
await asUser(null, `select public.release_goal_pushes(array[${evaIds.join(',')}]::bigint[])`, 'service_role');
msgs = await claim();
ok(msgs.find((m) => m.to === EVA)?.events.length === 1, 'released events go out on the next run', JSON.stringify(msgs));

// Deleting an account: the others are told, and nothing breaks.
await later();
[s, , e] = await psql(`delete from auth.users where id = '${EVA}'`);
ok(s, 'deleting a member\'s account works', e);
[, out] = await psql(`select recipient || ' ' || kind from app.push_events where sent_at is null`);
ok(out === `${ANNA} left`, 'Anna is told that Eva left', out);
ok((await psql(`select count(*) from public.push_tokens where user_id = '${EVA}'`))[1] === '0', 'Eva\'s push tokens are gone with her account');
await asUser(null, `select public.drop_push_tokens(array['${tok(1)}'])`, 'service_role');
ok((await claim()).length === 0, 'a token Expo says is gone is dropped, and with no phone left nothing is sent');

console.log('fails', fails());
process.exit(fails() ? 1 : 0);
