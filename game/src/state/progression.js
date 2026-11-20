// Napredak igrača: nadogradnje u prodavnici, cene oružja, dnevne nagrade i šta junak nosi u borbu.
import { WEAPONS, WEAPON_ORDER } from '../game/combat/weapons.js';

export const UPGRADES = [
  { id: 'damage', name: 'ŠTETA', desc: '+10% štete po nivou', max: 15, base: 120, growth: 1.42, color: ['#ff8a4c', '#e8582a'] },
  { id: 'rate', name: 'BRZINA PALJBE', desc: '+7% brže pucanje po nivou', max: 15, base: 140, growth: 1.42, color: ['#c07bff', '#8a3ae8'] },
  { id: 'ammo', name: 'MUNICIJA', desc: '+20 metaka na početku nivoa', max: 15, base: 100, growth: 1.38, color: ['#5fe08a', '#22a85a'] },
  { id: 'health', name: 'ZDRAVLJE', desc: '+20 zdravlja po nivou', max: 15, base: 110, growth: 1.4, color: ['#ff6a8a', '#e0365a'] },
];

export function upgradeCost(id, level) {
  const u = UPGRADES.find((x) => x.id === id);
  return Math.round((u.base * Math.pow(u.growth, level)) / 10) * 10;
}

// Šta junak nosi na početku nivoa (zavisi od kupljenih nadogradnji i izabranog oružja)
export function loadoutFromSave(save) {
  const u = save.upgrades;
  return {
    weapon: save.equipped,
    dmgMul: 1 + 0.1 * u.damage,
    rateMul: 1 + 0.07 * u.rate,
    ammo: 80 + 20 * u.ammo,
    maxHp: 100 + 20 * u.health,
  };
}

export const SHOP_WEAPONS = WEAPON_ORDER.map((id) => WEAPONS[id]);

// Uporedne trake u prodavnici (0..1)
export function weaponBars(w) {
  const dps = w.dmg * w.pellets * w.rate * (w.splash ? 2.2 : 1);
  return {
    damage: Math.min(1, (w.dmg * w.pellets) / 70),
    rate: Math.min(1, w.rate / 16),
    power: Math.min(1, dps / 180),
  };
}

// Dnevne nagrade: 7 dana zaredom, sedmi dan je najveći
export const DAILY_REWARDS = [100, 150, 200, 300, 400, 600, 1200];

export function todayKey(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function dayDiff(a, b) {
  const pa = new Date(a + 'T12:00:00');
  const pb = new Date(b + 'T12:00:00');
  return Math.round((pb - pa) / 86400000);
}

// Vraća { available, day (0..6) } za danas
export function dailyStatus(save, today = todayKey()) {
  const d = save.daily;
  if (!d.last) return { available: true, day: 0 };
  const diff = dayDiff(d.last, today);
  if (diff <= 0) return { available: false, day: d.streak % 7 };
  if (diff === 1) return { available: true, day: d.streak % 7 };
  return { available: true, day: 0 }; // propušten dan: kreće se ispočetka
}

export function claimDaily(save, today = todayKey()) {
  const st = dailyStatus(save, today);
  if (!st.available) return { save, amount: 0 };
  const amount = DAILY_REWARDS[st.day];
  return {
    amount,
    day: st.day,
    save: { ...save, coins: save.coins + amount, daily: { last: today, streak: st.day + 1 } },
  };
}
