# Dizajn ekrana (referenca za izradu)

Svaki ekran postoji kao slika (.png, kako izgleda) i kao .html (tačne boje, razmaci, veličine fontova i tekstovi).
Ovo su makete, ne kod aplikacije: u React Native se prenosi izgled, raspored i tekst, ne HTML.
Boje i fontovi su isti kao u aplikaciji (Bricolage Grotesque za naslove, Inter za tekst).
Cene su probne.

## placanje/ — ekran za plaćanje i sve posle dodira na dugme

1. **06-placanje** — ekran za plaćanje: katanac, "7 DAYS FREE", naslov, 5 stvari koje dobija,
   vremenska linija besplatne nedelje (danas / 5. dan podsetnik / 7. dan počinje plan),
   tri plana (godišnji označen, "BEST VALUE"), dugme "Start my free week", link za demo,
   Restore purchase / Terms / Privacy i tekst o automatskom obnavljanju.
   - Kod godišnjeg plana iznos koji se naplaćuje ($45 / year) mora biti krupniji od mesečnog preračuna ($3.75 a month) — Apple pravilo.
   - Doživotni plan nema probu: kad je izabran, dugme glasi "Buy for $69", a tekst ispod se menja.
   - Dugme i tekst ispod moraju uvek da prate izabrani plan.
   - Dugme ostaje vidljivo pri dnu ekrana dok se skroluje (sticky).
2. **07-placanje-potvrda** — prozor App Store-a / Google Play-a. Crta ga sistem, mi ga ne pravimo; nacrtan je samo da se vidi tok.
3. **08-placanje-obrada** — "Locking you in…" dok se kupovina proverava (katanac se zatvara, tri koraka).
4. **09-placanje-uspeh** — "You're locked in.": do kad je besplatno, koliko posle košta, prekidač "Remind me on <datum>"
   (lokalno obaveštenje 2 dana pre kraja probe, podrazumevano uključeno — obećanje sa ekrana za plaćanje mora da se ispuni),
   "Show me around" (vođeni obilazak) i "Skip the tour".
5. **10-placanje-nije-proslo** — "That didn't go through. Nothing was charged." Kartica sa razlogom, tri verzije:
   - korisnik zatvorio prozor: "Changed your mind? Fair." + "You closed the payment window before it finished. Your setup is saved, so you can pick up right where you left off."
   - kartica odbijena: "Your card said no. Rude." + "Check your payment method in App Store settings." (na Androidu: Google Play)
   - čeka odobrenje (Ask to Buy): "Waiting for approval." + "We'll unlock everything as soon as it's approved."
   Dugmad: Try again, Look around the demo, Restore purchase, Contact support (support@lockintracker.app).
6. **11-placanje-vraceno** — "Welcome back.": plan i datum obnove; napomena da su troškovi na starom telefonu
   i da se prebacuju preko More → Backup → Import. Ako nema šta da se vrati: poruka da kupovina nije nađena na ovom Apple/Google nalogu.

## zajednicki-cilj/ — zajednički cilj posle prijave

01 prazno stanje, 02 lista ciljeva, 03 cilj (katanac i prsten), 04 ubacivanje para, 05 otključan cilj.
