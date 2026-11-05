// Due date, nudges and pin notifications (0006). "A day later" is simulated by moving the rate events back.
import { freshDb, helpers } from './db.mjs';

const db = await freshDb();
const { psql, asUser, ok, signup, fails } = helpers(db);
let s, out, e;

const tok = (n) => `ExponentPushToken[device${n}aaaa]`;
const befriend = (a, b) => psql(`insert into public.friendships values ('${a < b ? a : b}', '${a < b ? b : a}')`);
const queued = async () => (await psql(`select coalesce(string_agg(recipient || ' ' || kind || coalesce(' ' || pct, ''), ',' order by id), '')
                                          from app.push_events where sent_at is null`))[1];
const clear = () => psql('delete from app.push_events');

const ANA = await signup('ana@example.com');
const MARKO = await signup('marko@example.com');
const EVA = await signup('eva@example.com');
const OUT = await signup('out@example.com'); // not in the goal
const LATE = await signup('late@example.com'); // plan ran out
for (const [u, n] of [[ANA, 'Ana'], [MARKO, 'Marko'], [EVA, 'Eva'], [OUT, 'Out'], [LATE, 'Late']]) {
  await psql(`update public.profiles set display_name = '${n}' where id = '${u}'`);
}
for (const u of [ANA, MARKO, EVA, LATE]) await befriend(ANA, u);
for (const [u, n] of [[ANA, 1], [MARKO, 2], [EVA, 3], [LATE, 4]]) await asUser(u, `select public.register_push_token('${tok(n)}', 'ios')`);

console.log('due date');
let G;
[s, G, e] = await asUser(ANA, "select public.create_goal('Summer trip', 2000, 'EUR', '2027-05-01')");
ok(s, 'a goal can be made with a due date', e);
[, out] = await asUser(ANA, `select deadline::text from public.goals where id = '${G}'`);
ok(out === '2027-05-01', 'the due date is saved', out);
const [, G2] = await asUser(ANA, "select public.create_goal('No date', 100, 'EUR')");
[, out] = await asUser(ANA, `select coalesce(deadline::text, 'none') from public.goals where id = '${G2}'`);
ok(out === 'none', 'the due date is optional (the old three-argument call still works)', out);
for (const u of [MARKO, EVA, LATE]) await asUser(ANA, `select public.add_friend_to_goal('${G}', '${u}')`);
await psql(`update public.subscriptions set active_until = now() - interval '1 day' where user_id = '${LATE}'`);
[s, , e] = await asUser(MARKO, `update public.goals set deadline = '2027-06-01' where id = '${G}'`);
[, out] = await psql(`select deadline::text from public.goals where id = '${G}'`);
ok(s && out === '2027-06-01', 'any member can change it, like the name and target', out || e);
await asUser(MARKO, `update public.goals set deadline = null where id = '${G}'`);
ok((await psql(`select deadline is null from public.goals where id = '${G}'`))[1] === 't', 'and remove it');
[s, , e] = await asUser(OUT, `update public.goals set deadline = '2027-01-01' where id = '${G}'`);
ok((await psql(`select deadline is null from public.goals where id = '${G}'`))[1] === 't', 'someone outside the goal cannot', e);
[s, , e] = await asUser(LATE, `update public.goals set deadline = '2027-01-01' where id = '${G}'`);
ok((await psql(`select deadline is null from public.goals where id = '${G}'`))[1] === 't', 'nor a member whose plan ran out', e);
[s, , e] = await asUser(ANA, `update public.goals set deadline = '3000-01-01' where id = '${G}'`);
ok(!s, 'a date in the year 3000 is refused', e);
await clear();

console.log('nudges');
[s, , e] = await asUser(ANA, `select public.nudge('${G}', '${MARKO}')`);
ok(s, 'Ana nudges Marko', e);
ok(await queued() === `${MARKO} nudged`, 'only Marko gets a push', await queued());
[, out] = await psql(`select actor_name from app.push_events where kind = 'nudged'`);
ok(out === 'Ana', 'with Ana\'s name', out);
[s, , e] = await asUser(ANA, `select public.nudge('${G}', '${MARKO}')`);
ok(!s && e.includes('You already nudged them today. Try again tomorrow.') && e.includes('rate_limited'),
  'a second nudge to the same person in 24 h is refused, with the message as it is', e);
[s, , e] = await asUser(ANA, `select public.nudge('${G}', '${EVA}')`);
ok(s, 'but Eva can still be nudged', e);
[s, , e] = await asUser(EVA, `select public.nudge('${G}', '${MARKO}')`);
ok(s, 'and someone else can nudge Marko', e);
[s, , e] = await asUser(ANA, `select public.nudge('${G2}', '${ANA}')`);
ok(!s && e.includes('You can\'t nudge yourself.'), 'nobody can nudge themselves', e);
[s, , e] = await asUser(ANA, `select public.nudge('${G}', '${OUT}')`);
ok(!s && e.includes('goal not found'), 'only members of the same goal', e);
[s, , e] = await asUser(OUT, `select public.nudge('${G}', '${ANA}')`);
ok(!s && e.includes('goal not found'), 'an outsider cannot nudge into the goal', e);
[s, , e] = await asUser(LATE, `select public.nudge('${G}', '${ANA}')`);
ok(!s && e.includes('no_access'), 'a member without a plan cannot nudge', e);
await clear();
[s, , e] = await asUser(MARKO, `select public.nudge('${G}', '${LATE}')`);
ok(s && await queued() === '', 'a member without a plan can be nudged, but gets no push (like 0005)', (await queued()) || e);
await psql(`update app.rate_events set at = at - interval '25 hours' where action = 'nudge_same'`);
[s, , e] = await asUser(ANA, `select public.nudge('${G}', '${MARKO}')`);
ok(s, 'a day later Ana can nudge Marko again', e);
await clear();

