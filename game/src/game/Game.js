// Glavni "mozak" igre: petlja koja se vrti 60 puta u sekundi, kretanje, kapije, borba, pobeda i poraz,
// plus kamera, svetlo, senke i efekti.
import * as THREE from 'three';
import { COLORS, FORWARD_SPEED, ROAD_HALF, STEER_LERP, FIGHT_TICK, START_ARMY } from './config.js';
import { generateLevel } from './levelGen.js';
import { applyOp, isGood, opLabel } from './gates.js';
import { buildLevel, disposeLevel, animateWorld } from './World.js';
import { Crowd } from './Crowd.js';
import { Effects } from './Effects.js';
import { Fallen } from './Fallen.js';
import { createEnvironment, HORIZON } from './Environment.js';
import { QUALITY_LEVELS, FrameMonitor } from './quality.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const rnd = (a, b) => a + Math.random() * (b - a);
const smooth = (t) => t * t * (3 - 2 * t);

// Faze igre
export const PHASE = {
  READY: 'ready', // glavni meni, čeka početak
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
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; // filmski kolor
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.width = 0;
    this.height = 0;

    this.qualityIndex = 2;
    this.quality = { ...QUALITY_LEVELS[this.qualityIndex] };
    this.monitor = new FrameMonitor();

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(HORIZON, 50, 140);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.5, 200);
    this.baseFov = 55;
    this.fovKick = 0;

    // Svetlo: nebo + sunce koje baca senke (senke prate vojsku)
    this.hemi = new THREE.HemisphereLight(0xd8efff, 0x5f7f48, 1.2);
    this.sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
    this.sun.castShadow = this.quality.shadows;
    this.sun.shadow.mapSize.set(this.quality.shadowMap, this.quality.shadowMap);
    const sc = this.sun.shadow.camera;
    sc.left = -13;
    sc.right = 13;
    sc.top = 20;
    sc.bottom = -14;
    sc.near = 1;
    sc.far = 70;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this.env = createEnvironment(this.scene);
    this.effects = new Effects(this.scene, { quality: this.quality, fog: { color: HORIZON, near: 50, far: 140 } });
    this.fallen = { blue: new Fallen(this.scene, 'blue'), red: new Fallen(this.scene, 'red') };

    this.coins = 0;
    this.levelNumber = 1;
    this.time = 0;
    this.shake = 0;
    this.toastId = 0;
    this.toast = null;
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
    this.fallen.blue.clear();
    this.fallen.red.clear();

    this.levelNumber = n;
    this.level = generateLevel(n, START_ARMY);
    this.world = buildLevel(this.level, this.scene, { fallen: this.fallen, effects: this.effects });
    this.player = new Crowd(this.scene, {
      team: 'blue', count: this.level.startCount, x: 0, z: 0, fallen: this.fallen.blue, effects: this.effects,
    });
    this.targetX = 0;
    this.phase = PHASE.READY;
    this.fightWith = null;
    this.lastEnemy = null;
    this.fightTimer = 0;
    this.fightElapsed = 0;
    this.earned = 0;
    this.shake = 0;
    this.panel = false;
    this.events = [];
    this.dustAcc = 0;
    this.artTimer = 0;
    this.toast = null;
    // Uvodni prelet kamere: kreće visoko iznad bojišta i spušta se iza vojske
    this.intro = 0;
    this.camPos = new THREE.Vector3(0, 30, -24);
    this.camLook = new THREE.Vector3(0, 0, -50);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.emit();
  }

  // ---- Komande iz ekrana ----
  start() {
    if (this.phase === PHASE.READY) {
      this.phase = PHASE.RUN;
      this.intro = Math.max(this.intro, 0.85);
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

  // Zakazuje događaj za kasnije (npr. eksplozije jedna za drugom)
  later(delay, fn) {
    this.events.push({ at: this.time + delay, fn });
  }

  update(dt) {
    const p = this.player;
    const allEnemies = [...this.world.squads, this.world.enemy];

    // Zakazani događaji
    if (this.events.length) {
      const due = this.events.filter((e) => e.at <= this.time);
      this.events = this.events.filter((e) => e.at > this.time);
      due.forEach((e) => e.fn());
    }

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
      this.checkBarrels();
      if (this.phase === PHASE.RUN) this.checkContact(allEnemies);
    } else if (this.phase === PHASE.FIGHT) {
      this.updateFight(dt);
    } else if (this.phase === PHASE.WON) {
      p.moving = false;
      p.aim = false;
      p.cheer = true;
    } else {
      p.moving = false;
    }

    // Neprijatelji jurišaju kad im se približiš
    for (const e of allEnemies) {
      if (!e.alive) {
        e.crowd.label.group.visible = false;
        continue;
      }
      const dist = e.crowd.z - p.z;
      const near = this.phase === PHASE.RUN || this.phase === PHASE.FIGHT ? dist > -16 : false;
      e.crowd.aim = this.fightWith === e || (near && dist > -9);
      if (this.phase === PHASE.LOST) {
        e.crowd.moving = false;
        e.crowd.aim = false;
        e.crowd.cheer = true;
      } else if (near && this.fightWith !== e) {
        e.crowd.moving = true;
        e.crowd.z += (e.final ? 2.5 : 4) * dt;
        e.crowd.x += (p.x - e.crowd.x) * Math.min(1, dt * 1.5);
      }
      e.crowd.update(dt, this.time);
    }

    p.update(dt, this.time);
    this.fallen.blue.update(dt);
    this.fallen.red.update(dt);
    this.updateAmbientFx(dt);
    this.updateGateFades(dt);
    this.effects.update(dt);
    animateWorld(this.world, this.time, dt);
    this.updateCamera(dt);
    this.env.update(this.time, this.camera, p.z);

    // Sunce i senke prate vojsku
    this.sun.position.set(p.x - 7, 18, p.z + 9);
    this.sun.target.position.set(p.x, 0, p.z - 5);

    // Napredak kroz nivo (za traku na vrhu ekrana)
    const total = Math.max(1, -this.level.enemy.z);
    this.progress = Math.max(0, Math.min(1, -p.z / total));
    this.emit();
  }

  // Prašina ispod nogu, dim i vatra iz zapaljenih tenkova, iskre u vazduhu
  updateAmbientFx(dt) {
    const p = this.player;
    const q = this.quality;
    if (q.dust && p.wRun > 0.5 && p.rendered > 0) {
      this.dustAcc += dt * Math.min(16, 5 + p.rendered * 0.12);
      while (this.dustAcc >= 1) {
        this.dustAcc -= 1;
        const f = p.randomFoot();
        if (f) this.effects.dust(f[0], f[1]);
      }
    }
    for (const e of this.world.emitters) {
      if (Math.abs(e.z - p.z) > 75) continue;
      e.acc += dt * e.rate * q.particles;
      while (e.acc >= 1) {
        e.acc -= 1;
        if (e.type === 'smoke') this.effects.smokeColumn(e.x, e.y, e.z);
        else this.effects.flame(e.x, e.y, e.z);
      }
    }
    if (q.ambient && Math.random() < dt * 3) this.effects.ambient(p.x, p.z);
  }

  showToast(text, good) {
    this.toastId++;
    this.toast = { id: this.toastId, text, good };
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
      this.showToast(opLabel(side.op), good);
      if (good) {
        this.fovKick = 4;
      } else {
        this.shake = Math.max(this.shake, 0.3);
        for (let i = 0; i < Math.min(10, before - p.count); i++) {
          this.effects.impact(p.x + rnd(-1.5, 1.5), 0.6, p.z + rnd(-1, 1));
        }
      }
      if (p.count <= 0) this.lose();
    }
  }

  // Eksplozivna buradi pored puta eksplodiraju kad vojska prođe
  checkBarrels() {
    const p = this.player;
    const m = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const b of this.world.barrels) {
      if (!b.alive || p.z - p.depth() - 6 > b.z) continue;
      b.alive = false;
      b.mesh.setMatrixAt(b.index, m);
      b.mesh.instanceMatrix.needsUpdate = true;
      this.effects.explosion(b.x, 0.3, b.z, 0.75, { shake: 0.35 });
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
        this.lastEnemy = e;
        this.fightTimer = -0.3; // kratka pucnjava pre nego što počnu da padaju
        this.fightElapsed = 0;
        this.artTimer = 0.3;
        if (e.final) this.showToast('BITKA!', true);
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
      if (Math.random() < dt * 12) this.effects.shoot(p.frontSoldier(ec.z), ec.frontSoldier(p.z));
      if (Math.random() < dt * 12) this.effects.shoot(ec.frontSoldier(p.z), p.frontSoldier(ec.z));
    }

    // U velikoj bici padaju granate po ivicama neprijateljske vojske
    if (e.final) {
      this.artTimer -= dt;
      if (this.artTimer <= 0 && ec.count > 3) {
        this.artTimer = rnd(0.35, 0.65);
        const side = Math.random() < 0.5 ? -1 : 1;
        const x = Math.random() < 0.6 ? side * rnd(ROAD_HALF - 1, ROAD_HALF + 1.5) : ec.x + rnd(-2, 2);
        const z = ec.z - ec.depth() - rnd(0.5, 3);
        this.effects.explosion(x, 0.2, z, 0.65, { shake: 0.2 });
      }
    }

    this.fightTimer += dt;
    this.fightElapsed += dt;
    while (this.fightTimer >= FIGHT_TICK && p.count > 0 && ec.count > 0) {
      this.fightTimer -= FIGHT_TICK;
      const k = Math.max(1, Math.ceil(Math.min(p.count, ec.count) / 18));
      const kk = Math.min(k, p.count, ec.count);
      p.kill(kk).slice(0, 3).forEach(([x, y, z]) => this.effects.impact(x, y + 0.2, z));
      ec.kill(kk).slice(0, 3).forEach(([x, y, z]) => this.effects.impact(x, y + 0.2, z));
      p.hit(2, ec.z);
      ec.hit(2, p.z);
      this.shake = Math.max(this.shake, e.final ? 0.12 : 0.08);
    }

    if (ec.count <= 0) {
      e.alive = false;
      this.fightWith = null;
      if (e.final) this.win();
      else this.phase = PHASE.RUN;
    } else if (p.count <= 0) {
      this.lose();
    }
  }

  win() {
    this.phase = PHASE.WON;
    this.wonAt = this.time;
    this.earned = 10 + this.levelNumber * 5 + this.player.count;
    this.coins += this.earned;
    this.showToast('POBEDA!', true);
    // Tvrđava eksplodira i ruši se
    const c = this.world.castle;
    const cz = c.group.position.z;
    for (let i = 0; i < 7; i++) {
      this.later(0.15 + i * 0.18, () => this.effects.explosion(rnd(-3.5, 3.5), rnd(0.5, 3.5), cz + rnd(-1, 1.6), rnd(0.9, 1.4), { shake: 0.4, scorch: false }));
    }
    this.later(0.35, () => (c.collapsing = true));
    this.later(1.5, () => this.effects.explosion(0, 0.5, cz + 1, 1.8, { shake: 0.6 }));
    this.later(1.9, () => this.effects.confetti(this.player.x, this.player.z - 2, 90));
    this.later(2.3, () => (this.panel = true));
  }

  lose() {
    this.phase = PHASE.LOST;
    this.fightWith = null;
    this.shake = Math.max(this.shake, 0.4);
    this.later(1.3, () => (this.panel = true));
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
    const finalFight = this.phase === PHASE.FIGHT && this.fightWith && this.fightWith.final;
    let pos;
    let look;
    if (this.phase === PHASE.WON) {
      // Polako kruži oko bojišta: vidi se vojska koja slavi i tvrđava koja se ruši
      const a = Math.sin((this.time - this.wonAt) * 0.25) * 0.9;
      const cz = (p.z + this.world.castle.group.position.z) / 2;
      pos = new THREE.Vector3(p.x * 0.5 + Math.sin(a) * 15, 10, cz + Math.cos(a) * 15 + 4);
      look = new THREE.Vector3(p.x * 0.5, 1.5, cz - 1);
    } else if (this.phase === PHASE.LOST && this.lastEnemy) {
      // Približava se neprijatelju koji slavi
      const ec = this.lastEnemy.crowd;
      pos = new THREE.Vector3(ec.x * 0.5, 6.5, ec.z + 9);
      look = new THREE.Vector3(ec.x, 0.8, ec.z);
    } else {
      const extra = finalFight ? 2.5 : 0;
      pos = new THREE.Vector3(p.x * 0.35, 9.5 + r * 0.9 + extra, p.z + 11.5 + r * 0.9 + extra);
      look = new THREE.Vector3(p.x * 0.3, 0, p.z - 9);
    }

    // Uvodni prelet
    if (this.intro < 1) {
      this.intro = Math.min(1, this.intro + dt / 2.2);
      const k = smooth(this.intro);
      const startPos = new THREE.Vector3(0, 30, p.z - 24);
      const startLook = new THREE.Vector3(0, 0, p.z - 50);
      this.camPos.copy(startPos.lerp(pos, k));
      this.camLook.copy(startLook.lerp(look, k));
    } else {
      const k = 1 - Math.exp(-dt * (this.phase === PHASE.WON ? 2.5 : 5));
      this.camPos.lerp(pos, k);
      this.camLook.lerp(look, k);
    }
    this.camera.position.copy(this.camPos);

    // Tresenje kamere (jače kod eksplozija, slabije u borbi)
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

    // Kratko "zumiranje" kad prođeš kroz dobru kapiju, i šire u velikoj bici
    this.fovKick = Math.max(0, this.fovKick - dt * 10);
    const fov = this.baseFov + this.fovKick + (finalFight ? 3 : 0);
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
      // Na uskim ekranima (telefon uspravno) malo proširimo pogled da put stane.
      this.baseFov = this.camera.aspect < 0.7 ? 62 : 55;
      this.camera.fov = this.baseFov;
      this.camera.updateProjectionMatrix();
    }
    if (w === 0 || h === 0) return;
    this.renderer.render(this.scene, this.camera);
    gl.endFrameEXP();
  }

  emit() {
    const fe = this.fightWith;
    const finalE = this.world.enemy;
    const nearFinal = finalE.alive && finalE.crowd.z - this.player.z > -26 && this.phase !== PHASE.READY;
    const next = {
      phase: this.phase,
      level: this.levelNumber,
      count: this.player ? this.player.count : 0,
      coins: this.coins,
      earned: this.earned,
      progress: Math.round((this.progress || 0) * 50) / 50,
      panel: this.panel,
      toast: this.toast,
      enemy: nearFinal || (fe && fe.final) ? finalE.crowd.count : null,
      enemyMax: this.level.enemy.count,
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
