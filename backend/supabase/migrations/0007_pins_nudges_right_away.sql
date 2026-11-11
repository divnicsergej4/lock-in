-- Lock In: pins, an unlocked goal and nudges go out right away (Andrija, 5 Nov 2026).
--
-- Until now every notification to one person about one goal waited until 10 minutes had passed since the last one,
-- so a pin that came right after a payment arrived up to 10 minutes late. Now the 10-minute wait is only for plain
-- payments, joins and leaves (so five payments in a row are still one notification). When a pin, an unlocked goal
-- or a nudge is waiting, the person gets it on the next run (within a minute), together with anything else waiting
-- for them on that goal.
--
-- Only claim_goal_pushes changes (same as 0006 apart from the "right away" line). Nothing else is touched.

create or replace function public.claim_goal_pushes(max_groups int default 500)
returns table (ids bigint[], recipient uuid, goal_id uuid, goal_name text, currency text, events jsonb, tokens text[])
language plpgsql security definer set search_path = public as $$
declare g record;
begin
  perform pg_advisory_xact_lock(hashtextextended('claim_goal_pushes', 0));
  delete from app.push_events e where e.sent_at < now() - interval '1 day';
  for g in
    select e.recipient as r, e.goal_id as gid from app.push_events e
     where e.sent_at is null
     group by e.recipient, e.goal_id
    having bool_or(e.kind in ('pin', 'unlocked', 'nudged'))
        or not exists (select 1 from app.push_events s where s.recipient = e.recipient and s.goal_id = e.goal_id
                          and s.sent_at > now() - interval '10 minutes')
     order by min(e.id)
     limit max_groups
  loop
    recipient := g.r;
    goal_id := g.gid;
    with done as (
      update app.push_events e set sent_at = now()
       where e.recipient = g.r and e.goal_id = g.gid and e.sent_at is null
      returning e.id, e.kind, e.actor, e.actor_name, e.amount, e.pct
    )
    select array_agg(d.id order by d.id),
           jsonb_agg(jsonb_build_object('kind', d.kind, 'actor', d.actor, 'actor_name', d.actor_name, 'amount', d.amount,
                                        'pct', d.pct) order by d.id)
      into ids, events from done d;
    select x.name, x.currency into goal_name, currency from public.goals x where x.id = g.gid;
    select array_agg(t.token order by t.created_at) into tokens from public.push_tokens t where t.user_id = g.r;
    if tokens is not null and app.is_member(g.gid, g.r) then
      return next;
    end if;
  end loop;
end $$;

-- create or replace keeps the old grants; stated again so this file stands on its own.
revoke all on function public.claim_goal_pushes(int) from public, anon, authenticated;
grant execute on function public.claim_goal_pushes(int) to service_role;
