# Zaštita od zloupotrebe i troškova

Šta je urađeno u kodu i šta Sergej mora sam da podesi po dashboard-ima. Nikome (ni Claude-u) ne šalji
`service_role` ključ, lozinku baze, Resend ključ, RevenueCat tajnu ni AI ključ. Sve tajne se lepe samo u
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

Testovi: `handler_test.ts` u oba foldera (15 provera).

## 3. Šta Sergej podešava, korak po korak

### 3.1 Supabase: baza
1. Supabase > **SQL Editor** > New query > nalepi ceo `backend/supabase/migrations/0002_limits_and_quotas.sql` > Run
   (posle `0001`).

### 3.2 Supabase: Auth (prijava)
1. **Authentication > Sign In / Providers**:
   - „Allow new users to sign up“: uključeno.
   - „Allow anonymous sign-ins“: **isključeno**.
   - „Allow manual linking“: isključeno.
   - Otvori **Email**: „Confirm email“ **uključeno** (obavezna potvrda mejla), „Secure email change“ uključeno,
     „Minimum password length“ **8**, „Password requirements“ **Letters and digits**,
     „Email OTP Expiration“ **900** sekundi (15 min).
2. **Authentication > Emails > SMTP Settings**: uključi „Custom SMTP“ i upiši Resend podatke
   (host `smtp.resend.com`, port `465`, korisnik `resend`, lozinka = Resend API ključ, pošiljalac sa tvog domena).
   Bez ovoga Supabase šalje najviše 2 mejla na sat za ceo projekat, pa registracija ne bi radila.
3. **Authentication > Rate Limits** (posle koraka 2 može da se menja i limit za mejlove):
   - Rate limit for sending emails: **60 na sat** (za ceo projekat; podigni kad bude više korisnika);
   - Sign ups and sign ins: **30 na 5 min po IP adresi** (podrazumevano, ne spuštaj: ljudi na istoj mobilnoj mreži
     često dele IP);
   - Token verifications (OTP / link iz mejla): **30 na 5 min po IP**;
   - Token refreshes: **150 na 5 min po IP** (podrazumevano);
   - Anonymous users: nebitno (anonimna prijava je isključena).
4. **Authentication > Attack Protection** (u starijem izgledu „Bot and Abuse Protection“):
   - „Enable CAPTCHA protection“: **uključi**, izaberi **Cloudflare Turnstile**, nalepi **Secret key** iz Cloudflare-a
     (vidi 3.3). Ovo radi tek kad aplikacija šalje CAPTCHA token, pa **uključi tek kad ekrani za registraciju
     budu gotovi** (inače niko ne može da se registruje).
   - „Prevent use of leaked passwords“: uključi (traži Pro plan).

**Važno o CAPTCHA:** Supabase ne može da je uključi samo za registraciju i zaboravljenu lozinku. Kad je uključena,
traži je za registraciju, zaboravljenu lozinku, slanje koda/linka na mejl **i za prijavu lozinkom**. Ne traži je za
Sign in with Apple i Google (oni idu preko `id_token`, koji je izuzet) ni za osvežavanje prijave. Zato se koristi
Turnstile u **nevidljivom** režimu: na prijavi se token uzme u pozadini i korisnik ništa ne vidi; izazov se pojavi
samo kad Cloudflare posumnja na bota. Tako je za korisnika CAPTCHA praktično samo na registraciji i
zaboravljenoj lozinki.

### 3.3 Cloudflare Turnstile (besplatno)
1. dash.cloudflare.com > **Turnstile** > Add widget.
2. Naziv „Lock In“, hostname: domen aplikacije (onaj sa kog idu mejlovi), Widget mode: **Invisible**.
3. **Site key** ide u aplikaciju (javan je, kao anon ključ). **Secret key** nalepi samo u Supabase (3.2, korak 4).

### 3.4 Supabase: troškovi
1. Organizacija > **Billing** > **Cost Control** > „Spend Cap“: **uključeno** (postoji na Pro planu; na Free planu
   nema doplata, projekat se samo uspori/pauzira). Spend cap blokira preterano korišćenje (Edge Functions, Realtime
   poruke, saobraćaj, MAU, prostor) umesto da se naplati.
2. Spend cap ne pokriva Compute, dodatni disk, PITR, IPv4, custom domen: ništa od toga ne uključuj dok ne zatreba.
   Compute ostavi na najmanjem.
3. Supabase nema upozorenja na iznos. Jednom nedeljno pogledaj Organizacija > **Usage** i Billing >
   „Upcoming invoice“.

