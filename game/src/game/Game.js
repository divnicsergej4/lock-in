// Glavni "mozak" igre: petlja (60 puta u sekundi), kretanje kroz dve trake, automatsko pucanje,
// zombiji, kocke sa nagradama, oružja, šef na kraju, kamera, svetlo i efekti.
import * as THREE from 'three';
import {
  FORWARD_SPEED, LANE_X, LANE_CENTER_RANGE, STEER_LERP, START_ARMY, THREAT_RANGE, MAX_PROJECTILES_PER_FRAME,
} from './config.js';
import { generateLevel } from './levelGen.js';
import { buildLevel, disposeLevel, animateWorld, hideInstance, ARENA_HALF } from './World.js';
import { Crowd } from './Crowd.js';
import { Effects } from './Effects.js';
import { Fallen } from './Fallen.js';
import { Horde } from './zombies.js';
import { Projectiles } from './projectiles.js';
import { WEAPONS, MAX_TIER } from './weapons.js';
import { CUBE_TYPES } from './cubes.js';
import { createEnvironment } from './Environment.js';
import { QUALITY_LEVELS, FrameMonitor } from './quality.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const rnd = (a, b) => a + Math.random() * (b - a);
const smooth = (t) => t * t * (3 - 2 * t);

export const PHASE = {
  READY: 'ready', // glavni meni
  RUN: 'run', // trčanje kroz trake
  BOSS: 'boss', // borba sa šefom u areni
  WON: 'won',
  LOST: 'lost',
};

