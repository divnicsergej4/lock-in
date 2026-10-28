# Testiranje sa pravim Supabase projektom

Vodič korak po korak: od praznog Supabase naloga do provere na dva telefona. Detalji i razlozi za svako
podešavanje su u `docs/ZASTITA.md` i `docs/DOMEN.md`; ovde je redosled i šta tačno kucaš i lepiš.

**Redosled je malo drugačiji od spiska koji si dao**, jer neki koraci ne mogu pre drugih:
probna pretplata (tvoja tačka 7) mora pre probe mejla sa pozivom, a provera lozinke (tvoja 6) mora **pre**
uključivanja CAPTCHA (tvoja 5): kad je CAPTCHA uključena, Supabase odbije prijavu lozinkom pre nego što pogleda
lozinku, pa provera ne bi ništa dokazala. Ovde je redosled kojim se radi:

| Deo | Šta | Tvoja tačka |
|---|---|---|
| 1 | Projekat (Frankfurt) i `mobile/.env.local` | 1 |
| 2 | Migracije 0001–0005 i provera posle svake | 2 |
| 3 | Prijava kodom: Resend, DNS, SMTP, Auth podešavanja, prva prijava | 3 |
| 4 | Probna pretplata za tebe i drugi nalog (SQL) | 7 |
| 5 | Edge funkcije, tajne, cron za push, proba mejla sa pozivom | 4 |
| 6 | Prijava lozinkom ne radi | 6 |
| 7 | Turnstile sa pravim ključevima, pa CAPTCHA u Supabase-u | 5 |
| 8 | Provera na dva telefona | 8 |

Kad nešto ne radi: pošalji mi broj koraka i **tačan tekst greške** (ili sliku ekrana). Nikad ne šalji ključeve,
tajne ni lozinke, ni kad se vide na slici: prekrij ih.

---

## 0. Pre početka

**Šta je javno, a šta tajno.** Javno sme u `mobile/.env.local` i sme da mi se pošalje. Tajno se lepi **samo** u
dashboard servisa kom pripada (ili u svoj menadžer lozinki), nikad u repo, u chat ni meni.

| Javno | Tajno |
|---|---|
| Project URL (`https://<ref>.supabase.co`) | Supabase **secret** ključ (`sb_secret_…`) i stari `service_role` |
| Publishable ključ (`sb_publishable_…`) ili stari `anon` | Lozinka baze |
| Turnstile **site key** | Turnstile **secret key** |
| RevenueCat `appl_…` / `goog_…` | Resend API ključevi (`re_…`) |
| | `REVENUECAT_WEBHOOK_AUTH`, `PUSH_CRON_AUTH`, Google Client Secret, Expo i Supabase access token |

Aplikacija odbija da se pokrene ako u `.env.local` greškom staviš `sb_secret_…` ili `service_role` ključ.

**Treba ti:**
- repo u `C:\dev\lock-in` na grani `aplikacija`, ažuran (`git pull`), i `npm install` u folderima `backend` i `mobile`;
- Node i PowerShell 7 (`pwsh`);
- dva telefona sa Expo Go-om: **telefon A** (tvoj iPhone) i **telefon B** (drugi telefon);
- dve mejl adrese: **A_MEJL** (tvoja) i **B_MEJL** (druga osoba ili tvoja druga adresa). U SQL-u ispod svuda
  zameni `A_MEJL` i `B_MEJL` pravim adresama (u SQL Editor-u Ctrl+H). Ako je to Gmail, `ime+b@gmail.com` je za
  Supabase posebna adresa, a stiže u isto sanduče: zgodno za B_MEJL ako nemaš drugu osobu;
- za deo 7: stranice iz `web/` postavljene na `lockintracker.app` (`docs/DOMEN.md`, deo 4).

**Kako se pokreće SQL:** Supabase > **SQL Editor** > **New query** > nalepi > **Run** (ili Ctrl+Enter). Ceo tekst
jednog polja se izvršava kao jedna celina: ako javi grešku, ništa iz tog polja nije upisano. Kad pita „Potential
issue detected… destructive operation“, to je zbog `drop`/`update` u migracijama: potvrdi **Run this query**.

---

## 1. Projekat (region Frankfurt) i ključ u `mobile/.env.local`

1. supabase.com > prijavi se > profil > **Account preferences > Multi-factor authentication**: uključi (ko uđe u
   ovaj nalog, ima celu bazu).
2. **New project**:
   - Organization: tvoja; Project name: `lock-in`;
   - Database Password: **Generate a password**, sačuvaj u menadžer lozinki. Nikome je ne šalješ; za ovaj vodič ti
     ne treba;
   - Region: ne ostavljaj samo „Europe“ (to može biti London): **Need a specific region?** > **Central EU
     (Frankfurt)** (`eu-central-1`); to piše i u Privacy Policy. Region posle ne može da se promeni (samo brisanje
     projekta i nov);
   - plan: Free. Security: „Enable Data API“ **uključeno** (aplikacija preko njega zove bazu), „Automatically expose
     new tables“ **isključeno** (migracije same daju prava), „Enable automatic RLS“ **uključeno**. GitHub ne
     povezuj. **Create new project** i sačekaj par minuta da bude spreman.
