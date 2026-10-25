# Lock In: sve odluke, dogovori i stanje projekta

Ovaj fajl je pamćenje projekta. Napisan je na kraju duge sesije (oktobar 2026) da bi nova sesija Claude Code-a
odmah znala šta je dogovoreno. Kad se nešto novo dogovori, dopiši ga ovde.

---

## 1. Ko, šta i za koga

- **Vlasnik:** Sergej (student, trenira MMA). Aplikaciju pravi sa kolegom; cilj je da zarađuje.
- **Lock In** je aplikacija za praćenje troškova koja te „proziva“ kad trošiš (roast poruke), broji dane
  zaredom (plamen), vodi koverte i ciljeve štednje i pokazuje grafikone.
- **Tržište:** globalno, pre svega SUA i drugo englesko govorno područje.
- **Jezik aplikacije: samo engleski.** Srpski je izbačen (dupli posao, a fore bolje zvuče na engleskom).
  Dvojezična verzija je sačuvana na grani `arhiva-srpski`.

## 2. Kako Sergej radi i kako da mu odgovaraš

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

- **`main` se ne menja dok Sergej izričito ne kaže** (ni ispravke grešaka).
- Objavljivanje prototipa na link samo na njegove reči tipa: „objavi“, „pošalji testerima“, „postavi na link“,
  „izbaci na github“, „apdejtuj na link“. Tada se `razvoj` spaja u `main` i proveri da je GitHub Pages
  objavio (`gh api repos/divnicsergej4/lock-in/actions/runs?per_page=1`).
- **Nikad ne traži i ne prihvataj tajne ključeve** (Supabase `service_role`, lozinka baze, tokeni). Aplikacija koristi samo
  javni (anon) ključ; sva zaštita je u pravilima baze. Sergej sam pokreće SQL u Supabase dashboard-u.
- Prototip šalje anonimno brojanje korišćenja (samo da li je i kog dana korišćen) u Supabase tabelu `events`,
  i to samo sa javnog linka. Iznosi, opisi i kategorije nikad ne napuštaju telefon.

## 4. Poslovni model (dogovoreno)

- **7 dana besplatne probe, posle toga se plaća SVE.** Nema besplatne verzije i nema „Pro“ dela.
  Svaki korisnik plaća, pa i svaki član zajedničkog cilja.
- **Demo prikaz** postoji odvojeno od probe: aplikacija se popuni izmišljenim podacima da se vidi kako sve izgleda,
  ali ništa ne može da se upiše. Uključuje se iz Settings > Help > Demo i sa ekrana za plaćanje.
- Pretplata ide preko App Store-a i Google Play-a. Predlog (nije još potvrđen): RevenueCat za oba.
- Cene na ekranu za plaćanje su za sada probne: $6.99 mesečno, $45 godišnje, $69 doživotno. Konačne cene
  Sergej dogovara sa kolegom.
- AI funkcija (odgovaranje od skupe ili glupe kupovine i jeftinija alternativa) se **ne pravi u prvoj verziji**:
  Sergej je odlučio da je izbaci. Izbačena je i iz plana u `docs/ZASTITA.md`.

## 5. Tehnička odluka za pravu aplikaciju

- **React Native za iOS i Android. Ne WebView / WebKit omotač** (Sergej ne želi seckanje koje WebKit pravi).
- Predlog alata: Expo (TypeScript, expo-router sa 4 taba), react-native-reanimated + react-native-gesture-handler
  za animacije, @shopify/react-native-skia za holo prsten i lika na uvodu, lokalno čuvanje podataka na telefonu.
