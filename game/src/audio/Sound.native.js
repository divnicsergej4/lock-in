// Zvuk za telefon: unapred napravljeni WAV fajlovi (scripts/make-sounds.mjs) puštaju se preko expo-audio.
// Za efekte koji se često ponavljaju (pucnji) postoji više plejera, pa se zvukovi mogu preklapati.
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { SOUNDS } from './synth.js';
import { FILES } from './files.native.js';

const pools = {};
const index = {};
const last = {};
const musicPlayers = {};
let current = null;
let wanted = 'none';
let ready = false;
let paused = false;
const enabled = { sfx: true, music: true };
const now = () => Date.now() / 1000;

function fade(player, to, ms, done) {
  const steps = 10;
  const from = player.volume;
  let i = 0;
  const id = setInterval(() => {
    i++;
    try {
      player.volume = from + ((to - from) * i) / steps;
    } catch {
      // plejer je uklonjen
    }
    if (i >= steps) {
      clearInterval(id);
      if (done) done();
    }
  }, ms / steps);
}

const Sound = {
  init() {
    if (ready) return;
    ready = true;
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
    for (const [name, def] of Object.entries(SOUNDS)) {
      if (!FILES[name]) continue;
      pools[name] = Array.from({ length: def.voices }, () => createAudioPlayer(FILES[name]));
      index[name] = 0;
    }
    if (wanted !== 'none') {
      const w = wanted;
      wanted = 'none';
      Sound.music(w);
    }
  },

  play(name, { vol = 1 } = {}) {
    if (!ready || !enabled.sfx || paused) return;
    const def = SOUNDS[name];
    const pool = pools[name];
    if (!def || !pool) return;
    const t = now();
    if (t - (last[name] || 0) < def.gap) return;
    last[name] = t;
    const p = pool[index[name]++ % pool.length];
    try {
      p.volume = def.vol * vol;
      p.seekTo(0)
        .then(() => p.play())
        .catch(() => {});
    } catch {
      // zvuk nije uspeo; igra ide dalje
    }
  },

  music(name) {
    wanted = name;
    if (!ready) return;
    if (current && current.name === name) return;
    if (current) {
      const old = current.player;
      fade(old, 0, 500, () => old.pause());
      current = null;
    }
    if (name === 'none' || !enabled.music) return;
    const key = 'music-' + name;
    if (!FILES[key]) return;
    if (!musicPlayers[name]) {
      musicPlayers[name] = createAudioPlayer(FILES[key]);
      musicPlayers[name].loop = true;
    }
    const p = musicPlayers[name];
    p.volume = 0;
    p.seekTo(0)
      .then(() => {
        if (!paused) p.play();
      })
      .catch(() => {});
    fade(p, name === 'menu' ? 0.5 : 0.38, 800);
    current = { name, player: p };
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
    paused = p;
    if (current) {
      if (p) current.player.pause();
      else current.player.play();
    }
  },
};

export default Sound;
