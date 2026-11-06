# Beleške za nastavak rada (pročitaj prvo ovo)

Poslednja sesija: 6. novembar 2026.

## Ko i kako
- Igru pravi korisnik koji **nije Andrija** (Andrija je ranije radio Lock In). Korisnik je **početnik**: objašnjavati jednostavno, na srpskom, korak po korak, bez stručnih reči.
- Dogovor: igra se pravi **isključivo u React Native-u** (Expo), ne u Unity-ju.
- Korisnik šalje velike "master" promptove na engleskom; prepričati mu ih i potvrditi pre velikih promena.

## Pravila za repo
- **Ne dirati granu `main`** (javni link Lock In aplikacije za testere). Vidi `../CLAUDE.md`.
- Rad ide na granu `claude/vigilant-lamport-zvdl89`, sve u folderu `game/`. Ostatak Lock In-a se ne dira.
- Po `../CLAUDE.md` nove izmene kasnije treba da idu na granu `razvoj`; spajanje u `main` samo uz Sergejevu dozvolu.

## Tehnika
- Expo SDK 58, React Native 0.88, three.js 0.187, expo-gl, expo-linear-gradient, font Lilita One.
- `npx expo install` mora sa `EXPO_OFFLINE=1` (api.expo.dev je blokiran u oblaku).
- Probni link za telefon (claude.ai artifact, privatan): **https://claude.ai/artifact/3iVawUeEaacrDAtrDTzZXS**
  - pravi se sa `npm run build:link`, pa se `dist/zombie-rush-3d.html` objavi na isti link
    (u prethodnoj sesiji fajl je kopiran u scratchpad kao `army-rush-3d.html` i objavljen; nova sesija treba da
    objavi sa `url` ovog artifacta da bi link ostao isti).
- Provera težine: `scripts/sim-bot.cjs` (automatski igrač u pregledaču, Playwright je već instaliran).

## Istorija
1. **Army Rush 3D** – vojska trči, kapije (+10, ×2, ÷2...), borba sa crvenom vojskom. (commit 93eeb1d)
2. Nova grafika, pa "AAA" grafika: senke, efekti, animacije, vojni predmeti. (c65e8a2 – poslednja Army Rush verzija)
3. **Zombie Rush 3D** (trenutno): korisnik je tražio potpuno novu igru sa dve trake. (a000b8e)
4. Korisnik: "prelako" → igra otežana. (2452763)

## Trenutno stanje (Zombie Rush 3D)
- Leva traka: talasi zombija (walker, runner, brute, mutant). Desna traka: kocke sa nagradama.
- Vojnici sami pucaju; traka se menja prevlačenjem ili dodirom leve/desne strane ekrana.
- 7 oružja (pištolj → plazma top), 5 okruženja, šef u areni na kraju nivoa.
- Posle otežavanja automatski igrač pobeđuje nivoe 1, 3, 4, a gubi 2, 5, 6, 7, 8.
- **Čeka se odgovor korisnika** da li je težina sada dobra (poslednja poruka: "Zapamti sve, radićemo sutra dalje").

## Šta nije urađeno / mogući sledeći koraci
- Igra **nije isprobana na pravom telefonu** niti kroz Expo Go (samo web verzija preko linka).
- Novčići i napredak se **ne čuvaju** kad se igra zatvori; nema prodavnice (u planu: trajne nadogradnje, oružja, izgledi).
- Nema zvuka ni vibracije.
- Na težim nivoima igra daje veću početnu vojsku i bolje oružje (privremeno, umesto prodavnice) – `levelGen.js`.
- Fino podešavanje težine po korisnikovom osećaju (zombiji / kocke / šef) – vrednosti su u
  `zombies.js` (ZTYPES), `cubes.js` (CUBE_TYPES), `levelGen.js` (talasi, šef), `weapons.js`.
