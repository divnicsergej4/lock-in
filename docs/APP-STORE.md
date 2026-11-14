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
Odluke (13. nov. 2026): dostupno u svim zemljama osim Kosova (Andrija); cene u evrima ostaju kako Apple sam
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

## 6. iOS build i TestFlight ⬜
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
dozvolu: ažuriranje `b4442b13` na kanal `production` (iOS i Android), 15. nov.
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

## 7. Stranica u prodavnici i obrasci ⬜
Tekstovi: `docs/PRODAVNICE.md` delovi 2–3 (u dugom opisu „Cancel anytime in your App Store settings.“), ključne reči,
podnaslov. Slike 1290×2796 iz `docs/prodavnica/app-store/` (6 i 7 ponovo snimiti, imaju stara imena).
App Privacy: deo 6 PRODAVNICE.md (+ Device ID / push token po potrebi). Age Rating: deo 5. Support URL
`https://lockintracker.app/support/`, Privacy Policy URL `https://lockintracker.app/privacy/`, Terms link u opisu.
App Review Information: isti Gmail nalog za recenzente kao na Google Play-u (Apple recenzent sme da koristi nalog koji
mu daš; prijava „Continue with Google“), napomena kao u PRODAVNICE.md deo 9 + da se proba pokreće u Sandbox-u.

## 8. Slanje na pregled ⬜
