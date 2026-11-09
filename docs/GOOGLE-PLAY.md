# Google Play: od naloga do produkcije

Vodič korak po korak (6. nov. 2026). Tekstovi za prodavnicu i odgovori na obrasce su u `docs/PRODAVNICE.md`,
RevenueCat u `docs/ZASTITA.md` 3.6, šta se sklanja pre objave u `docs/ZASTITA.md` deo 6.

**Pravilo:** broj kartice, lični dokument, lozinke, podatke banke, poreske podatke i sve tajne ključeve (service
account JSON, webhook secret, RevenueCat `sk_…`) Andrija unosi sam, direktno u Google / RevenueCat / Supabase.
Ne šalju se u čat. Javni RevenueCat ključ `goog_…` nije tajna.

Stanje: ✅ urađeno, ⬜ čeka.

## 1. Registracija naloga (play.google.com/console/signup) ⬜

Pre početka: Google nalog na koji se otvara Play Console treba da bude onaj koji zadržavaš zauvek (prenos aplikacije
na drugi nalog je spor), sa uključenom prijavom u dva koraka (2-Step Verification; Play Console je traži).

1. **Tip naloga: „Yourself“ (lični).** Odluka od 4. nov.: kućna adresa će biti javna (prodaješ pretplate) i pre
   produkcije ide zatvoreno testiranje 12 testera / 14 dana.
2. **Developer name** (javno, ispod imena aplikacije): može kasnije da se promeni. Predlog: ime brenda (npr.
   „Lock In Apps“), jer tvoje pravo ime i adresa ionako stoje u podacima prodavca. Izbor je tvoj. Ne sme da liči na
   tuđu firmu ili brend.
3. **Pravno ime i adresa:** tačno kao na ličnoj karti / pasošu i u Google payments profilu (latinicom, isti redosled).
   Ako se ne poklapa, provera identiteta pada.
4. **Contact email i phone** (samo za Google, nije javno): potvrđuju se kodom (mejl i SMS).
   „Kako planirate da zarađujete“: **Kupovine u aplikaciji** i **Prijave** (loš prevod za Subscriptions); posle
   izbacivanja doživotne kupovine dovoljne su samo Prijave. Sajt: `https://lockintracker.app`. Nalog je otvoren na
   `lockeddevsapps@gmail.com`.
5. **Developer email** (javno u prodavnici): `support@lockintracker.app` (Cloudflare Email Routing ga šalje na tvoj
   mejl, pa kod za potvrdu stiže tamo). Telefon se ne prikazuje javno osim ako ga sam ne staviš.
6. Pitanja o iskustvu i planovima: iskreno; „Will you earn money?“ → **Yes** (pretplate).
7. **Plaćanje $25:** unosiš karticu sam, u Google-ov prozor. Jednom i zauvek.
8. **Provera identiteta:** otpremaš sliku lične karte (obe strane) ili pasoša. Traje od par sati do nekoliko dana;
   stiže mejl.
9. **Provera Android uređaja:** na Honor-u instaliraj aplikaciju **Google Play Console** iz Play prodavnice i prijavi se
   istim Google nalogom; ona sama potvrdi uređaj. Ako traži i potvrdu telefona, to je SMS kod.
10. Posle provere: **Setup > Payments profile / Monetization setup:** napravi merchant (prodavački) nalog. Tu unosiš
    sam: račun u banci za isplate i poreske podatke (za SAD obrazac **W-8BEN**, jer nisi iz SAD-a; pitanja o porezu
    su za knjigovođu, ne za mene). Bez merchant naloga ne mogu da se prave pretplate.

Srbija je podržana za prodavce na Google Play-u (od 2019).

## 2. Nova aplikacija u Play Console-u ⬜

All apps > **Create app**:

| Polje | Šta ide |
|---|---|
| App name | `Lock In: Finance Tracker` |
| Default language | English (United States) – en-US |
| App or game | App |
| Free or paid | **Free** |
| Declarations | Developer Program Policies i US export laws: čekiraj (pročitaj) |

