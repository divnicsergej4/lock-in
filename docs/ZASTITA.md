# Zaštita od zloupotrebe i troškova

Šta je urađeno u kodu i šta Sergej mora sam da podesi po dashboard-ima. Nikome (ni Claude-u) ne šalji
`service_role` ključ, lozinku baze, Resend ključ, ni RevenueCat tajnu. Sve tajne se lepe samo u
dashboard tog servisa ili u Supabase > Edge Functions > Secrets.

---

## 1. Šta baza sama sprovodi (migracija `0002_limits_and_quotas.sql`)

Limiti po korisniku (gleda se ko je prijavljen, `auth.uid()`), u kliznom prozoru:

| Radnja | Limit |
|---|---|
| Poziv prijatelju (`send_friend_request`) | 10 na sat, 30 dnevno, ista mejl adresa najviše 3 puta nedeljno |
| Odgovor na poziv (`respond_friend_request`) | 30 na sat |
| Novi zajednički cilj (`create_goal`) | 30 na sat |
| Dodavanje prijatelja u cilj (`add_friend_to_goal`) | 30 na sat |
| Izmena cilja (naziv, iznos) | 60 na sat |
| Upis ili izmena uplate (contributions) | 60 na sat |
| Mejl sa pozivom (`claim_invite_email`) | jedan mejl po pozivu, 30 dnevno po korisniku, **100 dnevno za celu aplikaciju** |

Kvote:
- najviše 10 zajedničkih ciljeva u kojima je jedna osoba;
- najviše 20 ljudi u jednom cilju;
- najviše 200 prijatelja (proverava se i kod slanja i kod prihvatanja, za obe strane);
- najviše 50 neprihvaćenih poziva u isto vreme.

Kad se limit pređe, baza odbije zahtev porukom na engleskom koju aplikacija može da prikaže kakva jeste
(npr. „You can send up to 10 friend requests per hour. Try again later.“). Limiti imaju oznaku `rate_limited`,
kvote `quota`. Odbijen zahtev se ne broji i ništa ne upisuje.

Nisu ograničeni: izlazak iz cilja (`leave_goal`, iz cilja se uvek može izaći) i `my_access` (samo čita).
Server (Edge Functions sa service role ključem) nije ograničen.

**Promena broja bez nove migracije** (SQL Editor), npr. kad pređeš na plaćeni Resend:
```sql
update app.rate_limits set max_count = 1000 where action = 'invite_email' and app_wide;
select * from app.rate_limits order by action;  -- pregled svih limita
```
Kvote (10 / 20 / 200 / 50) su upisane u funkcije u `0002`; menjaju se novom migracijom.

Testovi: `backend/tests/limits.test.mjs` (59 provera: svaki limit i kvota, normalno korišćenje prolazi,
preterano se odbija, brojači su nedostupni aplikaciji, RLS je uključen na svakoj tabeli).

## 2. Serverske funkcije (Edge Functions), napisane, još nisu postavljene

- `backend/supabase/functions/revenuecat-webhook`: prima događaje iz RevenueCat-a i upisuje do kada traje proba
  ili pretplata. Prihvata **samo** zahtev čije je `Authorization` zaglavlje tačno ona tajna vrednost koju upišeš u
  RevenueCat; sve ostalo dobija 401 i ništa ne menja. Ako tajna nije podešena (ili je kraća od 32 znaka), odbija sve.
  Stariji događaj koji zakasni ne može da pregazi noviji. Doživotna kupovina = pristup bez isteka.
- `backend/supabase/functions/send-invite-email`: šalje mejl sa pozivom preko Resend-a. Radi samo sa prijavom
  korisnika (njegov token, ne service role), a baza odlučuje da li mejl sme da ode (vidi tabelu gore).
- `backend/supabase/functions/delete-account`: brisanje naloga iz Settings (Apple to traži). Briše **samo** onoga
  čiji je token (ko je, pita Supabase Auth; id iz zahteva se ne gleda), preko `auth.admin.deleteUser`. Ostalo
  radi baza: profil, pretplata, pozivi, prijateljstva, članstva i uplate se brišu (`on delete cascade`), cilj u
  kom je bio sam nestaje (triger `goal_member_left`), ciljevi sa drugima ostaju njima, sa njihovim uplatama.
  Ako Auth odbije, vraća 502 i aplikacija ne odjavljuje korisnika. RevenueCat kupac se ne briše (za to treba
  RevenueCat tajni ključ); pretplatu korisnik otkazuje sam u App Store-u / Google Play-u.

Testovi: `handler_test.ts` u sva tri foldera (19 provera) i `backend/tests/delete_account.test.mjs` (25 provera:
šta se briše, šta ostaje drugima, aplikacija ne može sama da briše korisnike, ponovna registracija istim mejlom
počinje od nule, i da svaki budući FK na `auth.users` mora biti `cascade` ili `set null`).

