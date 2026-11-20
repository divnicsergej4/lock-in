# Beleške za nastavak rada (pročitaj prvo ovo)

Poslednja sesija: 20. novembar 2026.

## Ko i kako
- Igru pravi korisnik koji **nije Andrija** (Andrija je ranije radio Lock In). Korisnik je **početnik**: objašnjavati jednostavno, na srpskom, korak po korak.
- Igra se pravi **isključivo u React Native-u** (Expo), ne u Unity-ju.
- Korisnik šalje velike promptove na engleskom i traži da se urade **tačno kako piše** ("nema zajebancije"). Kad nešto ne može tačno, reći mu unapred.
- Korisnik je razjasnio glavnu ideju: **junak stoji i puca, pomera se samo levo-desno; na jednoj strani zombiji, na drugoj polja napredovanja.** (Zato junak ne trči napred, iako je prvi prompt to tražio.)

## Pravila za repo
- **Ne dirati granu `main`** (javni link Lock In aplikacije za testere). Vidi `../CLAUDE.md`.
- Rad ide na granu `claude/vigilant-lamport-zvdl89`, sve u folderu `game/`.
- Po `../CLAUDE.md` nove izmene kasnije treba da idu na granu `razvoj`; spajanje u `main` samo uz Sergejevu dozvolu.

## Tehnika
- Expo SDK 58, React Native 0.88, three.js 0.187, expo-gl, expo-audio, AsyncStorage, expo-linear-gradient, font Lilita One.
- `npx expo install` mora sa `EXPO_OFFLINE=1` (api.expo.dev je blokiran u oblaku).
- Probni link (claude.ai artifact, privatan): **https://claude.ai/artifact/3iVawUeEaacrDAtrDTzZXS**
  - pravi se sa `npm run build:link`, pa se `dist/zombie-rush-3d.html` objavi na isti link (Artifact `url` ovog linka).
- Provera težine: `node scripts/sim-bot.cjs 1,2,3` (Playwright je već instaliran u oblaku).
- Za telefon se uspešno sklapa (`npx expo export --platform android --platform ios`), ali **nije isproban na pravom telefonu**.

## Istorija
1. Army Rush 3D (vojska kroz kapije) → nova grafika → "AAA" grafika (c65e8a2)
2. Zombie Rush 3D sa dve trake i vojskom koja trči (a000b8e, 2452763)
3. **Novi Zombie Rush 3D** po velikom promptu + pojašnjenju (9ee290c jezgro, c527cdb meniji/zvuk/čuvanje, pa doterivanje)

## Trenutno stanje
- Sve stavke iz prompta su urađene (vidi README): pucanje, zombiji sa svih strana, polja (×2 metaka, +municija, ×3 šteta, vatreni metci, novo oružje...), talasi, šefovi, 5 oružja, nadogradnje, zlatnici, dnevne nagrade, 3 okruženja, meniji (glavni, pauza, poraz, pobeda), zvuk i muzika, dodir, čuvanje napretka.
- Težina (automatski igrač): nivoi 1–2 su uvod; od 3. nivoa bez nadogradnji se gubi, sa nadogradnjama se prelazi, ali ne uvek.

## Mogući sledeći koraci
- Isprobati na pravom telefonu (Expo Go) i podesiti brzinu/težinu po osećaju korisnika.
- Više vrsta zombija ili šefova, novi izgledi junaka, vibracija.
