# App Store: korak po korak

Vodič za objavu na App Store-u (13. nov. 2026). Kao `docs/GOOGLE-PLAY.md`: posle svakog koraka upiši stanje.

**Pravilo:** Apple ID lozinku, kodove za potvrdu, ključeve (`.p8`), podatke banke i poreza unosi samo Andrija.
Ništa od toga ne ide u čet ni u repo. Javni RevenueCat ključ `appl_…` nije tajna.

Stanje pre ovog vodiča: Apple Developer Program aktivan (Individual, Andrijin lični Apple ID), porez popunjen,
Paid Apps ugovor sa USD računom (12. nov.).

## 1. Bundle ID ✅ 13. nov. (Sign In with Apple + Push Notifications; Service ID, Key i email izvori ne trebaju)
developer.apple.com > Account > Certificates, IDs & Profiles > **Identifiers** > **+** > App IDs > App:
- Description: `Lock In`
- Bundle ID: **Explicit**, `com.lockintracker.app` (isto kao `ios.bundleIdentifier` u `mobile/app.json`)
- Capabilities: **Sign In with Apple** i **Push Notifications** (ostalo ne dirati)
- Continue > Register.

## 2. Aplikacija u App Store Connect-u ✅ 13. nov.
appstoreconnect.apple.com > **Apps** > **+** > New App:
- Platforms: **iOS**
- Name: `Lock In: Finance Tracker`
- Primary Language: **English (U.S.)**
- Bundle ID: `com.lockintracker.app` (iz koraka 1)
- SKU: `lockin-ios`
- User Access: **Full Access**

## 3. App Store Small Business Program ⬜
developer.apple.com/app-store/small-business-program/ > Enroll: 15% provizije umesto 30%. Ne dešava se samo.

## 4. Pretplate ✅ 14. nov. (grupa `Lock In`, `lockin_monthly` $4.99 i `lockin_annual` $29.99, obe „Free for the first week“; Review Information sa slikom i „Add for Review“ tek uz prvu verziju)
Odluke (13. nov. 2026): dostupno u svim zemljama; Kosovo je prvo bilo izuzeto, ali Andrija 15. nov.: „kosovo treba
da ostane ukljuceno“ (aplikacija i pretplate); cene u evrima ostaju kako Apple sam
preračuna iz $4.99 (npr. €5.99 sa PDV-om; Andrija: „boli me uvo“).
App Store Connect > aplikacija > **Monetization > Subscriptions**:
1. Subscription Group: `Lock In` (obe pretplate u istoj grupi, da proba važi jednom za obe).
2. Mesečna: Reference Name `Lock In Monthly`, Product ID **`lockin_monthly`**, Duration 1 Month, cena **$4.99**
   (ostale zemlje Apple sam preračuna), Localization (English U.S.): Display Name `Monthly`, Description
   `Everything in Lock In, billed monthly.`
3. Godišnja: `Lock In Annual`, **`lockin_annual`**, 1 Year, **$29.99**, Display Name `Yearly`, Description
   `Everything in Lock In, billed yearly.`
4. Za obe: **Introductory Offers** > sve zemlje > **Free** > **1 Week**.
5. Za obe: Review Information > slika ekrana za plaćanje + napomena (posle prvog build-a, slika sa iPhone-a).
6. Product ID-jevi su isti kao na Google Play-u: RevenueCat ih spaja pod isti entitlement `access`.

## 5. RevenueCat za iOS ✅ 14. nov. (aplikacija „Lock In (App Store)“, In-App Purchase ključ, obaveštenja, proizvodi u `access` i `default`; `EXPO_PUBLIC_REVENUECAT_IOS_KEY` u EAS za sva tri okruženja)
1. App Store Connect > Users and Access > Integrations > **In-App Purchase** > Generate key: `.p8` preuzimaš sam,
   uz Key ID i Issuer ID.
2. RevenueCat > projekat Lock In > Apps > **+ App Store**: Bundle ID `com.lockintracker.app`; otpremi `.p8`, Key ID,
   Issuer ID (sam). Posle toga `.p8` obriši sa računara ili ga čuvaj u menadžeru lozinki.
3. RevenueCat > ta aplikacija > **App Store Server Notifications**: kopiraj URL u App Store Connect > App
   Information > App Store Server Notifications (Production i Sandbox, Version 2).