## 3. Šta Sergej podešava, korak po korak

### 3.1 Supabase: baza
1. Supabase > **SQL Editor** > New query > nalepi ceo `backend/supabase/migrations/0002_limits_and_quotas.sql` > Run
   (posle `0001`).
2. Isto za `backend/supabase/migrations/0003_no_passwords.sql` (posle `0002`): niko nikad nema lozinku (vidi 4).
   Provera u SQL Editor-u, mora da bude `0`:
   `select count(*) from auth.users where coalesce(encrypted_password, '') <> '';`
3. Isto za `backend/supabase/migrations/0004_privacy_and_input_checks.sql` (posle `0003`): ko šta vidi i provere
   unosa (vidi 7). Ako javi grešku „violates check constraint“, u bazi već postoji red koji ne prolazi novu proveru
   (npr. naziv cilja sa razmakom na kraju): javi mi koji, ne briši ništa sam.

### 3.2 Supabase: Auth (prijava bez lozinke)
Prijava je samo: **kod od 6 cifara na mejl**, **Google** i **Sign in with Apple** (iPhone). Lozinke nema nigde
(vidi 6). Redom:

1. **Authentication > Sign In / Providers**:
   - „Allow new users to sign up“: uključeno.
   - „Allow anonymous sign-ins“: **isključeno**.
   - „Allow manual linking“: isključeno.
   - Otvori **Email**: „Enable Email provider“ uključeno, „Confirm email“ **uključeno**, „Secure email change“
     uključeno, „Email OTP Expiration“ **600** sekundi (10 min), „Email OTP Length“ **6**.
     „Confirm email“ **mora** da ostane uključeno: kad je isključeno, `signUp` sa bilo kojim mejlom odmah daje
     prijavu, bez potvrde mejla, i to `0003` ne može da spreči (tu se ne prijavljuje lozinkom, nalog se samo napravi).
     Polja o lozinci („Minimum password length“, „Password requirements“, „Prevent use of leaked passwords“) su
     nebitna: lozinka se nikad ne čuva (`0003`). Ostavi ih kako jesu.
2. **Authentication > Emails > Templates**: u **„Magic Link“** i u **„Confirm signup“** (njega dobija neko ko se
   prijavljuje prvi put) obriši sav tekst i nalepi:
   - Subject: `Your Lock In code`
   - Body: `<h2>Your Lock In code</h2><p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p><p>It works for 10 minutes. If you didn't ask for it, ignore this email.</p>`

   Bitno: u tekstu ne sme da ostane `{{ .ConfirmationURL }}` (to je magic link).
3. **Authentication > Emails > SMTP Settings**: uključi „Custom SMTP“ i upiši Resend podatke
   (host `smtp.resend.com`, port `465`, korisnik `resend`, lozinka = Resend API ključ, pošiljalac sa tvog domena).
   Bez ovoga Supabase šalje najviše 2 mejla na sat za ceo projekat, pa prijava kodom ne bi radila.
   Ako na toj strani postoji „Minimum interval per user“ (razmak između mejlova istoj osobi), ostavi **60** sekundi.
4. **Authentication > Rate Limits** (mejlovi mogu da se menjaju tek posle koraka 3):

   | Polje | Vrednost | Zašto |
   |---|---|---|
   | Rate limit for sending emails | **30 na sat** (ceo projekat) | Svaka prijava kodom je jedan mejl. Resend Free ionako staje na 100 dnevno. Podigni na 100 kad bude više korisnika. Apple i Google ne troše mejlove. |
   | Rate limit for sign ups and sign ins | **30 na 5 min po IP** (podrazumevano, ne spuštaj) | Ovde se broji i slanje koda. Ljudi na istoj mobilnoj mreži često dele IP. |
   | Rate limit for token verifications | **15 na 5 min po IP** (umesto 30) | Provera koda. Pravom korisniku treba najviše 6 (aplikacija posle 5 pogrešnih traži novi kod). Napadač sa jedne IP adrese ima oko 30 pokušaja za vreme jednog koda, od milion mogućih. |
   | Rate limit for token refreshes | **150 na 5 min po IP** (podrazumevano, ne spuštaj) | Ovde se broje i Apple/Google prijave. Kad se ovaj limit pređe, supabase-js **odjavi** korisnika, pa je stroža vrednost gora od koristi. Refresh token je ionako jednokratan (vidi korak 5). |
   | Rate limit for anonymous users | nebitno | Anonimna prijava je isključena. |

   Supabase sam dozvoljava novi kod istoj adresi tek posle 60 s, isto kao dugme u aplikaciji.
5. **Authentication > Sessions** (ako ne vidiš, u Settings): „Detect and revoke potentially compromised refresh
   tokens“ **uključeno**, „Refresh token reuse interval“ **10** sekundi (podrazumevano). JWT expiry ostavi 3600.
