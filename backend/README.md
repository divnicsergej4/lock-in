# Lock In: backend (Supabase)

Ovde je baza za naloge, prijatelje i zajednički cilj. Lična potrošnja se ne čuva ovde, ona ostaje na telefonu.

## Pravila koja baza sama sprovodi

- Svaka izmena traži aktivnu probu ili pretplatu (tabela `subscriptions`, puni je server preko RevenueCat-a).
  Izlazak iz cilja je izuzetak: iz cilja se uvek može izaći.
- Prijatelji: poziv ide na mejl (`send_friend_request`), druga osoba prihvata (`respond_friend_request`).
  Ako ta osoba još nema nalog, poziv je čeka i pojavi joj se čim se registruje tim mejlom.
  Ako se dvoje pozovu međusobno, drugi poziv automatski prihvata prvi.
- Cilj: svi članovi su jednaki, nema vlasnika. Svako može da promeni naziv i iznos i da doda svoje prijatelje.
- Svako upisuje i menja samo svoje uplate.
- Ko izađe iz cilja, njegove uplate se brišu. Cilj ostaje ostalima. Kad izađe poslednji, cilj se briše.
- Brisanje naloga briše i osobu iz svih ciljeva, njene uplate i prijateljstva.
- Zaštita od zloupotrebe (`0002`): limiti po korisniku za svaku radnju (npr. najviše 10 poziva na sat, 30 dnevno,
  ista adresa 3 puta nedeljno; uplate 60 na sat), kvote (10 ciljeva po osobi, 20 ljudi po cilju, 200 prijatelja,
  50 poziva na čekanju) i dnevni limit mejlova sa pozivom za celu aplikaciju. Sve brojke i kako se menjaju:
  `docs/ZASTITA.md`.

## Kako se primenjuje

1. Supabase dashboard → SQL Editor → New query.
2. Nalepi ceo fajl `supabase/migrations/0001_accounts_friends_shared_goals.sql` i pokreni ga.
3. Isto za `supabase/migrations/0002_limits_and_quotas.sql` (uvek redom, posle 0001).

Serverske funkcije (`supabase/functions/`: RevenueCat webhook i slanje mejla sa pozivom) i sve što treba
kliknuti po dashboard-ima (Auth limiti, CAPTCHA, spend cap, Resend, RevenueCat, Expo): `docs/ZASTITA.md`.

Nikome ne šalji `service_role` ključ ni lozinku baze, pa ni meni. Aplikacija koristi samo javni (anon) ključ,
a sva zaštita je u pravilima u samoj bazi.

## Testovi

U folderu `backend`: `npm install`, pa `npm test`. Treba samo Node (baza se podiže u memoriji preko PGlite-a,
Postgres i Python nisu potrebni).

- `tests/shared_goals.test.mjs`: 49 situacija (ko šta vidi, ko šta sme da menja, šta se dešava kad neko izađe ili kad
  mu istekne pretplata), sa svim migracijama.
- `tests/limits.test.mjs`: 59 provera limita i kvota (normalno korišćenje prolazi, preterano se odbija), upis
  pretplate sa servera, da su brojači nedostupni aplikaciji i da je RLS uključen na svakoj tabeli.
- `supabase/functions/*/handler_test.ts`: 15 provera serverskih funkcija (Deno).
- `tests/test_shared_goals.py`: ista 49 provera na pravom Postgres-u (`python3 tests/test_shared_goals.py -h … -p … -U …`).

## Šta još fali

- Postaviti serverske funkcije i podesiti Resend i RevenueCat (koraci u `docs/ZASTITA.md`).
