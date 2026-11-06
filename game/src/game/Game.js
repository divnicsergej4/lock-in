// Glavni "mozak" igre: petlja koja se vrti 60 puta u sekundi, kretanje, kapije, borba, pobeda i poraz.
import * as THREE from 'three';
import { COLORS, FORWARD_SPEED, ROAD_HALF, STEER_LERP, FIGHT_TICK, START_ARMY } from './config.js';
import { generateLevel } from './levelGen.js';
import { applyOp, isGood } from './gates.js';
import { buildLevel, disposeLevel } from './World.js';
import { Crowd } from './Crowd.js';
import { Effects } from './Effects.js';

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
    this.renderer.setClearColor(COLORS.sky);
    this.width = 0;
    this.height = 0;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.sky);
    this.scene.fog = new THREE.Fog(COLORS.sky, 45, 95);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.5, 140);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x6f9c5e, 1.5);
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(-6, 14, 8);
    this.scene.add(hemi, sun);

    // Trava ide zajedno sa vojskom, pa nikad ne nestaje.
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 220), new THREE.MeshLambertMaterial({ color: COLORS.grass }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.31;
    this.scene.add(this.ground);

    this.effects = new Effects(this.scene);

    this.coins = 0;
    this.levelNumber = 1;
    this.time = 0;
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
    this.endTimer = 0;
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
    p.lean += (Math.max(-0.35, Math.min(0.35, -vx * 0.04)) - p.lean) * Math.min(1, dt * 10);

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
    this.updateCamera(dt);
    this.ground.position.z = p.z - 40;
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
      this.effects.burst(sx, 1.4, g.z, good ? COLORS.gateGood : COLORS.gateBad, 18, 1.1);
      if (!good) {
        // Vojnici koji su "nestali" na lošoj kapiji
        for (let i = 0; i < Math.min(12, before - p.count); i++) {
          this.effects.burst(p.x + (Math.random() - 0.5) * 2, 0.5, p.z, COLORS.blue, 2, 0.8);
        }
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
      if (gap <= 0.3) {
        this.phase = PHASE.FIGHT;
        this.fightWith = e;
        this.fightTimer = 0;
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
      const step = Math.min(gap + 0.4, 5 * dt);
      p.z -= step * 0.5;
      ec.z += step * 0.5;
    }
    ec.x += (p.x - ec.x) * Math.min(1, dt * 3);

    this.fightTimer += dt;
    while (this.fightTimer >= FIGHT_TICK && p.count > 0 && ec.count > 0) {
      this.fightTimer -= FIGHT_TICK;
      const k = Math.max(1, Math.ceil(Math.min(p.count, ec.count) / 18));
      const kk = Math.min(k, p.count, ec.count);
      p.kill(kk).slice(0, 4).forEach(([x, y, z]) => this.effects.burst(x, y, z, COLORS.blue, 3));
      ec.kill(kk).slice(0, 4).forEach(([x, y, z]) => this.effects.burst(x, y, z, COLORS.red, 3));
      this.emit();
    }

    if (ec.count <= 0) {
      e.alive = false;
      this.fightWith = null;
      if (e.final) {
        this.win();
      } else {
        this.phase = PHASE.RUN;
        this.emit();
      }
    } else if (p.count <= 0) {
      this.lose();
    }
  }

  win() {
    this.phase = PHASE.WON;
    this.earned = 10 + this.levelNumber * 5 + this.player.count;
    this.coins += this.earned;
    for (let i = 0; i < 40; i++) {
      const colors = [COLORS.gold, COLORS.blue, 0xffffff, 0x5ce07a];
      this.effects.burst(this.player.x + (Math.random() - 0.5) * 6, 2 + Math.random() * 2, this.player.z - 2, colors[i % 4], 1, 1.5);
    }
    this.emit();
  }

  lose() {
    this.phase = PHASE.LOST;
    this.fightWith = null;
    this.emit();
  }

  updateGateFades(dt) {
    for (const g of this.world.gates) {
      if (!g.used || g.fade >= 1) continue;
      g.fade = Math.min(1, g.fade + dt * 2.5);
      const k = 1 - g.fade;
      [g.left, g.right].forEach((s) => {
        s.panelMat.opacity = 0.55 * k;
        s.labelMat.opacity = k;
        if (s === g.chosen) {
          s.panel.scale.set(1 + g.fade * 0.3, 1 + g.fade * 0.3, 1);
        }
      });
    }
  }

  updateCamera(dt) {
    const p = this.player;
    const r = Math.min(p.radius(), 4);
    const battle = this.phase === PHASE.FIGHT && this.fightWith && this.fightWith.final;
    const extra = battle || this.phase === PHASE.WON ? 3 : 0;
    const desiredPos = new THREE.Vector3(p.x * 0.35, 10.5 + r * 0.9 + extra, p.z + 12 + r * 0.9 + extra);
    const desiredLook = new THREE.Vector3(p.x * 0.3, 0, p.z - 9);
    const k = 1 - Math.exp(-dt * 5);
    this.camPos.lerp(desiredPos, k);
    this.camLook.lerp(desiredLook, k);
    this.camera.position.copy(this.camPos);
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
