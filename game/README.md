# ZOMBIE RUSH 3D

3D zombi pucačina za telefon (React Native + Expo + three.js).

## Kako se igra

- Junak **stoji** na dnu puta i pomera se **samo levo-desno** (prevlačenjem prsta).
- **Dok držiš prst, junak puca** napred; puška sama malo skrene ka zombiju ispred junaka.
  Kad ispred nema ničega, ne troši municiju.
- **Na računaru (tastatura):** **A** ili **←** = levo, **D** ili **→** = desno (dok držiš taster, junak i puca),
  **razmak (Space)** = pucanje u mestu.
- **Leva strana: zombiji.** Dolaze spreda iz magle i iz bočnih ulica; kad su blizu (ili kad si na drugoj
  strani), presecaju ka junaku i napadaju. Od 3. nivoa neki dolaze i sa desne strane.
- **Desna strana: polja napredovanja** klize ka junaku. Staneš ispod polja da ga pokupiš.
  - Brojna polja (+municija, +zdravlje, +zlatnici): svaki pogodak povećava broj za 1 (i minus može da postane plus).
  - Specijalna polja su **zaključana** dok ih ne napuniš pucanjem: ×2/×3 metaka, ×2/×3 šteta,
    vatreni metci, novo oružje, +30% brzina paljbe.
- Municija se troši, pa moraš povremeno na desnu stranu po municiju, a tada zombiji prilaze.
- Na svakom 3. nivou na kraju dolazi **šef**: Gigant (baca kamenje, udara o zemlju) ili Kraljica mutanata
  (pljuje kiselinu, skače, doziva trkače). Gde će napad pasti vidi se unapred (krug na zemlji).

## Šta igra ima

- **Zombiji:** običan, trkač, grmalj (krupan), naduvenko (eksplodira i truje okolinu) + 2 šefa.
- **Oružja:** pištolj, sačmarica, jurišna puška, minigan, bacač granata (svako drugačije izgleda i puca).
- **Okruženja:** napuštene ulice, razoreni grad (noć, požari), mračna šuma (noć, magla, mesec).
- **Prodavnica (oružarnica):** trajne nadogradnje (šteta, brzina paljbe, municija, zdravlje) i kupovina oružja.
- **Zlatnici:** za ubijene zombije, pređene nivoe, polja sa zlatnicima i dnevnu nagradu.
- **Dnevne nagrade:** 7 dana zaredom, sve veće; propušten dan kreće ispočetka.
- **Meniji:** početni ekran, glavni meni, podešavanja (zvuk, muzika, uputstvo), pauza, poraz (oživljavanje
  za zlatnike), pobeda (zvezdice, nagrada).
- **Zvuk i muzika:** 34 efekta i 3 muzičke teme, napravljeni sintezom (bez gotovih snimaka).
- **Čuvanje napretka:** zlatnici, nivo, zvezdice, nadogradnje, oružja, dnevne nagrade, podešavanja.

## Struktura

- `App.js` – ulaz u aplikaciju
- `src/ui/` – ekrani: `GameScreen.js` (glavni tok i čuvanje), `MainMenu.js`, `ShopScreen.js`, `HUD.js`,
  `Modals.js` (dnevna nagrada, podešavanja, pauza), `ResultScreens.js` (pobeda, poraz), `components.js`
- `src/game/Game.js` – mozak igre (petlja, pucanje, pogoci, talasi, polja, šef, kamera, svetla)
- `src/game/core/` – podešavanja (`config.js`), slučajni brojevi, kvalitet grafike
- `src/game/world/` – nivoi (`levels.js`), okruženja (`themes.js`), scena (`World.js`, `buildings.js`), nebo i tlo
- `src/game/actors/` – junak (`Hero.js`), zombiji (`zombies.js`), šefovi (`bosses.js`)
- `src/game/combat/` – oružja, meci, polja napredovanja, brojevi štete
- `src/game/fx/` – efekti (eksplozije, dim, vatra, krv, čaure...) i teksture napravljene kodom
- `src/game/gfx/` – 3D modeli napravljeni kodom i 3D slova
- `src/audio/` – sinteza zvuka (`synth.js`), pokretač za web i za telefon
- `src/state/` – čuvanje (`save.js`) i napredak/prodavnica/dnevne nagrade (`progression.js`)

## Komande (iz foldera `game/`)

- `npm install` – instalira pakete
- `npm start` – pokreće igru za Expo Go (telefon)
- `npm run build:link` – pravi jedan HTML fajl sa celom igrom (`dist/zombie-rush-3d.html`) za probu preko linka
- `node scripts/sim-bot.cjs 1,2,3` – automatski igrač igra nivoe i ispisuje rezultate (posle `build:link`)
- `node scripts/make-sounds.mjs` – ponovo pravi WAV zvukove za telefon (posle izmene `src/audio/synth.js`)
- `node scripts/make-font.mjs` – ponovo pravi 3D slova iz fonta Lilita One

## Napomene

- Font **Lilita One** (SIL Open Font License).
- Ako telefon ne stiže 60 slika u sekundi, igra sama isključi senke i smanji efekte (`src/game/core/quality.js`).
- Starije verzije (Army Rush 3D, igra sa dve trake) su sačuvane u git istoriji.
