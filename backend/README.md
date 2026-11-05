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
- Brisanje naloga briše i osobu iz svih ciljeva, njene uplate i prijateljstva. Iz aplikacije ide preko serverske
  funkcije `delete-account` (briše samo onoga čiji je token).
- Zaštita od zloupotrebe (`0002`): limiti po korisniku za svaku radnju (npr. najviše 10 poziva na sat, 30 dnevno,
  ista adresa 3 puta nedeljno; uplate 60 na sat), kvote (10 ciljeva po osobi, 20 ljudi po cilju, 200 prijatelja,
  50 poziva na čekanju) i dnevni limit mejlova sa pozivom za celu aplikaciju. Sve brojke i kako se menjaju:
  `docs/ZASTITA.md`.

## Kako se primenjuje

1. Supabase dashboard → SQL Editor → New query.
2. Nalepi ceo fajl `supabase/migrations/0001_accounts_friends_shared_goals.sql` i pokreni ga.
3. Isto za `supabase/migrations/0002_limits_and_quotas.sql` (uvek redom, posle 0001).
4. Isto za `supabase/migrations/0003_no_passwords.sql` (posle 0002): niko nema lozinku, prijava lozinkom ne radi
   nikome. Provera na pravom projektu: `scripts/check-no-password-login.mjs` (koraci u `docs/ZASTITA.md`, deo 4).
5. Isto za `supabase/migrations/0004_privacy_and_input_checks.sql` (posle 0003): tuđ mejl ne vidi niko, provere
   unosa (`docs/ZASTITA.md`, deo 7).
6. Isto za `supabase/migrations/0005_goal_push.sql` (posle 0004): obaveštenja iz zajedničkog cilja (`docs/ZASTITA.md`,
   delovi 3.9 i 8, uključujući cron posao).
7. Isto za `supabase/migrations/0006_goal_deadline_nudges_pins.sql` (posle 0005): rok cilja, nudge (jedan dnevno istoj
   osobi po cilju, prekidač „Nudges from friends“) i push kad grupa pređe pin ili otključa cilj. Posle nje ponovo
   postaviti `send-goal-push` (novi tekstovi): `npx supabase functions deploy send-goal-push --no-verify-jwt`.

Ceo vodič za pravi projekat, sa SQL proverom posle svake migracije i proverom na dva telefona: `docs/TESTIRANJE.md`.
Skripte za pravi projekat (samo javni URL i ključ iz `mobile/.env.local`): `scripts/check-no-password-login.mjs`
(prijava lozinkom mora biti odbijena) i `scripts/send-test-invite.mjs` (šalje pravi poziv mejlom dok ekran ne postoji;
radi samo dok je CAPTCHA isključena).

Serverske funkcije (`supabase/functions/`: RevenueCat webhook, slanje mejla sa pozivom, brisanje naloga, slanje
obaveštenja iz zajedničkog cilja `send-goal-push`; zajednički delovi u `_shared/`) i sve što treba
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
- `tests/delete_account.test.mjs`: 25 provera brisanja naloga (šta se briše, šta ostaje drugima, aplikacija ne može
  sama da briše korisnike, svaki FK na `auth.users` je `cascade` ili `set null`).
- `tests/no_passwords.test.mjs`: 23 provere za `0003` (ponavlja šta Supabase Auth radi u bazi za prijavu lozinkom,
  kodom, Google-om i Apple-om; isti koraci na bazi bez `0003` pokazuju da napad tamo uspeva).
- `tests/privacy.test.mjs`: 20 provera ko šta vidi (`0004`), sa tačnim spiskom kolona i RPC-ova koje aplikacija sme da
  čita i zove.
- `tests/input_checks.test.mjs`: 68 provera unosa (`0004`): tekstovi, iznosi, valuta, adrese, bez dinamičkog SQL-a.
- `tests/push.test.mjs`: 43 provere za `0005` (tokeni, ko dobija obaveštenje, najviše jedno na 10 minuta).
- `tests/goal_extras.test.mjs`: 38 provera za `0006` (rok, nudge i ko ga vidi, prekidač, pinovi i otključavanje).
- `supabase/functions/*/handler_test.ts`: 29 provera serverskih funkcija (Deno).
- `tests/test_shared_goals.py`: ista 49 provera na pravom Postgres-u (`python3 tests/test_shared_goals.py -h … -p … -U …`).

## Šta još fali

- Postaviti serverske funkcije i podesiti Resend i RevenueCat (koraci u `docs/ZASTITA.md`).