3. Project Settings > **General**: prepiši **Project ID** (npr. `abcdefghijklmnopqrst`). U ovom vodiču je to
   `<REF>`, a adresa projekta je `https://<REF>.supabase.co`.
4. Project Settings > **API Keys**: kopiraj **Publishable key** (`sb_publishable_…`). **Secret key ne diraj** i ne
   kopiraj nigde: ništa u ovom vodiču ga ne traži. Ne isključuj ni „Legacy API keys“: Supabase preko njih sam daje
   ključeve Edge funkcijama.
5. U PowerShell-u, u folderu `C:\dev\lock-in`:
   ```
   Copy-Item mobile\.env.example mobile\.env.local
   ```
   Otvori `mobile\.env.local` u editoru i popuni samo ova dva reda (ostali ostaju prazni dok ne dođe njihov deo):
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<REF>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
   ```
   (Polje se zove `ANON_KEY`, ali prima i publishable ključ.)
6. Provera da fajl nije u gitu: `git check-ignore mobile/.env.local` mora da ispiše `mobile/.env.local`.

---

## 2. Migracije, redom, i provera posle svake

Za svaki fajl: otvori ga u editoru (`backend\supabase\migrations\…`), Ctrl+A, Ctrl+C, SQL Editor > New query >
nalepi > Run. Mora da piše „Success. No rows returned“. Odmah posle toga, u **novom** query-ju, pusti proveru:
**svaki red mora da ima `ok = true`**. Ako migracija javi grešku ili neki red ima `false`, stani, ne puštaj
sledeću i pošalji mi tekst.

### 2.1 `0001_accounts_friends_shared_goals.sql` (nalozi, prijatelji, zajednički cilj)
```sql
select 'sedam tabela sa RLS' as provera, count(*) = 7 as ok
  from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and relrowsecurity
   and relname in ('profiles', 'subscriptions', 'friend_requests', 'friendships', 'goals', 'goal_members', 'contributions')
union all
select 'profil za svaki nov nalog', exists (select 1 from pg_trigger where tgname = 'on_auth_user_created' and tgrelid = 'auth.users'::regclass)
union all
select 'funkcije za aplikaciju', count(*) = 6 from pg_proc where pronamespace = 'public'::regnamespace
   and proname in ('send_friend_request', 'respond_friend_request', 'create_goal', 'add_friend_to_goal', 'leave_goal', 'my_access')
union all
select 'izmene uživo (Realtime)', count(*) = 4 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
   and tablename in ('goals', 'goal_members', 'contributions', 'friend_requests')
union all
select 'bez prijave se ne vidi ništa', not has_table_privilege('anon', 'public.profiles', 'select');
```

### 2.2 `0002_limits_and_quotas.sql` (limiti i kvote)
```sql
select 'limiti upisani' as provera, count(*) >= 10 as ok from app.rate_limits
union all
select 'brojači nedostupni aplikaciji', not has_table_privilege('authenticated', 'app.rate_events', 'select')
union all
select 'mejl sa pozivom ide kroz bazu', has_function_privilege('authenticated', 'public.claim_invite_email(uuid)', 'execute')
union all
select 'pretplatu upisuje samo server', has_function_privilege('service_role', 'public.apply_store_event(uuid, timestamptz, text, timestamptz)', 'execute')
   and not has_function_privilege('authenticated', 'public.apply_store_event(uuid, timestamptz, text, timestamptz)', 'execute');
```

### 2.3 `0003_no_passwords.sql` (niko nema lozinku)
```sql
select 'triger koji briše lozinke' as provera,
       exists (select 1 from pg_trigger where tgname = 'no_password' and tgrelid = 'auth.users'::regclass and tgenabled <> 'D') as ok
union all
select 'niko nema lozinku', (select count(*) from auth.users where coalesce(encrypted_password, '') <> '') = 0;
```

### 2.4 `0004_privacy_and_input_checks.sql` (ko šta vidi, provere unosa)
Ako javi „violates check constraint“: u bazi već postoji red koji ne prolazi novu proveru. Javi mi koji, ne briši
ništa sam (na novom projektu ne bi smelo da se desi).
```sql
select 'tuđ mejl se ne čita' as provera, not has_column_privilege('authenticated', 'public.profiles', 'email', 'select') as ok
union all
select 'ime se čita', has_column_privilege('authenticated', 'public.profiles', 'display_name', 'select')
union all
select 'to_user se ne čita', not has_column_privilege('authenticated', 'public.friend_requests', 'to_user', 'select')
union all
select 'provere unosa', count(*) = 6 from pg_constraint
 where conname in ('profiles_display_name_clean', 'goals_name_clean', 'goals_target_max',
                   'contributions_note_clean', 'contributions_amount_max', 'friend_requests_to_email_plain');
