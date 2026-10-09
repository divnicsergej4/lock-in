-- Lock In: rezultati testa
-- Supabase → SQL Editor → nalepi jedan od upita → Run

-- 1) Ukupan pregled: koliko ljudi je počelo i koliko ih je i dalje aktivno
select
  count(distinct device_id)                                              as ukupno_ljudi,
  count(distinct device_id) filter (where local_day = current_date)      as aktivni_danas,
  count(distinct device_id) filter (where local_day >= current_date - 6) as aktivni_poslednjih_7_dana
from public.events;

-- 2) Po osobi (anonimno): kad je počela, koliko dana je upisivala, da li je i dalje tu posle 7 dana
select
  left(device_id, 8)                                          as osoba,
  min(local_day)                                              as prvi_dan,
  max(local_day)                                              as poslednji_dan,
  count(distinct local_day) filter (where event = 'log')      as dana_sa_upisom,
  count(distinct local_day)                                   as dana_otvorio,
  bool_or(event = 'log' and local_day >= min_day + 6)         as upisivao_7_dana_kasnije
from (
  select *, min(local_day) over (partition by device_id) as min_day
  from public.events
) e
group by device_id, min_day
order by prvi_dan;

-- 3) Po danu: koliko ljudi je otvorilo aplikaciju i koliko ih je nešto upisalo
select
  local_day                                                   as dan,
  count(distinct device_id)                                   as otvorilo,
  count(distinct device_id) filter (where event = 'log')      as upisalo
from public.events
group by local_day
order by local_day;
