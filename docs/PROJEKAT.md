# Lock In: sve odluke, dogovori i stanje projekta

Ovaj fajl je pamćenje projekta. Napisan je na kraju duge sesije (oktobar 2026) da bi nova sesija Claude Code-a
odmah znala šta je dogovoreno. Kad se nešto novo dogovori, dopiši ga ovde.

---

## 1. Ko, šta i za koga

- **Vlasnik i izdavač aplikacije: Andrija Dmitrović** (to ime ide u Privacy Policy, Terms, App Store i Google Play;
  ranije je ovde greškom pisalo drugo ime). Student, trenira MMA. Aplikaciju pravi sa kolegom; cilj je da zarađuje.
- **Lock In** je aplikacija za praćenje troškova koja te „proziva“ kad trošiš (roast poruke), broji dane
  zaredom (plamen), vodi koverte i ciljeve štednje i pokazuje grafikone.
- **Tržište:** globalno, pre svega SUA i drugo englesko govorno područje.
- **Jezik aplikacije: samo engleski.** Srpski je izbačen (dupli posao, a fore bolje zvuče na engleskom).
  Dvojezična verzija je sačuvana na grani `arhiva-srpski`.

## 2. Kako Andrija radi i kako da mu odgovaraš

- Piše ćirilicom ili latinicom. **Odgovaraj na srpskom, latinicom.**
- Želi da budeš **strog i kritičan** prema njegovim idejama (hoće da projekat uspe), ali bez dramatizovanja.
- **Radi tačno ono što je tražio, ni manje ni više.** Ne briši i ne menjaj stvari koje nije pomenuo.
  (Primer greške: tražio je da se skloni samo oznaka „Pro“, a izbačeni su i zlatni izgled i primer sa tri osobe.
  Morali smo da vraćamo.)
- **Ne pitaj ponovo ono što je već rekao** (npr. da se posle probe plaća sve). Ako nešto zaista nije rečeno,
  izaberi razumno rešenje, napiši koje si izabrao, i nastavi.
- **Njegove tekstove (fore, poruke) prepisuj tačno**, sa njegovim greškama u kucanju, razmacima i emodžijima.
  „Ništa ne menjaj ovo moje. Sve je kako jeste sa razlogom.“
- Kratki izveštaji: šta je urađeno, šta je provereno, šta eventualno fali. Bez nabrajanja koraka.
- Testirao je prototip u **Google Chrome-u na iPhone-u** (ne Safari). Od sada testira pravu aplikaciju na iPhone-u (Expo Go).
- Glatkoća animacija mu je jako bitna. Seckanje ne prihvata.

## 3. Grane, objavljivanje, bezbednost

| Grana | Šta je |
|---|---|
| `main` | Javni link prototipa https://divnicsergej4.github.io/lock-in/ koji koriste testeri |
| `razvoj` | Izmene prototipa (HTML) pre objave |
| `aplikacija` | Prava aplikacija: React Native + backend (Supabase). Ovde se sad radi. |
| `arhiva-srpski` | Prototip pre izbacivanja srpskog (dvojezičan), za svaki slučaj |
| `v2-puna` | Stara rana verzija prototipa, ne dirati |

- **`main` se ne menja dok Andrija izričito ne kaže** (ni ispravke grešaka).
- Objavljivanje prototipa na link samo na njegove reči tipa: „objavi“, „pošalji testerima“, „postavi na link“,
  „izbaci na github“, „apdejtuj na link“. Tada se `razvoj` spaja u `main` i proveri da je GitHub Pages
  objavio (`gh api repos/divnicsergej4/lock-in/actions/runs?per_page=1`).
- **Nikad ne traži i ne prihvataj tajne ključeve** (Supabase `service_role`, lozinka baze, tokeni). Aplikacija koristi samo
  javni (anon) ključ; sva zaštita je u pravilima baze. Andrija sam pokreće SQL u Supabase dashboard-u.
- Prototip šalje anonimno brojanje korišćenja (samo da li je i kog dana korišćen) u Supabase tabelu `events`,
  i to samo sa javnog linka. Iznosi, opisi i kategorije nikad ne napuštaju telefon.

## 4. Poslovni model (dogovoreno)

- **7 dana besplatne probe, posle toga se plaća SVE.** Nema besplatne verzije i nema „Pro“ dela.
  Svaki korisnik plaća, pa i svaki član zajedničkog cilja.
- **Demo prikaz** postoji odvojeno od probe: aplikacija se popuni izmišljenim podacima da se vidi kako sve izgleda,
  ali ništa ne može da se upiše. Uključuje se iz Settings > Help > Demo i sa ekrana za plaćanje.
- Pretplata ide preko App Store-a i Google Play-a. Predlog (nije još potvrđen): RevenueCat za oba.
- Cene na ekranu za plaćanje su za sada probne: $6.99 mesečno, $45 godišnje, $69 doživotno. Konačne cene
  Andrija dogovara sa kolegom.