```

### 2.5 `0005_goal_push.sql` (obaveštenja iz zajedničkog cilja)
```sql
select 'push_tokens sa RLS' as provera, (select relrowsecurity from pg_class where oid = 'public.push_tokens'::regclass) as ok
union all
select 'red za slanje nedostupan aplikaciji', not has_table_privilege('authenticated', 'app.push_events', 'select')
union all
select 'trigeri za uplatu, ulazak i izlazak', count(*) = 3 from pg_trigger
 where tgname in ('push_on_contribution', 'push_on_join', 'push_on_leave')
union all
select 'šalje samo server', has_function_privilege('service_role', 'public.claim_goal_pushes(integer)', 'execute')
   and not has_function_privilege('authenticated', 'public.claim_goal_pushes(integer)', 'execute');
```

### 2.6 Završna provera (posle svih pet)
Oba upita moraju da vrate **prazno** („Success. No rows returned“). Ako nešto ispišu, pošalji mi. Izuzetak: ako je
pri pravljenju projekta uključeno „Enable automatic RLS“, drugi upit pokaže funkciju `rls_auto_enable`. Nju pravi
Supabase za to podešavanje, ne može da se pozove spolja i to je u redu.
```sql
-- tabele bez RLS-a (ne sme da postoji nijedna)
select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname in ('public', 'app') and c.relkind = 'r' and not c.relrowsecurity;
```
```sql
-- šta neko bez prijave može da čita ili pozove (ne sme ništa)
select 'tabela' as vrsta, c.relname as ime from pg_class c
 where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v') and has_table_privilege('anon', c.oid, 'select')
union all
select 'funkcija', p.proname from pg_proc p
 where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute');
```

---

## 3. Prijava kodom

### 3.1 Resend nalog i domen `mail.lockintracker.app`
1. resend.com > napravi nalog > Settings > **Two-factor authentication**: uključi.
2. **Domains > Add Domain**: `mail.lockintracker.app`, Region **EU (Ireland)** (Supabase je u EU) > Add.
3. DNS zapisi. Najlakše: na stranici domena u Resend-u dugme **Sign in to Cloudflare** > odobri; Resend sam upiše
   zapise. Ili ručno: Cloudflare > `lockintracker.app` > **DNS > Records > Add record**, za svaki red tačno ono što
   Resend pokaže (oblik je u `docs/DOMEN.md` 2.1):
   - **MX** `send.mail` (povratna adresa) i **TXT** `send.mail` sa `v=spf1 include:amazonses.com ~all` (**SPF**);
   - **TXT** `resend._domainkey.mail` sa dugačkim `p=…` (**DKIM**), Proxy status **DNS only**.
4. **DMARC** (ceo domen), Cloudflare > DNS > Records > Add record:
   Type `TXT`, Name `_dmarc`, Content `v=DMARC1; p=none; rua=mailto:dmarc@lockintracker.app`.
   (`p=none` prve 2–4 nedelje, posle `p=quarantine`; da bi izveštaji stizali, `dmarc@` treba Email Routing iz
   `docs/DOMEN.md` 2.3, ili koristi Cloudflare DMARC Management iz 2.2.)
5. U Resend-u **Verify DNS Records**: za par minuta (najviše par sati) mora da piše **Verified**. Provera iz
   PowerShell-a (svaki mora da vrati tekst zapisa):
   ```
   nslookup -type=txt send.mail.lockintracker.app
   nslookup -type=txt resend._domainkey.mail.lockintracker.app
   nslookup -type=txt _dmarc.lockintracker.app
   ```
6. **API Keys > Create API Key**, dva ključa, oba sa Permission **Sending access** i Domain
   **mail.lockintracker.app** (ne Full access):
   - `supabase-auth-smtp` (za kodove, korak 3.2);
   - `invite-function` (za mejl sa pozivom, deo 5).
   Resend ključ pokaže samo jednom: nalepi ga odmah tamo gde ide (ili u menadžer lozinki). Dva ključa da bi svaki
   mogao da se ugasi sam.

### 3.2 Resend SMTP u Supabase-u
Supabase > **Authentication > Emails > SMTP Settings** > uključi **Enable Custom SMTP**:

| Polje | Vrednost |
|---|---|
| Sender email | `no-reply@mail.lockintracker.app` |
| Sender name | `Lock In` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | ključ `supabase-auth-smtp` iz 3.1 |
| Minimum interval per user (ako postoji) | `60` sekundi |

Save. Bez ovoga Supabase šalje najviše 2 mejla na sat za ceo projekat.

### 3.3 Sign In / Providers
**Authentication > Sign In / Providers**:
- „Allow new users to sign up“: **uključeno**;
- „Allow anonymous sign-ins“: **isključeno**;
- „Allow manual linking“: **isključeno**;
- otvori **Email**: „Enable Email provider“ **uključeno**, „Confirm email“ **uključeno** (mora: kad je isključeno,
  svako može da napravi prijavljen nalog sa tuđim mejlom), „Secure email change“ **uključeno**,
  „Email OTP Expiration“ **600**, „Email OTP Length“ **6**. Novi projekat ima 3600 i **8**: dužina mora na 6, jer
  aplikacija prima tačno 6 cifara. Polja o lozinci ostavi kako jesu (lozinka se nikad ne čuva). Save.

### 3.4 Šabloni mejla
**Authentication > Emails > Templates**. U **Magic Link** i u **Confirm signup** obriši sav tekst i nalepi:
- Subject:
  ```
  Your Lock In code
  ```
- Body:
  ```
  <h2>Your Lock In code</h2><p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p><p>It works for 10 minutes. If you didn't ask for it, ignore this email.</p>
  ```
U tekstu ne sme da ostane `{{ .ConfirmationURL }}` (to je magic link). Save za svaki.

### 3.5 Rate Limits
**Authentication > Rate Limits** (mejlovi se mogu menjati tek posle 3.2):

| Polje | Vrednost |
|---|---|
| Rate limit for sending emails | **30** na sat |
| Rate limit for sign ups and sign ins | **30** na 5 min po IP (podrazumevano, ne spuštaj) |
| Rate limit for token verifications | **15** na 5 min po IP (umesto 30) |
| Rate limit for token refreshes | **150** na 5 min po IP (podrazumevano, ne spuštaj) |
| Rate limit for anonymous users | ne diraj (anonimna prijava je isključena) |

Save. Zašto baš ovi brojevi: `docs/ZASTITA.md` 3.2, korak 4.

### 3.6 Sesije i URL-ovi
- **Authentication > Sessions** (ili Settings): „Detect and revoke potentially compromised refresh tokens“
  **uključeno**, „Refresh token reuse interval“ **10**. JWT expiry ostavi 3600.
- **Authentication > URL Configuration**: Site URL `lockin://auth-callback`; Redirect URLs: dodaj
  `lockin://auth-callback`. (`exp://…` adresu dodaješ samo ako probaš Google u Expo Go-u, vidi ispod.)