6. **Authentication > URL Configuration**:
   - Site URL: `lockin://auth-callback`
   - Redirect URLs: dodaj `lockin://auth-callback`.
   - Samo dok testiraš Google u Expo Go: dodaj i tačnu adresu koju aplikacija ispiše u terminalu kad pritisneš
     „Continue with Google“ (izgleda kao `exp://192.168.1.5:8081/--/auth-callback`). **Pre puštanja je obriši**,
     i nikad ne dodaj `exp://**` sa zvezdicama: tada bi tuđ link za prijavu mogao da vrati Google kod na tuđ računar.
7. **Google** (Google Cloud Console, besplatno):
   1. console.cloud.google.com > napravi projekat „Lock In“ > **APIs & Services > OAuth consent screen**:
      User type External, naziv „Lock In“, tvoj mejl za podršku, scopes `email`, `profile`, `openid`; pa „Publish app“.
   2. **Credentials > Create credentials > OAuth client ID** > Application type **Web application**.
      U „Authorized redirect URIs“ nalepi „Callback URL“ sa Supabase strane Google provajdera
      (`https://<tvoj-projekat>.supabase.co/auth/v1/callback`). Create.
   3. Supabase > **Authentication > Sign In / Providers > Google**: uključi, nalepi **Client ID** i **Client Secret**
      (Secret lepiš samo ovde, nikome ga ne šalješ), „Skip nonce check“ **isključeno**, Save.
8. **Apple** (treba Apple Developer nalog):
   1. developer.apple.com > Certificates, IDs & Profiles > **Identifiers** > App ID aplikacije (Explicit, Bundle ID
      `com.lockintracker.app`, isti kao `ios.bundleIdentifier` u `mobile/app.json`) > uključi
      **Sign In with Apple** > Save.
   2. Supabase > **Authentication > Sign In / Providers > Apple**: uključi; u „Client IDs“ upiši `host.exp.Exponent`
      (Expo Go) i `com.lockintracker.app`, odvojene zarezom. **Secret Key ostavi prazno**: aplikacija koristi samo
      prijavu na samom iPhone-u, kojoj ključ ne treba (i ne ističe na 6 meseci). Save.
   Na Android-u nema Apple dugmeta: Apple to traži samo za App Store, a na Android-u bi trebao i tajni ključ koji ističe.
9. **Authentication > Attack Protection** (u starijem izgledu „Bot and Abuse Protection“):
   - „Enable CAPTCHA protection“: Turnstile je ugrađen u aplikaciju (25. oktobra 2026). Uključuje se **tek posle**
     3.3 i provere da build koji ljudi koriste šalje token (inače „Send code“ prestaje da radi za sve):
     uključi, Provider **Turnstile by Cloudflare**, „Captcha secret“ = **Secret key** iz Cloudflare-a (lepiš samo
     ovde, nikome ne šalješ), Save.

**O CAPTCHA kod prijave bez lozinke:** Supabase je traži za slanje koda na mejl (`signInWithOtp`) i za registraciju
lozinkom. Ne traži je za proveru koda, za Apple i Google (oni idu preko `id_token` / PKCE) ni za osvežavanje prijave.
Widget je **Managed** sa `appearance: interaction-only`: korisnik obično ništa ne vidi, a kad Cloudflare traži klik,
widget se pojavi ispod „Send code“ sa „Quick check that you’re human:“. (Potpuno nevidljiv widget ne bi mogao da
pokaže ni taj klik, pa bi sumnjiv, a pravi korisnik ostao zaglavljen.)

### 3.3 Cloudflare Turnstile (besplatno)
1. dash.cloudflare.com > **Turnstile** > **Add widget**.
2. Widget name „Lock In“. Hostname Management > Add hostnames: **tvoj domen** (npr. onaj sa kog idu mejlovi,
   `lockintracker.com`; bez `https://` i bez putanje). Widget Mode: **Managed**. Pre-clearance: **No**. Create.
3. **Site key** (javan) i taj isti hostname idu u `mobile/.env.local`:
   `EXPO_PUBLIC_TURNSTILE_SITE_KEY=<site key>` i `EXPO_PUBLIC_TURNSTILE_HOSTNAME=<tvoj domen>`; za build preko EAS-a
   isto u EAS > Environment variables. **Secret key** lepiš samo u Supabase (3.2, korak 9).
4. Redosled: (a) ključevi u `.env.local`, `npx expo start`, „Send code“ mora i dalje da radi (Supabase još ne traži
   CAPTCHA i ne gleda token); (b) tek onda uključi CAPTCHA u Supabase-u (3.2, korak 9); (c) ponovo „Send code“:
   mora da stigne kod. Ako javi „Couldn’t check that you’re human“, isključi CAPTCHA u Supabase-u i javi mi.