// Who sees the nudges
[, out] = await asUser(MARKO, `select count(*) from public.goal_nudges`);
ok(out === '4', 'Marko sees the nudges he got and sent', out);
[, out] = await asUser(EVA, `select count(*) from public.goal_nudges`);
ok(out === '2', 'Eva sees only hers (got one, sent one), not Ana -> Marko', out);
[, out] = await asUser(OUT, `select count(*) from public.goal_nudges`);
ok(out === '0', 'an outsider sees none', out);
[s, , e] = await asUser(ANA, `insert into public.goal_nudges (goal_id, from_user, to_user) values ('${G}', '${ANA}', '${MARKO}')`);
ok(!s, 'nudges cannot be written directly (no rate limit to skip)', e);
[s, , e] = await asUser(ANA, `delete from public.goal_nudges`);
ok((await psql('select count(*) from public.goal_nudges'))[1] === '5', 'nor deleted', e);

// Switching nudge alerts off
[, out] = await asUser(MARKO, 'select public.nudge_alerts()');
ok(out === 't', 'nudge alerts are on by default', out);
await asUser(MARKO, 'select public.set_nudge_alerts(false)');
[, out] = await asUser(MARKO, 'select public.nudge_alerts()');
ok(out === 'f', 'Marko switches them off', out);
[s, , e] = await asUser(EVA, `select public.nudge('${G}', '${MARKO}')`);
ok(s && await queued() === '', 'Eva\'s nudge works for her (she is not told), but Marko gets no push', (await queued()) || e);
[, out] = await asUser(MARKO, `select count(*) from public.goal_nudges where to_user = '${MARKO}'`);
ok(out === '4', 'the nudge still shows in the app', out);
[s, , e] = await asUser(OUT, 'select * from app.nudge_alerts_off');
ok(!s, 'nobody can read who switched them off', e);
await asUser(MARKO, 'select public.set_nudge_alerts(true)');
ok((await asUser(MARKO, 'select public.nudge_alerts()'))[1] === 't', 'and on again');

// Leaving takes the nudges with it
await asUser(EVA, `select public.leave_goal('${G}')`);
ok((await psql(`select count(*) from public.goal_nudges where '${EVA}' in (from_user, to_user)`))[1] === '0', 'when Eva leaves, her nudges go too');
await asUser(ANA, `select public.add_friend_to_goal('${G}', '${EVA}')`);
await clear();

console.log('pins');
const pay = (u, a) => asUser(u, `insert into public.contributions (goal_id, user_id, amount) values ('${G}', '${u}', ${a}) returning id`);
await pay(MARKO, 400);
ok(await queued() === `${ANA} paid,${EVA} paid`, '20%: just the payment', await queued());
await clear();
await pay(MARKO, 100);
ok(await queued() === `${ANA} paid,${EVA} paid,${ANA} pin 25,${EVA} pin 25`,
  'reaching 25% (500 of 2000): the others get the pin, not Marko, not Late (no plan)', await queued());
await clear();
await pay(ANA, 1100);
ok(await queued() === `${MARKO} paid,${EVA} paid,${MARKO} pin 50,${EVA} pin 50,${MARKO} pin 75,${EVA} pin 75`,
  'one payment past two pins: both pins', await queued());
await clear();
const [, C] = await pay(EVA, 100); // 1700
await clear();
await asUser(EVA, `update public.contributions set amount = 400 where id = '${C}'`); // 2000
ok(await queued() === `${ANA} unlocked,${MARKO} unlocked`, 'raising an amount to 100%: unlocked (no extra pin)', await queued());
await clear();
await pay(MARKO, 50);
ok(await queued() === `${ANA} paid,${EVA} paid`, 'past 100%: no more pins', await queued());

// The function gets the pin in each event
await clear();
await psql(`delete from public.contributions where goal_id = '${G}'`);
await pay(MARKO, 600); // 30%
const [, msgs] = await asUser(null, `select events::text from public.claim_goal_pushes() where recipient = '${ANA}'`, 'service_role');
const ev = JSON.parse(msgs || '[]');
ok(ev.length === 2 && ev[0].kind === 'paid' && ev[0].pct === null && ev[1].kind === 'pin' && ev[1].pct === 25,
  'claim_goal_pushes passes "Marko paid" and "the 25% pin" to the function', msgs);

console.log('fails', fails());
process.exit(fails() ? 1 : 0);
