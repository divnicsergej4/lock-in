# Lock In: backend (Supabase)

Ovde je baza za naloge, prijatelje i zajednički cilj. Lična potrošnja se ne čuva ovde, ona ostaje na telefonu.

## Pravila koja baza sama sprovodi

- Svaka izmena traži aktivnu probu ili pretplatu (tabela `subscriptions`, puni je server preko RevenueCat-a).
  Izlazak iz cilja je izuzetak: iz cilja se uvek može izaći.
- Prijatelji: poziv ide na mejl (`send_friend_request`), druga osoba prihvata (`respond_friend_request`).
  Ako ta osoba još nema nalog, poziv je čeka i pojavi joj se čim se registruje tim mejlom.
  Ako se dvoje pozovu međusobno, drugi poziv automatski prihvata prvi.
- Cilj: svi članovi su jednaki, nema vlasnika. Svako može da promeni naziv i iznos i da doda svoje prijatelje.
- Svako upisuje i menja samo svoje uplate.
- Ko izađe iz cilja, njegove uplate se brišu. Cilj ostaje ostalima. Kad izađe poslednji, cilj se briše.
- Brisanje naloga briše i osobu iz svih ciljeva, njene uplate i prijateljstva.

## Kako se primenjuje

1. Supabase dashboard → SQL Editor → New query.
2. Nalepi ceo fajl `supabase/migrations/0001_accounts_friends_shared_goals.sql` i pokreni ga.

Nikome ne šalji `service_role` ključ ni lozinku baze, pa ni meni. Aplikacija koristi samo javni (anon) ključ,
a sva zaštita je u pravilima u samoj bazi.

## Testovi

`tests/test_shared_goals.py` podiže praznu lokalnu bazu, primeni fajl i proveri 49 situacija
(ko šta vidi, ko šta sme da menja, šta se dešava kad neko izađe ili kad mu istekne pretplata).

## Šta još fali

- Slanje samog mejla sa pozivom (serverska funkcija + servis za mejlove, npr. Resend).
- Webhook iz RevenueCat-a koji upisuje probu i pretplatu u `subscriptions`.