5. Za probu bez pravog domena Cloudflare ima javne test ključeve (prolaze uvek, bilo koji hostname): site key
   `1x00000000000000000000AA` u `.env.local` i secret `1x0000000000000000000000000000000AA` u Supabase. Pre objave
   ih zameni pravim (deo 6).

Kako aplikacija to radi: stranica sa widgetom se učitava u WebView kao da dolazi sa `https://<tvoj domen>/` (zato
taj domen mora biti u hostname listi; stranica se ne postavlja nigde, nalazi se u aplikaciji). WebView sme da učita
samo tu stranicu i `challenges.cloudflare.com`; svaki token važi jednom i 300 s, pa se za svako slanje radi nova
provera. **Nije provereno na telefonu:** da Cloudflare prihvata ovakvo učitavanje (umesto stranice sa pravog domena).
Ako ne prihvati (greška 110200 / „Couldn’t check that you’re human“ i sa pravim ključevima), sledeće rešenje je da
se ista stranica postavi na tvoj domen i WebView je otvori odatle; to je mala izmena.

### 3.4 Supabase: troškovi
1. Organizacija > **Billing** > **Cost Control** > „Spend Cap“: **uključeno** (postoji na Pro planu; na Free planu
   nema doplata, projekat se samo uspori/pauzira). Spend cap blokira preterano korišćenje (Edge Functions, Realtime
   poruke, saobraćaj, MAU, prostor) umesto da se naplati.
2. Spend cap ne pokriva Compute, dodatni disk, PITR, IPv4, custom domen: ništa od toga ne uključuj dok ne zatreba.
   Compute ostavi na najmanjem.
3. Supabase nema upozorenja na iznos. Jednom nedeljno pogledaj Organizacija > **Usage** i Billing >
   „Upcoming invoice“.

### 3.5 Edge Functions (brisanje naloga, RevenueCat i slanje mejlova)
1. Supabase > **Edge Functions > Secrets** (ili `npx supabase secrets set ...` u svom terminalu). Upiši sam, nikome ne šalji:
   - `REVENUECAT_WEBHOOK_AUTH` = `Bearer ` + dugačak nasumičan tekst (bar 40 znakova, npr. iz menadžera lozinki);
   - `RESEND_API_KEY` = Resend ključ sa dozvolom samo „Sending access“;
   - `INVITE_FROM` = npr. `Lock In <invites@tvoj-domen.com>`.
   `SUPABASE_URL`, `SUPABASE_ANON_KEY` i `SUPABASE_SERVICE_ROLE_KEY` Supabase sam daje funkcijama; ne upisuju se nigde.
2. Postavljanje (u folderu `backend`, posle `npx supabase login` i `npx supabase link`):
   ```
   npx supabase functions deploy revenuecat-webhook --no-verify-jwt
   npx supabase functions deploy send-invite-email
   npx supabase functions deploy delete-account
   ```
   `delete-account` ne traži nijednu tajnu koju ti upisuješ. Dok nije postavljena, „Delete account“ javlja grešku.
   (`--no-verify-jwt` samo za webhook: RevenueCat nema Supabase prijavu, njega štiti tajno zaglavlje.)

### 3.6 RevenueCat
0. **Product catalog > Entitlements** > New: identifier **`access`**, i za njega zakači sve proizvode
   (mesečno, godišnje, doživotno). Aplikacija proverava baš taj naziv. Javni SDK ključevi iz **API keys**
   (`appl_…`, `goog_…`) idu u `mobile/.env.local`; tajni (`sk_…`) nikad u aplikaciju.
1. Projekat > **Integrations > Webhooks** > Add webhook.
2. URL: `https://<tvoj-projekat>.supabase.co/functions/v1/revenuecat-webhook`.
3. „Authorization header value“: **ista** vrednost kao `REVENUECAT_WEBHOOK_AUTH` (sa `Bearer ` na početku).
4. Events: All events; Environment: oba (Sandbox treba za TestFlight).
5. Pritisni „Send test event“: odgovor mora biti 200 („ignored“, jer test ne menja ništa).
   Za proveru zaštite: ako privremeno promeniš vrednost u RevenueCat-u, odgovor mora biti 401.

### 3.7 Resend (mejlovi)
1. resend.com > **Domains**: dodaj svoj domen i podesi DNS zapise (SPF/DKIM), inače mejlovi idu u spam.
2. **API Keys**: napravi ključ sa „Sending access“ samo za taj domen (ne „Full access“).
3. Resend nema podešavanje dnevnog limita. Free plan sam staje na 100 mejlova dnevno / 3.000 mesečno (bez naplate).
   Na plaćenom planu nema dnevnog limita, zato pravi dnevni limit drži baza (100 poziva dnevno za celu aplikaciju,
   vidi 1). Kad pređeš na plaćeni plan, podigni ga SQL-om iz tačke 1. Potrošnju gledaj na stranici **Usage**.
   Pazi: isti Resend nalog šalje i mejlove za registraciju (3.2, korak 2), pa se troše iz iste kvote.