### 3.5 Edge Functions (kad dođe RevenueCat i slanje mejlova)
1. Supabase > **Edge Functions > Secrets** (ili `npx supabase secrets set ...` u svom terminalu). Upiši sam, nikome ne šalji:
   - `REVENUECAT_WEBHOOK_AUTH` = `Bearer ` + dugačak nasumičan tekst (bar 40 znakova, npr. iz menadžera lozinki);
   - `RESEND_API_KEY` = Resend ključ sa dozvolom samo „Sending access“;
   - `INVITE_FROM` = npr. `Lock In <invites@tvoj-domen.com>`.
   `SUPABASE_URL`, `SUPABASE_ANON_KEY` i `SUPABASE_SERVICE_ROLE_KEY` Supabase sam daje funkcijama; ne upisuju se nigde.
2. Postavljanje (u folderu `backend`, posle `npx supabase login` i `npx supabase link`):
   ```
   npx supabase functions deploy revenuecat-webhook --no-verify-jwt
   npx supabase functions deploy send-invite-email
   ```
   (`--no-verify-jwt` samo za webhook: RevenueCat nema Supabase prijavu, njega štiti tajno zaglavlje.)

### 3.6 RevenueCat
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

### 3.9 AI provajder (kad dođe AI funkcija)
1. Napravi poseban workspace samo za Lock In (npr. Anthropic Console > Settings > **Workspaces**).
2. Console > Settings > **Limits**: mesečni limit potrošnje za taj workspace (npr. $20 na početku) i obaveštenje
   mejlom na 50% i 80%.
3. Ključ za taj workspace ide samo u Supabase > Edge Functions > Secrets (`ANTHROPIC_API_KEY`), nikad u aplikaciju.

## 4. Plan za AI funkciju (nije rađeno)

- Aplikacija nikad ne zove AI direktno i nikad nema AI ključ. Poziva Edge Function `ai-advice` sa svojom prijavom;
  funkcija zove AI sa ključem iz Secrets.
- Pre svakog poziva funkcija pita bazu (kao `claim_invite_email`): dva nova reda u `app.rate_limits`:
  `ai_request` 20 dnevno po korisniku i `ai_request` npr. 2.000 dnevno za celu aplikaciju.
- Ukupni dnevni limit troška: tabela sa potrošenim tokenima po danu; funkcija posle svakog odgovora upiše
  trošak (ulazni + izlazni tokeni × cena modela), a pre poziva odbije ako je današnji trošak prešao npr. $3.
  Kad se pređe: „AI is resting for today. Try again tomorrow.“
- Svaki poziv ima `max_tokens` (npr. 400), skraćen ulaz (npr. do 500 znakova opisa) i najjeftiniji model koji daje
  dobre odgovore (npr. Claude Haiku). Bez istorije razgovora, samo jedno pitanje i jedan odgovor.
- Treći sloj: mesečni limit u dashboard-u AI provajdera (3.9).

## 5. Kad se prave ekrani za prijavu i registraciju (aplikacija)

- CAPTCHA: Turnstile (Invisible) preko WebView-a na registraciji, zaboravljenoj lozinki i prijavi lozinkom;
  token se šalje kao `options.captchaToken` u `signUp`, `resetPasswordForEmail` i `signInWithPassword`.
  Sign in with Apple i Google bez CAPTCHA. Tek tada uključiti CAPTCHA u Supabase-u (3.2, korak 4).
- Poruke iz baze sa oznakom `rate_limited` ili `quota` prikazati korisniku kakve jesu (već su na engleskom).
- Posle prijave pozvati `Purchases.logIn(<Supabase user id>)` u RevenueCat-u, inače webhook ne zna čija je pretplata.
- Supabase adresa i javni ključ u aplikaciji preko `EXPO_PUBLIC_SUPABASE_URL` i `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
  Javni (anon / `sb_publishable_…`) ključ sme u aplikaciju; `service_role` / `sb_secret_…` nikad.

## 6. Provera ključeva i RLS (25. oktobar 2026)

- Pregledan ceo repo i cela git istorija svih grana: nema `service_role` / `sb_secret_` ključa, lozinke baze,
  Resend, RevenueCat ni AI ključa. Jedini ključ je javni `sb_publishable_…` u prototipu (`index.html`), za brojanje
  korišćenja; on sme da bude javan.
- Aplikacija (`mobile/`) trenutno nema nijedan ključ: još se ne povezuje sa Supabase-om.
- RLS je uključen na svim tabelama: 7 iz `0001`, 2 iz `0002` (`app.rate_limits`, `app.rate_events`, bez ikakvog
  pristupa iz aplikacije) i `events` iz prototipa (`supabase/setup.sql`). Test proverava da u bazi nema tabele bez RLS-a.
- Uočeno, nije menjano: tabela `events` iz prototipa dozvoljava neograničen upis bez prijave (samo provera datuma).
  Neko ko pročita javni ključ iz prototipa može da je puni smećem. Šteta je mala (samo statistika), ali ako se
  isti Supabase projekat koristi za aplikaciju, vredi dodati limit ili je obrisati kad testiranje prototipa završi.