4. Product catalog: uvezi `lockin_monthly` i `lockin_annual` (iOS), zakači ih na entitlement `access` i na pakete
   Monthly / Annual u ponudi `default`.
5. API keys: javni `appl_…` → EAS promenljiva `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (plaintext, sva tri okruženja). Može
   da mi ga pošalje, pa to uradim ja.

## 6. iOS build i TestFlight ✅ 15. nov. (build 2 proveren na iPhone-u posle ispravki)
Prvi build pokrenut 14. nov. (`186de768-29e0-4684-a2d4-461b282b1683`, build number 1): EAS napravio sertifikat,
profil i push ključ; build gotov (commit `dff79f2`). `--auto-submit` je pao jer u `eas.json` nije bilo `submit` profila; dodat (`ascAppId`
`6834582561`), pa se šalje sa `npx eas-cli submit --platform ios --latest`. Poslato u App Store Connect 14. nov.
(EAS napravio App Store Connect API ključ sa ulogom **App Manager**, ne Admin).
Prva proba na iPhone-u (TestFlight, 15. nov.): (1) placeholder „Description (required)…“ sa razmaknutim slovima:
iOS ponovo koristi prikaz drugog polja i placeholder zadrži njegov razmak slova (react-native issue 42589);
ispravka: svako polje ima `letterSpacing: 0` ako ne zada svoj (`src/textScale/TextInput.tsx`). (2) prazna kutija
plamena: tab koji nije napred se sakrije (`display: none`, TabFreeze), Fabric ponovo napravi prikaz Canvas-a, a Skia
2.14 ga ostavi praznog (react-native-skia issue 4442, ispravke još nema); ispravka: plamen pravi nov Canvas kad se
ekran vrati napred (`Flame.tsx`). Isto može da pogodi krug i liniju na Spending-u i prsten cilja: proveriti posle
menjanja tabova. Obe ispravke su samo JS (stižu preko ažuriranja), ali build za pregled mora da ih ima ugrađene.
Andrija potvrdio uzrok plamena (prazno tek posle drugog taba, vrati se kad otvori „Can I afford this?“) i dao
dozvolu: ažuriranje `b4442b13` na kanal `production` (iOS i Android), 15. nov. Plamen posle toga radi (Andrija),
ali holo grafikoni (krug i linija na Spending-u) isto ostanu prazni posle drugog taba: ista ispravka je sad
zajednička (`components/useSkiaRemount.ts`) i važi za plamen, krug (i prazan krug) i liniju. Prsten cilja
(`LockRing`) nije diran: proveriti. Ažuriranje `952810cc` na `production` (iOS i Android), 15. nov., uz Andrijinu dozvolu.
(3) Holo na iPhone-u mutan dok se krug iscrtava i „190 EUR“ ulazi (Andrijin snimak; posle animacije oštro). Uzrok
(pretpostavka, nije izmereno): iOS matrica panela je u sebi imala pomak po dubini do ~140 000 (redosled panela), pa je
Core Animation animirane delove crtao u maloj rezoluciji. Ispravka samo za iOS: poza na unutrašnjem sloju, pomak po
dubini na spoljašnjem (`holo.ts` `poseMatrix` + `depthMatrix`, `HoloRing.tsx` RingPanel); slika i redosled panela
isti (test). Android i web nedirnuti. Ažuriranje `ea72e7e7` na `production`, 15. nov., uz Andrijinu dozvolu.
Andrija posle toga (15. nov.): „sad sve radi, nema ostalih gresaka nigde“. Pa ipak: katanac zajedničkog cilja na
Savings-u isto prazan posle drugog taba; Andrija: „na nivou cele aplikacije to popravi“. Sada svaki Skia crtež u
aplikaciji ide kroz jedan Canvas (`components/SkiaCanvas.tsx`) koji se sam napravi iznova kad se ekran vrati napred
(plamen, holo krug i linija, katanac cilja, lik i podvlaka na uvodu); test (`components/__tests__/skiaCanvas.test.ts`)
pada ako neki fajl uzme Canvas direktno iz Skia-e. Ažuriranje `9c48b530` na `production`, 15. nov. (Andrija: „kad
zavrsis posalji ono gde treba“).
Posle build-a 2 (17. nov., kolegin TestFlight): posle upisa troška tastatura je ostajala gore i krila roast. Sada se
tastatura spusti posle svakog uspešnog upisa (`components/home/NewEntry.tsx`). Ažuriranje `04d73928` na `production`;
Andrija: „sad radi“. Recenzenti build-a 2 to nemaju (ugrađen kod); ulazi u sledeći build. Od 17. nov. ažuriranja na
`production` šaljem bez pitanja (Andrija: „nemoj više nikad da mi tražiš dozvolu nego samo pošalji“).
Snimak za Apple (19. nov., kolegin TestFlight, build 2) pregledan kadar po kadar: pokriva sve iz napomena. Nađeno:
posle „Account deleted“ aplikacija se zaključala sa „Your free week is over.“, iako je proba tog Apple ID-ja aktivna
(RevenueCat `logOut` daje nov anonimni id bez kupovina). Sada posle odjave i brisanja naloga ide `syncPurchases`, pa
se proba/pretplata vrati bez „Restore purchase“ (commit `fc9815e`, ažuriranje `931ce390` na `production`, ulazi u
sledeći iOS build i Android AAB posle versionCode 7). Nije provereno na telefonu. Otvoreno: u Settings je sve vreme
pisalo „Plan active (finishing setup…)“, tj. server nije saznao za sandbox probu ni posle `sync-store-access`;
proveriti u RevenueCat-u i logovima funkcije.
Odgovor na 2.1 poslat 19. nov.: tekst iz `docs/prodavnica/app-store-review-notes.txt` sa linkom snimka (Google Drive,
„Anyone with the link“, provereno bez prijave) kao poruka Apple-u i u App Review Information > Notes, pa Update Review.
Pri tom je Apple tražio za **China mainland** bezbednosnu procenu i prijavu AI sadržaja: Kina je izbačena iz zemalja
(Pricing and Availability), sve ostale zemlje ostaju. Status: 4 stavke **Waiting for Review**.
Build 2 (sa svim ispravkama ugrađenim) pokrenut 15. nov. sa commit-a `7142caa`, bez Apple prijave (sertifikat, profil i
API ključ su na EAS-u): `ba0d28c3-00b8-4948-bda2-f5f584abc8aa`, sa `--auto-submit` (sam ide u App Store Connect). Za pregled treba nov build (2) sa ovim
ispravkama ugrađenim (recenzent vidi ugrađeni kod, ažuriranje se primeni tek na drugom pokretanju).
`mobile/app.json` već ima `ITSAppUsesNonExemptEncryption: false` (samo standardno šifrovanje, Apple ne pita svaki put).
Pokreće **Andrija u svom terminalu** (traži Apple ID prijavu i kod, to ne sme kroz mene), iz `mobile/`:
```
npx eas-cli build --platform ios --profile production
```
Na pitanja: Log in to Apple account **Yes**; neka EAS sam napravi Distribution Certificate, Provisioning Profile i
**Push Notifications key** (Yes). Kad build završi:
```
npx eas-cli submit --platform ios --latest
```
(EAS pita za App Store Connect API key: neka ga sam napravi.) Build se pojavi u TestFlight-u za ~10–30 min.
TestFlight > Internal Testing: dodaj sebe, instaliraj TestFlight na iPhone. Proveri: holo i 120 Hz, Sign in with
Apple, Google i kod, probna kupovina (Sandbox nalog), Restore, push iz cilja, „Already have an account? Sign in“.

## 7. Stranica u prodavnici i obrasci ✅ 15. nov.
Urađeno 15. nov.: App Information (podnaslov, Finance, bez sadržaja trećih strana), uzrast 13+ (PRODAVNICE deo 5),
Pricing and Availability (aplikacija Free, 175 zemalja sa Kosovom, bez Apple Silicon Mac-a), App Privacy (pet vrsta iz
PRODAVNICE dela 6, sve App Functionality, povezano sa osobom, bez praćenja). Build 2 gotov 15. nov. 11:42 UTC.
Ostaje: stranica verzije 1.0 (slike, opis, ključne reči, URL-ovi, build 2, pretplate, App Review Information) i
Review Information pretplata (`review-paywall.png`).
Tekstovi: `docs/PRODAVNICE.md` delovi 2–3 (u dugom opisu „Cancel anytime in your App Store settings.“), ključne reči,
podnaslov. Slike 1290×2796 iz `docs/prodavnica/app-store/` 1–8 (6 i 7 ponovo snimljene 15. nov. sa engleskim
imenima). App Store Connect (nov. 2026) prvo traži „iPhone with Dynamic Island (medium display)“ 1206×2622 ili
1179×2556: iste slike smanjene na 1206×2622 su u `docs/prodavnica/app-store-6.3/`. Za Review Information obe pretplate: `review-paywall.png` (ekran za plaćanje sa oba plana, TestFlight).
App Privacy: deo 6 PRODAVNICE.md (+ Device ID / push token po potrebi). Age Rating: deo 5. Support URL
`https://lockintracker.app/support/`, Privacy Policy URL `https://lockintracker.app/privacy/`, Terms link u opisu.
App Review Information: isti Gmail nalog za recenzente kao na Google Play-u (Apple recenzent sme da koristi nalog koji
mu daš; prijava „Continue with Google“), napomena kao u PRODAVNICE.md deo 9 + da se proba pokreće u Sandbox-u.
20. nov. 2026: taj Gmail je preuzet, napravljen je nov nalog za recenzente (`docs/GOOGLE-PLAY.md` deo 5); novi mejl i
lozinka upisani u Sign-In Information na stranici verzije 1.0 (polja se mogu menjati i dok čeka pregled; poruka
Apple-u nije potrebna).
23. nov. 2026: Apple mejl „Your trader contact information was verified“ (DSA): podaci trgovca su potvrđeni i
vidljivi u App Store-u u EU, pa aplikacija sme da se prodaje i u EU. To nije pregled build-a; verzija 1.0 i dalje
„Waiting for Review“ (poslato 19. nov. u 17:44).
25. nov. 2026: i dalje „Waiting for Review“; Andrija je Apple-u poslao upit o statusu pregleda (Contact Us > App
Review status), bez traženja ubrzanog pregleda, jer aplikacija ionako izlazi tek sa Google Play-om (~11 dana,
posle zatvorenog testiranja).

