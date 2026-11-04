# Materijal za App Store i Google Play

Nacrt (2. nov. 2026). Tekstovi za prodavnice su na engleskom i Andrija ih menja kako hoće. Odgovori na obrasce o
podacima napisani su prema `web/privacy/` i kodu; kad aplikacija počne da radi nešto novo, menjaju se i ovde i u
Privacy Policy.

## 1. Šta fali pre objave (ne može bez Andrije)

| Šta | Zašto |
|---|---|
| ~~Ikonica~~ | Urađeno 2. nov.: Andrijin dizajn „Lock In$“ (`docs/dizajn/ikonica/ikonica-izvor.jpg`, 1024×1024). Iz njega: `icon.png` (bez providnosti), Android prednji sloj (samo tekst, smanjen da stane u krug), pozadina `#060c08`, jednobojna verzija i splash (samo tekst). Za Google Play ikonicu 512×512 smanji `icon.png`. Vidi se tek u novom build-u (Expo Go pokazuje svoju). Andrija proverio ikonicu i splash na Android-u (3. nov.). |
| ~~iPad~~ | Andrija (2. nov.): samo telefon, `ios.supportsTablet: false`. Slike za iPad ne trebaju. |
| **Slike ekrana** | Prave slike sa telefona u demo režimu (Settings > Help > Demo), vidi 4. |
| ~~Stranica za brisanje naloga~~ | Urađeno 2. nov.: `https://lockintracker.app/delete-account/` (`web/delete-account/`): u aplikaciji, bez aplikacije mejlom na support (rok 30 dana), šta se briše, a šta ne. Ta adresa ide u Google Play > Data safety > „Delete account URL“. |

## 2. Ime i kratki tekstovi

Ime u obe prodavnice ima najviše **30 znakova**, pa „Lock In - Finance Tracker & Budgeting“ (36) ne može ceo.

| Polje | Ograničenje | Predlog |
|---|---|---|
| Ime (oba) | 30 | **`Lock In: Finance Tracker`** (24), Andrija potvrdio 2. nov. |
| Apple podnaslov | 30 | `Budgeting that roasts you` (25) |
| Google kratak opis | 80 | `Track spending, keep your streak, save with friends. Gets roasted when you slip.` (80) |
| Apple ključne reči | 100, zarezi bez razmaka | `budget,budgeting,expense,spending,money,savings,streak,roast,envelope,goal,bills,tracker` (88) |
| Kategorija | | Finance (Apple i Google) |

Ime aplikacije na telefonu ispod ikonice ostaje `Lock In` (`app.json` → `name`).

## 3. Dug opis (oba, do 4000 znakova)

```
Lock In is the spending tracker that tells you the truth.

Log what you spend in a few taps. Lock In keeps your balance, your streak and your goals in one place, and it
roasts you when you blow money you don't have. Pick how hard: Gentle, Normal or No mercy.

TRACK
• Log spending and income in seconds, with categories and a note
• See what's really available after your envelopes
• "Can I afford it?" before you buy
• Limits per category, recurring entries and subscriptions you track

KEEP THE STREAK
• Every day you log counts. Miss one and the flame goes out
• Flame levels from Orange to Legendary at 365 days
• A new challenge every week

SEE WHERE IT GOES
• Top categories, the last 30 days and a calendar of your month
• "We noticed": patterns in how you spend
• A monthly report with a grade from A to F

SAVE
• Envelopes and savings goals with a due date and how much to put in per day, week or month
• Shared goals with friends: everyone puts in, everyone sees the progress, nudge whoever is slacking

PRIVATE BY DESIGN
• No bank login. No spreadsheets
• Your amounts, descriptions and categories stay on your phone
• An account is only needed for shared goals with friends
• No ads, no tracking, we don't sell your data

7-day free trial, then a subscription or a one-time purchase.

Privacy Policy: https://lockintracker.app/privacy/
Terms of Use: https://lockintracker.app/terms/
```

Apple uz pretplatu traži i link na Terms (EULA) u opisu ili u polju za EULA; zato su oba linka na kraju.

## 4. Slike ekrana

Snimaju se na telefonu u **demo režimu** (popunjeni izmišljeni podaci, ništa lično), tamna tema.

| Prodavnica | Veličina | Koliko |
|---|---|---|
| App Store, iPhone 6.9" | 1320×2868 ili 1290×2796 (iPhone 15/16 Pro Max, uspravno) | 3–10 (Apple sam smanji za manje ekrane) |
| Google Play, telefon | najmanje 1080 px po kraćoj strani, odnos do 9:16 (npr. 1080×1920 ili 1080×2400) | 2–8 (za isticanje u prodavnici bar 4) |
| Google Play, feature graphic | 1024×500 | 1 (obavezno) |

Predlog redosleda (prva tri se vide bez otvaranja): 1 Home sa plamenom i porukom posle troška, 2 holo prsten,
3 zajednički cilj sa katancem, 4 koverte u fioci, 5 izveštaj meseca, 6 ekran sa likom („Then lock the fuck in.“).
Natpisi preko slika (ako ih bude) su posebna odluka; bez njih je dozvoljeno.

