"""Runs the shared-goal migration on a throwaway local Postgres and checks every rule as real users would hit it.

usage: python3 test_shared_goals.py <psql connection args...>
       (e.g. -h /tmp/pg -p 54329 -U postgres)
"""
import os, subprocess, sys, uuid

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = os.path.join(HERE, '..', 'supabase', 'migrations', '0001_accounts_friends_shared_goals.sql')
CONN = sys.argv[1:]
DB = 'lockin_test_' + uuid.uuid4().hex[:8]
fails = 0


def psql(sql, db=DB, ok_codes=(0,)):
    r = subprocess.run(['psql', *CONN, '-d', db, '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', sql],
                       capture_output=True, text=True)
    return r.returncode, r.stdout.strip(), r.stderr.strip()


def setup():
    subprocess.run(['psql', *CONN, '-d', 'postgres', '-qc', f'create database {DB}'], check=True)
    for f in (os.path.join(HERE, 'supabase_shim.sql'), MIG):
        r = subprocess.run(['psql', *CONN, '-d', DB, '-v', 'ON_ERROR_STOP=1', '-q', '-f', f], capture_output=True, text=True)
        if r.returncode:
            print(r.stderr); sys.exit(1)


def as_user(uid, sql):
    """Run sql the way the app would: role 'authenticated' with that user's id in the token."""
    wrapped = (f"begin; set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true) \\gset\n"
               f"{sql}; commit;")
    r = subprocess.run(['psql', *CONN, '-d', DB, '-v', 'ON_ERROR_STOP=1', '-qAt'], input=wrapped,
                       capture_output=True, text=True)
    return r.returncode == 0, r.stdout.strip(), r.stderr.strip()


def ok(cond, msg, extra=''):
    global fails
    print(('  PASS ' if cond else '  FAIL ') + msg + (('   [' + extra + ']') if (extra and not cond) else ''))
    if not cond:
        fails += 1


def signup(email, paid=True):
    _, uid, _ = psql(f"insert into auth.users (email) values ('{email}') returning id")
    uid = uid.splitlines()[0]
    if paid:
        psql(f"insert into public.subscriptions (user_id, active_until) values ('{uid}', now() + interval '7 days')")
    return uid


