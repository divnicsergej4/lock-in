# ARMY RUSH 3D

3D igrica za telefon (React Native + Expo + three.js).

## Struktura

- `App.js` – ulaz u aplikaciju
- `src/ui/GameScreen.js` – ekran: 3D prikaz, kontrola prstom, natpisi
- `src/game/Game.js` – glavna petlja igre (kretanje, kapije, borba, pobeda/poraz)
- `src/game/World.js` – staza: put, kapije, odredi, ciljna linija, baza, drveće
- `src/game/Crowd.js` – vojska (plava i crvena)
- `src/game/levelGen.js` – pravljenje nivoa
- `src/game/gates.js` – šta rade kapije (+, -, x, ÷)
- `src/game/config.js` – brzina, boje i ostala podešavanja

## Komande

- `npm install` – instalira potrebne pakete
- `npm start` – pokreće igru za Expo Go (telefon)
- `npm run export:web` – pravi web verziju u folderu `dist/`
- `npm run build:link` – pravi jedan HTML fajl sa celom igrom (`dist/army-rush-3d.html`) za probu preko linka
- `npm run check:levels` – proverava da je svaki nivo moguće preći

## Grafika

- **Modeli** (`src/game/models.js`): vojnici (uniforma, prsluk, opasač, čizme, rukavice, oči, šlem, ranac, puška) i vojni predmeti (džakovi s peskom, protivtenkovske prepreke, uništeni tenkovi, šatori, bunkeri, osmatračnice, buradi, sanduci, trava, cveće, tvrđava). Sve je napravljeno kodom; boje i senčenje pri dnu su "upečeni" u model, pa se svaki model crta jednim pozivom.
- **Animacije** (`src/game/Crowd.js`, `src/game/Fallen.js`): stajanje, trčanje, nišanjenje, trzaj puške, pogodak, umiranje, slavlje, sa glatkim prelazima i razlikama između vojnika.
- **Efekti** (`src/game/Effects.js`, `src/game/Particles.js`): eksplozije u više slojeva, dim, vatra, prašina, varnice, bljesak puške, meci, udarni talas, nagoreli tragovi, konfete. Sve se ponovo koristi (pooling).
- **Svetlo**: sunce sa mekim senkama koje prati vojsku, nebo, filmski kolor (ACES), magla u daljini.
- **Kamera**: uvodni prelet, praćenje, tresenje kod eksplozija, kružni pogled posle pobede.
- **Kvalitet** (`src/game/quality.js`): ako telefon ne stiže 60 slika u sekundi, igra sama isključi senke i smanji efekte.
- Brojevi su 3D slova fontom **Lilita One** (SIL Open Font License), pretvoreni skriptom `scripts/make-font.mjs` u `src/game/fonts/lilita.json`.
