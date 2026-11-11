# Nastavak rada u novoj sesiji (predaja, 4. nov. 2026)

Ovaj fajl je za novu sesiju Claude Code-a (i na novom Claude nalogu): gde smo stali, kako se tehnički radi i šta je
vezano za ovaj računar. Razgovori iz starih sesija ne prelaze na nov nalog: sve što je dogovoreno je u `docs/`.

## 1. Šta pročitati na početku

1. `CLAUDE.md` (pravila; učitava se sam) i `docs/PROJEKAT.md` (sve odluke i stanje, deo 8 „Sledeće“ je plan do objave).
2. `docs/FORE.md` (tačni tekstovi svih fora; prepisivati tačno).
3. Po potrebi: `docs/ZASTITA.md` (bezbednost, šta Andrija klikće po dashboard-ima, deo 6 pre objave),
   `docs/PRODAVNICE.md` (tekstovi i obrasci za prodavnice, slike), `docs/TESTIRANJE.md` (pravi Supabase projekat),
   `docs/DOMEN.md`, `docs/ZA-PRAVNIKA.md`, `mobile/README.md`, `backend/README.md`.

## 2. Gde smo stali

- Aplikacija (Expo SDK 58, React Native 0.88, `mobile/` na grani `aplikacija`) ima sve ekrane i funkcije iz prototipa,
  prijavu bez lozinke, prijatelje i zajednički cilj na pravom Supabase-u, obaveštenja, ekran za plaćanje i zaključavanje.
- Android je testiran na tri telefona (Redmi Note 15 Pro, Honor, stari Samsung). Holo prsten: prelaz radi „perfektno“,
  ~60 FPS na Honoru (ostaje tako), na starom Samsungu sporo (prihvaćeno; na sporim telefonima lebdenje i treptanje sad
  same stanu). Uvodni ekrani staju na svaki ekran; slova rastu sa podešavanjem telefona najviše 1,15×.
- iPhone: testiran samo kroz Expo Go (bez pravog build-a; treba Apple nalog).
- Google Play slike ekrana su gotove (`docs/prodavnica/google-play/`, 8 slika). Fale feature graphic i slike za iPhone.
- Plaćanje: kod gotov, čeka Google Play / Apple naloge i RevenueCat (`docs/ZASTITA.md` 3.6).
- Poslednji preview APK (Android, ima ažuriranja preko interneta):
  https://expo.dev/artifacts/eas/wKuPZl_jW3W2RBny414m1m8_xZuvgHXtoj2AfvyMVJM.apk
  Posle njega je sve stizalo kao ažuriranje preko interneta (kanal `preview`).

## 3. Kako se radi (tehnički)

- Repo: `C:\dev\lock-in`, GitHub `divnicsergej4/lock-in`. Radi se na grani `aplikacija`; `main` se ne dira bez
  Andrijine izričite dozvole (to je javni link prototipa).
- U `mobile/`: provera tipova `npx tsc --noEmit -p .`, testovi `npx jest` (~5.600 provera), backend testovi
  `npm test` u `backend/`.
- Pregled u pregledaču: `.claude/launch.json` ima `app-web` (Expo web na 8081) i `prototype`. Web nije isto što i
  Android (npr. `elevation`, ograničenje slova i Android grane koda se na web-u ne vide): za Android ponašanje čitati
  kod React Native-a / Reanimated-a u `node_modules` ili izvesti paket `npx expo export --platform android --no-minify
  --no-bytecode` i pregledati ga. Emulatora nema (virtualizacija isključena u BIOS-u).
- **Ažuriranje preko interneta** (samo JS izmene, za par minuta): iz `mobile/`
  `npx eas-cli update --channel preview --platform android --environment preview --message "..."`.
  Andrija zatvori i otvori aplikaciju dvaput. Na kanal `production` ništa bez Andrijine dozvole.
- **Novi APK** (nativna izmena: nov paket, plugin u `app.json`): `npx eas-cli build --profile preview --platform android
  --non-interactive --no-wait`, traje 20–60 min (besplatan red). Pre takvog build-a povećati `version` u `app.json`
  (`runtimeVersion` = verzija aplikacije), da staro ažuriranje ne stigne na drugačiji nativni deo.
- `mobile/metro.config.js` daje react-native-u `src/textScale/Text.tsx` i `TextInput.tsx` (ograničenje veličine slova):
  ne brisati.
- Fajlove menjati alatom za izmenu fajlova (Edit/Write), ne kroz shell; u shell komandama bez backtick-ova.

## 4. Šta je vezano za ovaj računar, a ne za Claude nalog

Ostaje isto i posle promene Claude naloga (ako se radi na istom računaru):
- Expo / EAS prijava: nalog `lockeddevs` (`npx eas-cli whoami`), EAS projekat `@lockeddevs/lock-in`.
- Git i GitHub pristup repou.
- Fajlovi van git-a: `mobile/.env.local` (samo javne vrednosti: Supabase URL, publishable ključ, Turnstile site key) i
  `mobile/google-services.json` (Firebase za push). Iste javne vrednosti su i u EAS promenljivim. Na novom računaru ih
  Andrija kopira sam.
- Tajni ključevi nisu nigde u repou i ne traže se (Supabase service_role / sb_secret, lozinka baze, Resend, RevenueCat
  secret, Turnstile secret, FCM service account, tokeni): Andrija ih sam unosi u dashboard-e.

## 5. Lekcije iz rada (da se ne ponove)

- Ne pretpostavljati kako se platforma ponaša: proveriti u kodu (npr. pozitivan `elevation` u RN 0.88 ne menja
  redosled crtanja; to je koštalo jedan APK).
- Pre svakog APK-a ili ažuriranja proveriti ono što može da se proveri (tipovi, testovi, pregledač, izvezen paket) i
  jasno reći šta nije provereno na telefonu.
- Brzinu meriti, ne nagađati: privremeni merač i prekidači preko ažuriranja, Andrija čita brojeve, popravlja se samo
  uzrok, pa se merač briše.
- Ekrane proveravati i na malom ekranu (360×640) i misliti na veća slova u podešavanjima telefona.
- Andrija testira na telefonu i šalje slike; kratki izveštaji, srpski latinicom, bez nabrajanja koraka.

## 6. Prva poruka za novu sesiju (Andrija je nalepi)

> Nastavljamo rad na aplikaciji Lock In. Pročitaj CLAUDE.md, docs/PROJEKAT.md, docs/FORE.md i docs/NASTAVAK.md, pa mi
> u par rečenica reci gde smo stali i šta je sledeće po planu. Ne menjaj ništa dok ti ne kažem.