**Zašto „Free“:** to polje je cena *preuzimanja*. „Paid“ znači da korisnik plati pre instalacije i nema besplatne
nedelje. Pretplata sa 7 dana probe je „Free“ aplikacija sa kupovinom u aplikaciji. Iz „Free“ se kasnije ne može u
„Paid“ i obrnuto, pa ovo mora odmah tačno. Reklama nema (formular Ads: **No**, korak 5).

Naziv paketa: Play Console ga sad traži odmah pri pravljenju (9. nov. 2026): **`com.lockintracker.app`**, isti kao
u AAB-u. Posle se ne menja.

## 3. Production build (AAB) ✅ gotov 6. nov.

**AAB za Internal testing (versionCode 4):**
https://expo.dev/artifacts/eas/fbyzLqi4Jkf1TVeBoZBpcEyDaMrtXULwBaUkvzCWk5Y.aab
(build `33adc8e6-20af-4e63-b224-350d42e524ca`). Provereno u fajlu: paket `com.lockintracker.app`, kanal
`production`, dozvola `com.android.vending.BILLING` (Play dozvoljava proizvode), push (Firebase `lock-in-513222`,
`POST_NOTIFICATIONS`), nema `AD_ID`, samo `arm64-v8a`.

**Zašto su versionCode 2 i 3 pali:** Gradle ubijen bez memorije usred C++ build-a Skia-e. Preview (`assembleRelease`)
prvo kompajlira C++, pa Kotlin i R8; production (`bundleRelease`) obrnuto, pa C++ krene dok Gradle i Kotlin
već drže memoriju. Popravka: `gradleCommand: ":app:mergeReleaseNativeLibs :app:bundleRelease"` (prvo C++, kao
preview). Izmereno iz logova build-ova, ne nagađano.

- `mobile/eas.json`, profil `production`: kanal `production`, `app-bundle`, `autoIncrement` (versionCode vodi EAS,
  `cli.appVersionSource: remote`), Gradle jedan po jedan kao kod preview-a, i samo arhitektura **`arm64-v8a`**.
  Isto kao preview. Posledica (moj izbor): aplikacija se ne nudi starim 32-bitnim telefonima (samo `armeabi-v7a`,
  danas retki, uglavnom jeftini Android Go); svi telefoni na kojima je testirano su 64-bitni. Može se probati i
  `armeabi-v7a` sad kad C++ ide prvi, ali nije provereno da staje u memoriju.
- EAS promenljive za `production`: Supabase URL (pravi projekat `jezdcanghhdnwnnnntzh`), publishable ključ,
  Turnstile site key (pravi, ne test `1x000…`), `GOOGLE_SERVICES_JSON`. Proverio 6. nov.
- **RevenueCat ključa još nema**, jer RevenueCat traži da aplikacija i proizvodi već postoje na Play-u. Zato ovaj prvi
  AAB služi za interno testiranje i za otključavanje pravljenja proizvoda (Play dozvoljava pretplate tek kad je
  otpremljen build sa Play Billing bibliotekom). U njemu niko nije zaključan, a ekran za plaćanje kaže da prodavnica
  još nije povezana. Posle koraka 7 ide drugi production build sa ključem (korak 7.6).
- `version` u `app.json` ostaje 1.0.0: na kanal `production` još nikad nije poslato ažuriranje, pa nema sudara.
- Komanda (iz `mobile/`): `npx eas-cli build --profile production --platform android --non-interactive --no-wait`.
  AAB se preuzima sa stranice build-a na expo.dev (dugme Download).

## 4. Interno testiranje ⬜

1. Testing > **Internal testing** > Create new release.
2. **Play App Signing:** ostavi „Use Google-generated key“ (podrazumevano). Google čuva ključ kojim se aplikacija
   potpisuje za korisnike; ključ sa EAS-a postaje samo „upload key“. Ništa se ne preuzima ni ne lepi.
