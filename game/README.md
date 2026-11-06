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
- `npm run check:levels` – proverava da je svaki nivo moguće preći
