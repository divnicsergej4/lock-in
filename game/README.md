# ZOMBIE RUSH 3D

3D igrica za telefon (React Native + Expo + three.js).

## Kako se igra

- Put ima **dve trake** sa zidom između.
  - **Leva traka:** talasi zombija (obični, brzi, krupni, mutanti) jurišaju na vojsku.
  - **Desna traka:** kocke sa nagradama. Vojnici ih gađaju, a kad kocka pukne, dobijaš nagradu
    (+5/+10/+20 vojnika, šteta +10%, brzina paljbe +15%, brzina napada +20%, dupla šteta, novo oružje).
    Ako vojska udari u kocku koja nije razbijena, gubi vojnike.
- Vojnici **sami pucaju** na najbližu metu (zombiji koji su blizu imaju prednost, pa i iz druge trake).
- Traka se menja **prevlačenjem prsta** ili **kratkim dodirom** leve/desne strane ekrana.
- Zombiji koji stignu do vojske ubijaju vojnike; krupni se zakače i udaraju dok ne umru.
- Usput: prepreke sa šiljcima, eksplozivna buradi (pucanjem ubijaju zombije oko sebe), novčići.
- Na kraju nivoa je **arena sa šefom** koji doziva nove zombije.

## Oružja

Pištolj → Jurišna puška → Sačmarica → Minigan → Teški mitraljez → Raketaš → Plazma top.
Svako ima drugačiji izgled, metke, štetu, brzinu i domet (`src/game/weapons.js`).

## Struktura

- `App.js` – ulaz u aplikaciju
- `src/ui/GameScreen.js` – ekran: 3D prikaz, kontrola prstom, meni, natpisi
- `src/game/Game.js` – glavna petlja (kretanje, pucanje, sudari, šef, kamera)
- `src/game/levelGen.js` – pravljenje nivoa (talasi, kocke, prepreke, šef)
- `src/game/World.js` – staza, arena, predmeti pored puta
- `src/game/zombies.js` – zombiji (modeli, ponašanje, animacije, trake života)
- `src/game/cubes.js` – kocke sa nagradama
- `src/game/projectiles.js` – meci, sačme, rakete, plazma
- `src/game/weapons.js` – oružja
- `src/game/Crowd.js`, `src/game/Fallen.js` – vojska i animacije vojnika
- `src/game/Effects.js`, `src/game/Particles.js` – eksplozije, dim, vatra, varnice...
- `src/game/themes.js`, `src/game/Environment.js` – okruženja (grad, pustinja, šuma, sneg, otrovna zona)
- `src/game/models.js` – 3D modeli napravljeni kodom
- `src/game/config.js` – brzina, širina traka i ostala podešavanja

## Komande

- `npm install` – instalira potrebne pakete
- `npm start` – pokreće igru za Expo Go (telefon)
- `npm run build:link` – pravi jedan HTML fajl sa celom igrom (`dist/zombie-rush-3d.html`) za probu preko linka

## Napomene

- Font **Lilita One** (SIL Open Font License) je pretvoren skriptom `scripts/make-font.mjs` u `src/game/fonts/lilita.json` za 3D natpise.
- Ako telefon ne stiže 60 slika u sekundi, igra sama isključi senke i smanji efekte (`src/game/quality.js`).
- Prethodna verzija (Army Rush 3D, vojska protiv vojske) je sačuvana u git istoriji (commit c65e8a2).