3. Otpremi `.aab` sa expo.dev. Release name ostavi kako ponudi (1.0.0 (4)). Release notes: npr. `First internal build.`
4. Tab **Testers** > Create email list (tvoj Gmail i kolegin) > Save. Kopiraj **opt-in link**.
5. **Settings > License testing** (u celom nalogu, ne u aplikaciji): dodaj iste Gmail adrese. Tim nalozima su kupovine
   probne (bez naplate, besplatna nedelja traje par minuta, mesečna se obnavlja na 5 min).
6. **Na Honor-u pre instalacije sa Play-a:** preview APK i verzija sa Play-a imaju isti paket, a različit potpis, pa
   Play ne može da instalira preko. Prvo More > Backup > izvezi (lični podaci su samo na telefonu), pa deinstaliraj
   preview APK, pa otvori opt-in link > Become a tester > instaliraj sa Play-a, pa uvezi rezervnu kopiju.
   Preview APK i ažuriranja na kanal `preview` posle toga rade samo na telefonu koji ga i dalje ima.

## 5. Stranica u prodavnici i obrasci ⬜

Sve vrednosti su u `docs/PRODAVNICE.md` deo 9 (tabela „Main store listing“ i „Obrasci“), deo 2 i 3 (tekstovi),
deo 5 (uzrast), deo 7 (Data safety). Fajlovi: `docs/prodavnica/google-play/` (`icon-512.png`,
`feature-graphic.png`, `1-home.png` … `8-who-put-in.png`).

Dopune uz PRODAVNICE.md:
- **Data safety:** dodaj i **Device or other IDs** (po izboru, App functionality): push token telefona ide na server
  kad korisnik uključi obaveštenja iz cilja (tako piše i u Privacy Policy). Strožije je bezbednije od
  nepotpunog: Google odbija aplikaciju kad se prijava ne slaže sa onim što radi.
- **Advertising ID:** No (aplikacija ga ne koristi). Ako Play posle otpremanja javi da manifest ima `AD_ID`, javi mi.
- **Financial features:** aplikacija ne nudi nijednu od navedenih stvari (banka, krediti, plaćanja, ulaganja,
  kripto), pa „My app doesn't provide any financial features“.
- **Target audience:** 18+. **Content rating** (IARC): blage psovke, ostalo ne.
- **App access:** tekst iz dela 9 PRODAVNICE.md. Radi tek kad je Google OAuth „In production“ (korak 8.1).
- Kategorija: Finance; kontakt: `support@lockintracker.app`, `https://lockintracker.app`.

## 6. Proizvodi ⬜ (cene: Andrija i kolega)

Pravi se posle otpremanja prvog AAB-a i merchant naloga. Monetize > Products:

| Šta | Product ID | Plan i ponuda |
|---|---|---|
| Mesečna pretplata | `lockin_monthly` | base plan `monthly`: Auto-renewing, 1 month; ponuda `free-week`: Free trial 7 days, Eligibility „New customer acquisition“ > **Never had any subscription** |
| Godišnja pretplata | `lockin_annual` | base plan `annual`: Auto-renewing, 1 year; ista ponuda `free-week` |

Doživotne kupovine nema (Andrija, 6. nov. 2026: „izbacivaću doživotnu kupovinu“). Ekran za plaćanje prikazuje samo
pakete iz RevenueCat ponude, pa se bez paketa Lifetime sam svede na mesečnu i godišnju; kod za to ne treba menjati.

- Product ID-jevi su trajni (ne mogu da se obrišu ni ponovo iskoriste); aplikacija ih ne čita direktno (čita
  RevenueCat pakete), pa su ovi samo predlog imena.
