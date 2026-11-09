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
  Taj stari projekat (`lock-in-tracker`, `awcuxsziarprpabywzgx`) je Supabase pauzirao 3. nov. 2026 (7 dana bez upisa);
  Andrija: više ne treba, ostaje pauziran. Prototip i dalje radi, brojanje tiho ne uspeva. Aplikacija ga ne koristi.

## 4. Poslovni model (dogovoreno)

- **7 dana besplatne probe, posle toga se plaća SVE.** Nema besplatne verzije i nema „Pro“ dela.
  Svaki korisnik plaća, pa i svaki član zajedničkog cilja.
- **Demo prikaz** postoji odvojeno od probe: aplikacija se popuni izmišljenim podacima da se vidi kako sve izgleda,
  ali ništa ne može da se upiše. Uključuje se iz Settings > Help > Demo i sa ekrana za plaćanje.
- Pretplata ide preko App Store-a i Google Play-a. Predlog (nije još potvrđen): RevenueCat za oba.
- Cene na ekranu za plaćanje su za sada probne: $6.99 mesečno, $45 godišnje, $69 doživotno (doživotna se
  izbacuje, Andrija 6. nov. 2026). **Konačne cene (Andrija, 6. nov. 2026): mesečna $4.99, godišnja $29.99;
  u Evropi €4.99 i €29.99.** Konačne cene
  Andrija dogovara sa kolegom. U aplikaciji cene nisu u kodu: čitaju se iz RevenueCat ponude (menjaju se u
  App Store Connect / Google Play Console); probne cene postoje samo za razvoj bez ključeva (`auth/testStore.ts`).
- AI funkcija (odgovaranje od skupe ili glupe kupovine i jeftinija alternativa) se **ne pravi u prvoj verziji**:
  Andrija je odlučio da je izbaci. Izbačena je i iz plana u `docs/ZASTITA.md`.

## 5. Tehnička odluka za pravu aplikaciju

- **React Native za iOS i Android. Ne WebView / WebKit omotač** (Andrija ne želi seckanje koje WebKit pravi).
- Predlog alata: Expo (TypeScript, expo-router sa 4 taba), react-native-reanimated + react-native-gesture-handler
  za animacije, @shopify/react-native-skia za holo prsten i lika na uvodu, lokalno čuvanje podataka na telefonu.