**Google Play, urađeno (4. nov. 2026):** 8 slika u `docs/prodavnica/google-play/`, Andrija ih je odobrio: 1-home,
2-roast (slajd „Roasts“ sa No mercy forom, slikan na telefonu), 3-charts, 4-transactions, 5-envelope,
6-shared-goals, 7-goal, 8-who-put-in. Isečene sa Andrijinog Redmi-ja (bez statusne trake, DEMO trake i Android
dugmića; razmera ≤ 2:1). Široke su 907 px, jer su stigle smanjene kroz čat: Google ih prima, ali za isticanje u
prodavnici traži bar 1080 px. Ako Andrija pošalje originale kao fajlove, iseći isto
(`jimp-compact` iz `mobile/node_modules`; cela širina, visina od–do na slikama 907×2000: home 218–1590, roast
250–1600, charts 218–1738, transactions 218–1730, envelope 218–1738, shared-goals 218–1700, goal 105–1715,
who-put-in 190–1490; za veće originale pomnožiti srazmerno). Feature graphic 1024×500 i slike za
iPhone (App Store) još ne postoje.

## 5. Uzrast

Na uvodu svako vidi „Then lock the fuck in.“, a „No mercy“ poruke imaju jače reči. Zato:
- **Apple** (upitnik o uzrastu): Profanity or Crude Humor: **Infrequent/Mild**; sve ostalo None. Rezultat je
  verovatno 13+.
- **Google** (IARC upitnik): da, aplikacija ima psovke („mild/moderate profanity“), bez nasilja, kocke i sl.
  Rezultat je verovatno PEGI 12 / Teen.
- Kategorija Finance + „Made for kids“: **ne**. Ciljna grupa u Google Play-u: 18+ (ili 13+ ako tako ostane u Privacy Policy).

## 6. Apple „App Privacy“

Podaci koji ostaju samo na telefonu (iznosi, opisi, kategorije, godine, podsetnici) se **ne prijavljuju**: Apple
broji samo ono što napušta telefon. Ništa se ne koristi za praćenje (**Tracking: No**), nema reklama ni analitike.

| Vrsta (Apple) | Šta je kod nas | Povezano sa osobom | Svrha |
|---|---|---|---|
| Contact Info > Email Address | mejl naloga, mejl pozvanog prijatelja | da | App Functionality |
| Contact Info > Name | ime koje prijatelji vide (display name) | da | App Functionality |
| User Content > Other User Content | zajednički ciljevi, uplate u njih, napomene, nudge | da | App Functionality |
| Identifiers > User ID | ID naloga (Supabase, RevenueCat) | da | App Functionality |
| Purchases > Purchase History | proba / pretplata i proizvod | da | App Functionality |

Ne prijavljuje se: lokacija, kontakti, zdravlje, pretraga, dijagnostika (nema prijave grešaka). Push token Apple
ne svrstava u Device ID kad služi samo za obaveštenja.

## 7. Google Play „Data safety“

- Prikuplja li aplikacija podatke: **da**. Deli li ih sa trećima: **ne** (Supabase, Resend, RevenueCat, Expo i
  Cloudflare rade za nas, to Google ne broji kao deljenje).
- Šifrovano u prenosu: **da** (HTTPS). Korisnik može da traži brisanje: **da** (u aplikaciji i na adresi iz 1).
- Nalog nije obavezan za praćenje troškova, ali jeste za probu/pretplatu preko servera i zajedničke ciljeve.

| Vrsta (Google) | Obavezno ili po izboru | Svrha |
|---|---|---|
| Personal info > Email address | obavezno za nalog | Account management, App functionality |
| Personal info > Name | po izboru (display name) | App functionality |
| Personal info > User IDs | obavezno za nalog | Account management |
| Financial info > Purchase history | obavezno za nalog | App functionality |
| Financial info > Other financial info | po izboru (iznosi uplata u zajednički cilj) | App functionality |
| App activity > Other user-generated content | po izboru (nazivi ciljeva, napomene, nudge) | App functionality |

Lična potrošnja („Financial info“ sa telefona) se ne prijavljuje jer ne napušta telefon.

## 8. Ostalo što obrasci pitaju

- Podrška: `https://lockintracker.app/support/`, mejl `support@lockintracker.app`.
- Privacy Policy: `https://lockintracker.app/privacy/`.
- Apple „Sign-in required for review“: recenzent mora da proba zajednički cilj, pa mu treba nalog. Prijava je kod
  na mejl, pa se pred slanje pravi poseban nalog za recenzenta sa mejlom kojem Andrija ima pristup i u napomeni
  za recenzenta piše da kod pošalje na support. Alternativa: objasniti da se cilj vidi u demo režimu
  (Settings > Help > Demo).
- Export compliance (Apple): aplikacija koristi samo standardno šifrovanje (HTTPS, AES za sesiju na telefonu) →
  „uses exempt encryption“; u `app.json` se dodaje `ios.config.usesNonExemptEncryption: false`.