- „Never had any subscription“ znači: ko je jednom imao probu mesečne, nema novu probu ni na godišnjoj.
- Cena se upisuje u USD, a Google sam preračuna za ostale zemlje. **Konačne cene (Andrija, 6. nov.): mesečna
  $4.99, godišnja $29.99; u zemljama sa evrom ručno €4.99 i €29.99.**
- Base plan i ponuda moraju biti **Activated**.

## 7. RevenueCat ⬜

1. revenuecat.com > nalog > Project „Lock In“ > **Apps > + Google Play**: package `com.lockintracker.app`.
2. **Service account (Play ↔ RevenueCat)**, radiš sam po RevenueCat-ovom uputstvu „Google Play Store service
   credentials“: Google Cloud projekat „Lock In“ > uključi *Google Play Android Developer API* i *Google Play Developer
   Reporting API* > napravi service account > Keys > JSON. Play Console > **Users and permissions** > Invite: mejl tog
   service account-a, dozvole *View app information*, *View financial data*, *Manage orders and subscriptions*.
   JSON otpremi sam u RevenueCat, pa ga obriši sa računara. Google ga aktivira do 36 h (do tad RevenueCat javlja
   grešku „credentials“: to je normalno).
3. **Real-time developer notifications:** RevenueCat > Google app > Connect to Google (napravi Pub/Sub topic) >
   kopiraj ime topic-a u Play Console > Monetization setup > Real-time developer notifications > Send test
   notification.
4. RevenueCat > Product catalog: uvezi dve pretplate, entitlement **`access`** (obe zakačene), ponuda **`default`**
   (Current) sa paketima Monthly / Annual (bez Lifetime) (`docs/ZASTITA.md` 3.6, korak 0 i 7).
5. Webhook i `sync-store-access`: `docs/ZASTITA.md` 3.6 koraci 1–6 (tajne unosiš sam u RevenueCat i Supabase).
6. Javni ključ: RevenueCat > API keys > `goog_…` → EAS promenljiva (plaintext, nije tajna), iz `mobile/`:
   `npx eas-cli env:create --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value goog_... --visibility plaintext
   --environment production --environment preview --environment development`. Možeš i da mi ga pošalješ, pa to
   uradim ja. Zatim novi production build (sledeći versionCode) → Internal testing.
7. **Probna kupovina na Honor-u** (nalog iz License testing): Start my free week → „You're locked in.“; u Supabase
   SQL-u red u `public.subscriptions` (webhook); otkaži u Play-u; Restore; prijava kodom i `sync-store-access`.
   Na ekranu za plaćanje ne sme da piše „TEST PRICES“.

## 8. Zatvoreno testiranje i produkcija ⬜

1. Pre zatvorenog testiranja (testeri i recenzenti se prijavljuju Google-om): `docs/ZASTITA.md` deo 6, bar tačke 3
   (probni nalozi i `manual_test`, osim ako još testiraš), 6 (Google OAuth **In production**), 8, 13. Tačke 1–2
   (Expo Go adrese) tek kad više ne testiraš u Expo Go-u na iPhone-u, jer bez njih prijava u Expo Go-u ne radi.
2. Testing > **Closed testing** > Create track > promoviši release iz Internal testing-a > Countries: sve.
3. Testeri: najmanje **12** (bolje 15–20, jer neko odustane), najlakše preko Google Group-e. Svi moraju da kliknu
   opt-in link, instaliraju sa Play-a i **stvarno koriste** aplikaciju; Google broji samo one koji su prijavljeni
   (opted-in) **14 dana zaredom**. Interno testiranje se ne računa.
4. Sve testere dodaj i u **License testing**, da niko ne plati pravim novcem posle besplatne nedelje.
5. Posle 14 dana: Dashboard > **Apply for production**: upitnik (kako si našao testere, šta su javili, šta si
   promenio). Odgovor stiže za par dana.
6. Production > Create release (isti AAB) > Countries > slanje na pregled. Na kanal OTA `production` ništa bez
   Andrijine dozvole.
