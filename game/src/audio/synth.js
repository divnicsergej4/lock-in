// Zvučni efekti i muzika napravljeni kodom (sinteza), bez gotovih snimaka.
// Isti kod koristi i web (zvuk se pravi pri pokretanju) i skripta koja pravi WAV fajlove za telefon.
export const SR = 22050;

const TAU = Math.PI * 2;

function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s / 4294967296) * 2 - 1;
  };
}

class LP {
  constructor(fc) {
    this.y = 0;
    this.set(fc);
  }
  set(fc) {
    this.a = 1 - Math.exp((-TAU * Math.min(fc, SR * 0.45)) / SR);
  }
  p(x) {
    this.y += this.a * (x - this.y);
    return this.y;
  }
}
class HP {
  constructor(fc) {
    this.lp = new LP(fc);
  }
  p(x) {
    return x - this.lp.p(x);
  }
}
// Pojasni filter (RBJ biquad)
class BP {
  constructor(fc, q) {
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.set(fc, q);
  }
  set(fc, q) {
    const w = (TAU * Math.min(fc, SR * 0.45)) / SR;
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    this.b0 = alpha / a0;
    this.b2 = -alpha / a0;
    this.a1 = (-2 * Math.cos(w)) / a0;
    this.a2 = (1 - alpha) / a0;
  }
  p(x) {
    const y = this.b0 * x + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

const saw = (ph) => 2 * (ph - Math.floor(ph)) - 1;
const sq = (ph) => (ph - Math.floor(ph) < 0.5 ? 1 : -1);
const tri = (ph) => 1 - 4 * Math.abs(ph - Math.floor(ph) - 0.5);

function normalize(buf, peak = 0.9) {
  let m = 0;
  for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
  if (m > 0) {
    const k = peak / m;
    for (let i = 0; i < buf.length; i++) buf[i] *= k;
  }
  // kratko utišavanje na početku i kraju (bez pucketanja)
  const f = Math.min(64, buf.length >> 2);
  for (let i = 0; i < f; i++) {
    buf[buf.length - 1 - i] *= i / f;
  }
  return buf;
}

function render(sec, fn) {
  const n = Math.ceil(sec * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SR, i);
  return out;
}

// ---------------- Pucnji ----------------
function gun({ dur, decay, lp0, lp1, thumpF, thumpDecay, thumpAmp, tail = 0, tailDecay = 8, seed = 1, drive = 1.8 }) {
  const n = makeRng(seed);
  const lp = new LP(lp0);
  const hp = new HP(120);
  const tl = new LP(900);
  let ph = 0;
  return normalize(
    render(dur, (t, i) => {
      if (i % 32 === 0) lp.set(lp1 + (lp0 - lp1) * Math.exp(-t * 25));
      const env = Math.exp(-t * decay);
      const noise = hp.p(lp.p(n())) * env;
      ph += (thumpF * (0.45 + 0.55 * Math.exp(-t * 35))) / SR;
      const thump = Math.sin(TAU * ph) * Math.exp(-t * thumpDecay) * thumpAmp;
      const crack = t < 0.003 ? n() * 1.5 : 0;
      const tailS = tail ? tl.p(n()) * Math.exp(-t * tailDecay) * tail : 0;
      return Math.tanh(drive * (noise + thump + crack + tailS));
    }),
  );
}

function explosion(seed = 3, dur = 1.7) {
  const n = makeRng(seed);
  const lp = new LP(3000);
  let ph = 0;
  let crackle = 0;
  return normalize(
    render(dur, (t, i) => {
      if (i % 32 === 0) lp.set(180 + 2800 * Math.exp(-t * 3.5));
      const att = Math.min(1, t / 0.004);
      const env = att * Math.exp(-t * 2.6);
      const noise = lp.p(n()) * env * 1.6;
      ph += (32 + 30 * Math.exp(-t * 4)) / SR;
      const rumble = Math.sin(TAU * ph) * Math.exp(-t * 2.2) * 0.9;
      if (Math.abs(n()) > 0.9985) crackle = 0.8;
      crackle *= 0.995;
      return Math.tanh(1.6 * (noise + rumble + crackle * n() * Math.exp(-t * 2)));
    }),
  );
}

// ---------------- Zombiji ----------------
function groan({ dur = 1.2, f0 = 90, f1 = 75, seed = 5, form = [450, 1100], vib = 5, rough = 0.35 }) {
  const n = makeRng(seed);
  const b1 = new BP(form[0], 3.5);
  const b2 = new BP(form[1], 5);
  const lp = new LP(2400);
  let ph = 0;
  return normalize(
    render(dur, (t) => {
      const k = t / dur;
      const f = (f0 + (f1 - f0) * k) * (1 + 0.05 * Math.sin(TAU * vib * t) + 0.03 * Math.sin(TAU * 13 * t));
      ph += f / SR;
      const env = Math.min(1, t / 0.18) * Math.min(1, (dur - t) / 0.35);
      const src = saw(ph) + rough * n() * (0.6 + 0.4 * Math.sin(TAU * 31 * t));
      const v = b1.p(src) + 0.55 * b2.p(src);
      return Math.tanh(lp.p(v) * 2.4) * env;
    }),
    0.8,
  );
}

function squelch(seed = 7) {
  const n = makeRng(seed);
  const bp = new BP(900, 1.6);
  let ph = 0;
  return normalize(
    render(0.13, (t) => {
      ph += (130 - t * 300) / SR;
      return bp.p(n()) * Math.exp(-t * 38) * 1.8 + Math.sin(TAU * ph) * Math.exp(-t * 45) * 0.8;
    }),
    0.7,
  );
}

// ---------------- Junak ----------------
function hurt(seed = 11) {
  const n = makeRng(seed);
  const b = new BP(720, 3);
  const b2 = new BP(1300, 5);
  let ph = 0;
  return normalize(
    render(0.32, (t) => {
      ph += (215 - t * 210) / SR;
      const env = Math.min(1, t / 0.02) * Math.exp(-t * 7);
      const src = saw(ph) + 0.3 * n();
      return Math.tanh((b.p(src) + 0.5 * b2.p(src)) * 3) * env;
    }),
    0.75,
  );
}

// ---------------- Tonovi (UI, nagrade) ----------------
function tones(notes, { wave = 'sq', decay = 9, lp = 4000, gap = 0.07, dur, vol = 0.8 }) {
  const total = dur || notes.length * gap + 0.35;
  const filt = new LP(lp);
  const osc = wave === 'sq' ? sq : wave === 'tri' ? tri : wave === 'saw' ? saw : (p) => Math.sin(TAU * p);
  const phs = notes.map(() => 0);
  return normalize(
    render(total, (t) => {
      let v = 0;
      notes.forEach((f, i) => {
        const t0 = i * gap;
        if (t < t0) return;
        phs[i] += f / SR;
        v += osc(phs[i]) * Math.exp(-(t - t0) * decay) * Math.min(1, (t - t0) / 0.004);
      });
      return filt.p(v);
    }),
    vol,
  );
}

function sweep(f0, f1, dur, { wave = 'saw', lp = 3000, vol = 0.7, noise = 0 } = {}) {
  const filt = new LP(lp);
  const n = makeRng(19);
  let ph = 0;
  const osc = wave === 'sq' ? sq : wave === 'tri' ? tri : saw;
  return normalize(
    render(dur, (t) => {
      const k = t / dur;
      ph += (f0 * Math.pow(f1 / f0, k)) / SR;
      const env = Math.min(1, t / 0.02) * Math.min(1, (dur - t) / 0.15);
      return filt.p(osc(ph) + noise * n()) * env;
    }),
    vol,
  );
}

function whoosh(dur, f0, f1, seed = 23) {
  const n = makeRng(seed);
  const bp = new BP(f0, 1.4);
  return normalize(
    render(dur, (t, i) => {
      const k = t / dur;
      if (i % 32 === 0) bp.set(f0 + (f1 - f0) * k, 1.4);
      return bp.p(n()) * Math.sin(Math.PI * k) * 1.5;
    }),
    0.6,
  );
}

function slam(seed = 29) {
  const n = makeRng(seed);
  const lp = new LP(500);
  let ph = 0;
  return normalize(
    render(0.95, (t) => {
      ph += (58 * (0.5 + 0.5 * Math.exp(-t * 6))) / SR;
      return Math.tanh(Math.sin(TAU * ph) * Math.exp(-t * 4) * 1.6 + lp.p(n()) * Math.exp(-t * 7) * 1.2);
    }),
  );
}

function roar(seed = 31, dur = 2.2, deep = 1) {
  const n = makeRng(seed);
  const b1 = new BP(320 * deep, 2.5);
  const b2 = new BP(760 * deep, 4);
  const lp = new LP(1800);
  const phs = [0, 0, 0];
  return normalize(
    render(dur, (t) => {
      const k = t / dur;
      const f = (48 + 40 * Math.sin(Math.PI * Math.min(1, k * 1.4))) * deep;
      let src = 0;
      [1, 1.013, 0.987].forEach((d, i) => {
        phs[i] += (f * d) / SR;
        src += saw(phs[i]);
      });
      src += n() * (0.8 + 0.6 * Math.sin(TAU * 27 * t));
      const env = Math.min(1, t / 0.12) * Math.min(1, (dur - t) / 0.5);
      return Math.tanh(lp.p(b1.p(src) * 1.4 + b2.p(src) * 0.8) * 3.5) * env;
    }),
  );
}

function wetSplash(dur = 0.45, seed = 37, f0 = 1500, f1 = 400) {
  const n = makeRng(seed);
  const bp = new BP(f0, 2);
  const hp = new HP(2500);
  return normalize(
    render(dur, (t, i) => {
      if (i % 32 === 0) bp.set(f0 + (f1 - f0) * (t / dur), 2);
      const bubbles = Math.sin(TAU * (500 + 400 * Math.sin(t * 90)) * t) * (Math.sin(t * 60) > 0.7 ? 0.4 : 0);
      return (bp.p(n()) * 1.4 + hp.p(n()) * 0.25 * Math.exp(-t * 3) + bubbles) * Math.exp(-t * 6);
    }),
    0.65,
  );
}

function click(seed = 41, f = 3000, dur = 0.05) {
  const n = makeRng(seed);
  const hp = new HP(f);
  return normalize(render(dur, (t) => hp.p(n()) * Math.exp(-t * 120)), 0.5);
}

function horn(notes, dur, lp = 1100) {
  const filt = new LP(lp);
  const phs = notes.map(() => [0, 0]);
  const seg = dur / notes.length;
  return normalize(
    render(dur, (t) => {
      const idx = Math.min(notes.length - 1, Math.floor(t / seg));
      const tt = t - idx * seg;
      const f = notes[idx];
      let v = 0;
      phs[idx][0] += f / SR;
      phs[idx][1] += (f * 1.006) / SR;
      v = saw(phs[idx][0]) + saw(phs[idx][1]);
      const env = Math.min(1, tt / 0.05) * Math.min(1, (seg - tt) / 0.08 + 0.2);
      return filt.p(v * (1 + 0.05 * Math.sin(TAU * 5.5 * t))) * env;
    }),
    0.7,
  );
}

function fanfare() {
  const n = [523, 659, 784, 1047];
  const filt = new LP(3200);
  const phs = [0, 0, 0, 0, 0, 0];
  return normalize(
    render(2.4, (t) => {
      let v = 0;
      n.forEach((f, i) => {
        const t0 = i * 0.12;
        if (t < t0) return;
        phs[i] += f / SR;
        const sustain = i === 3 ? Math.exp(-(t - t0) * 0.9) : Math.exp(-(t - t0) * 6);
        v += (saw(phs[i]) * 0.6 + sq(phs[i]) * 0.3) * sustain;
      });
      if (t > 0.48) {
        phs[4] += 659 / SR;
        phs[5] += 784 / SR;
        v += (saw(phs[4]) + saw(phs[5])) * 0.35 * Math.exp(-(t - 0.48) * 0.9);
      }
      return filt.p(v) * Math.min(1, (2.4 - t) / 0.3);
    }),
    0.75,
  );
}

function dirge() {
  const notes = [294, 262, 233, 220];
  const filt = new LP(1400);
  const phs = [0, 0, 0, 0];
  let drone = 0;
  return normalize(
    render(2.6, (t) => {
      let v = 0;
      notes.forEach((f, i) => {
        const t0 = i * 0.42;
        if (t < t0) return;
        phs[i] += f / SR;
        v += (saw(phs[i]) * 0.5 + tri(phs[i]) * 0.5) * Math.exp(-(t - t0) * (i === 3 ? 1.1 : 2.5));
      });
      drone += 55 / SR;
      v += saw(drone) * 0.25 * Math.min(1, t / 0.4) * Math.exp(-t * 0.6);
      return filt.p(v) * Math.min(1, (2.6 - t) / 0.4);
    }),
    0.7,
  );
}

function coinCascade() {
  const out = new Float32Array(Math.ceil(0.7 * SR));
  [0, 0.08, 0.15, 0.24, 0.3].forEach((d, k) => {
    const c = tones([988 + k * 60, 1319 + k * 80], { wave: 'sq', decay: 14, lp: 5000, gap: 0.05 });
    const off = Math.floor(d * SR);
    for (let i = 0; i < c.length && off + i < out.length; i++) out[off + i] += c[i] * 0.6;
  });
  return normalize(out, 0.75);
}

// Spisak efekata: ime -> { gen, vol (jačina), gap (najmanji razmak u sekundama), voices }
export const SOUNDS = {
  pistol: { gen: () => gun({ dur: 0.32, decay: 26, lp0: 6000, lp1: 900, thumpF: 150, thumpDecay: 22, thumpAmp: 0.9, tail: 0.25, seed: 2 }), vol: 0.55, gap: 0.05, voices: 4 },
  rifle: { gen: () => gun({ dur: 0.22, decay: 34, lp0: 7000, lp1: 1200, thumpF: 170, thumpDecay: 30, thumpAmp: 0.7, tail: 0.15, seed: 3 }), vol: 0.45, gap: 0.04, voices: 5 },
  shotgun: { gen: () => gun({ dur: 0.6, decay: 11, lp0: 3500, lp1: 500, thumpF: 95, thumpDecay: 9, thumpAmp: 1.2, tail: 0.45, tailDecay: 5, seed: 4, drive: 2.2 }), vol: 0.7, gap: 0.08, voices: 3 },
  minigun: { gen: () => gun({ dur: 0.1, decay: 60, lp0: 6500, lp1: 1500, thumpF: 210, thumpDecay: 50, thumpAmp: 0.6, seed: 5 }), vol: 0.32, gap: 0.03, voices: 6 },
  launcher: { gen: () => gun({ dur: 0.45, decay: 14, lp0: 1200, lp1: 300, thumpF: 120, thumpDecay: 10, thumpAmp: 1.4, tail: 0.2, seed: 6, drive: 1.4 }), vol: 0.6, gap: 0.1, voices: 3 },
  explosion: { gen: () => explosion(3), vol: 0.75, gap: 0.08, voices: 4 },
  hit: { gen: () => squelch(7), vol: 0.32, gap: 0.035, voices: 4 },
  zombieDie: { gen: () => groan({ dur: 0.6, f0: 140, f1: 60, seed: 8, form: [520, 1200], rough: 0.5 }), vol: 0.45, gap: 0.12, voices: 3 },
  zombieAttack: { gen: () => groan({ dur: 0.32, f0: 170, f1: 120, seed: 9, form: [600, 1500], rough: 0.6, vib: 9 }), vol: 0.45, gap: 0.2, voices: 2 },
  groan1: { gen: () => groan({ dur: 1.3, f0: 92, f1: 78, seed: 12 }), vol: 0.32, gap: 0.6, voices: 2 },
  groan2: { gen: () => groan({ dur: 1.1, f0: 110, f1: 70, seed: 13, form: [380, 950] }), vol: 0.32, gap: 0.6, voices: 2 },
  groan3: { gen: () => groan({ dur: 1.4, f0: 75, f1: 95, seed: 14, form: [500, 1250], vib: 3 }), vol: 0.32, gap: 0.6, voices: 2 },
  hurt: { gen: () => hurt(11), vol: 0.6, gap: 0.2, voices: 2 },
  coin: { gen: () => tones([988, 1319], { wave: 'sq', decay: 12, lp: 5000, gap: 0.06 }), vol: 0.35, gap: 0.06, voices: 3 },
  tick: { gen: () => tones([1500], { wave: 'sine', decay: 60, gap: 0.01, dur: 0.06 }), vol: 0.18, gap: 0.04, voices: 2 },
  unlock: { gen: () => tones([660, 880, 1320, 1760], { wave: 'tri', decay: 7, gap: 0.06 }), vol: 0.5, gap: 0.2, voices: 2 },
  gateGood: { gen: () => tones([1047, 1319, 1568, 2093], { wave: 'sq', decay: 8, lp: 4200, gap: 0.055 }), vol: 0.45, gap: 0.15, voices: 2 },
  gateBad: { gen: () => sweep(330, 140, 0.5, { wave: 'saw', lp: 1500 }), vol: 0.45, gap: 0.15, voices: 2 },
  powerup: { gen: () => sweep(220, 1400, 0.75, { wave: 'sq', lp: 3500 }), vol: 0.45, gap: 0.2, voices: 2 },
  locked: { gen: () => tones([110, 104], { wave: 'sq', decay: 10, lp: 900, gap: 0.12 }), vol: 0.45, gap: 0.2, voices: 1 },
  empty: { gen: () => click(41, 2500, 0.06), vol: 0.5, gap: 0.2, voices: 1 },
  wave: { gen: () => horn([220, 262, 220], 1.1, 900), vol: 0.5, gap: 1, voices: 1 },
  levelStart: { gen: () => horn([196, 262], 0.9, 1300), vol: 0.5, gap: 1, voices: 1 },
  bossRoar: { gen: () => roar(31, 2.2, 1), vol: 0.75, gap: 0.8, voices: 2 },
  bossDie: { gen: () => roar(33, 2.4, 0.7), vol: 0.8, gap: 1, voices: 1 },
  slam: { gen: () => slam(29), vol: 0.7, gap: 0.15, voices: 2 },
  throw: { gen: () => whoosh(0.5, 400, 1500, 23), vol: 0.45, gap: 0.2, voices: 2 },
  spit: { gen: () => wetSplash(0.35, 37, 1600, 500), vol: 0.5, gap: 0.15, voices: 2 },
  splash: { gen: () => wetSplash(0.5, 38, 900, 300), vol: 0.5, gap: 0.1, voices: 3 },
  victory: { gen: fanfare, vol: 0.6, gap: 1, voices: 1 },
  defeat: { gen: dirge, vol: 0.6, gap: 1, voices: 1 },
  ui: { gen: () => tones([880, 1320], { wave: 'sine', decay: 30, gap: 0.03, dur: 0.1 }), vol: 0.35, gap: 0.05, voices: 2 },
  buy: { gen: coinCascade, vol: 0.5, gap: 0.2, voices: 1 },
  daily: { gen: () => tones([784, 988, 1175, 1568, 1976], { wave: 'tri', decay: 4, gap: 0.08, dur: 1.2 }), vol: 0.5, gap: 0.5, voices: 1 },
};

// ---------------- Muzika ----------------
const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);
const CHORDS = { Am: [57, 60, 64], F: [53, 57, 60], C: [48, 55, 60], G: [55, 59, 62], E: [52, 56, 59], Dm: [50, 53, 57] };

function drumKit(seed) {
  const n = makeRng(seed);
  const hatHp = new HP(7000);
  const snareBp = new BP(1800, 0.8);
  return {
    kick(t) {
      if (t < 0 || t > 0.4) return 0;
      const f = 50 + 90 * Math.exp(-t * 30);
      return Math.sin(TAU * f * t) * Math.exp(-t * 9) * 1.1;
    },
    snare(t) {
      if (t < 0 || t > 0.3) return 0;
      return snareBp.p(n()) * Math.exp(-t * 18) * 1.2 + Math.sin(TAU * 185 * t) * Math.exp(-t * 25) * 0.4;
    },
    hat(t, open = false) {
      if (t < 0 || t > 0.25) return 0;
      return hatHp.p(n()) * Math.exp(-t * (open ? 14 : 45)) * 0.35;
    },
  };
}

export function generateMusic(name) {
  const cfg = {
    menu: { bpm: 84, bars: 8, prog: ['Am', 'F', 'C', 'E'], drums: 'soft', arp: true, lead: false, bassStyle: 'long' },
    game: { bpm: 126, bars: 16, prog: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'F', 'E'], drums: 'rock', arp: true, lead: true, bassStyle: 'eighths' },
    boss: { bpm: 140, bars: 8, prog: ['Am', 'Am', 'F', 'E'], drums: 'heavy', arp: false, lead: true, bassStyle: 'sixteenths' },
  }[name];
  const beat = 60 / cfg.bpm;
  const bar = beat * 4;
  const dur = bar * cfg.bars;
  const n = Math.ceil(dur * SR);
  const out = new Float32Array(n);
  const kit = drumKit(name.length * 7);
  const bassLp = new LP(name === 'boss' ? 700 : 420);
  const padLp = new LP(name === 'menu' ? 900 : 1300);
  const arpLp = new LP(2600);
  const windLp = new LP(260);
  const wind = makeRng(99);
  const padPh = [0, 0, 0, 0, 0, 0];
  let bassPh = 0;
  let arpPh = 0;
  let leadPh = 0;
  const leadScale = [69, 72, 74, 76, 79, 81];
  const leadRng = makeRng(name.length * 13);
  const leadNotes = Array.from({ length: cfg.bars * 8 }, () => leadScale[Math.floor((leadRng() + 1) * 3) % leadScale.length]);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const barIdx = Math.floor(t / bar);
    const chord = CHORDS[cfg.prog[barIdx % cfg.prog.length]];
    const tb = t - barIdx * bar; // vreme u taktu
    const beatIdx = Math.floor(tb / beat);
    const tbeat = tb - beatIdx * beat;
    const eighth = beat / 2;
    const tEighth = tb % eighth;
    const sixteenth = beat / 4;
    const tSix = tb % sixteenth;
    let v = 0;

