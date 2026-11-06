// Glavni "mozak" igre: petlja koja se vrti 60 puta u sekundi, kretanje, kapije, borba, pobeda i poraz.
import * as THREE from 'three';
import { COLORS, FORWARD_SPEED, ROAD_HALF, STEER_LERP, FIGHT_TICK, START_ARMY } from './config.js';
import { generateLevel } from './levelGen.js';
import { applyOp, isGood } from './gates.js';
import { buildLevel, disposeLevel, animateWorld } from './World.js';
import { Crowd } from './Crowd.js';
import { Effects } from './Effects.js';
import { createEnvironment, HORIZON } from './Environment.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// Faze igre
export const PHASE = {
  READY: 'ready', // čeka prvi dodir
  RUN: 'run', // trči
  FIGHT: 'fight', // bori se
  WON: 'won',
  LOST: 'lost',
};

export class Game {
  constructor(gl, onUi) {
    this.gl = gl;
    this.onUi = onUi;
    this.ui = {};

    // Na telefonu nema pravog "canvas"-a, pa three.js-u dajemo zamenu.
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
    this.width = 0;
    this.height = 0;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(HORIZON, 50, 140);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.5, 200);

    const hemi = new THREE.HemisphereLight(0xdff3ff, 0x6c8f52, 1.35);
    const sun = new THREE.DirectionalLight(0xfff3e0, 1.9);
    sun.position.set(-5, 12, 6);
    this.scene.add(hemi, sun);

    this.env = createEnvironment(this.scene);
    this.effects = new Effects(this.scene);

    this.coins = 0;
    this.levelNumber = 1;
    this.time = 0;
    this.shake = 0;
    this.last = now();
    this.running = true;
    this.loadLevel(1);
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  loadLevel(n) {
    if (this.world) disposeLevel(this.world, this.scene);
    if (this.player) this.player.dispose();
    this.effects.clear();

    this.levelNumber = n;
    this.level = generateLevel(n, START_ARMY);
    this.world = buildLevel(this.level, this.scene);
    this.player = new Crowd(this.scene, { team: 'blue', count: this.level.startCount, x: 0, z: 0 });
    this.targetX = 0;
    this.phase = PHASE.READY;
    this.fightWith = null;
    this.fightTimer = 0;
    this.earned = 0;
    this.shake = 0;
    this.camPos = new THREE.Vector3(0, 12, 14);
    this.camLook = new THREE.Vector3(0, 0, -8);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.emit();
  }

  // ---- Komande iz ekrana ----
  start() {
    if (this.phase === PHASE.READY) {
      this.phase = PHASE.RUN;
      this.emit();
    }
  }