## 8. Slanje na pregled ✅ poslato 15. nov. 2026 (čeka pregled)
Poslato 15. nov. oko 14:22: „4 Items Submitted“ (iOS App 1.0 build 2, Lock In Monthly, Lock In Annual, grupa Lock In).
Objava je ručna (Manually release): posle odobrenja ništa ne izlazi samo; pre klika na Release proći
`docs/ZASTITA.md` deo 6 (nalog za recenzente i `manual_review` ostaju). Odgovor Apple-a stiže mejlom i u App Review.
**15. nov. 21:07: odbijeno, Guideline 2.1 - Information Needed** (verzija Rejected, pretplate i grupa Ready for
Review). Apple traži u Notes: snimak ekrana sa pravog iPhone-a na najnovijem iOS-u (od pokretanja; registracija,
prijava, brisanje naloga, korisnički sadržaj sa prijavom/blokiranjem, plaćeni deo), svrhu i publiku, uputstvo za
pristup, spoljne servise, razlike po regionima, dozvole za regulisanu delatnost. Odgovor (bez linka do videa):
`docs/prodavnica/app-store-review-notes.txt` (3.147 znakova). Rizik: nemamo blokiranje ni prijavu prijatelja; u
odgovoru piše da ništa nije javno i da se iz cilja može izaći. Ako Apple to ipak traži, dodaje se „Remove friend“.
Postupak (Apple Help, nov. 2026): na stranici verzije više **nema** sekcije „In-App Purchases and Subscriptions“.
Prve pretplate moraju sa novom verzijom, u **isti nacrt slanja**: (1) verzija 1.0 > Save > **Add for Review**
(nacrt; prozor zatvoriti bez slanja); (2) Subscriptions > Lock In Monthly > **Add for Review** > izabrati postojeći
nacrt (ne „Create New Submission“), dodati i grupu Lock In ako ponudi; (3) isto za Lock In Annual; (4) App Review >
nacrt sadrži verziju, grupu i obe pretplate > **Submit for Review**. Status pretplata pre slanja: „Prepare for
Submission“ (spremne). Nivoi: Monthly 1, Annual 2 (predlog za kasnije: isti nivo, jer otključavaju isto).