    // Bubnjevi
    if (cfg.drums === 'soft') {
      if (beatIdx === 0 || beatIdx === 2) v += kit.kick(tbeat) * 0.55;
      v += kit.hat(tEighth) * 0.25;
    } else if (cfg.drums === 'rock') {
      if (beatIdx === 0 || beatIdx === 2 || (beatIdx === 3 && tbeat > eighth)) v += kit.kick(beatIdx === 3 ? tbeat - eighth : tbeat) * 0.9;
      if (beatIdx === 1 || beatIdx === 3) v += kit.snare(tbeat) * 0.55;
      v += kit.hat(tEighth, Math.floor(tb / eighth) % 2 === 1) * 0.5;
    } else {
      v += kit.kick(tbeat) * 1.0;
      if (beatIdx === 1 || beatIdx === 3) v += kit.snare(tbeat) * 0.7;
      v += kit.hat(tSix) * 0.45;
    }

    // Bas
    const root = NOTE(chord[0] - 24);
    let bassEnv = 1;
    if (cfg.bassStyle === 'eighths') bassEnv = Math.exp(-tEighth * 6);
    else if (cfg.bassStyle === 'sixteenths') bassEnv = Math.exp(-tSix * 10);
    else bassEnv = 0.8;
    const octave = cfg.bassStyle === 'eighths' && Math.floor(tb / eighth) % 2 === 1 ? 2 : 1;
    bassPh += (root * octave) / SR;
    const bassRaw = saw(bassPh) * 0.6 + sq(bassPh) * 0.3;
    v += Math.tanh(bassLp.p(bassRaw) * (name === 'boss' ? 3 : 1.6)) * bassEnv * 0.55;

