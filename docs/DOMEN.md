# Domen za Lock In

Domen treba za: mejlove (kodovi za prijavu i pozivi, preko Resend-a), Turnstile (CAPTCHA), politiku privatnosti,
uslove korišćenja i podršku (folder `web/`). Domen kupuješ sam; nikome ne šalji lozinke ni ključeve.
U ovom fajlu `<domen>` znači tvoj domen, npr. `lockintracker.com`.

Ne koristi `divnicsergej4.github.io`: to je link za testere prototipa (grana `main`).

---

## 1. Kupovina (Cloudflare Registrar)

Predlog: Cloudflare Registrar, jer su Turnstile, DNS, prijem mejla (Email Routing) i hosting stranica (Pages) na
istom mestu. Cloudflare naplaćuje domen po ceni registra, bez doplate, a godišnja cena se vidi pre kupovine.

1. dash.cloudflare.com > napravi nalog (ili se prijavi) i **potvrdi mejl** (bez toga kupovina ne radi).
2. **Odmah uključi dvostepenu prijavu**: profil (gore desno) > My Profile > Authentication > Two-Factor
   Authentication. Ko uđe u ovaj nalog, ima tvoj domen, mejl i stranice.
3. Levo: **Domain Registration > Register Domains**. Ukucaj ime, izaberi slobodan (najbolje `.com`), **Purchase**.
4. Payment option: 1 godina je dovoljno (auto-renew je uključen, ostavi ga).
5. Kontakt podaci (latinicom, bez č/ć/š: Cloudflare traži ASCII). Javno se ne prikazuju gde registar to dozvoljava.
6. Plaćanje karticom > pročitaj uslove > **Complete purchase**.
7. Domain Registration > Manage Domains > tvoj domen: proveri da je **Auto-Renew** uključen i da piše da je domen
   zaključan (Transfer lock). U DNS > Settings uključi **DNSSEC** (jedan klik).

Domen kupljen kod Cloudflare-a uvek koristi Cloudflare DNS, pa se sve ispod podešava na istom mestu.

## 2. Mejl

### 2.1 Slanje (Resend): poddomen `mail.<domen>`
Resend preporučuje slanje sa poddomena, da reputacija glavnog domena ostane čista. Mejlovi će ići sa
`no-reply@mail.<domen>` (kodovi za prijavu) i `invites@mail.<domen>` (pozivi).

1. resend.com > **Domains** > Add Domain > upiši `mail.<domen>` > region (EU ako je Supabase u EU, inače US).
2. Najlakše: dugme **Sign in to Cloudflare** na stranici domena u Resend-u > odobri. Resend sam upisuje DNS zapise.
3. Ili ručno, Cloudflare > tvoj domen > **DNS > Records > Add record**, za svaki red tačno ono što Resend pokaže
   (vrednosti kopiraj iz Resend-a, ovde su samo primeri oblika):

   | Type | Name | Value | Priority | Proxy |
   |---|---|---|---|---|
   | MX | `send.mail` | npr. `feedback-smtp.eu-west-1.amazonses.com` | 10 | (nema) |
   | TXT | `send.mail` | `v=spf1 include:amazonses.com ~all` | | |
   | TXT | `resend._domainkey.mail` | dugačak `p=...` ključ iz Resend-a (to je DKIM) | | **DNS only** |

   (`send.mail` je SPF i povratna adresa, `resend._domainkey.mail` je DKIM.)
4. U Resend-u **Verify DNS Records**; posle par minuta (najviše par sati) mora da piše **Verified**.

### 2.2 DMARC (ceo domen)
Cloudflare > DNS > Records > Add record:

| Type | Name | Value |
|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@<domen>` |

- `p=none` prve 2–4 nedelje: ništa se ne odbija, samo stižu izveštaji. Kad u izveštajima vidiš da sve što šalje
  Resend prolazi, promeni u `p=quarantine` (sumnjivi mejlovi u spam), kasnije po želji `p=reject`.
- Izveštaji su XML fajlovi. Lakše je u Cloudflare-u: tvoj domen > **Email > DMARC Management** > Enable (ako to
  postoji u tvom dashboard-u): on sam doda adresu za izveštaje i pokaže ih kao tabelu; tada `rua` iz reda iznad
  zameni onim što Cloudflare predloži.

### 2.3 Prijem: `support@<domen>` na tvoj lični mejl (besplatno)
1. Cloudflare > tvoj domen > **Email > Email Routing** > Onboard / Get started. Cloudflare doda MX i SPF zapise na
   glavni domen; to se ne sudara sa Resend-om (njegovi zapisi su na `send.mail`).
2. **Destination addresses**: upiši svoj lični mejl i potvrdi ga iz mejla koji stigne.
3. **Routing rules > Create**: `support` > Send to > tvoj lični mejl. Isto za `dmarc` ako ne koristiš DMARC
   Management.
4. Proba: sa drugog naloga pošalji mejl na `support@<domen>` (proveri i spam).

### 2.4 Gde se upisuje (sve to radiš ti, nijedna vrednost nije tajna osim ključeva)
- Supabase > Authentication > Emails > **SMTP Settings**: Sender email `no-reply@mail.<domen>`, Sender name
  `Lock In` (ostalo kao u `docs/ZASTITA.md` 3.2, korak 3).
- Supabase > Edge Functions > Secrets: `INVITE_FROM` = `Lock In <invites@mail.<domen>>`.
- Provera: pošalji sebi kod za prijavu iz aplikacije; u Gmail-u > ⋮ > **Show original** mora da piše
  `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`.

## 3. Šta je u `web/`

Statične stranice na engleskom, bez ičije skripte, fonta ili praćenja (osim Cloudflare-ove skripte na Turnstile
stranici):

| Adresa | Fajl | Šta je |
|---|---|---|
| `https://<domen>/` | `web/index.html` | kratka početna sa linkovima |
| `https://<domen>/privacy/` | `web/privacy/index.html` | Privacy Policy |
| `https://<domen>/terms/` | `web/terms/index.html` | Terms of Use |
| `https://<domen>/support/` | `web/support/index.html` | podrška: `support@<domen>` i česta pitanja |
| `https://<domen>/turnstile/` | `web/turnstile/` | stranica koju aplikacija otvara za Turnstile (ne za ljude) |

