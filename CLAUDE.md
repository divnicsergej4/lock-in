# Lock In — pravila rada

Na početku svake sesije pročitaj `docs/PROJEKAT.md` (sve odluke i stanje) i `docs/FORE.md` (tačan tekst svih fora).
@docs/PROJEKAT.md

## Pravila koja važe uvek
- NE menjati granu `main` (ona je javni link https://divnicsergej4.github.io/lock-in/ koji koriste testeri) dok Andrija izričito ne kaže drugačije.
- Izuzetak: ni greške ne ispravljati na `main` bez njegove potvrde.
- Izmene prototipa (`index.html`) idu na granu `razvoj`. Spajanje u `main` samo uz Andrijinu dozvolu
  (reči tipa „objavi“, „pošalji testerima“, „postavi na link“, „izbaci na github“, „apdejtuj na link“).
- Prava aplikacija (React Native) i backend idu na granu `aplikacija`.
- Nikad ne traži i ne prihvataj tajne ključeve (Supabase service_role, lozinka baze, tokeni).
- Odgovaraj Andriji na srpskom, latinicom. Budi strog i kritičan, ali bez dramatizovanja.
- Radi tačno ono što je tražio. Ne briši i ne menjaj ono što nije pomenuo. Ne pitaj ponovo ono što je već rekao.
- Njegove tekstove (fore, poruke) prepisuj tačno, sa njegovim greškama, razmacima i emodžijima.
- Aplikacija je samo na engleskom. 7 dana probe, posle toga se plaća sve (nema besplatne verzije, nema „Pro“ dela).
- U shell komandama nikad ne koristi backtick-ove (`) u tekstu: shell ih izvršava kao komande. Fajlove menjaj alatom
  za izmenu fajlova (Edit/Write), ne preko shell-a (sed, echo, node -e, heredoc u fajl).