### 3.8 Expo / EAS
1. expo.dev > tvoj nalog > **Billing**: dok ne treba više build-ova, ostani na **Free** planu: tad nema doplata.
2. Na plaćenom planu doplata se obračunava automatski i nema tvrdog limita; Expo šalje mejl vlasniku na 80% i 100%
   uključenih build kredita. Pogledaj Billing > **Usage** pre svakog većeg build-ovanja. Build-uj samo `production`
   kad treba, a za probu koristi Expo Go.

## 4. Prijava u aplikaciji (`mobile/src/auth/`, urađeno 25. oktobra 2026)

Ekran `mobile/src/app/sign-in.tsx` otvara se iz Shared goal („Sign in to get started“) i iz Settings > Account.
Aplikacija i dalje radi bez naloga: lična potrošnja je samo na telefonu, nalog treba za zajednički cilj i pretplatu.

**Načini prijave (nigde nema polja za lozinku):**
- **Kod od 6 cifara na mejl:** `signInWithOtp` (novi mejl dobija nalog) pa `verifyOtp` sa tipom `email`. Nije magic link.
  „Send code“ je zaključan 60 s posle slanja (i kad se ekran zatvori i otvori). Posle 5 pogrešnih kodova polje za kod
  se zaključa i traži se novi kod. Pogrešan kod se broji samo kad server kaže da je kod pogrešan ili istekao
  (ne kad nema mreže). Ovo je za korisnika; pravu granicu drže limiti u Supabase-u (3.2, korak 4).
- **Google:** prijava u sistemskom prozoru pregledača, **PKCE** (kod koji Google vrati važi samo uz tajnu koja ostaje
  na telefonu). Radi i u Expo Go.
- **Sign in with Apple:** samo iPhone, ugrađeno Apple dugme, `signInWithIdToken` sa jednokratnim `nonce`
  (Apple dobija SHA-256, Supabase original), pa token ne može da se iskoristi dvaput. Ime koje Apple da pri prvoj
  prijavi upisuje se kao ime koje prijatelji vide, ako ga još nema.
- Isti mejl preko koda i preko Google-a je isti nalog (Supabase spaja potvrđene mejlove). Apple „Hide my email“ daje
  drugu adresu, pa je to poseban nalog.
- Poruke greške su kratke, na engleskom, nikad sirov tekst servera.
- CAPTCHA: Turnstile je ugrađen (`mobile/src/auth/turnstile.ts`, `captcha.ts`, `components/TurnstileHost.tsx` na
  ekranu za prijavu). `getCaptchaToken()` daje nov token za svako slanje koda (`options.captchaToken` u
  `signInWithOtp`); bez site key-a i hostname-a u `.env.local` vraća `undefined` i CAPTCHA u Supabase-u mora da
  ostane isključena. Ako provera ne uspe (greška, nema mreže, 60 s bez odgovora), kod se ne šalje i piše
  „Couldn’t check that you’re human. Try again.“ Podešavanje: 3.3.