    // Akordi (pad)
    let pad = 0;
    for (let k = 0; k < 3; k++) {
      const f = NOTE(chord[k]);
      padPh[k] += f / SR;
      padPh[k + 3] += (f * 1.004) / SR;
      pad += saw(padPh[k]) + saw(padPh[k + 3]);
    }
    const padEnv = Math.min(1, tb / 0.35) * (name === 'menu' ? 0.32 : 0.16);
    v += padLp.p(pad) * padEnv;

    // Arpeđo
    if (cfg.arp) {
      const step = Math.floor(tb / (cfg.bpm > 100 ? sixteenth : eighth));
      const note = chord[step % 3] + 12 + (step % 6 >= 3 ? 12 : 0);
      arpPh += NOTE(note) / SR;
      const tt = cfg.bpm > 100 ? tSix : tEighth;
      v += arpLp.p(tri(arpPh)) * Math.exp(-tt * 14) * (name === 'menu' ? 0.22 : 0.14);
    }
    // Melodija u drugoj polovini
    if (cfg.lead && barIdx >= cfg.bars / 2) {
      const li = Math.floor(t / eighth) % leadNotes.length;
      leadPh += NOTE(leadNotes[li]) / SR;
      v += (sq(leadPh) * 0.5 + saw(leadPh) * 0.5) * Math.exp(-tEighth * 5) * 0.09;
    }
    // Vetar (atmosfera u meniju)
    if (name === 'menu') v += windLp.p(wind()) * 0.35 * (0.6 + 0.4 * Math.sin(t * 0.7));
    out[i] = Math.tanh(v * 0.9);
  }
  // Mekan prelaz na kraju da se petlja ne čuje
  const f = Math.floor(0.02 * SR);
  for (let i = 0; i < f; i++) {
    out[i] *= i / f;
    out[n - 1 - i] *= i / f;
  }
  return normalize(out, 0.8);
}

export const MUSIC = ['menu', 'game', 'boss'];
