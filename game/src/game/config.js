// Osnovna podešavanja igre na jednom mestu.
// Ako želiš da igra bude brža, sporija, teža ili lakša, ovde se menja.

export const ROAD_HALF = 4.2; // pola širine puta (put ide od -4.2 do +4.2)
export const FORWARD_SPEED = 12; // koliko brzo vojska trči napred
export const STEER_LERP = 14; // koliko brzo vojska prati prst
export const SEGMENT = 34; // razmak između kapija
export const START_ARMY = 8; // sa koliko vojnika se kreće

export const MAX_RENDERED = 160; // najviše vojnika koje crtamo (zbog brzine na telefonu)
export const SPIRAL = 0.3; // gustina formacije

export const FIGHT_TICK = 0.045; // koliko često padaju vojnici u borbi (sekunde)

export const COLORS = {
  sky: 0x8fd6ff,
  grass: 0x7fd36b,
  grassDark: 0x5dbb50,
  road: 0xdfe5ee,
  roadEdge: 0x9fb0c6,
  blue: 0x2f7bff,
  blueDark: 0x1d4fb8,
  red: 0xff4646,
  redDark: 0xb82424,
  skin: 0xffd3a8,
  gun: 0x3a3f4a,
  white: 0xffffff,
  gateGood: 0x29a3ff,
  gateBad: 0xff3d5a,
  post: 0xffffff,
  trunk: 0x9a6a3e,
  leaf: 0x3fb54a,
  leaf2: 0x67cc4f,
  rock: 0xb8c0cc,
  gold: 0xffc934,
};