  steerTo(x) {
    this.targetX = Math.max(-ROAD_HALF + 0.6, Math.min(ROAD_HALF - 0.6, x));
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

  // ---- Petlja ----
  loop() {
    if (!this.running) return;
    const t = now();
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.time += dt;
    this.update(dt);
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  }

  update(dt) {
    const p = this.player;
    const allEnemies = [...this.world.squads, this.world.enemy];

    // Skretanje levo-desno
    const prevX = p.x;
    p.x += (this.targetX - p.x) * (1 - Math.exp(-dt * STEER_LERP));
    const vx = (p.x - prevX) / Math.max(dt, 0.001);
    p.lean += (Math.max(-0.3, Math.min(0.3, -vx * 0.035)) - p.lean) * Math.min(1, dt * 10);

    p.aim = this.phase === PHASE.FIGHT;
    if (this.phase === PHASE.RUN) {
      p.moving = true;
      p.z -= FORWARD_SPEED * dt;
      this.checkGates();
      if (this.phase === PHASE.RUN) this.checkContact(allEnemies);
    } else if (this.phase === PHASE.FIGHT) {
      this.updateFight(dt);
    } else if (this.phase === PHASE.WON) {
      p.moving = false;
      p.cheer = true;
    } else {
      p.moving = false;
    }

    // Neprijatelji jurišaju kad im se približiš
    for (const e of allEnemies) {
      if (!e.alive) continue;
      const dist = e.crowd.z - p.z;
      const near = this.phase !== PHASE.READY && this.phase !== PHASE.WON && dist > -16;
      e.crowd.aim = this.fightWith === e;
      if (this.phase === PHASE.LOST) {
        e.crowd.moving = false;
        e.crowd.cheer = true;
      } else if (near && this.fightWith !== e) {
        e.crowd.moving = true;
        e.crowd.z += (e.final ? 2.5 : 4) * dt;
        e.crowd.x += (p.x - e.crowd.x) * Math.min(1, dt * 1.5);
      }
      e.crowd.update(dt, this.time);
    }

    p.update(dt, this.time);
    this.updateGateFades(dt);
    this.effects.update(dt);
    animateWorld(this.world, this.time);
    this.updateCamera(dt);
    this.env.update(this.time, this.camera, p.z);

    // Napredak kroz nivo (za traku na vrhu ekrana)
    const total = Math.max(1, -this.level.enemy.z);
    this.progress = Math.max(0, Math.min(1, -p.z / total));
    this.emit();
  }

  checkGates() {
    const p = this.player;
    for (const g of this.world.gates) {
      if (g.used || p.z > g.z) continue;
      g.used = true;
      const side = p.x < 0 ? g.left : g.right;
      g.chosen = side;
      const before = p.count;
      p.setCount(applyOp(p.count, side.op));
      const good = isGood(side.op);
      const sx = p.x < 0 ? -ROAD_HALF / 2 : ROAD_HALF / 2;
      this.effects.burst(sx, 1.4, g.z, good ? 0x7fd0ff : 0xff7a8c, 22, 1.1);
      if (!good) {
        for (let i = 0; i < Math.min(14, before - p.count); i++) {
          this.effects.burst(p.x + (Math.random() - 0.5) * 2, 0.5, p.z, COLORS.blue, 2, 0.8);
        }
        this.shake = 0.25;
      }
      if (p.count <= 0) this.lose();
      this.emit();
    }
  }

  checkContact(enemies) {
    const p = this.player;
    for (const e of enemies) {
      if (!e.alive) continue;
      const gap = p.z - p.depth() - (e.crowd.z + e.crowd.depth());
      if (gap <= 1.2) {
        this.phase = PHASE.FIGHT;
        this.fightWith = e;
        this.fightTimer = -0.25; // kratko pucanje pre nego što počnu da padaju
        this.fightElapsed = 0;
        this.emit();
        return;
      }
    }
  }

  updateFight(dt) {
    const p = this.player;
    const e = this.fightWith;
    const ec = e.crowd;
    p.moving = true;
    ec.moving = true;

    // Vojske se privlače jedna drugoj
    const gap = p.z - p.depth() - (ec.z + ec.depth());
    if (gap > -0.4) {
      const step = Math.min(gap + 0.4, 4 * dt);
      p.z -= step * 0.5;
      ec.z += step * 0.5;
    }
    ec.x += (p.x - ec.x) * Math.min(1, dt * 3);

    // Pucnjava: meci lete u oba smera
    const shots = Math.min(6, 1 + Math.floor(Math.min(p.count, ec.count) / 15));
    for (let i = 0; i < shots; i++) {
      if (Math.random() < dt * 14) this.effects.shoot(p.frontSoldier(ec.z), ec.frontSoldier(p.z));
      if (Math.random() < dt * 14) this.effects.shoot(ec.frontSoldier(p.z), p.frontSoldier(ec.z));
    }

    this.fightTimer += dt;
    this.fightElapsed += dt;
    while (this.fightTimer >= FIGHT_TICK && p.count > 0 && ec.count > 0) {
      this.fightTimer -= FIGHT_TICK;
      const k = Math.max(1, Math.ceil(Math.min(p.count, ec.count) / 18));
      const kk = Math.min(k, p.count, ec.count);
      p.kill(kk).slice(0, 4).forEach(([x, y, z]) => this.effects.burst(x, y, z, COLORS.blue, 4, 0.9));
      ec.kill(kk).slice(0, 4).forEach(([x, y, z]) => this.effects.burst(x, y, z, COLORS.red, 4, 0.9));
      this.shake = Math.max(this.shake, e.final ? 0.12 : 0.07);
    }

    if (ec.count <= 0) {
      e.alive = false;
      this.fightWith = null;
      if (e.final) {
        this.win();
      } else {
        this.phase = PHASE.RUN;
      }
    } else if (p.count <= 0) {
      this.lose();
    }
  }

  win() {
    this.phase = PHASE.WON;
    this.earned = 10 + this.levelNumber * 5 + this.player.count;
    this.coins += this.earned;
    this.effects.confetti(this.player.x, this.player.z - 2, 90);
  }

  lose() {
    this.phase = PHASE.LOST;
    this.fightWith = null;
    this.shake = 0.3;
  }

  updateGateFades(dt) {
    for (const g of this.world.gates) {
      if (!g.used || g.fade >= 1) continue;
      g.fade = Math.min(1, g.fade + dt * 2.5);
      const k = 1 - g.fade;
      [g.left, g.right].forEach((s) => {
        s.panel.material.opacity = k;
        s.labelMats.forEach((mt) => (mt.opacity = k));
        s.glowMat.opacity = 0.22 * k;
        if (s === g.chosen) {
          const sc = 1 + g.fade * 0.35;
          s.panel.scale.set(sc, sc, 1);
          s.label.scale.setScalar(1.05 * sc);
        }
      });
    }
  }

  updateCamera(dt) {
    const p = this.player;
    const r = Math.min(p.radius(), 4);
    const battle = this.phase === PHASE.FIGHT && this.fightWith && this.fightWith.final;
    const extra = battle || this.phase === PHASE.WON ? 2.5 : 0;
    const desiredPos = new THREE.Vector3(p.x * 0.35, 9.5 + r * 0.9 + extra, p.z + 11.5 + r * 0.9 + extra);
    const desiredLook = new THREE.Vector3(p.x * 0.3, 0, p.z - 9);
    const k = 1 - Math.exp(-dt * 5);
    this.camPos.lerp(desiredPos, k);
    this.camLook.lerp(desiredLook, k);
    this.camera.position.copy(this.camPos);
    // Tresenje kamere u borbi
    this.shake = Math.max(0, this.shake - dt);
    if (this.shake > 0) {
      const a = this.shake * 0.6;
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a;
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
      // Na uskim ekranima (telefon uspravno) malo proširimo pogled da put stane.
      this.camera.fov = this.camera.aspect < 0.7 ? 62 : 55;
      this.camera.updateProjectionMatrix();
    }
    if (w === 0 || h === 0) return;
    this.renderer.render(this.scene, this.camera);
    gl.endFrameEXP();
  }

  emit() {
    const next = {
      phase: this.phase,
      level: this.levelNumber,
      count: this.player ? this.player.count : 0,
      coins: this.coins,
      earned: this.earned,
      progress: Math.round((this.progress || 0) * 50) / 50,
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