`web/_headers` postavlja bezbednosna zaglavlja (stranice ne mogu da se ugrade u tuđi sajt, učitava se samo naš
sadržaj; Turnstile stranica sme samo Cloudflare-ov challenge).

**Privacy Policy i Terms nisu pravni savet.** Na vrhu oba fajla (u HTML komentaru, ne vidi se na stranici) je
spisak šta pravnik treba da proveri. Pre objave u prodavnicama neka ih pregleda pravnik, popuni
`[OWNER NAME AND ADDRESS]`, `[COUNTRY]` i `[SUPABASE REGION]`, pa obriši komentar. Tekst opisuje tačno ono što
aplikacija radi danas; kad aplikacija počne da radi nešto novo sa podacima, i tekst se menja.

## 4. Postavljanje `web/` na Cloudflare Pages (na tvoj domen)

1. Cloudflare > **Workers & Pages** > **Create application** > **Pages** > **Connect to Git** > GitHub > dozvoli
   pristup **samo** repou `divnicsergej4/lock-in` > Begin setup.
2. Project name: `lockin-web` (ili bilo šta). **Production branch: `aplikacija`**.
3. Build settings: Framework preset **None**, Build command **prazno**, Build output directory **`web`**.
   Save and Deploy. Dobiješ adresu tipa `lockin-web.pages.dev`; otvori `/privacy/` da proveriš.
4. Da se ne objavljuju druge grane: projekat > **Settings > Builds & deployments > Branch control** > Preview
   branches: **None**. (Inače bi i `main`/`razvoj` dobile svoje probne adrese.)
5. Domen: projekat > **Custom domains > Set up a custom domain** > upiši `<domen>` > Continue > Activate. Cloudflare
   sam napravi DNS zapis (ne pravi CNAME ručno pre ovoga: Cloudflare upozorava da tada domen ne radi). Ponovi za
   `www.<domen>` ako želiš da i www radi.
6. Provera: `https://<domen>/privacy/`, `/terms/`, `/support/` se otvaraju, katanac u pregledaču je tu.
   `https://<domen>/turnstile/?sitekey=1x00000000000000000000AA` je prazna stranica (to je u redu: widget se
   pojavi samo kad Cloudflare traži klik).

Svaki push na granu `aplikacija` posle toga sam objavi novu verziju stranica (za par minuta).

## 5. Gde se domen još upisuje (posle postavljanja)

- **Turnstile** widget > Hostname Management: `<domen>` (`docs/ZASTITA.md` 3.3).
- **Google Cloud** > OAuth consent screen: Authorized domains `<domen>`, App home page `https://<domen>/`,
  Privacy policy `https://<domen>/privacy/`, Terms `https://<domen>/terms/` (Google ih traži za objavu prijave).
- **App Store Connect**: Privacy Policy URL `https://<domen>/privacy/`, Support URL `https://<domen>/support/`.
- **Google Play Console**: Privacy policy `https://<domen>/privacy/`, kontakt mejl `support@<domen>`.

Napomena: Apple traži i link na politiku privatnosti **u samoj aplikaciji**; u Settings ga još nema (nije bilo
traženo). To je sledeći mali korak kad domen postoji.

## 6. Kad kupiš domen: javi mi ga

U kodu je mesto jasno označeno sa `__DOMAIN__`. Kad mi napišeš domen, upisujem ga ovde:

| Gde | Šta se menja |
|---|---|
| `mobile/src/config/domain.ts` | `DOMAIN = null` → `'<domen>'` (tada se uključuje Turnstile stranica u aplikaciji) |
| `web/privacy/index.html`, `web/terms/index.html`, `web/support/index.html` | `__DOMAIN__` u `support@__DOMAIN__` |

Pretraga za proveru: `git grep -n __DOMAIN__` (posle zamene sme da ostane samo u ovom fajlu i u komentaru u
`domain.ts`).