- AI funkcija (odgovaranje od skupe ili glupe kupovine i jeftinija alternativa) se **ne pravi u prvoj verziji**:
  Andrija je odlučio da je izbaci. Izbačena je i iz plana u `docs/ZASTITA.md`.

## 5. Tehnička odluka za pravu aplikaciju

- **React Native za iOS i Android. Ne WebView / WebKit omotač** (Andrija ne želi seckanje koje WebKit pravi).
- Predlog alata: Expo (TypeScript, expo-router sa 4 taba), react-native-reanimated + react-native-gesture-handler
  za animacije, @shopify/react-native-skia za holo prsten i lika na uvodu, lokalno čuvanje podataka na telefonu.
- **Lična potrošnja ostaje samo na telefonu.** Na serveru je samo ono što mora: nalozi, prijatelji, zajednički ciljevi, pretplata.
- **Backend: Supabase.** Migracije su u `backend/supabase/migrations/` (`0001` nalozi, prijatelji, zajednički cilj;
  `0002` limiti i kvote; `0003` bez lozinki; `0004` ko šta vidi i provere unosa; `0005` obaveštenja iz cilja), serverske funkcije u `backend/supabase/functions/`, testovi u `backend/tests/`
  (`npm test` u folderu `backend`, radi i na Windows-u bez Postgres-a). Detalji u `backend/README.md`,
  zaštita i podešavanja po dashboard-ima u `docs/ZASTITA.md`.
- **Prototip je specifikacija.** `index.html` na grani `razvoj` je tačan izgled i ponašanje svakog ekrana. Pri prenosu u
  React Native gledaj kod prototipa i prenesi isto ponašanje, isti tekst, iste boje.

### Lekcije iz prototipa (bitno za React Native)
- Holo prsten (tri grafikona koja se okreću prevlačenjem) je dva puta prepravljan „na izvorno skrolovanje“ i oba puta
  je na iPhone-u bilo gore (animacija nestala, pa kasnila 3 s). Vraćeno na verziju 49fbb6c. Pouka:
  **samo male izmene na verziji koja radi, i uvek proveriti na pravom telefonu.**
- Uzrok seckanja u prototipu je WebKit (skrol na glavnoj niti, JS ograničen na 60 Hz). U React Native-u animacije
  treba da idu na UI niti (Reanimated worklets), ne preko JS.

## 6. Zajednički cilj (dogovoreno)

- Ljudi se povezuju preko **„Add a friend“**: poziv ide na **mejl**, druga osoba ga prihvati.
- Prijatelji mogu da budu u zajedničkom cilju. **Svi u cilju su jednaki, nema administratora.** Ako onaj ko je napravio
  cilj ubaci još 3 osobe pa izađe, sve ostaje isto za ostale.
- **Ko izađe iz cilja, njegov ulog se briše** (više ne važi).
- Svaki član mora da ima probu ili pretplatu.
- Odluke koje sam doneo jer nisu bile rečene (Andrija može da promeni):
  - prijatelj se u cilj dodaje bez novog prihvatanja (pristanak je dao prihvatanjem prijateljstva) i može da izađe kad hoće;
  - bilo koji član može da doda svoje prijatelje, da promeni naziv i iznos cilja;
  - svako upisuje i menja samo svoje uplate;
  - kad izađe poslednji član, cilj se briše; ako se dvoje pozovu međusobno, to je prihvaćeno prijateljstvo;
  - cilj ima jednu valutu;
  - kad pretplata istekne: cilj se i dalje vidi, ali ništa ne može da se menja; izaći se uvek može.
- U prototipu: sekcija ima zlatni izgled, primer „Summer trip to Greece“ (S, M, A) i dugme **„Sign in to get started“**
  (za sada prikazuje „Accounts are coming soon“). Oznaka „Pro“ je skinuta.

## 7. Šta aplikacija ima (inventar iz prototipa)

**Navigacija:** 4 taba: Home, Spending, Savings, More.

**Uvod (novi korisnik):**
1. Uvodni ekran sa likom (animacija, ponavlja se na ~8 s): momak u narandžastom duksu spava u zelenoj stolici, iz džepa mu
   odleću novčanice sa krilima, telefon zavibrira, trgne se („!“), ispravi se i gleda u telefon, iznad iskoči katanac i
   zaključa se, tad se iscrta podvlaka ispod „Then lock the fuck in.“. Ispod je „račun“: Bank login NOT NEEDED,
   Spreadsheets NOT NEEDED, Your data ON YOUR PHONE, TOTAL STRESS 0.
   (Andrija: „on your phone“ znači „sve na jednom mestu, na tvom telefonu“, ne obećanje da je samo na telefonu.)