export class Game {
  constructor(gl, onUi) {
    this.gl = gl;
    this.onUi = onUi;
    this.ui = {};

    const canvas = gl.canvas && gl.canvas.addEventListener
      ? gl.canvas
      : {
          width: gl.drawingBufferWidth,
          height: gl.drawingBufferHeight,
          style: {},
          addEventListener: () => {},
          removeEventListener: () => {},
          clientHeight: gl.drawingBufferHeight,
          getContext: () => gl,
        };
    this.renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.width = 0;
    this.height = 0;

    this.qualityIndex = 2;
    this.quality = { ...QUALITY_LEVELS[this.qualityIndex] };
    this.monitor = new FrameMonitor();

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xffffff, 40, 120);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.5, 220);
    this.baseFov = 60;
    this.fovKick = 0;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.castShadow = this.quality.shadows;
    this.sun.shadow.mapSize.set(this.quality.shadowMap, this.quality.shadowMap);
    const sc = this.sun.shadow.camera;
    sc.left = -14;
    sc.right = 14;
    sc.top = 24;
    sc.bottom = -14;
    sc.near = 1;
    sc.far = 80;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this.env = createEnvironment(this.scene);
    this.effects = new Effects(this.scene, { quality: this.quality, fog: { color: 0xffffff, near: 40, far: 120 } });
    this.fallen = new Fallen(this.scene, 'blue');
    this.horde = new Horde(this.scene, this.effects);
    this.projectiles = new Projectiles(this.scene, this.effects);

    this.coins = 0;
    this.levelNumber = 1;
    this.time = 0;
    this.toastId = 0;
    this.last = now();
    this.running = true;
    this.loadLevel(1);
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  // ---------------- Nivo ----------------
  loadLevel(n) {
    if (this.world) disposeLevel(this.world, this.scene);
    if (this.player) this.player.dispose();
    this.effects.clear();
    this.fallen.clear();
    this.horde.clear();
    this.projectiles.clear();

    this.levelNumber = n;
    this.level = generateLevel(n);
    this.applyTheme(this.level.theme);
    this.horde.hpMul = this.level.zombieHp;
    this.world = buildLevel(this.level, this.scene, this.horde);
    this.player = new Crowd(this.scene, { team: 'blue', count: this.level.startArmy || START_ARMY, x: LANE_X, z: 0, fallen: this.fallen, effects: null });
    this.targetX = LANE_X;

    this.stats = { tier: this.level.startTier, dmgBonus: 0, rateBonus: 0, speedBonus: 0, doubleT: 0 };
    this.player.setWeapon(this.stats.tier);
    this.phase = PHASE.READY;
    this.shotBudget = 0;
    this.levelCoins = 0;
    this.kills = 0;
    this.panel = false;
    this.events = [];
    this.toast = null;
    this.shake = 0;
    this.dustAcc = 0;
    this.minionT = 0;
    this.lostTo = null;
    this.intro = 0;
    this.camPos = new THREE.Vector3(0, 34, -30);
    this.camLook = new THREE.Vector3(0, 0, -60);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.emit();
  }

  applyTheme(th) {
    this.scene.fog.color.set(th.horizon);
    this.scene.fog.near = th.fogNear;
    this.scene.fog.far = th.fogFar;
    const sm = this.effects.smoke.mesh.material.uniforms;
    sm.fogColor.value.set(th.horizon);
    sm.fogNear.value = th.fogNear;
    sm.fogFar.value = th.fogFar;
    this.hemi.color.set(th.hemiSky);
    this.hemi.groundColor.set(th.hemiGround);
    this.hemi.intensity = th.hemi;
    this.sun.color.set(th.sun);
    this.sun.intensity = th.sunInt;
    this.renderer.toneMappingExposure = th.exposure;
    this.env.setTheme(th);
  }

  // ---------------- Komande iz ekrana ----------------
  start() {
    if (this.phase === PHASE.READY) {
      this.phase = PHASE.RUN;
      this.intro = Math.max(this.intro, 0.8);
    }
  }

  // Prst pokazuje gde vojska treba da bude. Vojska uvek ostaje u jednoj od traka.
  steerTo(x) {
    if (this.phase === PHASE.BOSS) {
      this.targetX = Math.max(-ARENA_HALF + 2, Math.min(ARENA_HALF - 2, x));
      return;
    }
    const side = x >= 0 ? 1 : -1;
    const inLane = Math.max(LANE_X - LANE_CENTER_RANGE, Math.min(LANE_X + LANE_CENTER_RANGE, Math.abs(x)));
    this.targetX = side * inLane;
  }

  // Kratak dodir leve ili desne strane ekrana = prelazak u tu traku
  tapSide(side) {
    if (this.phase === PHASE.READY) this.start();
    if (this.phase === PHASE.BOSS) this.targetX = side * 3.5;
    else this.targetX = side * LANE_X;
  }

  getTargetX() {
    return this.targetX;
  }

  nextLevel() {
    this.loadLevel(this.levelNumber + 1);
  }

  retry() {
    this.loadLevel(this.levelNumber);
  }

  // ---------------- Petlja ----------------
  loop() {
    if (!this.running) return;
    const t = now();
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.time += dt;
    if (this.monitor.push(dt)) this.lowerQuality();
    this.update(dt);
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  }

  lowerQuality() {
    if (this.qualityIndex === 0) return;
    this.qualityIndex--;
    Object.assign(this.quality, QUALITY_LEVELS[this.qualityIndex]);
    this.sun.castShadow = this.quality.shadows;
  }

  later(delay, fn) {
    this.events.push({ at: this.time + delay, fn });
  }

  // Kratak dnevnik događaja (za proveru težine)
  log(msg) {
    this.events_log = this.events_log || [];
    this.events_log.push(`${this.time.toFixed(1)} ${msg}`);
    if (this.events_log.length > 60) this.events_log.shift();
  }

  showToast(text, kind = 'good') {
    this.toastId++;
    this.toast = { id: this.toastId, text, kind };
  }

  weapon() {
    return WEAPONS[this.stats.tier];
  }

  dmgPerShot() {
    const s = this.stats;
    return this.weapon().dmg * (1 + s.dmgBonus) * (s.doubleT > 0 ? 2 : 1);
  }

  shotsPerSecond() {
    const s = this.stats;
    return this.weapon().rate * (1 + s.rateBonus) * (1 + s.speedBonus * 0.5);
  }

  armyInfo() {
    const p = this.player;
    return {
      x: p.x,
      z: p.z,
      front: p.z - p.depth(),
      radius: p.radius(),
      lane: this.phase === PHASE.BOSS || this.phase === PHASE.WON ? 0 : Math.sign(p.x) || 1,
    };
  }

  halfWidth() {
    const p = this.player;
    return Math.min(p.radius(), p.squeeze ?? 1.85) + 0.15;
  }

  update(dt) {
    const p = this.player;

    if (this.events.length) {
      const due = this.events.filter((e) => e.at <= this.time);
      this.events = this.events.filter((e) => e.at > this.time);
      due.forEach((e) => e.fn());
    }

    // Skretanje (sa malim nagibom vojnika)
    const prevX = p.x;
    p.x += (this.targetX - p.x) * (1 - Math.exp(-dt * STEER_LERP));
    const vx = (p.x - prevX) / Math.max(dt, 0.001);
    p.lean += (Math.max(-0.3, Math.min(0.3, -vx * 0.03)) - p.lean) * Math.min(1, dt * 10);

    if (this.stats.doubleT > 0) this.stats.doubleT = Math.max(0, this.stats.doubleT - dt);

    if (this.phase === PHASE.RUN) {
      p.moving = true;
      p.z -= FORWARD_SPEED * dt;
      this.checkCollisions();
      if (p.z <= this.world.arenaZ - 3) this.enterBoss();
    } else if (this.phase === PHASE.BOSS) {
      p.moving = Math.abs(this.targetX - p.x) > 0.3;
      this.updateBoss(dt);
    } else if (this.phase === PHASE.WON) {
      p.moving = false;
      p.cheer = true;
    } else {
      p.moving = false;
    }

    const playing = this.phase === PHASE.RUN || this.phase === PHASE.BOSS;
    if (playing) {
      this.updateShooting(dt);
      this.checkZombieContacts(dt);
    } else {
      p.aim = false;
    }

    const army = this.armyInfo();
    this.horde.update(dt, this.time, this.phase === PHASE.READY ? { ...army, front: army.front + 100 } : army, this.camera);
    this.projectiles.update(dt, (pr, target) => this.onHit(pr, target));
    p.update(dt, this.time);
    this.fallen.update(dt);
    // Kocke koje su još daleko (u magli) ne crtamo, da bi bilo brže
    for (const c of this.world.cubes) {
      c.group.visible = c.alive && c.z > p.z - 70 && c.z < p.z + 12;
      if (c.group.visible) c.update(dt, this.time);
    }
    this.updateAmbientFx(dt);
    this.effects.update(dt);
    animateWorld(this.world, this.time);
    this.updateCamera(dt);
    this.env.update(this.time, this.camera, p.z);
    this.sun.position.set(p.x - 7, 20, p.z + 10);
    this.sun.target.position.set(p.x * 0.5, 0, p.z - 6);

    const total = Math.max(1, -this.world.arenaZ);
    this.progress = Math.max(0, Math.min(1, -p.z / total));

    if (playing && p.count <= 0) this.lose();
    this.emit();
  }

  // ---------------- Pucanje ----------------
  findTargets() {
    const p = this.player;
    const w = this.weapon();
    const front = p.z - p.depth();
    const lane = this.phase === PHASE.BOSS ? 0 : Math.sign(p.x) || 1;
    const out = [];
    // 1) Zombiji koji su blizu (u bilo kojoj traci) su najvažniji
    for (const zb of this.horde.list) {
      if (!zb.alive || zb.hp - zb.pending <= 0) continue;
      const d = front - zb.z;
      if (d < -2 || d > w.range) continue;
      const near = d < THREAT_RANGE && Math.abs(zb.x - p.x) < 7;
      const sameLane = lane === 0 || Math.sign(zb.x) === lane;
      if (near || sameLane) out.push({ t: zb, d: near ? d - 100 : d });
    }
    if (out.some((o) => o.d < 0)) return out.filter((o) => o.d < 0).sort((a, b) => a.d - b.d).map((o) => o.t);
    // 2) Kocke i buradi u istoj traci
    if (lane !== 0) {
      for (const c of this.world.cubes) {
        if (!c.alive || c.hp - c.pending <= 0 || Math.sign(c.x) !== lane) continue;
        const d = front - (c.z + 0.9);
        if (d < -0.5 || d > w.range) continue;
        out.push({ t: c, d: d + Math.abs(c.x - p.x) * 3 });
      }
      for (const b of this.world.barrels) {
        if (!b.alive || b.hp - b.pending <= 0 || Math.sign(b.x) !== lane) continue;
        const d = front - b.z;
        if (d < 0 || d > w.range) continue;
        out.push({ t: b, d: d - 2 });
      }
    }
    return out.sort((a, b) => a.d - b.d).map((o) => o.t);
  }

  updateShooting(dt) {
    const p = this.player;
    const targets = this.findTargets();
    if (!targets.length || p.count <= 0) {
      p.aim = false;
      this.shotBudget = 0;
      return;
    }
    p.aim = true;
    const w = this.weapon();
    this.shotBudget += p.count * this.shotsPerSecond() * dt;
    const shots = Math.floor(this.shotBudget);
    if (shots <= 0) return;
    this.shotBudget -= shots;
    const maxVis = Math.max(1, Math.round(MAX_PROJECTILES_PER_FRAME * (0.5 + this.quality.particles * 0.5)));
    const nVis = Math.min(shots, maxVis);
    const dmgEach = (shots / nVis) * this.dmgPerShot();
    const speedMul = 1 + this.stats.speedBonus;
    let ti = 0;
    for (let i = 0; i < nVis; i++) {
      // Sledeća meta koja još nije "pokrivena" mecima u letu
      while (ti < targets.length - 1 && targets[ti].hp - targets[ti].pending <= 0) ti++;
      const target = targets[ti];
      const from = p.muzzleWorld();
      this.effects.muzzle(from[0], from[1], from[2], -1);
      // Šteta koja je "na putu" se broji samo za metke koji su stvarno ispaljeni
      if (w.pellets > 1) {
        for (let k = 0; k < w.pellets; k++) {
          if (this.projectiles.fire(from, target, dmgEach / w.pellets, w, speedMul, 1.4)) target.pending += dmgEach / w.pellets;
        }
      } else if (this.projectiles.fire(from, target, dmgEach, w, speedMul, 0.25)) {
        target.pending += dmgEach;
      }
    }
  }

  onHit(pr, target) {
    target.pending = Math.max(0, target.pending - pr.dmg);
    const w = pr.w;
    if (target.def && target.def.hp !== undefined && target.type) {
      // Zombi
      const [x, y, z] = target.aimPoint();
      if (w.kind === 'plasma') this.effects.plasmaHit(x, y, z);
      else if (w.kind === 'rocket') this.effects.explosion(x, 0.2, z, 0.55, { shake: 0.12, scorch: false });
      else this.effects.impact(x, y, z);
      if (target.alive && this.horde.damage(target, pr.dmg)) this.onZombieKilled(target);
      if (w.splash > 0) this.splash(x, z, w.splash, pr.dmg * 0.6, target);
      if (w.pierce > 0) {
        let left = w.pierce;
        for (const zb of this.horde.list) {
          if (left <= 0) break;
          if (zb === target || !zb.alive) continue;
          if (Math.abs(zb.x - target.x) < 0.9 && zb.z < target.z && zb.z > target.z - 4) {
            if (this.horde.damage(zb, pr.dmg * 0.7)) this.onZombieKilled(zb);
            left--;
          }
        }
      }
    } else if (target.isBarrel) {
      if (!target.alive) return;
      this.effects.impact(target.x, 0.5, target.z);
      target.hp -= pr.dmg;
      if (target.hp <= 0) this.explodeBarrel(target);
    } else {
      // Kocka
      if (!target.alive) return;
      const [x, y, z] = target.aimPoint();
      this.effects.impact(x + rnd(-0.5, 0.5), y + rnd(-0.5, 0.5), z);
      if (w.kind === 'rocket') this.effects.explosion(x, y - 0.6, z, 0.45, { shake: 0.08, scorch: false });
      if (target.hit(pr.dmg)) this.collectCube(target);
    }
  }

  splash(x, z, r, dmg, skip) {
    for (const zb of this.horde.list) {
      if (zb === skip || !zb.alive) continue;
      if (Math.hypot(zb.x - x, zb.z - z) < r && this.horde.damage(zb, dmg)) this.onZombieKilled(zb);
    }
  }

  explodeBarrel(b) {
    b.alive = false;
    hideInstance(b.mesh, b.index);
    this.effects.explosion(b.x, 0.3, b.z, 1.1, { shake: 0.45 });
    this.splash(b.x, b.z, 3.8, 25 * this.level.zombieHp);
    this.showToast('BUM!', 'good');
  }

  onZombieKilled(zb) {
    this.kills++;
    const c = zb.def.coin;
    this.coins += c;
    this.levelCoins += c;
    this.effects.coinPop(zb.x, 1.2 * zb.scale, zb.z);
    if (zb.type === 'mutant') this.showToast('MUTANT UNIŠTEN!', 'good');
    if (zb.isBoss) this.win();
  }

  collectCube(cube) {
    const def = cube.def;
    const [x, y, z] = cube.aimPoint();
    this.effects.cubeBreak(x, y, cube.z, def.color, def.tier);
    const a = def.apply;
    const s = this.stats;
    let text = def.toast;
    if (a.soldiers) {
      this.player.setCount(this.player.count + a.soldiers);
      this.player.labelPop = 1;
    }
    if (a.dmg) s.dmgBonus += a.dmg;
    if (a.rate) s.rateBonus += a.rate;
    if (a.speed) s.speedBonus += a.speed;
    if (a.double) s.doubleT += a.double;
    if (a.weapon) {
      if (s.tier < MAX_TIER) {
        s.tier++;
        this.player.setWeapon(s.tier);
        text = WEAPONS[s.tier].name + '!';
        this.fovKick = 6;
      } else {
        s.dmgBonus += 0.25;
        text = 'ŠTETA +25%';
      }
    }
    this.log(`kocka ${text}`);
    this.showToast(text, def.tier >= 2 ? 'epic' : 'good');
  }

  // ---------------- Sudari ----------------
  checkCollisions() {
    const p = this.player;
    const front = p.z - p.depth();
    const hw = this.halfWidth();
    // Kocke koje nisu razbijene: udarac košta vojnike
    for (const c of this.world.cubes) {
      if (!c.alive) continue;
      if (front <= c.z + 0.9 && front >= c.z - 1.5 && Math.abs(p.x - c.x) < 0.85) {
        c.alive = false;
        c.group.visible = false;
        // Udar košta vojnike (zavisi od toga koliko je kocki ostalo), ali najviše četvrtinu vojske
        const loss = Math.min(p.count, Math.max(2, Math.min(Math.ceil(c.hp / (4 * this.level.cubeHp)), Math.ceil(p.count * 0.25))));
        this.log(`udar u kocku -${loss}`);
        p.kill(loss);
        this.effects.cubeBreak(c.x, 0.9, c.z, 0x888888, 0);
        this.showToast(`-${loss}`, 'bad');
        this.shake = Math.max(this.shake, 0.35);
      }
    }
    // Šiljci
    for (const sp of this.world.spikes) {
      if (!sp.alive) continue;
      if (Math.abs(front - sp.z) < 0.7 && Math.abs(p.x - sp.x) < 1.0 + hw * 0.6) {
        sp.alive = false;
        hideInstance(sp.mesh, sp.index);
        const loss = Math.min(p.count, 3 + Math.ceil(p.count * 0.06));
        this.log(`šiljci -${loss}`);
        p.kill(loss);
        this.effects.burst(sp.x, 0.6, sp.z, 0x6b4a2e, 10, 1.2, { size: 1.6 });
        this.showToast(`-${loss}`, 'bad');
        this.shake = Math.max(this.shake, 0.3);
      }
    }
    // Buradi na putu eksplodiraju ako vojska udari u njih
    for (const b of this.world.barrels) {
      if (b.alive && Math.abs(front - b.z) < 0.6 && Math.abs(p.x - b.x) < hw + 0.3) {
        this.explodeBarrel(b);
        p.kill(Math.min(p.count, 2));
      }
    }
    // Novčići
    for (const c of this.world.coins) {
      if (!c.alive) continue;
      if (c.z <= p.z + p.depth() && c.z >= front - 0.3 && Math.abs(c.x - p.x) < hw + 0.3) {
        c.alive = false;
        hideInstance(c.mesh, c.index);
        this.coins += 3;
        this.levelCoins += 3;
        this.effects.sparkle(c.x, 0.8, c.z);
      }
    }
  }

  // Zombiji koji stignu do vojske: obični ubiju vojnika i nestanu, krupni se zakače i udaraju
  checkZombieContacts(dt) {
    const p = this.player;
    const front = p.z - p.depth();
    const hw = this.halfWidth();
    for (const zb of this.horde.list) {
      if (!zb.alive) continue;
      if (zb.state === 'chase' && zb.z >= front - 0.2 && zb.z < p.z + p.depth() + 1 && Math.abs(zb.x - p.x) < hw + 0.35 * zb.scale) {
        if (zb.def.attach) {
          zb.state = 'attack';
          zb.attachX = Math.max(-hw, Math.min(hw, zb.x - p.x));
          zb.attackT = 0;
        } else {
          const spots = p.kill(Math.min(p.count, zb.def.dmg));
          this.log(`${zb.type} -${zb.def.dmg}`);
          spots.forEach(([x, y, z]) => this.effects.impact(x, y, z));
          zb.hp = 0;
          zb.alive = false;
          zb.state = 'dying';
          zb.deadT = 0;
          this.effects.goo(zb.x, 0.6, zb.z, zb.scale);
          this.shake = Math.max(this.shake, 0.12);
        }
      } else if (zb.state === 'attack') {
        zb.hitTimer = (zb.hitTimer || 0) + dt;
        if (zb.hitTimer >= 0.8) {
          zb.hitTimer = 0;
          const spots = p.kill(Math.min(p.count, zb.def.dmg));
          this.log(`${zb.type} udara -${zb.def.dmg}`);
          spots.slice(0, 3).forEach(([x, y, z]) => this.effects.impact(x, y, z));
          if (zb.def.scale > 2) {
            this.effects.ring(zb.x, zb.z + 1, 3 * zb.def.scale * 0.5);
            this.shake = Math.max(this.shake, 0.35);
          } else {
            this.shake = Math.max(this.shake, 0.15);
          }
        }
      }
    }
  }

  // ---------------- Šef ----------------
  enterBoss() {
    this.phase = PHASE.BOSS;
    this.player.divider = false;
    this.player.squeeze = 5;
    this.targetX = Math.max(-3.5, Math.min(3.5, this.player.x));
    const boss = this.world.boss;
    if (boss) boss.state = 'chase';
    this.minionT = 1.5;
    this.showToast('ŠEF!', 'epic');
    this.shake = 0.3;
  }

  updateBoss(dt) {
    const boss = this.world.boss;
    if (!boss || !boss.alive) return;
    this.minionT -= dt;
    if (this.minionT <= 0) {
      this.minionT = this.level.boss.minionEvery;
      const n = 3 + Math.floor(this.levelNumber / 2);
      for (let i = 0; i < n; i++) {
        const type = Math.random() < 0.08 + this.levelNumber * 0.01 ? 'brute' : Math.random() < 0.35 ? 'runner' : 'walker';
        const zb = this.horde.spawn(type, boss.x + rnd(-4, 4), boss.z + rnd(-1, 1.5), { state: 'chase' });
        if (zb) this.effects.dust(zb.x, zb.z, 2);
      }
    }
  }

  win() {
    this.phase = PHASE.WON;
    this.wonAt = this.time;
    const bonus = 20 + this.levelNumber * 10;
    this.coins += bonus;
    this.levelCoins += bonus;
    this.earned = this.levelCoins;
    const boss = this.world.boss;
    for (let i = 0; i < 5; i++) {
      this.later(0.1 + i * 0.2, () => this.effects.explosion(boss.x + rnd(-2, 2), rnd(0.5, 3), boss.z + rnd(-1.5, 1.5), rnd(1, 1.5), { shake: 0.45, scorch: i === 0 }));
    }
    // Svi preostali zombiji padaju
    this.later(0.4, () => {
      for (const zb of this.horde.list) {
        if (zb.alive) {
          this.horde.damage(zb, 1e9);
        }
      }
    });
    this.later(1.2, () => this.effects.confetti(this.player.x, this.player.z - 3, 90));
    this.showToast('POBEDA!', 'epic');
    this.later(2.2, () => (this.panel = true));
  }

  lose() {
    if (this.phase === PHASE.LOST) return;
    this.phase = PHASE.LOST;
    this.earned = this.levelCoins;
    this.shake = Math.max(this.shake, 0.4);
    this.later(1.4, () => (this.panel = true));
  }

  // ---------------- Atmosfera ----------------
  updateAmbientFx(dt) {
    const p = this.player;
    const q = this.quality;
    if (q.dust && p.wRun > 0.5 && p.rendered > 0) {
      this.dustAcc += dt * Math.min(14, 4 + p.rendered * 0.1);
      while (this.dustAcc >= 1) {
        this.dustAcc -= 1;
        const f = p.randomFoot();
        if (f) this.effects.dust(f[0], f[1]);
      }
    }
    for (const e of this.world.emitters) {
      if (Math.abs(e.z - p.z) > 70) continue;
      e.acc += dt * e.rate * q.particles;
      while (e.acc >= 1) {
        e.acc -= 1;
        if (e.type === 'smoke') this.effects.smokeColumn(e.x, e.y, e.z);
        else this.effects.flame(e.x, e.y, e.z);
      }
    }
    if (q.ambient && Math.random() < dt * 3) this.effects.ambient(p.x, p.z);
  }

  // ---------------- Kamera ----------------
  updateCamera(dt) {
    const p = this.player;
    const r = Math.min(p.radius(), 3);
    let pos;
    let look;
    if (this.phase === PHASE.WON) {
      const a = Math.sin((this.time - this.wonAt) * 0.3) * 0.8;
      pos = new THREE.Vector3(p.x * 0.5 + Math.sin(a) * 13, 9, p.z + Math.cos(a) * 13 - 2);
      look = new THREE.Vector3(p.x * 0.5, 1.2, p.z - 6);
    } else if (this.phase === PHASE.LOST) {
      pos = new THREE.Vector3(p.x * 0.5, 7, p.z + 8);
      look = new THREE.Vector3(p.x, 0.8, p.z - 3);
    } else if (this.phase === PHASE.BOSS) {
      pos = new THREE.Vector3(p.x * 0.3, 14, p.z + 13);
      look = new THREE.Vector3(p.x * 0.2, 1, p.z - 13);
    } else {
      pos = new THREE.Vector3(p.x * 0.3, 10.5 + r * 0.4, p.z + 10.5 + r * 0.5);
      look = new THREE.Vector3(p.x * 0.25, 0, p.z - 12);
    }

    if (this.intro < 1) {
      this.intro = Math.min(1, this.intro + dt / 2.4);
      const k = smooth(this.intro);
      const startPos = new THREE.Vector3(0, 34, p.z - 36);
      const startLook = new THREE.Vector3(0, 0, p.z - 70);
      this.camPos.copy(startPos.lerp(pos, k));
      this.camLook.copy(startLook.lerp(look, k));
    } else {
      const k = 1 - Math.exp(-dt * (this.phase === PHASE.WON ? 2.5 : 4.5));
      this.camPos.lerp(pos, k);
      this.camLook.lerp(look, k);
    }
    this.camera.position.copy(this.camPos);

    this.shake = Math.max(this.shake, this.effects.shake);
    this.effects.shake = 0;
    this.shake = Math.max(0, this.shake - dt * 1.4);
    if (this.shake > 0) {
      const a = Math.min(0.5, this.shake * this.shake) * 1.2;
      const t = this.time * 45;
      this.camera.position.x += Math.sin(t * 1.3) * a;
      this.camera.position.y += Math.sin(t * 1.7 + 1) * a * 0.7;
      this.camera.position.z += Math.sin(t * 1.1 + 2) * a * 0.4;
    }
    this.camera.lookAt(this.camLook);

    this.fovKick = Math.max(0, this.fovKick - dt * 8);
    const fov = this.baseFov + this.fovKick + (this.phase === PHASE.BOSS ? 3 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 8);
      this.camera.updateProjectionMatrix();
    }
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
      this.baseFov = this.camera.aspect < 0.7 ? 64 : 55;
      this.camera.fov = this.baseFov;
      this.camera.updateProjectionMatrix();
    }
    if (w === 0 || h === 0) return;
    this.renderer.render(this.scene, this.camera);
    gl.endFrameEXP();
  }

  emit() {
    const s = this.stats;
    const w = this.weapon();
    const boss = this.world.boss;
    const showBoss = boss && (this.phase === PHASE.BOSS || (this.phase === PHASE.RUN && this.progress > 0.93));
    const next = {
      phase: this.phase,
      level: this.levelNumber,
      theme: this.level.theme.name,
      count: this.player.count,
      coins: this.coins,
      earned: this.earned || 0,
      kills: this.kills,
      progress: Math.round((this.progress || 0) * 60) / 60,
      panel: this.panel,
      toast: this.toast,
      tier: s.tier,
      weapon: w.name,
      dmg: Math.round(this.dmgPerShot() * 10) / 10,
      dps: Math.round(this.player.count * this.dmgPerShot() * this.shotsPerSecond()),
      dmgPct: Math.round(s.dmgBonus * 100),
      ratePct: Math.round(s.rateBonus * 100),
      speedPct: Math.round(s.speedBonus * 100),
      doubleT: Math.ceil(s.doubleT),
      bossHp: showBoss ? Math.max(0, Math.ceil(boss.hp)) : null,
      bossMax: boss ? Math.ceil(boss.maxHp) : 1,
      lane: this.phase === PHASE.BOSS ? 0 : Math.sign(this.targetX),
    };
    const prev = this.ui;
    if (Object.keys(next).some((k) => next[k] !== prev[k])) {
      this.ui = next;
      this.onUi(next);
    }
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (this.world) disposeLevel(this.world, this.scene);
    if (this.player) this.player.dispose();
    this.renderer.dispose();
  }
}

export { CUBE_TYPES };
