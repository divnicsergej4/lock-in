// Osnovna podešavanja igre na jednom mestu.
// Ako želiš da igra bude brža, sporija, teža ili lakša, ovde se menja.

// ---- Put i trake ----
export const LANE_X = 3.0; // sredina leve (-3) i desne (+3) trake
export const LANE_HALF = 2.4; // pola širine jedne trake
export const DIVIDER_HALF = 0.4; // pola širine zida između traka
export const ROAD_HALF = LANE_X + LANE_HALF; // pola širine celog puta
export const LANE_CENTER_RANGE = 0.65; // koliko vojska može da se pomeri unutar trake (levo-desno od sredine)
export const SQUEEZE_HALF = 1.85; // najveća poluširina vojske (da stane u traku)

// ---- Kretanje ----
export const FORWARD_SPEED = 8.5; // koliko brzo vojska trči napred
export const STEER_LERP = 10; // koliko brzo vojska prati prst

// ---- Vojska ----
export const START_ARMY = 15; // sa koliko vojnika se kreće
export const MAX_RENDERED = 150; // najviše vojnika koje crtamo (zbog brzine na telefonu)
export const SPIRAL = 0.3; // gustina formacije

// ---- Borba ----
export const THREAT_RANGE = 13; // na ovoj udaljenosti vojnici pucaju na zombije i u drugoj traci
export const MAX_PROJECTILES_PER_FRAME = 3; // koliko vidljivih metaka najviše ispaljujemo po slici

export const COLORS = {
  blue: 0x2f7bff,
  blueDark: 0x1d4fb8,
  red: 0xff4646,
  skin: 0xffd3a8,
  gun: 0x3a3f4a,
  white: 0xffffff,
  gold: 0xffc934,
  trunk: 0x9a6a3e,
  zombieBlood: 0x5fbf2a,
};
