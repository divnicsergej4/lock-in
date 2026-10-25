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

### 3.2 Supabase: Auth (prijava bez lozinke)
Prijava je samo: **kod od 6 cifara na mejl**, **Google** i **Sign in with Apple** (iPhone). Lozinke nema nigde
(vidi 6). Redom:

1. **Authentication > Sign In / Providers**:
   - „Allow new users to sign up“: uključeno.
   - „Allow anonymous sign-ins“: **isključeno**.
   - „Allow manual linking“: isključeno.
   - Otvori **Email**: „Enable Email provider“ uključeno, „Confirm email“ **uključeno**, „Secure email change“
     uključeno, „Email OTP Expiration“ **600** sekundi (10 min), „Email OTP Length“ **6**.
     Lozinku aplikacija ne koristi, ali Supabase ne može da isključi prijavu lozinkom preko API-ja, pa je otežaj:
     „Minimum password length“ **20**, „Password requirements“ **Lowercase, uppercase letters, digits and symbols**.
     „Prevent use of leaked passwords“ nije potrebno.
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
   - „Enable CAPTCHA protection“: **isključeno dok Turnstile nije ugrađen** u aplikaciju (`mobile/src/auth/captcha.ts`).
     Kad bude: uključi, izaberi **Cloudflare Turnstile**, nalepi **Secret key** iz Cloudflare-a (vidi 3.3).
     Ako se uključi pre toga, „Send code“ prestaje da radi za sve.

**O CAPTCHA kod prijave bez lozinke:** Supabase je traži za slanje koda na mejl (`signInWithOtp`) i za registraciju
lozinkom. Ne traži je za proveru koda, za Apple i Google (oni idu preko `id_token` / PKCE) ni za osvežavanje prijave.
Turnstile u **nevidljivom** režimu: token se uzme u pozadini kad korisnik pritisne „Send code“, izazov se pojavi samo
kad Cloudflare posumnja na bota.

### 3.3 Cloudflare Turnstile (besplatno)
1. dash.cloudflare.com > **Turnstile** > Add widget.
2. Naziv „Lock In“, hostname: domen aplikacije (onaj sa kog idu mejlovi), Widget mode: **Invisible**.
3. **Site key** ide u aplikaciju (javan je, kao anon ključ). **Secret key** nalepi samo u Supabase (3.2, korak 9).

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
- CAPTCHA: `mobile/src/auth/captcha.ts` je pripremljeno mesto za Turnstile; `getCaptchaToken()` se već šalje kao
  `options.captchaToken` u `signInWithOtp`, a dok Turnstile nije ugrađen vraća `undefined` (zato CAPTCHA u Supabase-u
  mora da ostane isključena).

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

**Poznat rizik, nije rešen u kodu:** pošto Supabase ne može da isključi registraciju lozinkom preko API-ja, neko
bi mogao da napravi nepotvrđen nalog sa tuđim mejlom i lozinkom pre nego što se pravi vlasnik prvi put prijavi
kodom. Šteta je mala (nalog ima samo prijatelje i zajedničke ciljeve) i zato je lozinka otežana (3.2, korak 1).
Pre puštanja proveriti na pravom projektu da li potvrda koda briše tu lozinku; ako ne briše, to se
rešava pre puštanja.

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
