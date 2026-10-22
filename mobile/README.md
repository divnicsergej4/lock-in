# Lock In: mobilna aplikacija (Expo / React Native)

Expo SDK 58, TypeScript, expo-router sa 4 taba (Home, Spending, Savings, More).

## Pokretanje na telefonu (Expo Go)

```bash
cd mobile
npm install
npx expo start
```

Na iPhone-u otvori kameru i skeniraj QR kod iz terminala (telefon i računar moraju biti na istoj Wi-Fi mreži).
Ako ne radi preko Wi-Fi-ja: `npx expo start --tunnel`.

## Provere

```bash
npm test            # testovi logike
npm run typecheck   # TypeScript
npx expo-doctor     # zavisnosti i podešavanja
```

## Raspored

| Folder | Šta je |
|---|---|
| `src/app/` | Ekrani (expo-router). `(tabs)/` su 4 taba. |
| `src/logic/` | Logika prenesena iz prototipa (`index.html` na `razvoj`): fore, plamen, novac, „Can I afford it?“, ocena meseca. Bez React-a, sve pokriveno testovima. |
| `src/store/` | Stanje aplikacije i čuvanje na telefonu (AsyncStorage, ključ `lockin`). |
| `src/theme/` | Boje (tamna/svetla) i fontovi iz prototipa. |
| `src/components/` | Zajednički delovi ekrana. |

Fore su u `src/logic/roasts.ts` i moraju biti identične `docs/FORE.md`; test `roasts.test.ts` to proverava slovo po slovo.

`src/logic/__tests__/same-as-prototype.test.ts` pokreće pravi kod prototipa (`index.html` u korenu repoa) na
nasumičnim podacima i proverava da TypeScript daje isti rezultat i isti tekst koji korisnik vidi. Svesna odstupanja
su opisana u tom testu i u `features.test.ts`.
