// Osnovna podešavanja igre na jednom mestu (sve mere su u metrima i sekundama).
//
// Raspored: junak stoji na liniji z = 0 i pomera se samo levo-desno.
// Put ide napred (ka -z). Leva traka = zombiji, desna traka = polja napredovanja.

// ---- Put i trake ----
export const LANE_X = 2.8; // sredina leve (-2.8) i desne (+2.8) trake
export const LANE_HALF = 2.3; // pola širine jedne trake
export const ROAD_HALF = LANE_X + LANE_HALF; // pola širine celog puta (5.1)
export const MEDIAN_START_Z = -3; // zid između traka počinje malo ispred junaka
export const ZOMBIE_SIDE = -1; // zombiji dolaze levom trakom
export const FIELD_SIDE = 1; // polja napredovanja dolaze desnom trakom

// ---- Junak ----
export const HERO_Z = 0;
export const HERO_X_LIMIT = 4.55; // dokle junak može levo-desno
export const HERO_MOVE_LERP = 24; // koliko brzo junak prati prst
export const KEY_SPEED = 12; // brzina junaka kad se pomera tasterima (m/s)
export const HERO_RADIUS = 0.45;

// ---- Svet ----
export const SPAWN_Z = -62; // odavde (iz magle) dolaze zombiji i polja
export const FIELD_SPEED = 6.5; // brzina polja napredovanja ka junaku
export const ALLEYS_Z = [-13, -27, -41]; // bočne ulice iz kojih izlaze zombiji

// ---- Borba ----
export const MAX_PROJECTILES = 280;
export const AIM_CONE = 0.42; // koliko (u radijanima) puška sama skrene ka zombiju ispred junaka
export const CRIT_CHANCE = 0.1;

// ---- Kamera ----
export const CAMERA = { height: 6.3, back: 7.0, lookZ: -15, fov: 64, followX: 0.72 };
