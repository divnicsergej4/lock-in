// Glavni "mozak" igre. Junak stoji na dnu puta i pomera se levo-desno; dok držiš prst, puca napred.
// Levom trakom dolaze zombiji (i iz bočnih ulica), desnom trakom polja napredovanja.
// Ovde su: petlja (60 puta u sekundi), pucanje, pogoci, talasi, polja, šef, pobeda/poraz, kamera i svetla.
import * as THREE from 'three';
import {
  CAMERA, HERO_X_LIMIT, HERO_MOVE_LERP, HERO_Z, LANE_X, SPAWN_Z, ALLEYS_Z, AIM_CONE, CRIT_CHANCE, ROAD_HALF, KEY_SPEED,
} from './core/config.js';
import { createRng } from './core/rng.js';
import { QUALITY_LEVELS, FrameMonitor } from './core/quality.js';
import { Effects } from './fx/Effects.js';
import { createEnvironment } from './world/Environment.js';
import { buildWorld } from './world/World.js';
import { getLevel, nextFieldRow } from './world/levels.js';
import { Hero } from './actors/Hero.js';
import { Horde } from './actors/zombies.js';
import { Boss, BossShots, BOSSES } from './actors/bosses.js';
import { Projectiles } from './combat/projectiles.js';
import { UpgradeField, FIELD_TYPES } from './combat/fields.js';
import { DamageNumbers } from './combat/damageNumbers.js';
import { WEAPONS, nextWeapon } from './combat/weapons.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => t * t * (3 - 2 * t);

const NullSound = { play() {}, music() {}, stopMusic() {} };
const MUZZLE_SCALE = { pistol: 0.8, shotgun: 1.5, rifle: 1, minigun: 0.9, launcher: 1.6 };
const SHOT_SOUND = { pistol: 'pistol', shotgun: 'shotgun', rifle: 'rifle', minigun: 'minigun', launcher: 'launcher' };