2. Tri ekrana koja se mogu preskočiti: Spending (troškovi uleću, stanje se smanjuje), Roasts (upisan trošak + poruka
   + prekidač Gentle / Normal / No mercy koji se sam menja), Streak (plamen 14 dana + nedelja).
3. Podešavanje: koliko para imaš, valuta (+ druga valuta), mesečni prihod, koliko želiš da uštediš,
   **godine (opciono, „just for info“)**.
4. Ekran za plaćanje, pa vođeni obilazak.

**Home:** kartica Available (stanje bez novca u kovertama), plamen (dani zaredom), izazov nedelje, novi unos
(trošak/prihod, iznos, obavezan opis, kategorija, više opcija: svoja kategorija, mesečna pretplata, plaćanje iz koverte),
„Can I afford it?“.

**Spending:** holo prsten sa 3 panela (krug top 5 kategorija ovog meseca; linija 30 dana sa držanjem prsta;
kalendar), sve promene (filteri, olovka za izmenu, iks za brisanje), limiti po kategoriji, ponavljajući unosi,
pretplate („Don't use it“), „We noticed“ (šabloni potrošnje).

**Savings:** zajednički cilj, koverte i ciljevi (fioka sa fasciklama u boji, vađenje i vraćanje uz animaciju,
ubaci/izvadi, raspoređivanje slobodnog novca, rok i iznos po danu/nedelji/mesecu), plan meseca.

**More:** izveštaj meseca (ocena A–F), rezervna kopija (izvoz/uvoz), Settings: plata, druga valuta, **godine**,
tema (tamna/svetla), jačina poruka, podsetnik, obilazak, demo, pretplata, privatnost, reset.

**Kategorije:** Groceries, Food, Coffee, Clothes, Shoes, Gym, Transportation, Bills, Rent, Nights out, Gaming, Other
(+ svoje). Ikonice su ručno crtane linijske, u boji kategorije (ne emodžiji). „Brza hrana“ je preimenovana u „Hrana“ (Food).

**Plamen (streak):** počinje od 1; dan se računa kad upišeš trošak ili pritisneš „I didn't spend anything today“
(tek posle 20h); propušten dan gasi plamen. Nivoi: 0 Orange, 5 Blue, 10 Red, 14 Golden, 30 Purple, 60 Lock-in green,
90 Diamond, 120 Rainbow, 365 Legendary 🗿.

**Fore i kritike:** kompletan spisak je u `docs/FORE.md`. Pravila:
- prag za poruku o velikom trošku je **30%** svega što korisnik ima;
- **No mercy:** jake fore (sa „shi“, „be drunk“, „smh“, „bruh“ i ona sa godinama) izlaze samo u tom modu, oko 70%
  vremena, a ostatak su obične; na kraj poruke se dodaje „Not even your mom would approve.“ ili „Future you hates you.“;
- **Normal:** obične fore, bez jakih;
- **Gentle:** umesto prozivke blaga poruka (osim kad je stanje u minusu);
- fora sa godinama: broj je godine zaokružene na desetice (24 → 20+, 34 → 30+); mlađi od 20 i bez godina je nikad ne dobijaju.

**Demo:** dva meseca izmišljenih podataka (kafa skoro svaki dan, namirnice, izlasci vikendom, kirija, računi,
pretplate Netflix/Spotify/teretana po jednom, plate, 4 koverte, limiti, dugovi, zajednički cilj sa 3 osobe).
Ništa se ne čuva; izlazak ili ponovno otvaranje vraća prave podatke. Unos je isključen, ali sve može da se gleda,
prevlači i otvara. Traka „DEMO … Exit demo“ na vrhu.

**Vođeni obilazak (tutorial):** 38 koraka kroz svaki ekran i funkciju; korisnik sam isprobava (upisuje, prevlači,
dodiruje), može da se preskoči odmah i „Skip tour“ je uvek vidljivo. Deo koji se objašnjava je osvetljen, ostalo blago
zamagljeno; pri prelasku na novi ekran sve se odmagli na trenutak da korisnik vidi gde je. Kod koverti se vidi cela
fioka. Ako korisnik slučajno otvori prozor (izmena, Pro ekran), obilazak stane dok ga ne zatvori. Probni unosi se brišu
na kraju, posle preskakanja i ako se aplikacija zatvori usred obilaska. Ponovo se pokreće iz Settings > Help.

## 8. Stanje i sledeći koraci

Urađeno:
- Prototip je završen po izgledu i funkcijama (Andrija: „završio sam skroz izgled i funkcije“).
- Backend za naloge, prijatelje i zajednički cilj (Supabase migracija + testovi) na grani `aplikacija`.
- Zaštita od zloupotrebe i troškova (`backend/supabase/migrations/0002_limits_and_quotas.sql`, `docs/ZASTITA.md`):
  limiti po korisniku u bazi (pozivi 10/sat, 30/dan, ista adresa 3/nedeljno; odgovori, novi ciljevi i dodavanje u cilj
  30/sat; izmene cilja i uplate 60/sat; mejlovi sa pozivom 30/dan po korisniku i 100/dan za celu aplikaciju) i kvote
  (10 ciljeva po osobi, 20 ljudi po cilju, 200 prijatelja, 50 poziva na čekanju), sa porukom na engleskom.
  Napisane serverske funkcije `revenuecat-webhook` (prima samo zahteve sa tajnim Authorization zaglavljem) i
  `send-invite-email` (Resend); još nisu postavljene. Testovi: 49 starih + 59 novih provera baze, 15 provera funkcija.
  Provereno: u repou i git istoriji nema tajnih ključeva (samo javni ključ prototipa), RLS je na svakoj tabeli.
  Aplikacija (`mobile/`) nije menjana. Šta Andrija klikće po dashboard-ima (Supabase Auth, Turnstile, spend cap,
  Resend, RevenueCat, Expo): `docs/ZASTITA.md`, deo 3.
- Korak 1: kostur Expo aplikacije u `mobile/` (SDK 58, expo-router, 4 taba, tema i fontovi, čuvanje na telefonu,
  logika iz prototipa sa testovima). Ekrani su još prazni osim kartice Available i plamena na Home i izbora teme na More.
  Uputstvo: `mobile/README.md`. Repo je lokalno u `C:\dev\lock-in`.
- Sva logika prototipa prenesena u `mobile/src/logic/` (bez ekrana): stanje i saldo, unosi (dodaj/izmeni/obriši),
  koverte, plamen i nivoi, izazov nedelje, limiti, ponavljajući unosi i pretplate, „Can I afford it?“, izveštaj meseca,
  plan meseca, „We noticed“, fore. Test poredi rezultat sa pravim kodom prototipa na nasumičnim podacima.
  Svesno ispravljeno (prototip je grešio): „(oko N per day)“ u planu → „(about N per day)“; prag 30% gleda iznos u
  glavnoj valuti; raspoređivanje novca u koverte čita „12.5“ kao 12,5 (prototip kao 125).
  Nije preneto: dugovi, nivoi/XP (sakriveni u prototipu). Grafikoni holo prstena su preneti uz Spending, demo podaci uz demo.
- Uvod u aplikaciji (`mobile/src/app/welcome.tsx`): ekran sa likom (Skia, ista animacija i ponavljanje na ~8 s),
  tri ekrana koja se preskaču, podešavanje sa godinama. Mere upoređene sa prototipom u pregledaču (razlika ≤ 0,2 px).
  Posle podešavanja ide se pravo na Home: ekran za plaćanje i vođeni obilazak još ne postoje.
  Izbor valute je lista koja izlazi odozdo (prototip je koristio telefonski birač).
- Home u aplikaciji: Available, plamen svih nivoa (sa animacijom i skokom na novi nivo), izazov nedelje, novi unos
  (trošak/prihod, kategorije sa ikonicama, druga valuta, više opcija), poruke posle troška, „Can I afford this?“,
  donja navigacija. Tamna i svetla tema; mere upoređene sa prototipom (razlika ≤ 0,2 px).
  Svesno ispravljeno: klik na kategoriju u prototipu upisuje poslednji iznos sa zarezom („4,5“), pa se zapiše 45;
  u aplikaciji se upisuje „4.5“.
- Spending u aplikaciji: holo prsten sa tri panela (krug top 5 kategorija, linija 30 dana sa držanjem prsta, kalendar),
  sve promene (filteri, ✎ izmena, ✕ brisanje), limiti, ponavljajući unosi, pretplate („Don't use it“), „We noticed“,
  ulazak sekcija pri promeni taba. Prevlačenje, opruga i 3D položaj panela rade na UI niti (Reanimated, opruga se
  računa u koracima od 1/120 s); `app.json` ima `CADisableMinimumFrameDurationOnPhone` da iPhone sme na 120 Hz.
  Podaci grafikona testirani prema pravom kodu prototipa; mere upoređene u pregledaču (tamna i svetla, razlika ≤ 1 px).
  Ponavljajući unosi se sad upisuju čim se otvori bilo koji tab (ranije samo Home).
  Nije provereno na pravom telefonu: prevlačenje prstom, držanje na liniji i 120 Hz. Podešavanje za 120 Hz iz `app.json`
  važi tek u pravom build-u (development build / TestFlight); u Expo Go-u zavisi od samog Expo Go-a.
  Posle probe na iPhone-u: skrol je gladak i dok je prsten na ekranu (senke panela se čuvaju kao slika, stalne animacije
  stoje tokom skrola), brojevi u kalendaru više nisu mutni dok ćelije uleću.
- Savings u aplikaciji: zajednički cilj (primer „Summer trip to Greece“ i „Sign in to get started“, koje za sada kaže
  „Accounts are coming soon“), koverte u fioci (izvlačenje koverte, „Put it back“ sa letom nazad, padom i odskokom,
  ručka fioke na dodir i prevlačenje, ulazak fascikli pri otvaranju taba, Add / Take out / brisanje uz „Sure?“,
  raspoređivanje slobodnog novca, nova koverta sa ciljem i rokom koja se odmah izvuče), plan meseca. Tamna i svetla tema;
  mere upoređene sa prototipom (razlika ≤ 0,4 px), animacije na UI niti, statični delovi fioke čuvaju se kao slika.
  Vibracija iz prototipa (navigator.vibrate) nije preneta: na iPhone-u ni u prototipu nije radila.
- More u aplikaciji: izveštaj meseca (ocena), rezervna kopija (tekst za kopiranje i uvoz), Settings: plata, druga valuta,
  godine, tema, jačina poruka (Mild / Normal / No mercy, kao u prototipu), podsetnik (prekidač + vreme preko telefonskog
  birača; kad prođe vreme, a ništa nije upisano, na Home se pojavi žuta kartica kao u prototipu), privatnost, reset.
  „Lock-in Pro / See plans“ za sada kaže „Coming soon.“ (ekran za plaćanje još ne postoji).
  Mere upoređene sa prototipom (razlika ≤ 0,8 px). Podsetnik je samo u aplikaciji (kartica na Home), ne prava notifikacija.
  Tekst o privatnosti (Settings i podešavanje na uvodu) je skraćen na „Amounts, descriptions and categories stay on your
  phone only.“: rečenica da se anonimno beleži korišćenje je izbačena jer aplikacija ništa ne beleži (beleženje postoji
  samo u prototipu na javnom linku). Ako se beleženje doda u aplikaciju, rečenica se vraća.
- Demo u aplikaciji: Settings > Help > Demo. Isti izmišljeni podaci kao u prototipu (test poredi sa pravim kodom prototipa),
  traka „DEMO … Exit demo“, polja za unos zaključana i prigušena, pokušaj unosa daje poruku kao u prototipu; ništa se ne
  čuva, a izlazak ili ponovno otvaranje vraća prave podatke. Uključivanje i isključivanje vodi na Home (kao u prototipu).
  Zajednički cilj u demu pokazuje primer sa 3 osobe iz prototipa. Sa ekrana za plaćanje se još ne pali (ekran ne postoji).
- Vođeni obilazak u aplikaciji: svih 38 koraka sa tekstom iz prototipa (test poredi tekst, tab, dugme i uslove), korisnik sam
  upisuje, prevlači i dodiruje; osvetljen deo, ostalo zamagljeno (expo-blur) i zatamnjeno; „Skip step“ posle 15 s,
  „Skip tour“ uvek vidljivo; prozor za izmenu unosa pauzira obilazak. Probni unosi se brišu na kraju, posle preskakanja i ako
  se aplikacija zatvori usred obilaska; posle toga se ide na Home. Pokreće se sam kod korisnika koji ga nije video (i kod
  postojećih podataka bez oznake, npr. Andrijinih, jednom) i ponovo iz Settings > Help > App tour.
  Stranica se skroluje prevlačenjem bilo gde po ekranu, i preko zamagljenog dela (tap na zamagljeno i dalje ne radi ništa,
  kao u prototipu). Korak u kom se kuca završava se tek kad korisnik 2 s ne pritisne nijedan taster (ne čim upiše
  prvu cifru ili dva slova). Posle te pauze tastatura pređe na sledeće prazno polje koraka (tekst ili broj, npr.
  iznos → opis, „Guitar“ → cena), a kad prođe korak u kom se kuca, skloni se.
  Provereno u pregledaču od 1. do 38. koraka; na pravom telefonu nije provereno. Iz teksta koraka 37 izbačeno je „language“,
  jer izbora jezika nema (jedina namerna razlika od prototipa).
- Prijava u aplikaciji (`mobile/src/auth/`, ekran `mobile/src/app/sign-in.tsx`, detalji u `docs/ZASTITA.md` deo 4).
  Dogovoreno (Andrija): **prijava bez lozinke**, nigde nema polja za lozinku: kod od 6 cifara na mejl (ne magic link),
  Google i Sign in with Apple. „Send code“ se zaključa na 60 s, posle 5 pogrešnih kodova traži se novi kod.
  Sesija je šifrovana u AsyncStorage, a ključ u SecureStore (Keychain/Keystore); odjava i brisanje naloga brišu oba.
  Prava (proba/pretplata) se uvek pitaju od servera (`my_access`) i RevenueCat-a, nikad se ne čuvaju na telefonu;
  sve na serveru i dalje štiti baza. Brisanje naloga: Settings > Danger zone > Delete account → serverska funkcija
  `delete-account` (briše samo onoga čiji je token; baza briše ostalo). Turnstile ima pripremljeno mesto
  (`mobile/src/auth/captcha.ts`), još nije ugrađen.
  Odluke koje sam doneo jer nisu bile rečene (Andrija može da promeni):
  - aplikacija radi i bez naloga (lična potrošnja je samo na telefonu); prijava se otvara iz Shared goal i Settings > Account;
  - Apple dugme samo na iPhone-u (Apple ga traži samo za App Store; na Android-u bi trebao tajni ključ koji ističe na 6 meseci);
  - Google ide preko pregledača (PKCE), ne preko posebne Google biblioteke, da bi radio i u Expo Go;
  - za šifrovanje je uzet `aes-js` (AES-256-CTR, tačno kako Supabase preporučuje), nasumični ključ iz `expo-crypto`;
  - „Sign out“ odjavljuje samo taj telefon; brisanje naloga ne dira podatke na telefonu (za to je Reset everything);
  - identifikator aplikacije (Andrija: "neka bude lockintracker"): `com.lockintracker.app` za iOS (`bundleIdentifier`) i
    Android (`package`, Android traži bar dva dela pa je dodato `com.` i `.app`); šema linkova ostaje `lockin`;
  - RevenueCat entitlement se zove `access`; ime sa Apple-a se upisuje kao ime koje prijatelji vide, ako ga nema.
  Testovi: 24 provere u `mobile/src/auth/__tests__/` (šifrovanje i brisanje sesije i sa pravim supabase-js,
  60 s / 5 kodova, prava), 25 provera brisanja naloga u bazi i 4 provere funkcije `delete-account`.
  Nije provereno na pravom telefonu ni sa pravim Supabase projektom (nema ključeva u repou): to je sledeći korak.
  Andrija podešava: `docs/ZASTITA.md` 3.2 (Email, šabloni mejla, SMTP, Rate Limits, URL-ovi, Google, Apple),
  3.5 (postaviti `delete-account`), 3.6 (entitlement `access`), i javne ključeve u `mobile/.env.local`.
- Lozinke zatvorene u bazi (Andrija: „ne ostavljamo za kasnije“): migracija `0003_no_passwords.sql`, triger
  BEFORE INSERT OR UPDATE na `auth.users` koji uvek prazni `encrypted_password`, pa prijava lozinkom ne radi nikome,
  ni posle potvrde mejla. Zatvara i preuzimanje naloga (neko napravi nalog sa tuđim mejlom i lozinkom, pa uđe kad
  se vlasnik prijavi kodom; Supabase Auth tu lozinku sam ne briše). Kod, Google i Apple lozinku ne čitaju.
  Testovi: 23 provere (`backend/tests/no_passwords.test.mjs`), uz kontrolu da napad bez `0003` uspeva. Pravi Supabase
  Auth nije pokrenut (nema Docker-a): Andrija jednom proverava na projektu (`docs/ZASTITA.md`, deo 4).
  „Confirm email“ mora ostati uključeno. Lista stvari koje se sklanjaju pre objave: `docs/ZASTITA.md`, deo 6.
- Bezbednosna provera pre objave (`docs/ZASTITA.md`, deo 7): mejl sa pozivom samo običan tekst, ime pošiljaoca
  očišćeno (ne može postati HTML ni link, do 40 znakova), bez imena „A friend“ umesto mejla pošiljaoca; migracija
  `0004`: **tuđ mejl ne vidi niko** (izabrano strožije; drugi vide samo `display_name`), poziv ne otkriva da li nalog
  postoji, provere unosa (tekstovi bez praznih/razmaka/nevidljivih znakova, iznosi do 1.000.000.000, „nema imena“ je
  NULL); Turnstile ugrađen na ekranu za prijavu (Managed + interaction-only, u WebView-u); Dependabot nedeljno;
  istorija svih grana bez tajni; upozorenje ispod rezervne kopije. `npm audit` u `mobile/`: 8 ranjivosti u Expo
  alatima za razvoj (ne u aplikaciji), bez ispravke koja ne kvari Expo; čeka se Expo zakrpa.
- Obaveštenja (`docs/ZASTITA.md`, deo 8; Andrija je tražio tri vrste):
  1. podsetnik za troškove: ostaje žuta kartica iz prototipa, plus pravo lokalno obaveštenje u izabrano vreme, samo
     ako tog dana još ništa nije upisano;
  2. „Don’t waste money“: lokalno, svoj prekidač u Settings > Reminder. Andrijin raspored i tekstovi (26. oktobar,
     prepisani tačno u `mobile/src/logic/nudges.ts`): dan bez upisa 9 h i 15 h iz rotacije od 11 tekstova i 20 h
     „you’ve been doing good. don’t ruin the streak now 🔥“ (nije u rotaciji); posle upisa tog dana samo jedno u
     21 h; nikad 23–9 h. Izbor 6 / 12 / 24 h izbačen (raspored ga zamenjuje). Streak (20 h) ima svoj prekidač
     „Streak reminder“, odvojen od „Don’t waste money“, da bi neko mogao da ostavi samo njega. Tekstovi idu u svakoj jačini poruka
     dok Andrija ne označi jake;
  3. zajednički cilj (push sa servera, `0005` + `send-goal-push` + pg_cron): ostali članovi dobijaju uplatu, ulazak i
     izlazak, onaj ko je to uradio ne; najviše jedno obaveštenje po osobi po cilju na 10 minuta (spajaju se);
     prekidač „Shared goal alerts“ u Settings > Account.
  Dozvola se traži tek na uključivanje prekidača (ne pri pokretanju). Odluke koje nisu bile rečene: nudge je
  podrazumevano isključen dok ga korisnik ne uključi (dozvola se ne sme tražiti ranije); „I didn’t spend anything
  today“ se računa kao upis; član sa isteklom pretplatom dobija samo „left“; kad neko doda prijatelja,
  obaveštenje ne dobijaju ni onaj ko je dodao ni dodati.
- Domen (`docs/DOMEN.md`): Andrija ga kupuje sam (predlog Cloudflare Registrar). Folder `web/` (engleski, statično,
  bez praćenja): Privacy Policy, Terms of Use, Support (`support@<domen>`), početna i Turnstile stranica koju
  aplikacija sad otvara sa domena (`https://<domen>/turnstile/`, kako Cloudflare preporučuje), postavlja se na
  Cloudflare Pages iz grane `aplikacija` (nikako `divnicsergej4.github.io`). Privacy i Terms nisu pravni savet: u
  HTML komentaru na vrhu je šta pravnik treba da proveri i popuni (`[OWNER NAME AND ADDRESS]`, `[COUNTRY]`,
  `[SUPABASE REGION]`). Domen je kupljen: **`lockintracker.app`** (Cloudflare Registrar), upisan u
  `mobile/src/config/domain.ts` i `web/`. Privacy i Terms: „Andrija Dmitrović, Serbia“, support@lockintracker.app,
  Supabase Frankfurt (EU); adresa namerno nije na javnoj stranici. Settings > **Legal & support**: Privacy Policy,
  Terms of Use, Support (otvaraju se u pregledaču; rade i u demu). Mejl ide sa poddomena `mail.lockintracker.app`. Lokalna obaveštenja rade u Expo Go na iPhone-u; u Expo Go na
  Android-u (SDK 58) sam uvoz `expo-notifications` puca (fali `ExpoTopicSubscriptionModule`) i obarao je celu
  aplikaciju, pa se paket sad učitava oprezno (`mobile/src/notifications/expoNotifications.ts`) i tamo aplikacija
  radi bez obaveštenja telefona (žuta kartica na Home i dalje radi). Push iz cilja traži
  development build, EAS projekat i Apple nalog (`docs/ZASTITA.md` 3.9).
- Vodič za pravi Supabase projekat (`docs/TESTIRANJE.md`, 27. oktobar 2026; Andrija pravi projekat): projekat u
  Frankfurtu i samo publishable ključ u `mobile/.env.local`, migracije 0001–0005 sa SQL proverom posle svake, Resend
  (`mail.lockintracker.app`, SPF/DKIM/DMARC) i SMTP, Auth podešavanja, probna pretplata SQL-om (`product =
  'manual_test'`), postavljanje četiri funkcije i cron za push, provera lozinke, Turnstile pa CAPTCHA, i spisak za dva
  telefona. Redosled je promenjen u odnosu na Andrijin spisak: probna pretplata pre probe poziva, provera lozinke
  **pre** CAPTCHA (sa CAPTCHA Supabase odbije zahtev pre provere lozinke). Aplikacija još nema ekrane za prijatelje,
  pozive i zajednički cilj, pa se te stavke proveravaju u SQL Editor-u kao korisnik A ili B (iste baze, ista pravila),
  a pravi mejl sa pozivom šalje nova skripta `backend/scripts/send-test-invite.mjs` (radi samo dok je CAPTCHA
  isključena). Svi SQL blokovi iz vodiča pušteni na lokalnoj bazi sa svim migracijama (prolaze); skripte provere
  na lažnom serveru. Na pravom projektu još ništa nije pokrenuto.
- Android (prvi put isproban 27–28. oktobra 2026, Redmi Note 15 Pro). Uzroci i popravke, izmereno (React Profiler
  na web build-u, Perf Monitor na telefonu), ne nagađano:
  - pad pri pokretanju u Expo Go-u: učitava se samo lokalni deo `expo-notifications` (`notifications/expoLocal.ts`),
    push token tek kad se uključi i nikad u Expo Go-u;
  - dodir kasnio 2–5 s: svaka promena stanja (i otvaranje sekcije) crtala je sva 4 taba (160 od 187 ms u skrivenom
    Spending-u), `useTheme`/`useDemoGuard` čitali ceo store, `fmt` je na Android-u pravio Java formatter pri svakom
    pozivu. Sada: `TabFreeze` (tab koji nije napred se ne crta), tema i demo u svojim kontekstima, memo redova
    transakcija i sadržaja holo panela, jedan Intl formatter. Tap 187 → ~20 ms;
  - tastatura (edge-to-edge, prozor se ne skraćuje): `components/keyboard.tsx`, samo Android; toast na 78 px kao u
    prototipu i sklanja se na prvi dodir;
  - holo: zIndex prednjeg panela na UI niti, providnost kao celina (`needsOffscreenAlphaCompositing`), unutrašnjost
    panela sačuvana kao slika a spoljne senke na svom sloju (samo Android; iOS isto kao pre);
  - **Expo Go na Android-u nije merilo brzine**: Reanimated tamo svaku promenu u frejmu provlači kroz ceo ShadowTree
    (UI ~30 fps dok je holo na ekranu, drugde 120). Zato postoji sopstveni build: `expo-dev-client`, `eas.json`
    (profili `development` i `preview`, samo arm64 i Gradle jedan po jedan jer je EAS inače ostajao bez memorije),
    `package.json` → `reanimated.staticFeatureFlags.ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS: true`. EAS projekat
    `@lockeddevs/lock-in`. Brzinu meriti samo na `preview` APK-u (`npx eas-cli build --profile preview --platform
    android`); `development` je debug i spor. Preview APK nema ključeve iz `.env.local` (prijava tu ne radi);
  - stanje (Andrija, 28. okt.): sve van holo-a glatko; holo mnogo bolji, ali ne savršen kao na iPhone-u. Ostavljeno
    za kasnije: pre objave izmeriti sa „Profile HWUI rendering“ (opcije za programere) šta tačno kasni na holo-u.
    U dev režimu na Android-u ostaju bezopasna upozorenja `[Worklets] Tried to modify key current` (holo).

Sledeće, ovim redom:
1. **Kostur React Native (Expo) aplikacije** na grani `aplikacija` (npr. folder `mobile/`): 4 taba, tema iz prototipa,
   fontovi (Bricolage Grotesque, Inter), lokalno čuvanje podataka, prenos logike iz prototipa sa testovima.
2. Supabase projekat: Andrija primeni migraciju u SQL Editor-u. Prijava (kod na mejl + Google + **Sign in with Apple**)
   je napravljena u aplikaciji; ostaje podešavanje iz `docs/ZASTITA.md` (3.2: Email, šabloni, SMTP, Rate Limits,
   URL-ovi, Google, Apple; spend cap) i provera na telefonu. **CAPTCHA (Cloudflare Turnstile, nevidljiv) ugraditi u
   `mobile/src/auth/captcha.ts`** (traži se samo kad se šalje kod na mejl), pa je tek onda uključiti u Supabase-u.
   Sign in with Apple i Google ne traže CAPTCHA.
3. Pretplata: 7 dana probe preko App Store-a / Google Play-a (predlog RevenueCat) + webhook koji puni tabelu
   `subscriptions` (napisan: `backend/supabase/functions/revenuecat-webhook`, treba ga postaviti); zaključavanje
   aplikacije kad proba istekne.
4. Prenos ekrana iz prototipa jedan po jedan (Home, Spending sa holo prstenom, Savings sa fiokom, More, uvod sa likom,
   obilazak, demo).
5. Zajednički cilj vezan za backend; slanje mejla sa pozivom (napisano: `backend/supabase/functions/send-invite-email`,
   preko Resend-a; treba postaviti i podesiti domen). Dogovoreno (Andrija, 28. okt.): aplikacija nema polje za ime,
   pa bi skoro svi u pozivu i u cilju bili „A friend“ / „Someone“. Pri prvoj prijavi ili prvom pozivu pitati
   „What should friends call you?“ i upisati u `profiles.display_name` (mejl se nikad ne koristi kao ime).
6. Kad zajednički cilj počne da radi preko servera, dopuniti tekst o privatnosti („…stay on your phone only, except shared
   goals, which sync with the people you share them with“).

Za objavu u prodavnicama trebaće: Apple Developer nalog ($99 godišnje), Google Play nalog ($25 jednom), a za iOS build
Mac sa Xcode-om ili Expo EAS Build.

Poznata sitnica u prototipu: neki stari probni testovi (bili su van repoa) očekuju srpski tekst; aplikacija radi ispravno.