- Google i Sign in with Apple nisu potrebni za ovaj vodič (prijava kodom radi bez njih). Kad budeš hteo i njih:
  `docs/ZASTITA.md` 3.2, koraci 6–8. CAPTCHA (korak 9 tamo) je ovde deo 7.

### 3.7 Prva prijava na oba telefona
1. U PowerShell-u, u folderu `C:\dev\lock-in\mobile` (ne iz drugog foldera): `npx expo start --clear --tunnel --go`
   (posle svake izmene `.env.local` Expo mora da se pokrene ponovo). `--go` je obavezan otkad projekat ima
   `expo-dev-client`: bez njega QR kod vodi u development build, pa iPhone kaže „No usable data found“. Iznad QR koda
   mora da piše „Using Expo Go“. `--tunnel` radi i kad telefon ne vidi računar preko Wi-Fi-ja. Na Android-u QR
   skeniraš iz same Expo Go aplikacije.
2. **Telefon A**: skeniraj QR (iPhone: kamera). U aplikaciji Savings > Shared goal > **Sign in to get started**
   (ili Settings > Account). Upiši A_MEJL > **Send code**.
3. Mejl mora da stigne od **Lock In &lt;no-reply@mail.lockintracker.app&gt;**, naslov „Your Lock In code“, 6 cifara.
   Upiši kod > **Sign in** > mora da piše „Signed in“.
4. U Gmail-u otvori taj mejl > ⋮ > **Show original**: mora da piše `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`.
   Ako je mejl u spamu ili nešto nije PASS, javi mi šta piše.
5. **Telefon B**: isto sa B_MEJL.
6. Provera u SQL Editor-u (dva reda, svuda `true`):
   ```sql
   select u.email,
          u.email_confirmed_at is not null as potvrdjen,
          coalesce(u.encrypted_password, '') = '' as bez_lozinke,
          p.id is not null as ima_profil
     from auth.users u left join public.profiles p on p.id = u.id
    order by u.created_at;
   ```

---

## 4. Probna pretplata (dok RevenueCat ne radi) — tvoja tačka 7

Baza dozvoljava prijatelje, ciljeve i uplate samo uz probu ili pretplatu (tabela `subscriptions`, koju kasnije puni
RevenueCat webhook). Dok on ne radi, upiši je ručno za oba naloga (oba moraju već da postoje, deo 3.7):
```sql
insert into public.subscriptions (user_id, active_until, product)
select id, now() + interval '30 days', 'manual_test' from auth.users
 where email in (lower('A_MEJL'), lower('B_MEJL'))
on conflict (user_id) do update
  set active_until = excluded.active_until, product = excluded.product, updated_at = now();

select u.email, s.active_until, s.product
  from public.subscriptions s join auth.users u on u.id = s.user_id order by u.email;
```
Mora da vrati dva reda sa `manual_test` i datumom za 30 dana. Ponovo pokrenut, samo produži za 30 dana od sada.