export class Game {
  constructor(gl, { onUi, onEvent, sound } = {}) {
    this.gl = gl;
    this.onUi = onUi || (() => {});
    this.onEvent = onEvent || (() => {});
    this.sound = sound || NullSound;
    this.ui = {};

    const canvas = gl.canvas && gl.canvas.addEventListener
      ? gl.canvas
      : { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, style: {}, addEventListener: () => {}, removeEventListener: () => {}, clientHeight: gl.drawingBufferHeight, getContext: () => gl };
    this.renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.width = 0;
    this.height = 0;
    this.viewW = 390;
    this.viewH = 844;

    this.qualityIndex = 2;
    this.quality = { ...QUALITY_LEVELS[this.qualityIndex] };
    this.monitor = new FrameMonitor();

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xffffff, 30, 80);
    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.3, 240);
    this.camPos = new THREE.Vector3(0, 9, 10);
    this.camLook = new THREE.Vector3(0, 0, -16);
    this.baseFov = CAMERA.fov;

    // Svetla: nebo, sunce (senke), bljesak cevi i svetlo baze (noću)
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.position.set(-10, 22, 14);
    this.sun.target.position.set(1, 0, -14);
    this.sun.castShadow = this.quality.shadows;
    const sc = this.sun.shadow.camera;
    sc.left = -24;
    sc.right = 24;
    sc.top = 26;
    sc.bottom = -26;
    sc.near = 1;
    sc.far = 90;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.04;
    this.muzzleLight = new THREE.PointLight(0xffc070, 0, 9, 1.6);
    this.baseLight = new THREE.PointLight(0xffd8a0, 0, 46, 1.1);
    this.baseLight.position.set(0, 5.5, 4.5);
    this.scene.add(this.hemi, this.sun, this.sun.target, this.muzzleLight, this.baseLight);

    this.env = createEnvironment(this.scene);
    this.effects = new Effects(this.scene, { quality: this.quality, fog: { color: 0xffffff, near: 30, far: 80 } });
    this.numbers = new DamageNumbers(this.scene);
    this.projectiles = new Projectiles(this.scene, this.effects);
    this.horde = new Horde(this.scene, this.effects);
    this.bossShots = new BossShots(this.scene, this.effects);
    this.hero = new Hero(this.scene);
    this.fields = [];
    this.boss = null;

    this.mode = 'none';
    this.phase = 'none';
    this.paused = false;
    this.time = 0;
    this.timeScale = 1;
    this.toastId = 0;
    this.hurtId = 0;
    this.input = { down: false, startX: 0, startHeroX: 0 };
    this.keys = { left: false, right: false, fire: false };
    this.targetX = 0;
    this.last = now();
    this.running = true;
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  // ======================= Postavljanje scene =======================
  setViewSize(w, h) {
    this.viewW = w;
    this.viewH = h;
  }

  setupWorld(n, menu = false) {
    if (this.world) this.world.dispose();
    this.fields.forEach((f) => f.dispose());
    this.fields = [];
    if (this.boss) this.boss.dispose();
    this.boss = null;
    this.horde.clear();
    this.projectiles.clear();
    this.effects.clear();
    this.numbers.clear();
    this.bossShots.clear();
    this.level = getLevel(n);
    const th = this.level.theme;
    this.scene.fog.color.set(th.fog.color);
    this.scene.fog.near = th.fog.near;
    this.scene.fog.far = th.fog.far;
    const sm = this.effects.smoke.mesh.material.uniforms;
    sm.fogColor.value.set(th.fog.color);
    sm.fogNear.value = th.fog.near;
    sm.fogFar.value = th.fog.far;
    this.hemi.color.set(th.hemi.sky);
    this.hemi.groundColor.set(th.hemi.ground);
    this.hemi.intensity = th.hemi.intensity;
    this.sun.color.set(th.sun.color);
    this.sun.intensity = th.sun.intensity;
    this.renderer.toneMappingExposure = th.exposure;
    this.baseLight.intensity = th.baseLight ? 60 : 0;
    // Noću zombiji blago svetle da bi se videli u mraku
    this.horde.setNight(!!th.night);
    this.env.setTheme(th);
    this.world = buildWorld(this.level, this.scene, { menu });
    this.rng = createRng(n * 977 + 5);
  }

  // Glavni meni: junak se odmara ispred baze, zombiji lutaju u daljini, kamera polako kruži
  showMenu(n) {
    this.setupWorld(n, true);
    this.mode = 'menu';
    this.phase = 'menu';
    this.paused = false;
    this.timeScale = 1;
    this.hero.setState('menu');
    this.hero.x = 0;
    this.targetX = 0;
    for (let i = 0; i < 9; i++) {
      const types = ['walker', 'walker', 'walker', 'runner', 'brute', 'bloater'];
      this.horde.spawn(types[i % types.length], -LANE_X + rnd(-2, 2) + (i % 3 === 0 ? LANE_X * 1.6 : 0), rnd(-46, -24), { menu: true });
    }
    this.run = null;
    this.emit(true);
  }

  // loadout = { weapon, dmgMul, rateMul, ammo, maxHp }
  startLevel(n, loadout) {
    this.setupWorld(n, false);
    this.loadout = loadout;
    this.mode = 'play';
    this.phase = 'intro';
    this.phaseT = 0;
    this.paused = false;
    this.timeScale = 1;
    this.hero.setState('play');
    this.hero.x = 0;
    this.hero.setWeapon(loadout.weapon);
    this.targetX = 0;
    this.horde.hpMul = this.level.hpMul;
    this.horde.dmgMul = this.level.dmgMul;
    this.horde.speedMul = this.level.speedMul;
    this.run = {
      weapon: loadout.weapon, multishot: 1, dmgMult: 1, fire: false, rateBonus: 0,
      ammo: loadout.ammo, hp: loadout.maxHp, maxHp: loadout.maxHp,
      coins: 0, kills: 0, shots: 0, hits: 0, time: 0, revived: false,
    };
    this.waveIndex = -1;
    this.waveStartT = 0;
    this.waveGap = 1.2;
    this.spawnQueue = [];
    this.fieldTimer = 1.2;
    this.lastAmmoRow = -10;
    this.fireTimer = 0;
    this.spin = 0;
    this.invuln = 0;
    this.emptyT = 0;
    this.endT = 0;
    this.bossIntroT = 0;
    this.bossSpawned = false;
    this.resultSent = false;
    this.result = null;
    this.camPos.set(0, 30, -12);
    this.camLook.set(0, 0, -50);
    this.input.down = false;
    this.releaseKeys();
    this.toast(`NIVO ${n}`, 'epic');
    this.sound.play('levelStart');
    this.sound.music('game');
    this.emit(true);
  }

  restart() {
    if (this.level && this.loadout) this.startLevel(this.level.number, this.loadout);
  }

  setPaused(p) {
    this.paused = p;
    if (p) {
      this.input.down = false;
      this.releaseKeys();
    }
    if (!p) this.last = now();
    this.emit(true);
  }

  // Oživljavanje (za novčiće): pola zdravlja, municija i udarni talas koji odbaci zombije
  revive() {
    const r = this.run;
    if (!r || this.phase !== 'lost') return;
    r.revived = true;
    r.hp = Math.round(r.maxHp * 0.6);
    r.ammo += 30;
    this.invuln = 2.5;
    this.phase = this.boss && this.boss.alive ? 'boss' : 'fight';
    this.hero.setState('play');
    this.timeScale = 1;
    this.effects.ring(this.hero.x, 0, 9);
    this.effects.explosion(this.hero.x, 0.2, -1.5, 0.8, { shake: 0.3, scorch: false });
    for (const zb of this.horde.list) {
      if (!zb.alive) continue;
      const d = Math.hypot(zb.x - this.hero.x, zb.z - HERO_Z);
      if (d < 9) {
        if (zb.type === 'walker' || zb.type === 'runner') {
          if (this.horde.damage(zb, 1e6, { explosive: true, fromX: this.hero.x })) this.onKill(zb);
        } else {
          zb.z -= 6;
          zb.state = 'walk';
        }
      }
    }
    this.sound.play('powerup');
    this.toast('NASTAVI BORBU!', 'epic');
    this.emit(true);
  }

  // ======================= Unos (prst) =======================
  // Prevlačenje: koliko pomeriš prst preko ekrana, toliko se junak pomeri levo-desno. Dok držiš, puca.
  pointerDown(x) {
    this.input.down = true;
    this.input.startX = x;
    this.input.startHeroX = this.targetX;
  }

  pointerMove(x) {
    if (!this.input.down) return;
    const scale = (ROAD_HALF * 2 * 1.2) / Math.max(1, this.viewW);
    this.targetX = clamp(this.input.startHeroX + (x - this.input.startX) * scale, -HERO_X_LIMIT, HERO_X_LIMIT);
  }

  pointerUp() {
    this.input.down = false;
  }

  // Tastatura (na računaru): A/D ili strelice levo-desno pomeraju junaka i dok je taster pritisnut junak puca;
  // razmak (Space) = pucanje u mestu
  setKey(name, down) {
    if (name in this.keys) this.keys[name] = down;
  }

  releaseKeys() {
    this.keys.left = this.keys.right = this.keys.fire = false;
  }

  // Da li igrač trenutno puca (drži prst ili taster)
  isFiring() {
    return this.input.down || this.keys.left || this.keys.right || this.keys.fire;
  }

  // ======================= Petlja =======================
  loop() {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const t = now();
    let dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    if (this.paused || !this.world) return;
    try {
      if (this.monitor.push(dt)) this.lowerQuality();
      dt *= this.timeScale;
      this.time += dt;
      this.update(dt);
      this.render();
    } catch (e) {
      // Greška u jednom kadru ne sme da zaustavi igru
      if (!this.errorLogged) {
        this.errorLogged = true;
        console.error('Greška u igri:', e && e.message, e && e.stack);
      }
    }
  }

  lowerQuality() {
    if (this.qualityIndex === 0) return;
    this.qualityIndex--;
    Object.assign(this.quality, QUALITY_LEVELS[this.qualityIndex]);
    this.sun.castShadow = this.quality.shadows;
    if (this.quality.shadowMap < 2048) {
      this.sun.shadow.mapSize.set(this.quality.shadowMap, this.quality.shadowMap);
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
    }
  }

  update(dt) {
    const t = this.time;
    const hero = this.hero;
    const playing = this.mode === 'play' && (this.phase === 'fight' || this.phase === 'boss' || this.phase === 'intro');

    // ---- Junak: levo-desno ----
    if (this.mode === 'play' && this.phase !== 'lost' && this.phase !== 'won') {
      const dir = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
      if (dir) this.targetX = clamp(this.targetX + dir * KEY_SPEED * dt, -HERO_X_LIMIT, HERO_X_LIMIT);
    }
    const prevX = hero.x;
    if (this.mode === 'play' && this.phase !== 'lost') {
      hero.x += (this.targetX - hero.x) * (1 - Math.exp(-dt * HERO_MOVE_LERP));
    }
    hero.vx = (hero.x - prevX) / Math.max(dt, 1e-4);
    this.invuln = Math.max(0, (this.invuln || 0) - dt);

    if (playing) {
      this.run.time += dt;
      if (this.phase === 'intro') {
        this.phaseT += dt;
        if (this.phaseT > 1.0) this.phase = 'fight';
      }
      this.updateWaves(dt);
      this.updateFields(dt, t);
      this.updateShooting(dt);
    } else {
      hero.aimYaw += (0 - hero.aimYaw) * Math.min(1, dt * 4);
      this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 400);
      if (this.mode === 'play') this.fields.forEach((f) => f.update(dt, t, this.phase === 'won' ? 2 : 0));
    }

    // ---- Zombiji ----
    const heroInfo = { x: hero.x, z: HERO_Z, alive: playing, vx: hero.vx };
    const zev = this.horde.update(dt, t, heroInfo, this.camera);
    for (const e of zev) this.onZombieEvent(e);

    // ---- Šef ----
    if (this.boss) {
      const bev = this.boss.update(dt, t, heroInfo);
      if (playing || !this.boss.alive) for (const e of bev) this.onBossEvent(e);
      if (!this.boss.alive && this.boss.deadT > 4) {
        this.boss.dispose();
        this.boss = null;
      }
    }
    for (const imp of this.bossShots.update(dt)) this.onBossImpact(imp);

    // ---- Projektili ----
    this.projectiles.update(dt, { zombies: this.horde.list, boss: this.boss, fields: this.fields, barrels: this.world.barrels }, (pr, what, obj, point) =>
      this.onHit(pr, what, obj, point),
    );

    // Brojevi štete (sabrano po zombiju, da ne bude previše brojeva)
    for (const zb of this.horde.list) {
      if (zb.dmgAcc > 0.5 && t - (zb.numT || 0) > 0.14) {
        this.numbers.spawn(zb.x, 1.25 * zb.scale + 0.2, zb.z, zb.dmgAcc, zb.lastCrit ? 0xffd34a : zb.burnT > 0 ? 0xff8a3a : 0xffffff, zb.lastCrit ? 0.42 : 0.32);
        zb.dmgAcc = 0;
        zb.numT = t;
        zb.lastCrit = false;
      }
    }

    // ---- Ostalo ----
    hero.update(dt, t, { firing: playing && this.isFiring() && this.run && this.run.ammo >= WEAPONS[this.run.weapon].ammoPerShot });
    this.world.update(dt, t, this.camera);
    this.updateAmbient(dt);
    this.effects.update(dt);
    this.numbers.update(dt, this.camera);
    this.updateEnd(dt);
    this.updateCamera(dt);
    this.env.update(this.camera);
    this.emit(false);
  }

  // ======================= Talasi zombija =======================
  updateWaves(dt) {
    if (this.phase === 'intro') return;
    const lvl = this.level;
    const t = this.run.time;
    // Ubacivanje zombija iz reda čekanja
    while (this.spawnQueue.length && this.spawnQueue[0].at <= t) {
      const s = this.spawnQueue.shift();
      this.spawnZombie(s.type, s.from);
    }
    if (this.phase === 'boss') return;
    const alive = this.horde.countAlive();
    const waveDone = this.spawnQueue.length === 0;
    if (this.waveIndex < lvl.waves.length - 1) {
      const since = t - this.waveStartT;
      if (this.waveIndex < 0 || (waveDone && (alive <= 3 || since > 16))) {
        this.waveGap -= dt;
        if (this.waveGap <= 0 || this.waveIndex < 0) this.startWave(this.waveIndex + 1);
      }
    } else if (waveDone && alive === 0) {
      // Svi talasi su gotovi
      if (lvl.boss && !this.bossSpawned) this.startBoss();
      else if (!lvl.boss) this.win();
    }
  }

  startWave(i) {
    const lvl = this.level;
    const wave = lvl.waves[i];
    this.waveIndex = i;
    this.waveStartT = this.run.time;
    this.waveGap = 0.8;
    const queue = [];
    for (const g of wave.groups) {
      for (let k = 0; k < g.count; k++) {
        queue.push({ type: g.type, from: g.from, at: this.run.time + (k / Math.max(1, g.count)) * wave.spawnTime + rnd(0, 0.9) });
      }
    }
    this.spawnQueue = queue.sort((a, b) => a.at - b.at);
    this.toast(wave.label, i === lvl.waves.length - 1 ? 'danger' : 'wave');
    this.sound.play('wave');
  }

  spawnZombie(type, from) {
    if (from === 'alleyL' || from === 'alleyR') {
      const side = from === 'alleyL' ? -1 : 1;
      const az = ALLEYS_Z[Math.floor(Math.random() * ALLEYS_Z.length)];
      const zb = this.horde.spawn(type, side * rnd(10.5, 12.5), az + rnd(-1, 1), { from: 'alley' });
      if (zb) {
        zb.laneX = side * LANE_X + rnd(-1.4, 1.4);
        this.effects.dust(side * 9, az, 2);
      }
    } else {
      this.horde.spawn(type, -LANE_X + rnd(-2, 2), SPAWN_Z + rnd(0, 7));
    }
  }

  // ======================= Šef =======================
  startBoss() {
    this.bossSpawned = true;
    this.phase = 'boss';
    this.boss = new Boss(this.scene, this.level.boss, { hpMul: this.level.hpMul, dmgMul: this.level.dmgMul });
    this.bossIntroT = 2.2;
    this.toast(BOSSES[this.level.boss].name + '!', 'danger');
    this.sound.play('bossRoar');
    this.sound.music('boss');
    this.effects.shake = 0.5;
    this.emit(true);
  }

  onBossEvent(e) {
    const hero = this.hero;
    switch (e.type) {
      case 'roar':
        this.sound.play('bossRoar');
        this.effects.shake = Math.max(this.effects.shake, 0.45);
        break;
      case 'summon':
        for (let i = 0; i < e.count; i++) {
          const zb = this.horde.spawn(e.kind, clamp(e.x + rnd(-3, 3), -ROAD_HALF + 0.5, ROAD_HALF - 0.5), e.z + rnd(-2, 1));
          if (zb) {
            zb.state = 'chase';
            this.effects.dust(zb.x, zb.z, 1.5);
          }
        }
        break;
      case 'rock':
        this.bossShots.throwShot(e, 'rock');
        this.sound.play('throw');
        break;
      case 'acid':
        this.bossShots.throwShot(e, 'acid');
        this.sound.play('spit');
        break;
      case 'telegraph':
        this.bossShots.telegraph(e.x, e.z, e.r, e.time, e.color);
        break;
      case 'slam':
        this.effects.ring(e.x, e.z, e.r * 1.6);
        this.effects.dust(e.x, e.z, 4);
        this.effects.burst(e.x, 0.3, e.z, 0x6a5a48, 12, 1.4, { size: 1.6 });
        this.effects.shake = Math.max(this.effects.shake, 0.6);
        this.sound.play('slam');
        if (Math.hypot(hero.x - e.x, HERO_Z - e.z) < e.r + 0.3) this.damageHero(e.dmg);
        break;
      case 'contact':
        this.damageHero(e.dmg);
        this.sound.play('slam');
        break;
      case 'stagger':
        this.sound.play('hit');
        break;
      default:
        break;
    }
  }

  onBossImpact(imp) {
    if (imp.kind === 'rock') {
      this.effects.burst(imp.x, 0.4, imp.z, 0x7d736b, 10, 1.3, { size: 1.8 });
      this.effects.dust(imp.x, imp.z, 3);
      this.effects.ring(imp.x, imp.z, imp.r * 1.4);
      this.effects.shake = Math.max(this.effects.shake, 0.35);
      this.sound.play('slam');
    } else {
      this.effects.toxicBlast(imp.x, 0.2, imp.z, 0.45);
      this.sound.play('splash');
    }
    if (this.mode === 'play' && (this.phase === 'boss' || this.phase === 'fight') && Math.abs(this.hero.x - imp.x) < imp.r + 0.2 && Math.abs(HERO_Z - imp.z) < imp.r + 0.6) {
      this.damageHero(imp.dmg);
    }
  }

  // ======================= Polja napredovanja =======================
  updateFields(dt, t) {
    const r = this.run;
    const w = WEAPONS[r.weapon];
    if (this.phase !== 'won' && this.phase !== 'lost') {
      this.fieldTimer -= dt;
      const lowAmmo = r.ammo < w.ammoPerShot * 10;
      const ammoComing = this.fields.some((f) => f.alive && !f.passed && f.type === 'ammo' && f.value > 0 && f.z > -40);
      const needAmmo = lowAmmo && !ammoComing && r.time - this.lastAmmoRow > 4;
      if (this.fieldTimer <= 0 || needAmmo) {
        const row = nextFieldRow(this.rng, this.level.number, { ammo: r.ammo, weapon: r.weapon, needAmmo });
        const z = needAmmo ? -26 : SPAWN_Z;
        for (const it of row) {
          const f = new UpgradeField(this.world.group, it.type, it.x, z, { halfW: it.halfW || 1.05, value: it.value ?? 0, chargeMul: this.level.chargeMul });
          this.fields.push(f);
          if (it.type === 'ammo' && f.value > 0) this.lastAmmoRow = r.time;
        }
        this.fieldTimer = this.phase === 'boss' ? rnd(5, 6) : rnd(3.6, 4.6);
      }
    }
    const hero = this.hero;
    this.fields = this.fields.filter((f) => {
      f.update(dt, t);
      if (f.arrived()) {
        f.passed = true;
        if (Math.abs(hero.x - f.x) <= f.halfW + 0.1) this.collectField(f);
      }
      if (!f.alive) {
        f.dispose();
        return false;
      }
      return true;
    });
  }

  collectField(f) {
    const r = this.run;
    const def = FIELD_TYPES[f.type];
    const hx = this.hero.x;
    let text = '';
    let kind = 'good';
    if (def.kind === 'numeric') {
      const v = Math.round(f.value);
      if (f.type === 'ammo') {
        r.ammo = Math.max(0, r.ammo + v);
        text = `${v > 0 ? '+' : ''}${v} MUNICIJA`;
      } else if (f.type === 'health') {
        r.hp = clamp(r.hp + v, 1, r.maxHp);
        text = `${v > 0 ? '+' : ''}${v} ZDRAVLJE`;
      } else {
        r.coins = Math.max(0, r.coins + Math.round(v * this.level.coinMul));
        text = `${v > 0 ? '+' : ''}${Math.round(v * this.level.coinMul)} ZLATNIKA`;
      }
      kind = v > 0 ? 'good' : 'bad';
    } else if (!f.unlocked) {
      text = 'ZAKLJUČANO!';
      kind = 'bad';
      this.sound.play('locked');
      this.toast(text, kind);
      return;
    } else {
      text = def.toast;
      kind = 'epic';
      switch (f.type) {
        case 'bullets2':
          r.multishot = Math.min(8, r.multishot * 2);
          break;
        case 'bullets3':
          r.multishot = Math.min(8, r.multishot * 3);
          break;
        case 'damage2':
          r.dmgMult = Math.min(24, r.dmgMult * 2);
          break;
        case 'damage3':
          r.dmgMult = Math.min(24, r.dmgMult * 3);
          break;
        case 'fire':
          if (r.fire) {
            r.dmgMult = Math.min(24, r.dmgMult * 1.5);
            text = 'JAČA VATRA!';
          }
          r.fire = true;
          break;
        case 'rate':
          r.rateBonus += 0.3;
          break;
        case 'weapon': {
          const nw = nextWeapon(r.weapon);
          if (nw) {
            r.weapon = nw;
            this.hero.setWeapon(nw);
            text = WEAPONS[nw].name + '!';
            r.ammo += 15;
          } else {
            r.dmgMult = Math.min(24, r.dmgMult * 1.5);
            text = 'ŠTETA +50%';
          }
          break;
        }
        default:
          break;
      }
    }
    this.effects.collect(hx, HERO_Z - 0.2, kind === 'bad' ? 0xe03a3a : FIELD_TYPES[f.type].color, kind === 'epic');
    this.sound.play(kind === 'bad' ? 'gateBad' : kind === 'epic' ? 'powerup' : 'gateGood');
    this.toast(text, kind);
    this.emit(true);
  }

  // ======================= Pucanje =======================
  updateShooting(dt) {
    const r = this.run;
    const hero = this.hero;
    const w = WEAPONS[r.weapon];
    // Meta: najbliži zombi ispred junaka u uglu nišana (ili šef); inače pravo napred
    const target = this.findTarget(w);
    let desiredYaw = 0;
    let aimY = 1.0;
    if (target) {
      const p = target.aimPoint();
      desiredYaw = Math.atan2(-(p[0] - hero.x), -(p[2] - HERO_Z));
      aimY = p[1];
    }
    hero.aimYaw += (desiredYaw - hero.aimYaw) * Math.min(1, dt * 18);
    this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 400);

    const firing = this.isFiring() && this.phase !== 'intro';
    const rate = w.rate * this.loadout.rateMul * (1 + r.rateBonus);
    if (w.spinUp) this.spin = firing ? Math.min(1, this.spin + dt / w.spinUp) : Math.max(0, this.spin - dt * 2);
    const effRate = w.spinUp ? rate * (0.3 + 0.7 * this.spin) : rate;
    this.fireTimer -= dt;
    if (!firing) {
      this.fireTimer = Math.max(this.fireTimer, 0);
      return;
    }
    if (r.ammo < w.ammoPerShot) {
      this.emptyT -= dt;
      if (this.emptyT <= 0) {
        this.emptyT = 0.45;
        this.sound.play('empty');
      }
      return;
    }
    // Ne troši municiju u prazno: puca samo kad ispred ima zombija, polje ili bure
    if (!target && !this.somethingAhead()) {
      this.fireTimer = Math.max(this.fireTimer, 0);
      return;
    }
    let guard = 0;
    while (this.fireTimer <= 0 && r.ammo >= w.ammoPerShot && guard++ < 4) {
      this.shoot(w, target, aimY);
      this.fireTimer += 1 / effRate;
    }
    if (this.fireTimer < -0.2) this.fireTimer = 0;
  }

  somethingAhead() {
    const x = this.hero.x;
    for (const f of this.fields) if (f.alive && !f.passed && f.z > -48 && Math.abs(f.x - x) < f.halfW + 0.2) return true;
    for (const b of this.world.barrels) if (b.alive && Math.abs(b.x - x) < 0.9 && b.z > -45) return true;
    return false;
  }

  findTarget(w) {
    const hero = this.hero;
    let best = null;
    let bestScore = Infinity;
    // Na desnoj strani junak gađa polja napredovanja (pravo napred), osim ako mu zombi nije blizu
    const fieldSide = hero.x > 0.5;
    const consider = (obj, x, z, big) => {
      const dz = HERO_Z - z;
      if (dz < 0.3 || dz > w.range) return;
      if (fieldSide && x < 0.3 && dz > 8) return;
      const dx = x - hero.x;
      const ang = Math.abs(Math.atan2(dx, dz));
      const close = dz < 5;
      if (ang > (close ? 1.1 : AIM_CONE) && !(big && ang < AIM_CONE * 1.6)) return;
      const score = dz + ang * 18 - (close ? 30 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = obj;
      }
    };
    for (const zb of this.horde.list) if (zb.alive) consider(zb, zb.x, zb.z, zb.type === 'brute');
    if (this.boss && this.boss.alive) consider(this.boss, this.boss.x, this.boss.z, true);
    return best;
  }

  shoot(w, target, aimY) {
    const r = this.run;
    const hero = this.hero;
    r.ammo = Math.max(0, r.ammo - w.ammoPerShot);
    r.shots++;
    const muzzle = hero.muzzleWorld(new THREE.Vector3());
    const baseYaw = hero.aimYaw;
    const dist = target ? Math.max(2, Math.hypot(target.aimPoint()[0] - muzzle.x, target.aimPoint()[2] - muzzle.z)) : 25;
    const pitch = Math.atan2(aimY - muzzle.y, dist);
    const streams = r.multishot;
    const crit = Math.random() < CRIT_CHANCE;
    const dmg = w.dmg * this.loadout.dmgMul * r.dmgMult * (crit ? 2 : 1);
    const color = r.fire ? 0xff5a1a : w.tracer;
    for (let s = 0; s < streams; s++) {
      const fan = (s - (streams - 1) / 2) * (w.kind === 'grenade' ? 0.12 : 0.075);
      for (let p = 0; p < w.pellets; p++) {
        const spread = (Math.random() - 0.5) * w.spread * 2;
        const yaw = baseYaw + fan + spread;
        const pp = pitch + (Math.random() - 0.5) * w.spread * 0.5;
        const dir = [-Math.sin(yaw) * Math.cos(pp), Math.sin(pp), -Math.cos(yaw) * Math.cos(pp)];
        let gTarget = null;
        if (w.kind === 'grenade') {
          const tp = target ? target.aimPoint() : [hero.x, 0, HERO_Z - 22];
          const d = Math.hypot(tp[0] - muzzle.x, tp[2] - muzzle.z);
          gTarget = [muzzle.x + dir[0] / Math.max(0.01, Math.hypot(dir[0], dir[2])) * d, 0, muzzle.z + dir[2] / Math.max(0.01, Math.hypot(dir[0], dir[2])) * d];
        }
        this.projectiles.fire(muzzle, dir, {
          dmg, speed: w.speed, range: w.range, kind: w.kind, color, width: w.width * (r.fire ? 1.3 : 1),
          fire: r.fire ? dmg * 0.5 : 0, knock: w.knock, splash: w.splash || 0, crit, target: gTarget,
        });
      }
    }
    // Efekti pucnja
    const ms = MUZZLE_SCALE[w.id] || 1;
    this.effects.muzzleBig(muzzle.x, muzzle.y, muzzle.z, ms);
    if (w.kind !== 'grenade') this.effects.casing(muzzle.x + 0.1, muzzle.y - 0.05, muzzle.z + 0.35, hero.aimYaw);
    this.muzzleLight.position.copy(muzzle);
    this.muzzleLight.intensity = 26 * ms;
    hero.kick(w.recoil * 0.5);
    if (w.id !== 'minigun' || r.shots % 2 === 0) this.sound.play(SHOT_SOUND[w.id]);
    this.camShake = Math.max(this.camShake || 0, w.recoil * 0.03);
  }

  // Šta se desi kad metak nešto pogodi. Vraća true ako metak leti dalje.
  onHit(pr, what, obj, point) {
    const r = this.run;
    if (pr.kind === 'grenade' && (what === 'zombie' || what === 'boss' || what === 'ground' || what === 'barrel')) {
      this.grenadeBlast(point[0], point[2], pr);
      return false;
    }
    if (what === 'zombie') {
      if (r) r.hits++;
      this.effects.blood(point[0], point[1], point[2], 2);
      if (pr.fire) this.effects.flame(point[0], point[1], point[2]);
      else if (Math.random() < 0.4) this.effects.impact(point[0], point[1], point[2]);
      obj.lastCrit = obj.lastCrit || pr.crit;
      if (this.horde.damage(obj, pr.dmg, { knock: pr.knock, fire: pr.fire })) this.onKill(obj);
      this.sound.play('hit');
      return false;
    }
    if (what === 'boss') {
      if (r) r.hits++;
      this.effects.blood(point[0], point[1], point[2], 1);
      this.effects.impact(point[0], point[1], point[2]);
      if (pr.fire) this.effects.flame(point[0], point[1], point[2]);
      this.bossDamage(pr.dmg * (pr.fire ? 1.25 : 1), point, pr.crit);
      return false;
    }
    if (what === 'field') {
      const res = obj.hit(pr.dmg);
      this.effects.impact(point[0], point[1], point[2]);
      if (pr.kind === 'grenade') {
        this.effects.explosion(point[0], point[1] - 0.8, point[2] + 0.3, 0.45, { shake: 0.1, scorch: false });
        this.sound.play('explosion');
      }
      if (res === 'unlock') {
        this.effects.collect(obj.x, obj.z, FIELD_TYPES[obj.type].color, true);
        this.sound.play('unlock');
        this.toast('OTKLJUČANO!', 'good');
      } else {
        this.sound.play('tick');
      }
      return false;
    }
    if (what === 'barrel') {
      obj.hp -= pr.dmg;
      this.effects.impact(point[0], point[1], point[2]);
      if (obj.hp <= 0 && obj.alive) this.explodeBarrel(obj);
      return false;
    }
    return false;
  }

  bossDamage(dmg, point, crit) {
    const b = this.boss;
    if (!b || !b.alive) return;
    const died = b.damage(dmg);
    b.dmgAcc = (b.dmgAcc || 0) + dmg;
    if (this.time - (b.numT || 0) > 0.12) {
      this.numbers.spawn(point[0], point[1] + 0.6, point[2], b.dmgAcc, crit ? 0xffd34a : 0xffffff, crit ? 0.6 : 0.48);
      b.dmgAcc = 0;
      b.numT = this.time;
    }
    this.sound.play('hit');
    if (died) this.onBossKilled();
  }

  grenadeBlast(x, z, pr) {
    const rad = pr.splash || 3;
    this.effects.explosion(x, 0.2, z, 0.85, { shake: 0.25 });
    this.sound.play('explosion');
    for (const zb of this.horde.list) {
      if (!zb.alive) continue;
      const d = Math.hypot(zb.x - x, zb.z - z);
      if (d < rad + zb.def.radius * zb.scale / 1.6) {
        const k = 1 - Math.min(1, d / rad) * 0.5;
        zb.lastCrit = pr.crit;
        if (this.horde.damage(zb, pr.dmg * k, { knock: 1, fire: pr.fire, explosive: true, fromX: x })) this.onKill(zb);
        if (this.run) this.run.hits++;
      }
    }
    if (this.boss && this.boss.alive && Math.hypot(this.boss.x - x, this.boss.z - z) < rad + this.boss.radius) this.bossDamage(pr.dmg, [x, 2.5, z], pr.crit);
    for (const b of this.world.barrels) if (b.alive && Math.hypot(b.x - x, b.z - z) < rad) this.explodeBarrel(b);
  }

  explodeBarrel(b) {
    b.alive = false;
    this.world.hideBarrel(b);
    this.effects.explosion(b.x, 0.3, b.z, 1.2, { shake: 0.45 });
    this.sound.play('explosion');
    const rad = 4.2;
    const dmg = 120 * this.level.hpMul;
    for (const zb of this.horde.list) {
      if (!zb.alive) continue;
      const d = Math.hypot(zb.x - b.x, zb.z - b.z);
      if (d < rad && this.horde.damage(zb, dmg * (1 - d / rad * 0.4), { knock: 1.2, explosive: true, fromX: b.x })) this.onKill(zb);
    }
    if (this.boss && this.boss.alive && Math.hypot(this.boss.x - b.x, this.boss.z - b.z) < rad + this.boss.radius) this.bossDamage(dmg, [b.x, 2.5, b.z], false);
    this.toast('BUM!', 'good');
  }

  onKill(zb) {
    const r = this.run;
    if (!r) return;
    r.kills++;
    const c = Math.round(zb.def.coin * this.level.coinMul);
    r.coins += c;
    this.effects.coinPop(zb.x, 1.3 * zb.scale, zb.z);
    this.effects.splat(zb.x, zb.z, 0.9 + zb.scale * 0.35);
    if (zb.type !== 'bloater') this.sound.play('zombieDie');
    // Ponekad zombi ostavi malo municije koja odleti do junaka
    if (Math.random() < 0.07) {
      r.ammo += 3;
      this.effects.sparkle(this.hero.x, 1.4, HERO_Z, new THREE.Color(0.5, 1, 0.5));
    }
  }

  onBossKilled() {
    const b = this.boss;
    this.run.kills++;
    this.run.coins += Math.round(b.def.coin * this.level.coinMul);
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        if (this.mode !== 'play') return;
        this.effects.explosion(b.x + rnd(-2, 2), rnd(0.5, 3), b.z + rnd(-1.5, 1.5), rnd(1, 1.6), { shake: 0.5, scorch: i === 0 });
        this.sound.play('explosion');
      }, 120 + i * 220);
    }
    this.sound.play('bossDie');
    for (const zb of this.horde.list) if (zb.alive && this.horde.damage(zb, 1e9, { explosive: true, fromX: b.x })) this.onKill(zb);
    this.win();
  }

  onZombieEvent(e) {
    if (e.type === 'hit') {
      if (this.mode === 'play' && (this.phase === 'fight' || this.phase === 'boss')) {
        this.damageHero(e.dmg);
        this.sound.play('zombieAttack');
      }
    } else if (e.type === 'explode') {
      const rad = 3.2;
      this.effects.toxicBlast(e.x, 0.3, e.z, 1);
      this.sound.play('explosion');
      for (const zb of this.horde.list) {
        if (!zb.alive || zb === e.zb) continue;
        const d = Math.hypot(zb.x - e.x, zb.z - e.z);
        if (d < rad && this.horde.damage(zb, 70 * this.level.hpMul * (1 - d / rad * 0.5), { knock: 1, explosive: true, fromX: e.x })) this.onKill(zb);
      }
      if (this.mode === 'play' && Math.hypot(this.hero.x - e.x, HERO_Z - e.z) < rad + 0.3) this.damageHero(e.zb.def.dmg * this.level.dmgMul);
    } else if (e.type === 'killed') {
      this.onKill(e.zb);
    }
  }

  damageHero(dmg) {
    const r = this.run;
    if (!r || this.invuln > 0 || this.phase === 'won' || this.phase === 'lost') return;
    r.hp = Math.max(0, r.hp - dmg);
    this.invuln = 0.3;
    this.hero.hurt();
    this.hurtId++;
    this.effects.shake = Math.max(this.effects.shake, 0.25);
    this.sound.play('hurt');
    if (r.hp <= 0) this.lose();
    this.emit(true);
  }

  // ======================= Kraj nivoa =======================
  win() {
    if (this.phase === 'won' || this.phase === 'lost') return;
    this.phase = 'won';
    this.endT = 0;
    this.input.down = false;
    this.releaseKeys();
    this.hero.setState('victory');
    this.effects.confetti(this.hero.x, -3, 100);
    this.sound.play('victory');
    this.sound.music('none');
    this.toast('POBEDA!', 'epic');
    const r = this.run;
    const hpPct = r.hp / r.maxHp;
    const bonus = Math.round((40 + this.level.number * 12) * (hpPct >= 0.7 ? 1.5 : 1));
    r.coins += bonus;
    this.result = {
      won: true, level: this.level.number, kills: r.kills, coins: r.coins, bonus,
      accuracy: r.shots ? Math.min(1, r.hits / (r.shots * r.multishot)) : 0,
      stars: hpPct >= 0.7 ? 3 : hpPct >= 0.35 ? 2 : 1, hpPct,
      waves: this.level.waves.length, boss: !!this.level.boss,
    };
    this.emit(true);
  }

  lose() {
    if (this.phase === 'won' || this.phase === 'lost') return;
    this.phase = 'lost';
    this.endT = 0;
    this.input.down = false;
    this.releaseKeys();
    this.hero.setState('dead');
    this.timeScale = 0.45;
    this.sound.play('defeat');
    this.sound.music('none');
    const r = this.run;
    const total = this.level.waves.length + (this.level.boss ? 1 : 0);
    this.result = {
      won: false, level: this.level.number, kills: r.kills, coins: r.coins, canRevive: !r.revived,
      progress: Math.min(1, Math.max(0, this.waveIndex) / total),
    };
    this.emit(true);
  }

  updateEnd(dt) {
    if (this.mode !== 'play') return;
    if (this.phase === 'won' || this.phase === 'lost') {
      this.endT += dt / Math.max(0.01, this.timeScale);
      if (this.phase === 'lost' && this.endT > 1.2) this.timeScale = 1;
      if (this.endT > 1.2 && !this.resultSent) {
        this.resultSent = true;
        this.onEvent(this.phase, this.result);
      }
    } else {
      this.resultSent = false;
    }
  }

  // ======================= Atmosfera =======================
  updateAmbient(dt) {
    for (const e of this.world.emitters) {
      e.acc += dt * e.rate * this.quality.particles;
      while (e.acc >= 1) {
        e.acc -= 1;
        if (e.type === 'smoke') this.effects.smokeColumn(e.x, e.y, e.z);
        else this.effects.flame(e.x, e.y, e.z);
      }
    }
    if (this.quality.ambient && Math.random() < dt * 5) this.effects.ambientKind(this.level.theme.ambient, 0, -10);
    // Zombiji povremeno ječe (češće kad ih je više)
    if (this.mode === 'play' && this.phase !== 'won') {
      this.groanT = (this.groanT ?? 2) - dt;
      const alive = this.horde.countAlive();
      if (this.groanT <= 0 && alive > 0) {
        this.groanT = rnd(1.4, 3.2) / Math.min(2, 0.6 + alive * 0.08);
        this.sound.play('groan' + (1 + Math.floor(Math.random() * 3)), { vol: 0.8 });
      }
    }
  }

  // ======================= Kamera =======================
  updateCamera(dt) {
    const hero = this.hero;
    let pos;
    let look;
    if (this.mode === 'menu') {
      const a = this.time * 0.12;
      pos = new THREE.Vector3(Math.sin(a) * 6.5, 3.2 + Math.sin(this.time * 0.3) * 0.4, 6.5 + Math.cos(a) * 1.5);
      look = new THREE.Vector3(0, 1.4, -2);
    } else {
      pos = new THREE.Vector3(hero.x * CAMERA.followX, CAMERA.height, CAMERA.back);
      look = new THREE.Vector3(hero.x * CAMERA.followX * 0.8, 0, CAMERA.lookZ);
      if (this.phase === 'boss' && this.boss) {
        pos.y += 1.2;
        pos.z += 1.5;
        if (this.bossIntroT > 0) {
          // Kamera kratko pogleda šefa dok ulazi
          this.bossIntroT -= dt;
          const k = smooth(Math.min(1, this.bossIntroT / 2.2));
          pos.lerp(new THREE.Vector3(this.boss.x * 0.5, 6, this.boss.z + 18), k * 0.85);
          look.lerp(new THREE.Vector3(this.boss.x, 3, this.boss.z), k);
        }
      }
      if (this.phase === 'won') {
        pos.set(hero.x + Math.sin(this.time * 0.4) * 3, 3.6, 5.8);
        look.set(hero.x, 1.3, -1);
      }
      if (this.phase === 'lost') {
        pos.set(hero.x * 0.6, 5, 4.6);
        look.set(hero.x, 0.5, -1.5);
      }
    }
    const k = this.phase === 'intro' ? 1 - Math.exp(-dt * 3.6) : 1 - Math.exp(-dt * 5);
    this.camPos.lerp(pos, this.mode === 'menu' ? 1 - Math.exp(-dt * 2) : k);
    this.camLook.lerp(look, k);
    this.camera.position.copy(this.camPos);

    const shake = Math.max(this.effects.shake, this.camShake || 0);
    this.effects.shake = Math.max(0, this.effects.shake - dt * 1.4);
    this.camShake = Math.max(0, (this.camShake || 0) - dt * 2);
    if (shake > 0) {
      const a = Math.min(0.5, shake * shake) * 1.2 + (this.camShake || 0) * 0.5;
      const t = this.time * 45;
      this.camera.position.x += Math.sin(t * 1.3) * a;
      this.camera.position.y += Math.sin(t * 1.7 + 1) * a * 0.7;
    }
    this.camera.lookAt(this.camLook);
  }

  render() {
    const gl = this.gl;
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    if (w !== this.width || h !== this.height) {
      this.width = w;
      this.height = h;
      this.renderer.setViewport(0, 0, w, h);
      this.camera.aspect = w / Math.max(1, h);
      this.camera.fov = this.camera.aspect < 0.7 ? CAMERA.fov : 52;
      this.camera.updateProjectionMatrix();
    }
    if (w === 0 || h === 0) return;
    this.renderer.render(this.scene, this.camera);
    gl.endFrameEXP();
  }

  // ======================= Prikaz na ekranu (HUD) =======================
  toast(text, kind = 'good') {
    this.toastId++;
    this.toastMsg = { id: this.toastId, text, kind };
  }

  emit(force) {
    const r = this.run;
    const w = r ? WEAPONS[r.weapon] : null;
    const lvl = this.level;
    const totalSteps = lvl ? lvl.waves.length + (lvl.boss ? 1 : 0) : 1;
    let progress = 0;
    if (lvl && r) {
      progress = Math.max(0, this.waveIndex) / totalSteps;
      if (this.phase === 'boss') progress = lvl.waves.length / totalSteps;
      if (this.phase === 'won') progress = 1;
    }
    const next = {
      mode: this.mode,
      phase: this.phase,
      paused: this.paused,
      level: lvl ? lvl.number : 1,
      theme: lvl ? lvl.theme.name : '',
      bossLevel: lvl ? !!lvl.boss : false,
      hp: r ? Math.ceil(r.hp) : 0,
      maxHp: r ? r.maxHp : 1,
      ammo: r ? Math.floor(r.ammo) : 0,
      ammoPerShot: w ? w.ammoPerShot : 1,
      weapon: w ? w.id : '',
      weaponName: w ? w.name : '',
      multishot: r ? r.multishot : 1,
      dmgMult: r ? Math.round(r.dmgMult * 10) / 10 : 1,
      fire: r ? r.fire : false,
      rateBonus: r ? Math.round(r.rateBonus * 100) : 0,
      coins: r ? r.coins : 0,
      kills: r ? r.kills : 0,
      wave: Math.max(0, this.waveIndex + 1),
      waves: lvl ? lvl.waves.length : 0,
      progress: Math.round(progress * 100) / 100,
      bossName: this.boss ? this.boss.def.name : null,
      bossHp: this.boss && this.phase === 'boss' ? Math.max(0, Math.ceil(this.boss.hp)) : null,
      bossMax: this.boss ? this.boss.maxHp : 1,
      empty: r ? r.ammo < (w ? w.ammoPerShot : 1) : false,
      hurtId: this.hurtId,
      toast: this.toastMsg || null,
    };
    if (!force) {
      const prev = this.ui;
      let changed = false;
      for (const k in next) {
        if (next[k] !== prev[k]) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
    }
    this.ui = next;
    this.onUi(next);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (this.world) this.world.dispose();
    this.fields.forEach((f) => f.dispose());
    if (this.boss) this.boss.dispose();
    this.hero.dispose();
    this.renderer.dispose();
  }
}