- **Lična potrošnja ostaje samo na telefonu.** Na serveru je samo ono što mora: nalozi, prijatelji, zajednički ciljevi, pretplata.
- **Backend: Supabase.** Migracije su u `backend/supabase/migrations/` (`0001` nalozi, prijatelji, zajednički cilj;
  `0002` limiti i kvote), serverske funkcije u `backend/supabase/functions/`, testovi u `backend/tests/`
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
- Odluke koje sam doneo jer nisu bile rečene (Sergej može da promeni):
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
   (Sergej: „on your phone“ znači „sve na jednom mestu, na tvom telefonu“, ne obećanje da je samo na telefonu.)
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
- Prototip je završen po izgledu i funkcijama (Sergej: „završio sam skroz izgled i funkcije“).
- Backend za naloge, prijatelje i zajednički cilj (Supabase migracija + testovi) na grani `aplikacija`.
- Zaštita od zloupotrebe i troškova (`backend/supabase/migrations/0002_limits_and_quotas.sql`, `docs/ZASTITA.md`):
  limiti po korisniku u bazi (pozivi 10/sat, 30/dan, ista adresa 3/nedeljno; odgovori, novi ciljevi i dodavanje u cilj
  30/sat; izmene cilja i uplate 60/sat; mejlovi sa pozivom 30/dan po korisniku i 100/dan za celu aplikaciju) i kvote
  (10 ciljeva po osobi, 20 ljudi po cilju, 200 prijatelja, 50 poziva na čekanju), sa porukom na engleskom.
  Napisane serverske funkcije `revenuecat-webhook` (prima samo zahteve sa tajnim Authorization zaglavljem) i
  `send-invite-email` (Resend); još nisu postavljene. Testovi: 49 starih + 59 novih provera baze, 15 provera funkcija.
  Provereno: u repou i git istoriji nema tajnih ključeva (samo javni ključ prototipa), RLS je na svakoj tabeli.
  Aplikacija (`mobile/`) nije menjana. Šta Sergej klikće po dashboard-ima (Supabase Auth, Turnstile, spend cap,
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
  postojećih podataka bez oznake, npr. Sergejevih, jednom) i ponovo iz Settings > Help > App tour.
  Stranica se skroluje prevlačenjem bilo gde po ekranu, i preko zamagljenog dela (tap na zamagljeno i dalje ne radi ništa,
  kao u prototipu). Korak u kom se kuca završava se tek kad korisnik 2 s ne pritisne nijedan taster (ne čim upiše
  prvu cifru ili dva slova). Posle te pauze tastatura pređe na sledeće prazno polje koraka (tekst ili broj, npr.
  iznos → opis, „Guitar“ → cena), a kad prođe korak u kom se kuca, skloni se.
  Provereno u pregledaču od 1. do 38. koraka; na pravom telefonu nije provereno. Iz teksta koraka 37 izbačeno je „language“,
  jer izbora jezika nema (jedina namerna razlika od prototipa).

Sledeće, ovim redom:
1. **Kostur React Native (Expo) aplikacije** na grani `aplikacija` (npr. folder `mobile/`): 4 taba, tema iz prototipa,
   fontovi (Bricolage Grotesque, Inter), lokalno čuvanje podataka, prenos logike iz prototipa sa testovima.
2. Supabase projekat: Sergej primeni migraciju u SQL Editor-u; prijava e-mailom + Google + **Sign in with Apple**
   (Apple to traži čim postoji Google prijava). Pre puštanja podesiti sve iz `docs/ZASTITA.md` (Auth limiti, potvrda
   mejla, lozinka, SMTP, spend cap). **CAPTCHA (Cloudflare Turnstile, nevidljiv) ugraditi u ekrane za registraciju,
   zaboravljenu lozinku i prijavu lozinkom kad se budu pravili**, pa je tek onda uključiti u Supabase-u.
   Sign in with Apple i Google ne traže CAPTCHA.
3. Pretplata: 7 dana probe preko App Store-a / Google Play-a (predlog RevenueCat) + webhook koji puni tabelu
   `subscriptions` (napisan: `backend/supabase/functions/revenuecat-webhook`, treba ga postaviti); zaključavanje
   aplikacije kad proba istekne.
4. Prenos ekrana iz prototipa jedan po jedan (Home, Spending sa holo prstenom, Savings sa fiokom, More, uvod sa likom,
   obilazak, demo).
5. Zajednički cilj vezan za backend; slanje mejla sa pozivom (napisano: `backend/supabase/functions/send-invite-email`,
   preko Resend-a; treba postaviti i podesiti domen).
6. Kad zajednički cilj počne da radi preko servera, dopuniti tekst o privatnosti („…stay on your phone only, except shared
   goals, which sync with the people you share them with“).

Za objavu u prodavnicama trebaće: Apple Developer nalog ($99 godišnje), Google Play nalog ($25 jednom), a za iOS build
Mac sa Xcode-om ili Expo EAS Build.

Poznata sitnica u prototipu: neki stari probni testovi (bili su van repoa) očekuju srpski tekst; aplikacija radi ispravno.
