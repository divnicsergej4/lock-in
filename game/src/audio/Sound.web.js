// Zvuk za web (pregledač): efekti i muzika se prave kodom (synth.js) i puštaju preko Web Audio.
// Pregledači dozvoljavaju zvuk tek posle prvog dodira, zato init() pozivamo na prvi dodir.
import { SOUNDS, generateMusic, SR } from './synth.js';

let ctx = null;
let sfxGain = null;
let musicGain = null;
const buffers = {};
const musicBuffers = {};
const last = {};
const active = {};
let current = null;
let wanted = 'none';
const enabled = { sfx: true, music: true };

function toBuffer(samples) {
  const b = ctx.createBuffer(1, samples.length, SR);
  b.getChannelData(0).set(samples);
  return b;
}

function musicBuffer(name) {
  if (!musicBuffers[name]) musicBuffers[name] = toBuffer(generateMusic(name));
  return musicBuffers[name];
}

const Sound = {
  // za proveru u testovima
  status() {
    return { state: ctx ? ctx.state : 'none', buffers: Object.keys(buffers).length, music: current ? current.name : 'none', enabled: { ...enabled } };
  },

  init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    try {
      ctx = new AC();
    } catch {
      ctx = null;
      return;
    }
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.9;
    sfxGain.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 1;
    musicGain.connect(ctx.destination);
    for (const [name, def] of Object.entries(SOUNDS)) buffers[name] = toBuffer(def.gen());
    // Muzika za borbu se pravi malo kasnije (dok je igrač u meniju), da ne zastane ekran
    setTimeout(() => {
      try {
        musicBuffer('game');
        setTimeout(() => musicBuffer('boss'), 800);
      } catch {
        // bez muzike ako nema memorije
      }
    }, 1500);
    if (wanted !== 'none') {
      const w = wanted;
      wanted = 'none';
      Sound.music(w);
    }
  },

  play(name, { vol = 1, rate } = {}) {
    if (!ctx || !enabled.sfx || ctx.state !== 'running') return;
    const def = SOUNDS[name];
    const buf = buffers[name];
    if (!def || !buf) return;
    const now = ctx.currentTime;
    if (now - (last[name] || -1) < def.gap) return;
    if ((active[name] || 0) >= def.voices) return;
    last[name] = now;
    active[name] = (active[name] || 0) + 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate || 0.94 + Math.random() * 0.12;
    const g = ctx.createGain();
    g.gain.value = def.vol * vol;
    src.connect(g).connect(sfxGain);
    src.onended = () => {
      active[name] = Math.max(0, (active[name] || 1) - 1);
    };
    src.start();
  },

  // name: 'menu' | 'game' | 'boss' | 'none'
  music(name) {
    wanted = name;
    if (!ctx) return;
    if (current && current.name === name) return;
    if (current) {
      const old = current;
      old.gain.gain.cancelScheduledValues(ctx.currentTime);
      old.gain.gain.setValueAtTime(old.gain.gain.value, ctx.currentTime);
      old.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      setTimeout(() => {
        try {
          old.src.stop();
        } catch {
          // već zaustavljeno
        }
      }, 700);
      current = null;
    }
    if (name === 'none' || !enabled.music) return;
    const src = ctx.createBufferSource();
    src.buffer = musicBuffer(name);
    src.loop = true;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(name === 'menu' ? 0.5 : 0.38, ctx.currentTime + 0.9);
    src.connect(g).connect(musicGain);
    src.start();
    current = { name, src, gain: g };
  },

  setEnabled({ sfx, music }) {
    if (sfx !== undefined) enabled.sfx = sfx;
    if (music !== undefined) {
      enabled.music = music;
      const w = wanted;
      if (!music && current) {
        Sound.music('none');
        wanted = w;
      } else if (music && w !== 'none' && !current) {
        Sound.music(w);
      }
    }
  },

  setPaused(p) {
    if (!ctx) return;
    if (p) ctx.suspend();
    else ctx.resume();
  },
};

export default Sound;