**Čuvanje prijave:** supabase-js ne koristi običan AsyncStorage. Šema koju Supabase preporučuje za Expo
(„LargeSecureStore“): sesija je šifrovana (AES-256, `aes-js`) u AsyncStorage, a ključ je u **SecureStore**
(Keychain / Keystore), sa `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (čita se samo dok je telefon otključan i nikad ne ide u
rezervnu kopiju na drugi telefon). Svako snimanje pravi nov ključ. Pogrešan ili nestao ključ znači „nije prijavljen“,
ne smeće. Prijava se osvežava samo dok je aplikacija na ekranu.
**Odjava** (samo na tom telefonu) i **brisanje naloga** brišu sesiju i ključ, i kad nema mreže
(`wipeSession` briše i zaostale ključeve). Lični podaci (`lockin`) se ne diraju.

**Prava (proba / pretplata):** aplikacija ih nikad ne određuje sama i ne čuva odgovor. Pri svakom pokretanju i
povratku u aplikaciju pita server (`my_access()`, tabela `subscriptions` koju puni samo webhook) i RevenueCat
(entitlement `access`). Server je glavni: ako kaže da važi, važi; ako RevenueCat kaže da je upravo kupljeno, a
webhook još nije stigao, piše „finishing setup“; ako server ne može da se pita, stanje je „unknown“, ne „active“.
To menja samo prikaz. Sve što ide na server i dalje proverava baza (`app.require_access`, RLS).
Provereno 25. oktobra: nijedan ekran ne zaključava ni ne otključava ništa po probi ili pretplati, i u stanju na
telefonu (`AppState`) ne postoji oznaka „plaćeno“. „Lock-in Pro / See plans“ u Settings je i dalje samo „Coming soon.“
- Posle prijave `Purchases.logIn(<Supabase user id>)`, pri odjavi i brisanju `Purchases.logOut()`.
- Ključevi samo javni, u `mobile/.env.local` (primer: `mobile/.env.example`): `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`,
  `EXPO_PUBLIC_TURNSTILE_SITE_KEY`. Aplikacija **odbija da se pokrene** sa `sb_secret_…` ili `service_role` ključem.
  Bez ključeva Settings nema deo Account, a dugme u Shared goal kaže „Accounts are coming soon“ kao ranije.

**Brisanje naloga** (Settings > Danger zone > Delete account, dva dodira u 4 s, kao Reset): funkcija
`delete-account` (vidi 2). Tekst kaže da pretplata u App Store-u / Google Play-u nije otkazana time (Apple traži da se to kaže).

**Lozinke (rešeno 25. oktobra 2026, migracija `0003_no_passwords.sql`):** prijava lozinkom ne radi nikome.
- Problem je bio stvaran: Supabase ne može da isključi lozinke (sa javnim ključem svako može da pozove `signUp`,
  `signInWithPassword` i `updateUser({ password })`), a Supabase Auth **ne briše** postojeću lozinku nepotvrđenog
  naloga kad se on potvrdi kodom (`signupVerify` i `Signup` u njihovom kodu ne diraju lozinku). Neko je mogao da
  napravi nalog sa tuđim mejlom i svojom lozinkom, a kad se pravi vlasnik prvi put prijavi kodom, da uđe njegovom
  lozinkom.
- Rešenje: triger `no_password` **BEFORE INSERT OR UPDATE** na `auth.users` uvek postavlja `encrypted_password` na
  prazno. Supabase Auth prazno tretira kao „nema lozinke“ (`User.Authenticate` vraća „ne“ pre bilo kakvog
  poređenja), pa je odgovor uvek „Invalid login credentials“: pre potvrde, posle potvrde, za nalog napravljen u
  dashboard-u i za lozinku postavljenu kasnije. Migracija briše i lozinke naloga koji već postoje.
- Kod, Google i Apple lozinku nikad ne čitaju (kod se proverava prema jednokratnom tokenu, Google i Apple prema
  nalogu kod njih). Google/Apple nalozi ionako imaju prazno polje, a nalog napravljen kodom dobija od Supabase-a
  nasumičnu privremenu lozinku, koja se sada odmah briše.
- Na Supabase-u je dozvoljeno: trigeri na `auth.users` su izričito dozvoljeni i posle ograničenja od 21. aprila 2025;
  funkcija je van `auth` šeme (`app.no_password`), ne čita nijednu tabelu i aplikacija ne može da je pozove.
- Testovi (`backend/tests/no_passwords.test.mjs`, 23 provere): korak po korak ponavljaju šta Supabase Auth radi
  u bazi za svaki zahtev (isti redovi, iste kolone, ista uloga `supabase_auth_admin`, ista provera lozinke):
  nalog sa lozinkom ne može da se prijavi lozinkom ni pre ni posle prijave kodom; isto za nalog iz dashboard-a i
  lozinku postavljenu preko `updateUser`; kod, Google i Apple i dalje rade i ostale kolone ostaju; profil se i
  dalje pravi. Iste korake test pušta i na bazi **bez** `0003`: tamo napad uspeva, što pokazuje da test proverava
  pravu stvar.
- Šta test ne može: pravi Supabase Auth server se ne pokreće ovde (nema Docker-a). Zato posle primene `0003` na
  pravom projektu, jednom:
  1. Authentication > Users > **Add user > Create new user**: probni mejl (npr. tvoj sa `+nopw` pre `@`),
     bilo koja probna lozinka, „Auto Confirm User“ uključeno.
  2. U folderu `backend`: `node scripts/check-no-password-login.mjs <taj mejl> <ta lozinka>` (uzima URL i anon ključ
     iz `mobile/.env.local`). Mora da ispiše `OK: password sign-in is refused`.
  3. SQL iz 3.1, korak 2 mora da vrati `0`. Pa obriši tog probnog korisnika.

## 5. Provera ključeva i RLS (25. oktobar 2026)

- Pregledan ceo repo i cela git istorija svih grana: nema `service_role` / `sb_secret_` ključa, lozinke baze,
  Resend, RevenueCat ni AI ključa. Jedini ključ je javni `sb_publishable_…` u prototipu (`index.html`), za brojanje
  korišćenja; on sme da bude javan.
- Aplikacija (`mobile/`) nema nijedan ključ u repou: javni ključevi idu u `mobile/.env.local` (nije u gitu), a
  aplikacija odbija da radi sa tajnim ključem (vidi 4).
- RLS je uključen na svim tabelama: 7 iz `0001`, 2 iz `0002` (`app.rate_limits`, `app.rate_events`, bez ikakvog
  pristupa iz aplikacije) i `events` iz prototipa (`supabase/setup.sql`). Test proverava da u bazi nema tabele bez RLS-a.
- Uočeno, nije menjano: tabela `events` iz prototipa dozvoljava neograničen upis bez prijave (samo provera datuma).
  Neko ko pročita javni ključ iz prototipa može da je puni smećem. Šteta je mala (samo statistika), ali ako se
  isti Supabase projekat koristi za aplikaciju, vredi dodati limit ili je obrisati kad testiranje prototipa završi.

## 6. Pre objave u prodavnicama: skloniti

Sve ovo služi samo za probu (Expo Go, test nalozi). Pre slanja na App Store / Google Play:

1. Supabase > Authentication > Sign In / Providers > **Apple** > Client IDs: obriši `host.exp.Exponent`
   (to je Expo Go; ostaje samo `com.lockintracker.app`).
2. Supabase > Authentication > **URL Configuration** > Redirect URLs: obriši sve `exp://…` adrese
   (ostaje samo `lockin://auth-callback`). Site URL mora biti `lockin://auth-callback`, ne `localhost`.