- **Lična potrošnja ostaje samo na telefonu.** Na serveru je samo ono što mora: nalozi, prijatelji, zajednički ciljevi, pretplata.
- **Backend: Supabase.** Migracije su u `backend/supabase/migrations/` (`0001` nalozi, prijatelji, zajednički cilj;
  `0002` limiti i kvote; `0003` bez lozinki; `0004` ko šta vidi i provere unosa; `0005` obaveštenja iz cilja; `0006` rok cilja, nudge, push za pinove; `0007` pin, otključan cilj i nudge bez čekanja od 10 min), serverske funkcije u `backend/supabase/functions/`, testovi u `backend/tests/`
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
- **U aplikaciji (Andrijin dizajn, 28. okt. 2026, slike i prompt):** cilj je zlatni katanac u sredini prstena; prsten
  se puni segmentima u boji svakog člana (#22e07a, #5aa9f0, #ff7eb6, #ffab3d redom), pinovi na 25/50/75/100% (pređeni
  puni zlatni, sledeći prazan), pri prelasku pina animacija i haptic, na 100% se katanac otvori i ide ekran „Unlocked.“.
  Rok (`deadline`) nije obavezan i menjaju ga svi. Nudge: push drugom članu, najviše 1 od iste osobe istoj osobi po
  cilju na 24 h, ne sebi, traži probu/pretplatu, prekidač „Nudges from friends“. Push i za pređen pin i otključan cilj.
  Squad streak, fer deo, tempo i pinovi se računaju u aplikaciji (`mobile/src/logic/goals.ts`), bez novih tabela.
  Andrija je odobrio spisak svih novih tekstova (29. okt.): „Every euro“ u uvodu piše valutu cilja (euro, dollar,
  krona…), bez naloga je isti izgled sa šarenim S M A i „Sign in to get started“, prekidač za nudge gasi samo push
  (red „Luka nudged you“ i dalje stoji u aplikaciji, onaj ko šalje ne saznaje), valuta cilja je glavna valuta u
  trenutku pravljenja (ispravljeno 29. okt., Andrija: „lepo sam ti bio rekao da stavis da se bira koja valuta je za
  cilj“: pri pravljenju cilja bira se valuta sa liste iz uvoda, podrazumevana je glavna; posle se ne menja), „On track“ = prosek uplata u poslednje 4 nedelje ≥ koliko treba nedeljno do roka.
  Za `no_access` se prikazuje „Your trial or plan has ended. …“ umesto „subscription required“ iz baze.

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
  vremena, a ostatak su obične; „Not even your mom would approve.“ ili „Future you hates you.“ se dodaje samo
  ponekad (oko 1 od 3) na kraj obične fore, nikad posle jake fore ni posebne poruke (Andrija, 4. nov. 2026;
  prototip ga je dodavao uvek);
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
  Provereno u pregledaču od 1. do 38. koraka i na iPhone-u u Expo Go (Andrija, 5. nov. 2026: „radi“). Iz teksta koraka 37 izbačeno je „language“,
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
     izlazak, onaj ko je to uradio ne; najviše jedno obaveštenje po osobi po cilju na 10 minuta (spajaju se), osim pina, otključanog cilja i
     nudge-a, koji idu odmah (`0007`, Andrija 5. nov. 2026, posle probe na dva telefona: pin je kasnio do 10 min;
     `0007` postavljena na pravi projekat i proverena isti dan; Andrija posle probe: „sad je dobro sve“);
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
  na lažnom serveru.
  **Pravi projekat podešen i proveren (27–28. okt. 2026):** Supabase `lock-in-finance-tarcker` (ref
  `jezdcanghhdnwnnnntzh`, Frankfurt, Free; „expose new tables“ isključeno, automatic RLS uključen), svih 5 migracija
  sa proverama, Resend `mail.lockintracker.app` (EU) sa SPF/DKIM/DMARC PASS, SMTP (pošiljalac „Lock In - Finance
  tracker“, Andrijin izbor; isto u `INVITE_FROM`), Auth podešavanja (OTP 6 cifara / 600 s), 4 funkcije postavljene
  (bez prijave 401), cron `send-goal-push` svaki minut, Turnstile (site key u `mobile/.env.local`) i CAPTCHA uključena
  u Supabase-u (skripta bez tokena odbijena). Provereno na telefonima: prijava kodom (iPhone i Android, Turnstile sa
  kvadratićem), 60 s, 5 pogrešnih kodova, odjava, brisanje naloga (Android). Prijava lozinkom odbijena. Kao korisnik
  u SQL-u: poziv (pravi mejl stigao, kod jednog primaoca u Promotions), prihvatanje, cilj, uplate, uplata na tuđe ime
  odbijena, izlazak briše uplate, brisanje naloga briše nalog, profil, prijateljstvo i uplate, a cilj ostaje drugima.
  Probne pretplate `manual_test` za Andrijin nalog (do 26. nov.); probni cilj „Summer trip test“ i poziv za
  `andrijadmitrovicc@gmail.com` (bez naloga) su ostali. Expo Go: `npx expo start --clear --tunnel --go` iz `mobile/`.
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
    android`); `development` je debug i spor. Javne vrednosti iz `.env.local` (Supabase URL, publishable ključ, Turnstile site key) su od 2. nov. 2026 i na EAS-u
    kao promenljive (development, preview, production), pa prijava radi i u APK-u; RevenueCat ključeva još nema;
  - ažuriranja preko interneta (Andrija: „Da, ubaci“, 3. nov. 2026): `expo-updates`, `runtimeVersion` = verzija
    aplikacije (`appVersion`, sada 1.0.0), kanali u `eas.json` (`development`, `preview`, `production`). Promena samo u
    JS kodu stiže bez novog APK-a: iz `mobile/` `npx eas-cli update --channel preview --platform android --message "..."`.
    Na telefonu: aplikaciju skroz zatvoriti i otvoriti (skine ažuriranje), pa još jednom zatvoriti i otvoriti (pokrene ga).
    Novi APK ipak treba kad se doda ili promeni nativni paket, plugin u `app.json` ili bilo šta nativno; tada se poveća
    `version` u `app.json`, da staro ažuriranje nikad ne stigne na APK sa drugačijim nativnim delom. Na kanal
    `production` se ne šalje ništa bez Andrijine dozvole;
  - stanje (Andrija, 28. okt.): sve van holo-a glatko; holo mnogo bolji, ali ne savršen kao na iPhone-u. Ostavljeno
    za kasnije: pre objave izmeriti sa „Profile HWUI rendering“ (opcije za programere) šta tačno kasni na holo-u.
    3. nov. 2026 (preview APK sa push-om): holo i dalje secka pri prelasku sa jednog panela na drugi. Andrija ne želi
    sad da se bavi time. Dogovor (3. nov.): posle slika ekrana za prodavnicu pravi se JEDAN preview APK sa skrivenim
    prekidačima koji posebno gase (1) `needsOffscreenAlphaCompositing` na panelima, (2) promenu `zIndex` sa UI niti,
    (3) JS posao pri prelasku (`setCur`/`activate`, scan i bljesak); Andrija jednom proba i kaže koji prekidač daje
    glatko, pa se popravlja samo to. Ništa drugo ne dirati na holo-u. Prekidači su ugrađeni 3. nov.
    Isti APK: izbori u Settings na Android-u (kratka lista se ne skroluje na izabrani red), bez zatamnjenja iza liste
    izbora (Andrija), kartica cilja u svetloj temi bela umesto sive, No mercy primer na uvodu je prava fora
    („brooo you DON'T need that shi🥀🥀🥀 Not even your mom would approve.“). Andrija: sve to radi.
    Rezultat probe (3. nov., Andrijin snimak ekrana, pregledan kadar po kadar): nijedan prekidač sam ne pomaže. Na svakom
    prelasku sredine oba panela u jednom kadru skoče 3–5 px dok prst skoro stoji. Dva uzroka u isto vreme, pa gašenje
    jednog nije bilo dovoljno: (a) `zIndex` u animiranom stilu je slao svaki frejm panela kroz commit React Native-a
    (Reanimated direktno upisuje samo opacity, transform, elevation…), (b) `setCur` pri prelasku je pravio React render
    čiji commit kasni frejm i prepisuje položaj panela. Popravka (samo Android): redosled panela preko `elevation`
    (spoljni View nema pozadinu, pa nema senke), `cur` (tačkice, dodir na bočni panel) se menja tek kad prsten stane
    (`activate`), statični `zIndex` se ne menja. Na svim platformama `L` je `useMemo` (inače se pri svakom renderu
    ponovo pokreću animirani stilovi panela); inače iOS i web isti kao pre. Prekidači obrisani (`holoLab.ts`,
    `EXPO_PUBLIC_HOLO_LAB`).
    APK sa tom popravkom (3. nov. uveče, Andrijine slike ekrana): bočni paneli se crtaju PREKO prednjeg. Greška: pozitivan
    `elevation` u React Native 0.88 ne menja redosled (`ReactViewGroup.drawChild` posle takvog deteta zatvara Android-ovo
    preuređivanje, pa se deca crtaju redom kojim su u stablu); to je bilo pretpostavljeno, a ne provereno u kodu.
    Ispravljeno: prednji panel `elevation` 0, ostali −1. Negativan ostaje u preuređivanju roditelja, pa Android crta
    bočne prve, a prednji preko njih, i dalje bez commit-a i bez premeštanja view-ova. Dodir ne prati `elevation`
    (React Native traži dodirnuti view po redosledu u stablu), pa na Android-u bočni paneli ne primaju dodir
    (`pointerEvents` none), a tap na bočni panel preuzimaju dve providne trake levo i desno od prednjeg panela
    (`zIndex` 30, nikad se ne menja). Provereno: kod React Native-a i Reanimated-a (elevation ide direktno u view, bez
    ograničenja na negativne vrednosti), u pregledaču sa privremeno uključenom Android granom (trake tačno uz ivice
    prednjeg panela, okreću prsten levo/desno, tap na prednji panel ga ne okreće); običan web isti kao pre. Sam
    redosled crtanja na Android-u ovde ne može da se vidi (nema emulatora: virtualizacija je isključena u BIOS-u).
    Andrija (4. nov. 2026, preview APK sa tom popravkom): „holo radi perfektno“. Prelaz je završen; ne dirati.
    Isti dan: dok je holo na ekranu, FPS cele aplikacije znatno padne (ranije isto i na iPhone-u). Privremeno, preko
    ažuriranja na kanalu preview: merač FPS-a i 6 prekidača ispod prstena (`components/spending/holoLab.ts`, samo
    Android): lebdenje, treptanje, senke, pozadina panela, grafikoni, bočni paneli. Andrija čita FPS sa svakim, pa se
    popravlja samo uzrok. Rezultat: senke (sjaj i senka oko panela) obaraju FPS sa 50–60 na 35–40; Andrija: „izbaci ih
    ni ne trebaju nam“. Izbačene na svim platformama (ostala je samo unutrašnja senka u pozadini panela). Posle toga, uz to da
    se prsten tokom skrola čuva kao jedna slika: Honor (Andrijin test telefon) ~60 FPS, „na oko se ne primeti“,
    ostaje tako; star Samsung ~11 FPS na holo-u (Andrija: star telefon, prihvaćeno). Merač i prekidači obrisani.
    U dev režimu na Android-u ostaju bezopasna upozorenja `[Worklets] Tried to modify key current` (holo).
  - treći Android telefon (4. nov. 2026, Andrijine slike, 720×1600): uvodni ekran i slajdovi odsečeni. Uzrok nije manji
    ekran (~411 dp, isto kao Redmi) nego veća slova u podešavanjima telefona (~1,3×). Popravljeno: (1) slova u
    aplikaciji rastu sa podešavanjem telefona najviše 1,15× (`MAX_FONT_SCALE`, `src/textScale/`; `metro.config.js`
    daje te Text i TextInput samom react-native-u, pa važi za sve, i za biblioteke i Animated.Text; web nije
    pogođen); 1,15 je moj izbor (Andrija može da promeni: 1 = slova uvek kao u dizajnu); (2) uvodni ekran: kad lik i
    tamni deo ne staju ispod naslova, oba se srazmerno smanje (k, najmanje 0,55; petina lika sme iza naslova, kao na
    Redmi-ju, gde je k = 1); (3) slajdovi: tekst uvek staje, slika dobija ostatak (340 kao u prototipu, manje kad
    nema mesta) i smanji se cela kad ni to nije dovoljno. Oba se prikažu tek kad su izmereni. Provereno u pregledaču
    na 412×866 (isto kao pre) i 360×640 (sve staje); na tom telefonu nije provereno.
- Prijatelji i zajednički cilj u aplikaciji, vezani za pravi Supabase (29. okt. 2026, Andrijin dizajn iz dela 6):
  Savings (bez naloga, bez ciljeva sa „Lock in together.“, lista ciljeva sa malim prstenom), ekran cilja
  (`mobile/src/app/goal/[id].tsx`: katanac u prstenu, pinovi, „Put money in“, tempo, squad streak, „Who put in what“
  sa Nudge, Activity sa izmenom/brisanjem svojih uplata, Edit / Leave), „Unlocked.“ (`app/unlocked/[id].tsx`, jednom po
  cilju na telefonu), Friends (`app/friends.tsx`: poziv mejlom, zahtevi, poslati pozivi, prijatelji), „What should
  friends call you?“ posle prve prijave i pre prvog poziva/cilja, Settings > Account: „Your name“ i „Nudges from
  friends“. Server: `mobile/src/goals/` (učitavanje navedenih kolona, akcije, Realtime za ciljeve, članove, uplate,
  pozive, prijateljstva i nudge-ove, osvežavanje pri povratku u aplikaciju). Istekla pretplata: sve se vidi, sve osim
  izlaska (i brisanja svoje uplate) daje jasnu poruku. „Shared goal alerts“ se nude jednom, posle prvog pravljenja
  cilja ili uplate (u Expo Go-u se ne broje, pa ih pravi build ponudi). Demo: isti izgled sa „Summer trip to Greece“
  (Sergej, Marko, Ana; 520 + 400 + 320 od 2,000 €, rok May 1, streak 3 nedelje). Tekst o privatnosti dopunjen (korak 6).
  Migracija `0006` + nova verzija `send-goal-push` (tekstovi za nudge, pin i otključavanje). Testovi: 18 provera logike
  cilja, 38 provera za `0006`, spisak kolona i RPC-ova u `privacy.test.mjs` dopunjen, 7 novih provera teksta push-a.
  Provereno u pregledaču (demo, tamna i svetla tema, mere prema slikama). Nije provereno na telefonima ni sa pravim
  projektom: Andrija pokreće `0006`, ponovo postavlja `send-goal-push` (`docs/TESTIRANJE.md` 2.5a) i proba na dva
  telefona. Haptic je `expo-haptics` (radi u Expo Go); push (nudge, pin) traži pravi build.
- Ekran za plaćanje i zaključavanje (30. okt. 2026, Andrijin dizajn `docs/dizajn/placanje/` 06–11; zamenjuje ekran
  iz prototipa). Ruta `mobile/src/app/paywall.tsx`, delovi u `components/paywall/`, tekstovi i datumi u
  `logic/paywall.ts`, prodavnica u `auth/purchases.ts`. Uvod: podešavanje → ekran za plaćanje → vođeni obilazak
  („Show me around“) ili Home („Skip the tour“). „Lock-in Pro“ u Settings otvara ekran; dodato „Manage subscription“
  (stranica pretplata u App Store-u / Google Play-u) i „Trial reminder“ dok traje proba.
  **Odakle počinje proba (odluka):** proba je besplatna nedelja **prodavnice** (RevenueCat introductory offer), i
  počinje kad korisnik na ekranu za plaćanje pritisne „Start my free week“ i potvrdi u prozoru App Store-a /
  Google Play-a. Nalog za to ne treba: kupovina pripada Apple ID-u / Google nalogu (RevenueCat anonimni id), pa je
  Restore vraća i na novom telefonu. Aplikacija sama ne broji dane i ništa ne čuva kao „plaćeno“. Zašto: (1) to je
  jedini način da posle 7 dana naplata krene sama, (2) prodavnica ne daje drugu besplatnu nedelju istom Apple ID-u
  (brisanje aplikacije ili Reset ne daju novu), (3) lokalni brojač bi se varao reinstalacijom, a proba na serveru bi
  terala svakoga da napravi nalog. Ko zatvori prozor prodavnice nema probu: aplikacija ostaje zaključana (vidi se
  samo ekran za plaćanje, demo i Restore). Ko kupi bez naloga pa se kasnije prijavi: `Purchases.logIn` spoji kupovinu
  sa nalogom, a nova funkcija `sync-store-access` je upiše na server (webhook to ne javlja do sledeće obnove).
  **Zaključavanje:** prijavljen korisnik bez probe/pretplate (server) ili, bez naloga, bez kupovine u RevenueCat-u.
  Ne zaključava se offline ni dok se proverava; build bez RevenueCat ključeva ne zaključava **nikoga**, ni prijavljene
  (ispravljeno 9. nov. 2026: na prvom Google Play build-u prijavljen tester bez probe je ostao na ekranu za plaćanje
  bez ✕, a kupiti nije mogao; Andrija prijavio). U razvoju (Expo Go, probni planovi) prijavljen bez probe i dalje
  ostaje zaključan. Server i dalje odbija izmene u zajedničkom cilju bez probe/pretplate.
  Doživotni plan nema probu („Buy for <cena>“). Kad je proba već iskorišćena (prodavnica kaže), nema „7 DAYS FREE“
  ni linije, piše „Your free week is over.“ i „Subscribe for <cena> a year“.
  Šta sam dodao jer ga dizajn nema (Andrija: „šta fali, dodaj“): ✕ kad aplikacija nije zaključana (otvoreno iz
  Settings, ili build bez prodavnice); taj drugi naslov za iskorišćenu probu; tekst ispod dugmeta za doživotni
  („One payment of $69. No subscription.“); kartica „Couldn't reach the App Store.“ kad nema mreže; uspeh za
  doživotni / plaćeni plan bez probe (bez reda „Then“ i bez podsetnika); „No purchase found“ kao sistemska poruka;
  na Android-u svuda „Google Play“ umesto „App Store“.
  Podsetnik: lokalno obaveštenje u 10:00 dva dana pre **pravog** kraja probe (datum iz prodavnice), podrazumevano
  uključeno, prekidač na „You're locked in.“ i u Settings > Subscription; ne šalje se ako je proba otkazana.
  Bez RevenueCat ključeva (Expo Go) ekran radi na probnim cenama iz dizajna sa oznakom „TEST PRICES · NO STORE YET“, a
  dugme nudi izbor šta „prodavnica“ odgovara (uspeh, zatvoren prozor, odbijena kartica, čeka odobrenje, nema mreže),
  da se svi ekrani vide na telefonu; to ništa ne otključava. Testovi: 16 provera (`logic/__tests__/paywall.test.ts`)
  i 6 za `sync-store-access`. Provereno u pregledaču (06, 08, 09, 10, uvod → plaćanje → obilazak, Settings, demo);
  11 („Welcome back.“) i sistemske poruke se na web-u ne vide. Nije provereno na telefonu ni sa pravom prodavnicom.
  Andrija podešava kad otvori naloge: `docs/ZASTITA.md` 3.5 (`sync-store-access`) i 3.6 koraci 6–7.

- Spori telefoni i sitnice (4. nov. 2026, Andrija: „uradi oba“): holo sam meri brzinu (posle prve sekunde mirovanja
  na ekranu, 90 frejmova); ispod 40 FPS lebdenje panela i treptanje tačkica stanu do kraja rada aplikacije, sve
  ostalo ostaje (`HoloRing.tsx`, `slowPhone`). Na brzim telefonima se ništa ne menja. Naslov kalendara („November 2026
  (0 EUR)“) uvek u jednom redu (`CalendarPanel.tsx`). Posle toga je stari Samsung „na par sekundi“ zamrzavao celu
  aplikaciju; najverovatniji uzrok je bio `adjustsFontSizeToFit` na tom naslovu (na Android-u se tekst ponovo
  uklapa pri svakom crtanju), pa je zamenjen sa `maxFontSizeMultiplier={1}` (naslov ne raste sa slovima telefona).
  Uzrok nije izmeren; ako zamrzavanje ostane, dodati privremeni merač zastoja (UI frejm i JS kašnjenje).
  Nije pomoglo: stari Samsung je dobio „Lock In ne reaguje“ (ANR, glavna nit blokirana > 5 s) na Spending-u. Andrija
  je izabrao plan B umesto izveštaja o grešci: „bez lebdenja i bilo kakvih sranja, nek izgledaju kao najobičniji
  prozori koji se menjaju, ali samo ako telefon baguje; na normalnim telefonima lep holo“. Urađeno:
  `components/spending/HoloLite.tsx` (tri obična prozora u horizontalnom skrolu sa stranicama, tačkice, bez 3D-a,
  animacija, slika u memoriji i bilo čega što radi u svakom frejmu; sadržaj panela bez animacija dolaska; prozori iste
  visine). `HoloRing` meri frejmove posle ulaska na ekran i prelazi na prozore, pamti to u AsyncStorage, pa posle
  odmah ide sa prozorima. Andrija (4. nov.): Samsung prešao sam, Honor pun holo. Ali iPhone 15 Pro Max (Expo Go) je
  prešao na prozore kad je uključen demo (cela aplikacija se tad ponovo crta, pa je prosek 24 frejma bio spor);
  Andrija: „mora baš u ekstremnim situacijama kad je telefon baš neka kršina“. Sada: 1,5 s posle ulaska, 40 frejmova,
  prozori samo ako je bar 30 od njih sporije od 50 ms (ispod 20 FPS; Samsung ~90 ms svaki); nov ključ
  `lockin.holoLite2`, pa stare odluke (i iPhone-ova) ne važe. Ranija logika „spor telefon gasi lebdenje“ je
  zamenjena ovim. Provereno u pregledaču sa privremeno uključenim prozorima (izgled, prelazak); jednaka visina
  prozora i Samsung nisu provereni (pregledač je bio sakriven). Ako ANR ostane i sa prozorima, uzrok nije holo i treba
  izveštaj o grešci (Opcije za programere > Prijava greške) da se vidi gde glavna nit stoji.

Sledeće (stanje 4. nov. 2026; kostur, prenos svih ekrana, prijava, CAPTCHA, cilj i ekran za plaćanje su urađeni):
1. **Google Play nalog** ($25; Andrija otvara što pre, jer novi lični nalog traži zatvoreno testiranje sa 12 testera
   14 dana zaredom pre produkcije). Odluka (Andrija, 4. nov. 2026): **lični nalog** (javna kućna adresa zbog
   pretplata i 12 testera / 14 dana prihvaćeni).
2. ~~Bez naloga: feature graphic, ikonica 512, tekst za prodavnicu~~ (urađeno 4. nov., `docs/PRODAVNICE.md` delovi 2–4
   i 9; recenzenti ulaze preko Google prijave, uputstvo u delu 9). Android je završen (Andrija, 4. nov.: Samsung sam
   prešao na proste prozore, Honor pun holo, „jako je klin sve“).
3. Posle naloga: production build (AAB) → Internal testing; proizvodi u Play Console (mesečna i godišnja sa 7 dana
   probe, doživotna; **cene konačno** dogovara Andrija sa kolegom); RevenueCat (`docs/ZASTITA.md` 3.6: entitlement
   `access`, ponuda `default`, webhook, javni ključ `goog_` u EAS); probna kupovina; formulari (Data safety, Content
   rating, Target audience, Ads, Financial features, App access); zatvoreno testiranje 14 dana; zahtev za produkciju.
   RevenueCat Test Store je razmotren i odložen (radi samo u debug build-u; nije sigurno za besplatnu nedelju i webhook).
   **Vodič korak po korak: `docs/GOOGLE-PLAY.md`** (6. nov. 2026, Andrija plaća i otvara nalog; tamo je i stanje svakog
   koraka). Odluke od 6. nov.: u Play Console-u aplikacija je **„Free“** (to je cena preuzimanja; pretplata sa probom
   je kupovina u aplikaciji, „Paid“ bi tražio plaćanje pre instalacije i ne može se kasnije promeniti); Play App
   Signing sa Google ključem (EAS ključ je upload key); versionCode vodi EAS (`appVersionSource: remote`,
   `autoIncrement`); production AAB samo za `arm64-v8a` kao preview (sa `armeabi-v7a` build je pao bez memorije na
   EAS-u; stari 32-bitni telefoni ne dobijaju aplikaciju, moj izbor); u Data safety dodat
   i push token (Device or other IDs); svi testeri i u License testing (bez prave naplate). Prvi production AAB
   (versionCode 4, gotov 6. nov., link u `docs/GOOGLE-PLAY.md` 3; 2 i 3 pali bez memorije, popravljeno redosledom
   `gradleCommand` u `eas.json`; bez RevenueCat ključa, jer RevenueCat traži da proizvodi već postoje na Play-u) služi za Internal
   testing i da Play dozvoli pravljenje proizvoda; posle RevenueCat-a ide drugi build sa `goog_` ključem.
   Na Honor-u se pre instalacije sa Play-a izveze rezervna kopija i deinstalira preview APK (drugi potpis).
   **Doživotna kupovina se izbacuje** (Andrija, 6. nov. 2026): samo mesečna i godišnja pretplata sa 7 dana probe.
   U prodavnici se ne pravi, a RevenueCat ponuda nema paket Lifetime; ekran za plaćanje tad sam pokazuje dva plana.
   Probni planovi za razvoj bez ključeva (`auth/testStore.ts`) i dalje imaju doživotni (samo u Expo Go-u). Play
   Console nalog se otvara na `lockeddevsapps@gmail.com` (lični tip, Andrijino ime).
4. App Store (Apple Developer $99 godišnje): iOS build preko EAS-a (Mac ne treba), Sign in with Apple, proizvodi u App
   Store Connect, TestFlight na Andrijinom iPhone-u (prvi pravi build na iPhone-u: holo, 120 Hz, push, kupovina),
   slike za iPhone 6.9", App Privacy, pregled. Apple Small Business Program (15% umesto 30% provizije) prijaviti ručno.
   Stanje (8. nov. 2026): Andrija se upisao u Apple Developer Program preko sajta (aplikacija Apple Developer traži
   iOS 26, a on ostaje na iOS 18), kao **Individual**, svojim **ličnim Apple ID-jem** (novi Apple ID na
   `lockeddevsapps@gmail.com` Apple je odbio: „Your account cannot be created at this time“). Plaćeno $99,
   čeka se mejl o aktivaciji (do 2 radna dana). Prodavac u App Store-u biće njegovo ime; kolega dobija pristup
   preko Users and Access, EAS radi preko API ključa.
5. Pre slanja u obe prodavnice: `docs/ZASTITA.md` deo 6 (Expo Go adrese iz Supabase-a, probni nalozi i `manual_test`
   pretplate, Google OAuth „In production“, pravi ključevi, bez „TEST PRICES“).
6. Provere na telefonima koje fale: zajednički cilj na dva telefona sa pravim nalozima (`0006`, nova `send-goal-push`),
   ekran za plaćanje sa pravom prodavnicom. Na iPhone-u (Expo Go, 5. nov.) provereno: vođeni obilazak 1–38, svetla
   tema, ekran za plaćanje sa probnim cenama, podsetnik za troškove (pravo obaveštenje stiglo). Zajednički cilj proveren
   na dva telefona sa pravim nalozima (iPhone u Expo Go + Honor preview APK, 5. nov.): poziv, cilj, uplate, push
   za pin na Honoru (posle `0007` stiže odmah). Nudge dugme se vidi samo pored člana bez uplate te nedelje. Slike za App Store (1290×2796,
   bez DEMO i statusne trake) su u `docs/prodavnica/app-store/`.
Okvirno (4. nov.): ~75% posla do objave; kod ~95%, ostatak su nalozi, podešavanja po dashboard-ima i čekanje
prodavnica. Troškovi do objave: Google $25 jednom + Apple $99 godišnje (domen već plaćen); Supabase, RevenueCat
(besplatno do $2.500 mesečnog prihoda, pa 1% od celog iznosa tog meseca), Expo, Resend, Cloudflare, Firebase su
besplatni dok aplikacija ne poraste.
Odluka (Andrija, 30. okt. 2026): pravni pregled Privacy Policy i Terms se ne radi sad i računa se kao završen za
potrebe objave; tekst se ažurira kasnije po potrebi. Spisak pitanja za pravnika ostaje u `docs/ZA-PRAVNIKA.md`.
Privacy Policy je dopunjena nudge-ovima, rokom cilja i obaveštenjima za pinove. Supabase je na Free planu (bez
doplata, spend cap nije potreban dok se ne pređe na Pro).

Poznata sitnica u prototipu: neki stari probni testovi (bili su van repoa) očekuju srpski tekst; aplikacija radi ispravno.