- Aplikacija na telefonu za sada ništa ne zaključava po pretplati (ekran za plaćanje ne postoji); ovo menja samo
  šta baza dozvoljava.
- Kad proradi RevenueCat, njegov događaj koji stigne posle ovog upisa pregazi ga sam.
- Pre objave u prodavnicama obriši probne redove (`docs/ZASTITA.md` deo 6, tačka 3):
  ```sql
  delete from public.subscriptions where product = 'manual_test';
  ```

---

## 5. Edge funkcije — tvoja tačka 4

Četiri funkcije: `send-invite-email` (mejl sa pozivom), `delete-account` (brisanje naloga), `revenuecat-webhook`
(pretplate) i `send-goal-push` (push iz zajedničkog cilja).

### 5.1 Tajne (lepiš sam, u dashboard)
Dve tajne su nasumičan tekst koji praviš sam (lozinke između servera; korisnici ih nikad ne vide). U PowerShell-u
(radi i u starom Windows PowerShell-u), za svaku posebno (ispis vidiš samo ti; ne šalji ga):
```
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); 'Bearer ' + (($b | ForEach-Object { $_.ToString('x2') }) -join '')
```
Ne moraš da ih čuvaš: `REVENUECAT_WEBHOOK_AUTH` odmah nalepi u Secrets (kad se bude podešavao RevenueCat, pravi se
nova i stavlja na oba mesta), a `PUSH_CRON_AUTH` odmah nalepi i u Secrets i u Vault (5.4, korak 2). Proveri da su
iste: `select encode(sha256(convert_to(decrypted_secret, 'utf8')), 'hex') from vault.decrypted_secrets where name =
'push_cron_auth';` mora da se poklapa sa DIGEST kolonom pored `PUSH_CRON_AUTH`. Resend ključ `invite-function` napravi
tek sad i nalepi odmah. Posle čuvanja proveri da `RESEND_API_KEY` i `INVITE_FROM` nisu zamenjeni (lako se desi).

Supabase > **Edge Functions > Secrets** > Add new secret, jedan po jedan:

| Name | Value |
|---|---|
| `RESEND_API_KEY` | ključ `invite-function` iz 3.1 |
| `INVITE_FROM` | `Lock In <invites@mail.lockintracker.app>` |
| `REVENUECAT_WEBHOOK_AUTH` | prvi `Bearer …` (sa `Bearer ` i razmakom na početku) |
| `PUSH_CRON_AUTH` | drugi `Bearer …` (**ne** isti kao prvi) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` i `SUPABASE_SERVICE_ROLE_KEY` Supabase sam daje funkcijama: ne upisuj ih.
`EXPO_ACCESS_TOKEN` samo ako u expo.dev uključiš „Enhanced push security“; inače ne treba.

### 5.2 Postavljanje
U PowerShell-u, u folderu `C:\dev\lock-in\backend`:
1. `npx supabase login` (otvori pregledač, odobri). Token koji CLI sačuva na računaru je tajna: ne šalji ga.
2. `npx supabase link --project-ref <REF>`. Ako pita za lozinku baze, samo Enter (ne treba za ovo).
   Ako javi da nema `config.toml`, pokreni `npx supabase init`, odgovori „N“ na pitanja i javi mi (commit-ujem taj
   fajl), pa ponovo `link`.
3. Četiri komande, jedna po jedna:
   ```
   npx supabase functions deploy send-invite-email
   npx supabase functions deploy delete-account
   npx supabase functions deploy revenuecat-webhook --no-verify-jwt
   npx supabase functions deploy send-goal-push --no-verify-jwt
   ```
   (`--no-verify-jwt` samo za ove dve: RevenueCat i cron nemaju Supabase prijavu, njih štiti tajno zaglavlje.)
   Ako javi da traži Docker, dodaj `--use-api` na kraj komande.
4. Provera da sve četiri postoje i da bez prijave ne puštaju nikog (svaka mora da ispiše **401**; 404 znači da
   funkcija nije postavljena, a 500 kod poslednje dve da njena tajna iz 5.1 nije upisana ili je prekratka):
   ```
   curl.exe -s -o NUL -w "%{http_code}`n" -X POST https://<REF>.supabase.co/functions/v1/send-invite-email
   curl.exe -s -o NUL -w "%{http_code}`n" -X POST https://<REF>.supabase.co/functions/v1/delete-account
   curl.exe -s -o NUL -w "%{http_code}`n" -X POST https://<REF>.supabase.co/functions/v1/revenuecat-webhook
   curl.exe -s -o NUL -w "%{http_code}`n" -X POST https://<REF>.supabase.co/functions/v1/send-goal-push
   ```

### 5.3 RevenueCat webhook
Samo postavljen; povezuje se kad napraviš RevenueCat projekat (`docs/ZASTITA.md` 3.6). Do tada pretplata ide ručno
(deo 4).

### 5.4 Cron za push (bez njega `send-goal-push` nikad ne radi)
1. Supabase > **Database > Extensions**: uključi **pg_cron** i **pg_net**.
2. Supabase > **Integrations > Vault** > Add new secret: Name `push_cron_auth`, Secret = **ista** vrednost kao
   `PUSH_CRON_AUTH` (sa `Bearer `). Save.
3. SQL Editor (zameni `<REF>`):
   ```sql
   select cron.schedule('send-goal-push', '* * * * *', $job$
     select net.http_post(
       url := 'https://<REF>.supabase.co/functions/v1/send-goal-push',
       headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
         (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_auth')),
       body := '{}'::jsonb
     ) where exists (select 1 from app.push_events where sent_at is null);
   $job$);
   ```
   Funkcija se zove samo kad nešto čeka, pa ne troši pozive kad je mirno.
4. Provera, posle dva minuta (prvi upit jedan red sa `active = true`; drugi `succeeded`):
   ```sql
   select jobname, schedule, active from cron.job;
   ```
   ```sql
   select status, return_message, start_time from cron.job_run_details order by start_time desc limit 3;
   ```
   Ne puštaj `select … from vault.decrypted_secrets` i ne šalji mi njegov ispis: tamo je tajna.
5. Pravi push na telefon **ne može da se proveri u Expo Go-u**: traži EAS projekat, development build i Apple
   nalog (`docs/ZASTITA.md` 3.9, koraci 1–3). U Expo Go-u prekidač „Shared goal alerts“ kaže
   „Shared goal alerts come with the full app build.“ i to je očekivano.

### 5.5 Proba mejla sa pozivom
Ekran „Add a friend“ još ne postoji u aplikaciji, pa poziv šalje skripta, istim putem kojim će ga slati aplikacija
(prijava kodom, `send_friend_request`, pa funkcija `send-invite-email` preko Resend-a). Radi samo dok je CAPTCHA
isključena, zato je ovde, pre dela 7. Treba deo 4 (A mora da ima probnu pretplatu).

1. Po želji, da u mejlu piše tvoje ime umesto „A friend“ (ekran za ime još ne postoji):
   ```sql
   update public.profiles set display_name = 'Andrija' where email = lower('A_MEJL');
   ```
2. U folderu `C:\dev\lock-in\backend`:
   ```
   node scripts/send-test-invite.mjs A_MEJL B_MEJL
   ```
   Skripta pošalje kod na A_MEJL i pita za njega (ovo je isto kao „Send code“, pa važi isti razmak od 60 s).
   Mora da završi sa `OK: invite email sent to …`.
3. Na B_MEJL mora da stigne mejl od **Lock In &lt;invites@mail.lockintracker.app&gt;**, naslov
   „Andrija invited you to Lock In“ (ili „A friend…“), običan tekst. Proveri i spam i **Show original** (SPF, DKIM,
   DMARC: PASS).
4. Provera u bazi (jedan red: `pending`, `mejl_poslat = true`):
   ```sql
   select to_email, status, emailed_at is not null as mejl_poslat, created_at
     from public.friend_requests order by created_at desc limit 5;
   ```
Istu adresu ne zovi više od 3 puta nedeljno (limit iz `0002`). Ako skripta javi grešku, pošalji mi ceo ispis
(u njemu nema ključeva).

---

## 6. Prijava lozinkom ne radi — tvoja tačka 6

Radi se **pre** dela 7 (vidi vrh).
1. Supabase > **Authentication > Users > Add user > Create new user**: mejl npr. tvoj sa `+nopw` pre `@`
   (`ime+nopw@gmail.com`), bilo koja izmišljena probna lozinka (nikako neka tvoja prava), „Auto Confirm User“
   **uključeno** > Create user.
2. U folderu `C:\dev\lock-in\backend` (uzima URL i ključ iz `mobile/.env.local`):
   ```
   node scripts/check-no-password-login.mjs ime+nopw@gmail.com <ta probna lozinka>
   ```
   Mora da ispiše `OK: password sign-in is refused ("Invalid login credentials").`
   `FAIL: signed in with a password` znači da `0003` ne radi: javi mi odmah.
3. SQL iz `docs/ZASTITA.md` 3.1 (mora da vrati `0`):
   ```sql
   select count(*) from auth.users where coalesce(encrypted_password, '') <> '';
   ```
4. Authentication > Users > taj probni korisnik > **Delete user**.

---

## 7. Turnstile (pravi ključevi), pa tek onda CAPTCHA u Supabase-u — tvoja tačka 5

Redosled je bitan: ako CAPTCHA uključiš u Supabase-u pre nego što aplikacija šalje token, „Send code“ prestaje da
radi za sve.

1. **Stranica postoji:** u pregledaču otvori `https://lockintracker.app/privacy/` (mora da se otvori, sa katancem)
   i `https://lockintracker.app/turnstile/?sitekey=1x00000000000000000000AA` (prazna stranica je u redu). Ako ne
   radi, prvo `docs/DOMEN.md` deo 4.
2. dash.cloudflare.com > **Turnstile > Add widget**: Widget name `Lock In`; Hostname Management > Add hostnames:
   `lockintracker.app` (bez `https://` i bez putanje); Widget Mode **Managed**; Pre-clearance **No** > Create.
3. **Site key** (javan) u `mobile\.env.local`:
   ```
   EXPO_PUBLIC_TURNSTILE_SITE_KEY=<site key>
   ```
   **Secret key** ne lepiš nigde osim u korak 5.
4. `npx expo start --clear` u `mobile`, pa na telefonu A **Sign out** i ponovo prijava kodom: kod mora i dalje da
   stigne (Supabase još ne traži CAPTCHA). Obično ne vidiš ništa; ako Cloudflare traži klik, ispod „Send code“ se
   pojavi „Quick check that you’re human:“.
5. Supabase > **Authentication > Attack Protection** (ili „Bot and Abuse Protection“) > **Enable CAPTCHA
   protection**: uključi, Provider **Turnstile by Cloudflare**, Captcha secret = **Secret key** iz koraka 2 > Save.
6. Ponovo na telefonu A: Sign out, prijava kodom: kod mora da stigne.
   Ako piše „Couldn’t check that you’re human. Try again.“: odmah isključi CAPTCHA u Supabase-u (korak 5) i javi mi.
7. Provera da Supabase stvarno traži CAPTCHA: `node scripts/send-test-invite.mjs A_MEJL B_MEJL` u `backend` sad mora
   da ispiše `FAIL: Supabase asks for CAPTCHA…` (i ništa ne pošalje). U Cloudflare > Turnstile > Lock In >
   Analytics vide se rešene provere sa telefona.

---

## 8. Provera na dva telefona — tvoja tačka 8

Oba telefona u Expo Go-u (`npx expo start --clear` u `mobile`). Za svaku stavku: šta radiš i šta mora da se desi.
Zapiši broj stavke koja ne prođe i pošalji mi.

**Važno: aplikacija još nema ekrane za prijatelje, pozive i zajednički cilj preko servera** (Shared goal posle
prijave kaže „You’re signed in. Shared goals with friends are coming soon.“; to je korak 5 u `docs/PROJEKAT.md`).
Zato stavke 6–10 ispod radiš u SQL Editor-u **kao taj korisnik**: prva dva reda svakog bloka kažu bazi „ovo radi A“
(ili B), pa važe ista pravila, limiti i provere kao kad bude zvala aplikacija. Tako se proverava prava baza;
ekrani dolaze posle i proveravaju se tada. Mejl sa pozivom je pravi (deo 5.5).

### 8.1 Na telefonima

| # | Šta radiš | Šta mora da se desi |
|---|---|---|
| 1 | **Prijava**, telefon A i B: Settings > Account (ili Shared goal) > mejl > Send code > kod > Sign in | Kod stiže za par sekundi, „Signed in“. U Settings > Account se vidi „Sign out“ i „Shared goal alerts“. |
| 2 | **60 s**: posle Send code gledaj dugme; zatvori ekran za prijavu i otvori ga ponovo | Dugme piše „Send again in 59s“ i odbrojava, i posle ponovnog otvaranja. Na 0 piše „Send a new code“. |
| 3 | **5 kodova**: upiši pogrešan kod 5 puta zaredom | Svaki put „That code is wrong or expired.“; posle petog „Too many wrong codes. Send a new code.“ i polje za kod je zaključano. Nov kod (posle 60 s) radi. |
| 4 | **Odjava**, telefon A: Settings > Account > Sign out | Account opet nudi prijavu. Telefon B je i dalje prijavljen. Lični troškovi na telefonu A su ostali. |
| 5 | Ponovo se prijavi na telefonu A | Radi normalno. |

Napomena za 2 i 3: ako stigne „Too many tries. Wait a few minutes and try again.“, to je Supabase limit (15
provera koda na 5 min po IP adresi; oba telefona na istom Wi-Fi-ju dele adresu). Sačekaj 5 minuta: to nije greška.

### 8.2 Prijatelji i zajednički cilj (SQL Editor, kao korisnik)

Svaki blok je poseban query (New query > nalepi > Run). Zameni `A_MEJL` / `B_MEJL`. Treba deo 4 (probna pretplata
za oba).

**6. Poziv prijatelju.** Već poslat u 5.5 (sa mejlom). Ako nisi radio 5.5, ovako se pravi poziv bez mejla, kao A:
```sql
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = lower('A_MEJL')), true);
set local role authenticated;
select public.send_friend_request(lower('B_MEJL')) as poziv;
```

**7. Prihvatanje**, kao B (mora `prijatelji = true`):
```sql
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = lower('B_MEJL')), true);
set local role authenticated;
select public.respond_friend_request(id, true) from public.friend_requests where status = 'pending' and to_email = lower('B_MEJL');
select count(*) = 1 as prijatelji from public.friendships;
```

**8. Zajednički cilj**: A pravi cilj i dodaje B (mora jedan red: `Summer trip test`, 1000, EUR, `saved` 0, `members` 2):
```sql
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = lower('A_MEJL')), true);
set local role authenticated;
select public.add_friend_to_goal(public.create_goal('Summer trip test', 1000, 'EUR'),
       (select case when user_a = auth.uid() then user_b else user_a end from public.friendships limit 1));
select name, target, currency, saved, members from public.goal_totals;
```

**9. Uplate.** A uplati 50 (mora `saved` 50):
```sql
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = lower('A_MEJL')), true);
set local role authenticated;
insert into public.contributions (goal_id, user_id, amount, note)
select id, auth.uid(), 50, 'A test' from public.goals where name = 'Summer trip test';
select name, saved, members from public.goal_totals;
```
B uplati 30 (mora `saved` 80):
```sql
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = lower('B_MEJL')), true);
set local role authenticated;
insert into public.contributions (goal_id, user_id, amount, note)
select id, auth.uid(), 30, 'B test' from public.goals where name = 'Summer trip test';
select name, saved, members from public.goal_totals;
```
B pokušava da upiše uplatu **na A-ovo ime**: mora da javi grešku
`new row violates row-level security policy for table "contributions"`:
```sql
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = lower('B_MEJL')), true);
set local role authenticated;
insert into public.contributions (goal_id, user_id, amount)
select g.id, (select case when user_a = auth.uid() then user_b else user_a end from public.friendships limit 1), 10
  from public.goals g where g.name = 'Summer trip test';
```
B pokušava da promeni A-ovu uplatu: mora „Success. No rows returned“ (ništa nije promenjeno):
```sql
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = lower('B_MEJL')), true);
set local role authenticated;
update public.contributions set amount = 1 where user_id <> auth.uid() returning id;
```

**10. Izlazak iz cilja**: B izlazi:
```sql
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = lower('B_MEJL')), true);
set local role authenticated;
select public.leave_goal(id) from public.goals where name = 'Summer trip test';
```
Provera (običan query, bez prva dva reda). Mora: `clanova` 1, `ukupno` 50, `uplate_od_b` 0 (B-ova uplata je obrisana):
```sql
select g.name,
       (select count(*) from public.goal_members m where m.goal_id = g.id) as clanova,
       (select coalesce(sum(c.amount), 0) from public.contributions c where c.goal_id = g.id) as ukupno,
       (select count(*) from public.contributions c join auth.users u on u.id = c.user_id
         where c.goal_id = g.id and u.email = lower('B_MEJL')) as uplate_od_b
  from public.goals g where g.name = 'Summer trip test';
```

### 8.3 Brisanje naloga (telefon B, na kraju)

Da bi se videlo šta brisanje radi, prvo vrati B u cilj sa jednom uplatom: pusti ponovo blok iz 8, ali samo dodavanje
(kao A):
```sql
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = lower('A_MEJL')), true);
set local role authenticated;
select public.add_friend_to_goal((select id from public.goals where name = 'Summer trip test'),
       (select case when user_a = auth.uid() then user_b else user_a end from public.friendships limit 1));
select name, saved, members from public.goal_totals;
```
pa B-ovu uplatu od 30 iz bloka 9 (`saved` 80, `members` 2).

| # | Šta radiš | Šta mora da se desi |
|---|---|---|
| 11 | Telefon B: Settings > Danger zone > **Delete account**, pa još jednom u roku od 4 s | „Account deleted“, Account opet nudi prijavu, lični troškovi na telefonu B su ostali. |

Provera u SQL Editor-u (sve `true`; važi za probni projekat u kom su samo A i B):
```sql
select (select count(*) from auth.users where email = lower('B_MEJL')) = 0 as nalog_obrisan,
       (select count(*) from public.profiles where email = lower('B_MEJL')) = 0 as profil_obrisan,
       (select count(*) from public.friendships) = 0 as prijateljstvo_obrisano,
       exists (select 1 from public.goals where name = 'Summer trip test') as cilj_ostao_a,
       (select coalesce(sum(amount), 0) from public.contributions) = 50 as ostala_samo_uplata_a;
```
Ako „Delete account“ javi „Couldn’t delete your account. Try again.“: Edge Functions > delete-account > **Logs**,
pošalji mi poslednje redove.

| # | Šta radiš | Šta mora da se desi |
|---|---|---|
| 12 | Telefon B: ponovo se prijavi sa B_MEJL | Radi; to je nov, prazan nalog (bez prijatelja i ciljeva, i bez probne pretplate: za nju ponovo deo 4). |

### 8.4 Posle testiranja
- Probni cilj nestaje kad A izađe (poslednji član): blok iz 10 sa `A_MEJL` umesto `B_MEJL`.
- Probne naloge i redove `manual_test` ne moraš da brišeš sad; obavezno pre objave (`docs/ZASTITA.md` deo 6).
- Free Supabase projekat se pauzira posle nedelju dana bez korišćenja: tada ga u dashboard-u samo pokreneš
  (**Restore**), ništa se ne gubi.