3. Supabase > Authentication > **Users**: obriši probne naloge (npr. onaj iz provere lozinke u delu 4).
   U SQL Editor-u obriši probne redove iz `public.subscriptions` koje si eventualno upisao ručno.
4. Supabase > Authentication > Attack Protection: **CAPTCHA uključena** (Turnstile), ali tek kad je ugrađen u
   aplikaciju (3.2, korak 9); ako nije ugrađen, objava čeka na to.
5. Supabase > Authentication > Sign In / Providers > Email: „Confirm email“ **uključeno** (vidi 3.2, korak 1).
6. Google Cloud Console > OAuth consent screen: status **In production** (ne „Testing“, gde rade samo ručno
   dodati test korisnici); u „Authorized redirect URIs“ samo Supabase callback.
7. Resend: pošiljalac sa tvog domena (ne `onboarding@resend.dev`), domen potvrđen (SPF/DKIM).
8. `mobile/.env.local` / EAS secrets za production build: adresa i javni ključ **pravog** Supabase projekta
   (ne probnog, ako ih ima dva) i pravi RevenueCat javni ključevi. Nikad `service_role` / `sb_secret_`.
9. Tabela `events` iz prototipa (vidi 5): ako je u istom projektu kao aplikacija, obrisati je ili joj dodati limit.
10. Pokrenuti proveru iz dela 4 (lozinke) i SQL iz 3.1, korak 2 na pravom projektu.
11. Turnstile: Cloudflare test ključevi (`1x000…`) zamenjeni pravim, u `.env.local` / EAS i u Supabase-u (3.3).
12. GitHub > Settings > Code security: „Dependabot alerts“ i „Dependabot security updates“ uključeni (deo 7).

## 7. Bezbednosna provera pre objave (25. oktobar 2026)