def main():
    setup()
    A = signup('ana@example.com'); B = signup('Bojan@Example.com'); C = signup('ceca@example.com')
    D = signup('dule@example.com', paid=False)

    ok(psql(f"select email from public.profiles where id='{B}'")[1] == 'bojan@example.com', 'signup creates a profile (email lower-cased)')

    # ---- friends ----
    s, rid, e = as_user(A, "select public.send_friend_request('BOJAN@example.com')")
    ok(s, 'A invites B by email', e)
    s, out, e = as_user(C, f"select count(*) from public.friend_requests")
    ok(s and out == '0', 'C cannot see the invite between A and B', out + e)
    s, out, e = as_user(B, "select count(*) from public.friend_requests where status='pending'")
    ok(out == '1', 'B sees the invite', out + e)
    s, out, e = as_user(C, f"select public.respond_friend_request('{rid}', true)")
    ok(not s, 'C cannot accept an invite meant for B')
    s, out, e = as_user(B, f"select public.respond_friend_request('{rid}', true)")
    ok(s, 'B accepts', e)
    ok(as_user(A, "select count(*) from public.friendships")[1] == '1', 'A and B are friends')
    s, out, e = as_user(A, "select public.send_friend_request('bojan@example.com')")
    ok(not s and 'already friends' in e, 'inviting an existing friend again is refused', e)
    s, out, e = as_user(A, "select public.send_friend_request('ana@example.com')")
    ok(not s and 'yourself' in e, 'cannot add yourself', e)
    s, out, e = as_user(A, "select public.send_friend_request('not an email')")
    ok(not s and 'invalid email' in e, 'bad email is refused', e)
    s, out, e = as_user(D, "select public.send_friend_request('ana@example.com')")
    ok(not s and 'subscription required' in e, 'no trial/subscription: cannot add friends', e)
    s, out, e = as_user(A, "insert into public.friendships values ('%s','%s')" % tuple(sorted([A, C])))
    ok(not s, 'nobody can make a friendship without an accepted invite')

    # invite before the other person has an account
    s, rid2, e = as_user(A, "select public.send_friend_request('eva@example.com')")
    ok(s, 'A invites someone who has no account yet', e)
    E = signup('eva@example.com')
    ok(as_user(E, "select count(*) from public.friend_requests where status='pending'")[1] == '1', 'after signing up, Eva finds the invite waiting')
    ok(as_user(E, f"select public.respond_friend_request('{rid2}', true)")[0], 'Eva accepts')

    # two people inviting each other: the second invite simply accepts the first
    s, _, e = as_user(C, "select public.send_friend_request('bojan@example.com')"); ok(s, 'C invites B', e)
    s, _, e = as_user(B, "select public.send_friend_request('ceca@example.com')"); ok(s, 'B invites C back', e)
    ok(as_user(B, f"select count(*) from public.friendships where '{C}' in (user_a,user_b)")[1] == '1', 'crossed invites become a friendship')

    # ---- goals ----
    s, G, e = as_user(A, "select public.create_goal('Summer trip', 2000, 'eur')")
    ok(s, 'A creates a goal', e)
    ok(as_user(A, f"select currency from public.goals where id='{G}'")[1] == 'EUR', 'currency stored in capitals')
    s, _, e = as_user(A, f"select public.add_friend_to_goal('{G}', '{B}')"); ok(s, 'A adds friend B', e)
    s, _, e = as_user(A, f"select public.add_friend_to_goal('{G}', '{C}')")
    ok(not s and 'only friends' in e, 'A cannot add C (not friends)', e)
    s, _, e = as_user(B, f"select public.add_friend_to_goal('{G}', '{C}')"); ok(s, 'B (equal member) adds his own friend C', e)
    ok(as_user(D, f"select count(*) from public.goals")[1] == '0', 'outsider D sees no goals')
    s, _, e = as_user(A, f"insert into public.goal_members (goal_id, user_id) values ('{G}', '{D}')")
    ok(not s, 'nobody can put people in a goal behind the rules')

    s, _, e = as_user(A, f"insert into public.contributions (goal_id, user_id, amount) values ('{G}', '{A}', 500)"); ok(s, 'A puts in 500', e)
    s, _, e = as_user(B, f"insert into public.contributions (goal_id, user_id, amount) values ('{G}', '{B}', 300)"); ok(s, 'B puts in 300', e)
    s, _, e = as_user(B, f"insert into public.contributions (goal_id, user_id, amount) values ('{G}', '{A}', 999)")
    ok(not s, 'B cannot log money in A\'s name')
    s, _, e = as_user(E, f"insert into public.contributions (goal_id, user_id, amount) values ('{G}', '{E}', 50)")
    ok(not s, 'Eva (not in the goal) cannot put money in')
    s, _, e = as_user(C, f"insert into public.contributions (goal_id, user_id, amount) values ('{G}', '{C}', -5)")
    ok(not s, 'negative amounts are refused')
    s, out, e = as_user(C, f"update public.contributions set amount = 1 where user_id = '{A}' returning id")
    ok(s and out == '', 'C cannot change A\'s contribution', out + e)
    ok(as_user(C, f"select saved||'/'||members from public.goal_totals where goal_id='{G}'")[1] == '800.00/3', 'totals: 800 saved, 3 members')
    s, _, e = as_user(B, f"update public.goals set target = 2500, name = 'Greece' where id = '{G}'"); ok(s, 'any member can edit the goal (no admin)', e)
    s, _, e = as_user(B, f"update public.goals set created_by = '{B}' where id = '{G}'")
    ok(not s, 'nobody can rewrite who created the goal')
    ok(as_user(C, f"select count(*) from public.profiles")[1] == '3', 'C sees names of everyone in the goal (A, B and herself)')
    s, _, e = as_user(A, f"update public.profiles set email = 'x@y.z' where id = '{A}'"); ok(not s, 'email cannot be changed from the app')
    s, _, e = as_user(A, f"update public.profiles set display_name = 'Ana' where id = '{A}'"); ok(s, 'own display name can be changed', e)

    # subscription runs out: can still look and leave, cannot change anything
    psql(f"update public.subscriptions set active_until = now() - interval '1 minute' where user_id = '{C}'")
    s, _, e = as_user(C, f"insert into public.contributions (goal_id, user_id, amount) values ('{G}', '{C}', 10)")
    ok(not s, 'after the trial ends without paying: no new contributions')
    s, out, e = as_user(C, f"update public.goals set target = 1 where id = '{G}' returning id")
    ok(s and out == '', 'after the trial ends without paying: cannot edit the goal', out + e)

    # leaving: your money in the goal is deleted, everything else stays
    s, _, e = as_user(A, f"select public.leave_goal('{G}')"); ok(s, 'A (who created it) leaves', e)
    ok(as_user(B, f"select saved||'/'||members||'/'||name from public.goal_totals where goal_id='{G}'")[1] == '300.00/2/Greece',
       'A\'s 500 is gone, goal stays for B and C with the same name')
    ok(as_user(A, f"select count(*) from public.goals where id='{G}'")[1] == '0', 'A no longer sees the goal')
    s, _, e = as_user(C, f"select public.leave_goal('{G}')"); ok(s, 'C leaves even with an expired subscription', e)
    s, _, e = as_user(B, f"select public.leave_goal('{G}')"); ok(s, 'B, the last one, leaves', e)
    ok(psql(f"select count(*) from public.goals where id='{G}'")[1] == '0', 'the empty goal is deleted')
    ok(psql(f"select count(*) from public.contributions where goal_id='{G}'")[1] == '0', 'and no money rows are left behind')

    # deleting an account cleans up after itself
    s, G2, e = as_user(B, "select public.create_goal('Gift', 100, 'RSD')")
    as_user(B, f"select public.add_friend_to_goal('{G2}', '{A}')")
    as_user(A, f"insert into public.contributions (goal_id, user_id, amount) values ('{G2}', '{A}', 40)")
    psql(f"delete from auth.users where id = '{A}'")
    ok(as_user(B, f"select saved||'/'||members from public.goal_totals where goal_id='{G2}'")[1] == '0.00/1',
       'deleting an account removes that person and their money from goals')
    ok(psql(f"select count(*) from public.friendships where '{A}' in (user_a, user_b)")[1] == '0', 'and their friendships')

    # anonymous (not signed in) gets nothing
    r = subprocess.run(['psql', *CONN, '-d', DB, '-v', 'ON_ERROR_STOP=1', '-qAt'], input="begin; set local role anon; select count(*) from public.goals; commit;",
                       capture_output=True, text=True)
    ok(r.returncode != 0, 'signed-out visitors cannot read anything')

    subprocess.run(['psql', *CONN, '-d', 'postgres', '-qc', f'drop database {DB}'])
    print('fails', fails)
    sys.exit(1 if fails else 0)


main()