**Mejl sa pozivom** (`send-invite-email`): mejl je samo običan tekst, bez HTML dela, pa HTML ne može ni da se
ubaci. Ime pošiljaoca je ranije išlo skoro kakvo jeste (sklanjali su se samo novi redovi), a kad imena nema, slao
se **mejl pošiljaoca**. Ispravljeno:
- u imenu ostaju samo slova, cifre, razmaci, apostrof i crtica: nema `< > " &`, tačaka, dvotačke, kosih crta ni `@`,
  pa ime ne može da postane HTML, link (mejl programi i u običnom tekstu od „evil.com“ i „https://…“ prave link) ni
  adresa; sklanjaju se i nevidljivi i znakovi koji okreću tekst; slova koja liče na druga („ｅｖｉｌ．ｃｏｍ“) se prvo
  svedu na obična, pa se i ona uhvate; najviše **40** znakova;
- bez imena piše „A friend“, mejl pošiljaoca se nikad ne šalje (baza vraća samo `display_name`);
- adresa primaoca mora biti obična mejl adresa, inače se ništa ne šalje (400).
Testovi: 3 nove i 1 dopunjena provera u `send-invite-email/handler_test.ts` (imena sa `<a href>`, `<script>`, URL-om, `www.`, `@`, `javascript:`,
full-width slovima, okretanjem teksta; prava imena sa đ, š, ćirilicom ostaju; dužina; loše adrese).

**Ko šta vidi** (`0004_privacy_and_input_checks.sql`). Bilo je: prijatelji i članovi zajedničkog cilja čitali su
ceo profil, **uključujući mejl**; pošiljalac poziva je mogao da pročita `to_user` i tako sazna da li za neki mejl
postoji nalog. Izabrano strožije, jer ništa u aplikaciji ne traži tuđi mejl: **mejl ne vidi niko osim vlasnika**
(i on ga ima iz prijave, ne iz tabele). Sada:
- `profiles`: drugi vide samo `id` i `display_name`, i to: prijatelji, članovi istog cilja i onaj ko ti je poslao
  poziv koji čeka (da znaš ko te zove); `email` aplikacija ne može da pročita ni za sebe; `select *` je odbijen, pa
  aplikacija uvek navodi kolone;
- `friend_requests`: `to_user` se ne čita; poziv nalogu i poziv nepostojećem mejlu izgledaju isto pošiljaocu;
- ostale tabele i `goal_totals`: bez mejlova; RPC-ovi: samo `claim_invite_email` vraća mejl, i to adresu koju si
  ti upisao u svoj poziv; Realtime šalje samo kolone na koje korisnik ima pravo, pa važi i za izmene uživo;
- pomoćne funkcije u šemi `app` (`are_friends`, `shares_goal`…) nisu dostupne preko API-ja (Supabase API vidi
  samo `public`).
Testovi: `backend/tests/privacy.test.mjs` (20 provera), uključujući **tačan spisak svih kolona i RPC-ova** koje
aplikacija sme da čita i zove: nova kolona sa mejlom ili nov RPC bi odmah oborio test.

**Provera unosa u bazi** (isto `0004`). Bilo je: naziv cilja nije smeo biti prazan, ali je smeo da ima razmake na
krajevima, novi red, nevidljive znakove; `display_name` je smeo biti samo razmaci; napomena uz uplatu je smela biti
prazna; iznosi bez gornje granice (do ~10^12). Sada:
- svaki tekst (naziv cilja do 60, ime do 40, napomena do 80): nije prazan, nije samo razmaci, nema razmak na
  početku/kraju, nema kontrolnih ni nevidljivih znakova i znakova koji okreću tekst (`app.clean_text`);
- „još nema imena“ i „nema napomene“ su `NULL`, ne prazan tekst;
- iznos cilja i uplate: veći od 0 i najviše **1.000.000.000** (dovoljno i za VND/IDR); valuta tačno 3 velika slova
  (bilo je i ranije);
- adresa u pozivu: obična mejl adresa, najviše 254 znaka.
- SQL od stringova: nijedna funkcija ne koristi `EXECUTE` (dinamički SQL); jedini `format()` sastavlja poruku o
  limitu iz serverske tabele, ne SQL. Svaka `security definer` funkcija ima zaključan `search_path`.
Testovi: `backend/tests/input_checks.test.mjs` (68 provera; test pada ako se ikad pojavi `EXECUTE` ili `security
definer` funkcija bez `search_path`).

**Turnstile**: ugrađen, vidi 3.3 i 4. Testovi: `mobile/src/auth/__tests__/turnstile.test.ts` (9 provera: stranica,
site key ne može da „probije“ skriptu, poruke iz WebView-a, nov token za svako slanje, greška / 60 s).

**Zavisnosti** (`npm audit`):
- `backend/`: 0 ranjivosti.
- `mobile/`: 8 (6 visokih, 2 srednje), sve u alatima za razvoj, ne u aplikaciji na telefonu (provereno u
  izvezenom paketu): `node-forge` i `zod` u Expo CLI-ju (`@expo/cli`, potpisivanje i čitanje podešavanja na tvom
  računaru), `uuid` u `@expo/ngrok` (tunel za `--tunnel`). Ostale stavke (`expo`, `datetimepicker`) su samo „preko
  njih“. Nije popravljeno, jer ne može bez kvara: za `node-forge` ispravka još ne postoji, a `zod` je ispravljen samo
  u verziji 4, koju Expo CLI ne podržava; `npm audit fix --force` bi vratio Expo na SDK 44. Rešiće se sa sledećim
  Expo SDK-om ili zakrpom; Dependabot će javiti.
- `.github/dependabot.yml`: npm za `mobile/` i `backend/`, nedeljno (ponedeljkom), na granu `aplikacija`. Za
  `mobile/` bot ne predlaže nove minor/major verzije paketa koje određuje Expo SDK (expo, react, react-native…):
  njih menja `npx expo install expo@<sledeći SDK> --fix`, namerno. Zakrpe (patch) dolaze grupisane.

**Tajne u istoriji**: pregledana cela istorija svih 8 grana (64 commit-a, svaka dodata linija): nema JWT-a
(`service_role`/`anon`), `sb_secret_`, Stripe/RevenueCat `sk_`, Resend `re_`, GitHub, AWS, Google `GOCSPX-`/`AIza`,
Turnstile secret, privatnih ključeva, lozinki u adresi baze ni dodela tipa `password = "…"`; nikad nije bio
commit-ovan `.env`, `.p8`, `.p12`, `.pem`, `.key` ni `google-services` fajl. Jedini ključ je javni
`sb_publishable_…` u prototipu (dozvoljeno). gitleaks nije instaliran; pretraga je rađena kroz `git log --all -p`.

**Rezervna kopija**: ispod „Make backup / Import“ piše „This backup has all your spending in it. Don’t send it to
anyone.“ Ništa drugo na tom ekranu nije menjano.
