// Šefovi zombija (na kraju svakog trećeg nivoa).
// GIGANT: spor i ogroman, baca kamenje (vidi se crveni krug gde će pasti) i udara o zemlju kad priđe.
// KRALJICA MUTANATA: drži se na razdaljini, pljuje kiselinu u tri tačke, skače ka junaku i doziva trkače.
// Na 2/3 i 1/3 života šef rikne i pozove pomoć.
import * as THREE from 'three';
import { zombieBody, zombieArm, zombieLeg, HIP_Y, SHOULDER_Y } from './zombies.js';
import { shadowTexture } from '../fx/textures.js';
import { LANE_X, ZOMBIE_SIDE, HERO_Z } from '../core/config.js';

export const BOSSES = {
  giant: { id: 'giant', name: 'GIGANT', model: 'boss', scale: 5.2, hp: 2600, speed: 1.3, radius: 1.45, coin: 150, contactDmg: 26 },
  queen: { id: 'queen', name: 'KRALJICA MUTANATA', model: 'mutant', scale: 4.3, hp: 2100, speed: 2.1, radius: 1.15, coin: 150, contactDmg: 22 },
};

const rnd = (a, b) => a + Math.random() * (b - a);

export class Boss {
  constructor(scene, kind, { hpMul = 1, dmgMul = 1 } = {}) {
    this.def = BOSSES[kind];
    this.kind = kind;
    this.scene = scene;
    this.hpMul = hpMul;
    this.dmgMul = dmgMul;
    this.maxHp = Math.round(this.def.hp * hpMul);
    this.hp = this.maxHp;
    this.alive = true;
    this.radius = this.def.radius;
    this.x = ZOMBIE_SIDE * LANE_X;
    this.z = -66;
    this.state = 'enter';
    this.stateT = 0;
    this.t = 0;
    this.hitT = 0;
    this.yaw = Math.PI;
    this.attackT = 2.5;
    this.special = 6;
    this.summonMarks = [0.66, 0.33];
    this.recentDmg = 0;
    this.contactT = 0;
    this.deadT = 0;
    this.jump = null;
    this.aimPoint = () => [this.x, 1.3 * this.def.scale * 0.5, this.z];

    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.root = new THREE.Group();
    const s = this.def.scale;
    this.root.scale.setScalar(s);
    this.body = new THREE.Mesh(zombieBody(this.def.model), this.mat);
    this.body.castShadow = true;
    this.root.add(this.body);
    this.legs = [-1, 1].map((sg) => {
      const g = new THREE.Group();
      g.position.set(sg * 0.08, HIP_Y, 0);
      const m = new THREE.Mesh(zombieLeg(this.def.model), this.mat);
      m.castShadow = true;
      g.add(m);
      this.root.add(g);
      return g;
    });
    this.arms = [-1, 1].map((sg) => {
      const g = new THREE.Group();
      g.position.set(sg * 0.2, SHOULDER_Y, -0.08);
      const m = new THREE.Mesh(zombieArm(this.def.model), this.mat);
      m.castShadow = true;
      g.add(m);
      this.root.add(g);
      return g;
    });
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), color: 0x050505, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    shadow.position.y = 0.004;
    shadow.scale.setScalar(0.9);
    this.root.add(shadow);
    this.shadow = shadow;
    scene.add(this.root);
  }

  // Šteta šefu; vraća true ako je umro
  damage(dmg) {
    if (!this.alive) return false;
    this.hp -= dmg;
    if (this.hitT < 0.5) this.hitT = 1;
    this.recentDmg += dmg;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.state = 'dying';
      this.deadT = 0;
      return true;
    }
    return false;
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
  }

  // Vraća listu događaja koje Game izvršava (bacanje kamena, pljuvanje, skok, udar, rika i pozivanje zombija)
  update(dt, t, hero) {
    const ev = [];
    this.t += dt;
    this.stateT += dt;
    this.hitT = Math.max(0, this.hitT - dt * 7);
    this.recentDmg = Math.max(0, this.recentDmg - this.maxHp * 0.06 * dt);
    if (this.state === 'dying') {
      this.deadT += dt;
      this.pose(t);
      return ev;
    }
    // Ako primi mnogo štete odjednom, zatetura se
    if (this.recentDmg > this.maxHp * 0.1 && this.state !== 'stagger' && this.state !== 'leap') {
      this.recentDmg = 0;
      this.setState('stagger');
      ev.push({ type: 'stagger' });
    }
    // Rika i pozivanje pomoći na 2/3 i 1/3 života
    const frac = this.hp / this.maxHp;
    if (this.summonMarks.length && frac <= this.summonMarks[0] && this.state !== 'leap') {
      this.summonMarks.shift();
      this.setState('roar');
      ev.push({ type: 'roar' });
      ev.push({ type: 'summon', count: 6, kind: this.kind === 'queen' ? 'runner' : 'walker', x: this.x, z: this.z });
    }

    const dx = hero.x - this.x;
    switch (this.state) {
      case 'enter':
        // Brzo izlazi iz magle i zastane da zarikne kad se dobro vidi
        this.z += 5 * dt;
        if (this.z > -32) {
          this.setState('roar');
          ev.push({ type: 'roar' });
        }
        break;
      case 'roar':
      case 'stagger':
        if (this.stateT > (this.state === 'roar' ? 1.4 : 0.7)) this.setState('walk');
        break;
      case 'walk': {
        // Gigant ide pravo na junaka; Kraljica se drži na razdaljini i šeta levo-desno
        const holdZ = this.kind === 'queen' ? -15 : -4.2;
        if (this.z < holdZ) this.z = Math.min(holdZ, this.z + this.def.speed * dt);
        const targetX = this.kind === 'queen' ? ZOMBIE_SIDE * LANE_X + Math.sin(this.t * 0.6) * 1.8 : hero.x * 0.7 + ZOMBIE_SIDE * LANE_X * 0.3;
        this.x += Math.max(-1, Math.min(1, targetX - this.x)) * dt * (this.kind === 'queen' ? 2.2 : 1.1);
        this.attackT -= dt;
        this.special -= dt;
        const near = this.z > -7 && Math.abs(dx) < 4.6;
        if (this.kind === 'giant') {
          if (near && this.attackT < 1.5) this.setState('slamWind');
          else if (this.attackT <= 0) this.setState('throwWind');
        } else if (this.special <= 0) {
          this.setState('leapWind');
          this.jumpTarget = { x: Math.max(-4.2, Math.min(4.2, hero.x)), z: -3.6 };
          ev.push({ type: 'telegraph', x: this.jumpTarget.x, z: this.jumpTarget.z, r: 3.2, time: 1.6, color: 0xff3df0 });
        } else if (this.attackT <= 0) {
          this.setState('spitWind');
        }
        break;
      }
      case 'throwWind':
        if (this.stateT > 0.75) {
          const tx = Math.max(-4.4, Math.min(4.4, hero.x + hero.vx * 0.5));
          ev.push({ type: 'rock', fromX: this.x, fromY: 1.3 * this.def.scale, fromZ: this.z, x: tx, z: HERO_Z, r: 1.5, flight: 1.25, dmg: 30 * this.dmgMul });
          this.attackT = rnd(3.4, 4.4);
          this.setState('recover');
        }
        break;
      case 'slamWind':
        if (this.stateT === dt) ev.push({ type: 'telegraph', x: this.x, z: this.z + 2.6, r: 4.3, time: 0.95, color: 0xff2a2a });
        if (this.stateT > 0.95) {
          ev.push({ type: 'slam', x: this.x, z: this.z + 2.6, r: 4.3, dmg: 34 * this.dmgMul });
          this.attackT = rnd(2.2, 3);
          this.setState('recover');
        }
        break;
      case 'spitWind':
        if (this.stateT > 0.6) {
          [-1.9, 0, 1.9].forEach((o, i) =>
            ev.push({
              type: 'acid', fromX: this.x, fromY: 1.0 * this.def.scale, fromZ: this.z,
              x: Math.max(-4.6, Math.min(4.6, hero.x + o)), z: HERO_Z, r: 1.15, flight: 1.05 + i * 0.12, dmg: 18 * this.dmgMul,
            }),
          );
          this.attackT = rnd(2.8, 3.6);
          this.setState('recover');
        }
        break;
      case 'leapWind':
        if (this.stateT > 0.6) {
          this.jump = { fromX: this.x, fromZ: this.z, t: 0, dur: 1.0 };
          this.setState('leap');
        }
        break;
      case 'leap': {
        const j = this.jump;
        j.t += dt;
        const k = Math.min(1, j.t / j.dur);
        this.x = j.fromX + (this.jumpTarget.x - j.fromX) * k;
        this.z = j.fromZ + (this.jumpTarget.z - j.fromZ) * k;
        this.jumpY = Math.sin(k * Math.PI) * 5;
        if (k >= 1) {
          this.jumpY = 0;
          ev.push({ type: 'slam', x: this.x, z: this.z, r: 3.2, dmg: 30 * this.dmgMul });
          ev.push({ type: 'summon', count: 3, kind: 'runner', x: this.x, z: this.z - 4 });
          this.special = rnd(7, 9);
          this.setState('retreat');
        }
        break;
      }
      case 'retreat':
        this.z = Math.max(-15, this.z - this.def.speed * 2.2 * dt);
        if (this.z <= -14.9 || this.stateT > 4) this.setState('walk');
        break;
      case 'recover':
        if (this.stateT > 0.6) this.setState('walk');
        break;
      default:
        break;
    }
    // Ako je tik uz junaka, udara ga
    this.contactT -= dt;
    if (this.state !== 'leap' && this.z > -3.2 && Math.abs(dx) < this.radius + 0.8 && this.contactT <= 0) {
      this.contactT = 1.2;
      ev.push({ type: 'contact', dmg: this.def.contactDmg * this.dmgMul });
    }
    this.yaw = Math.atan2(-(hero.x - this.x), -(HERO_Z - this.z));
    this.pose(t);
    return ev;
  }

  pose(t) {
    const s = this.def.scale;
    const walking = this.state === 'walk' || this.state === 'enter' || this.state === 'retreat';
    const ph = t * (this.kind === 'queen' ? 5 : 3.2);
    const sw = Math.sin(ph);
    let pitch = -0.08 + this.hitT * 0.06;
    let y = walking ? Math.abs(Math.cos(ph)) * 0.04 * s : 0;
    let armL = walking ? 1.3 + sw * 0.2 : 1.0;
    let armR = walking ? 1.3 - sw * 0.2 : 1.0;
    if (this.state === 'throwWind') {
      armR = 1 + Math.min(1, this.stateT / 0.75) * 2.1;
    } else if (this.state === 'slamWind') {
      const k = Math.min(1, this.stateT / 0.95);
      armL = armR = 1 + k * 2;
      pitch = 0.2 * k;
    } else if (this.state === 'recover') {
      armL = armR = 0.4;
      pitch = -0.35 * Math.max(0, 1 - this.stateT * 2);
    } else if (this.state === 'roar') {
      pitch = 0.25 + Math.sin(this.stateT * 30) * 0.03;
      armL = armR = 2.2;
    } else if (this.state === 'stagger') {
      pitch = 0.3 * Math.sin(this.stateT * 9);
    } else if (this.state === 'spitWind') {
      pitch = 0.3 * Math.min(1, this.stateT / 0.6);
    } else if (this.state === 'leapWind') {
      y = -0.2 * s * Math.min(1, this.stateT / 0.6);
      pitch = -0.3;
    } else if (this.state === 'leap') {
      y = this.jumpY || 0;
      armL = armR = 2.6;
    }
    let sink = 0;
    if (this.state === 'dying') {
      const k = Math.min(1, this.deadT / 0.9);
      pitch = (1 - (1 - k) * (1 - k)) * 1.45;
      sink = this.deadT > 2 ? Math.min(1, (this.deadT - 2) / 1.5) : 0;
    }
    this.root.position.set(this.x, y - sink * 2, this.z);
    this.root.rotation.set(pitch, this.yaw, 0, 'YXZ');
    this.legs.forEach((l, i) => (l.rotation.x = walking ? (i ? sw : -sw) * 0.5 : 0));
    this.arms[0].rotation.x = armL;
    this.arms[1].rotation.x = armR;
    // Kratak, blag bljesak kad je pogođen (da ne pobeli kad ga gađa minigan)
    const f = this.hitT > 0.7 ? (this.hitT - 0.7) * 0.5 : 0;
    this.mat.emissive.setRGB(f + 0.03, f * 0.85, f * 0.8);
    this.shadow.material.opacity = 0.5 * (1 - Math.min(1, (this.jumpY || 0) / 6));
  }

  dispose() {
    this.scene.remove(this.root);
    this.mat.dispose();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
  }
}

// Kamenje i kiselina koje šef baca, i crveni krugovi na zemlji koji pokazuju gde će pasti.
export class BossShots {
  constructor(scene, effects) {
    this.scene = scene;
    this.effects = effects;
    this.list = [];
    this.rings = [];
    this.rockGeo = new THREE.DodecahedronGeometry(0.55, 0);
    this.rockMat = new THREE.MeshLambertMaterial({ color: 0x7d736b, flatShading: true });
    this.acidGeo = new THREE.SphereGeometry(0.32, 10, 8);
    this.acidMat = new THREE.MeshBasicMaterial({ color: 0x9dff4a });
    this.ringGeo = new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2);
    this.fillGeo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
  }

  telegraph(x, z, r, time, color = 0xff2a2a) {
    const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false });
    const fillMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false });
    const ring = new THREE.Mesh(this.ringGeo, ringMat);
    const fill = new THREE.Mesh(this.fillGeo, fillMat);
    ring.position.set(x, 0.05, z);
    fill.position.set(x, 0.045, z);
    ring.scale.setScalar(r);
    fill.scale.setScalar(0.01);
    ring.renderOrder = fill.renderOrder = 2;
    this.scene.add(ring, fill);
    this.rings.push({ ring, fill, r, t: 0, time });
  }

  throwShot(e, kind) {
    const mesh = new THREE.Mesh(kind === 'rock' ? this.rockGeo : this.acidGeo, kind === 'rock' ? this.rockMat : this.acidMat);
    mesh.castShadow = kind === 'rock';
    mesh.scale.setScalar(kind === 'rock' ? 1.4 : 1);
    this.scene.add(mesh);
    this.list.push({ ...e, kind, mesh, t: 0 });
    this.telegraph(e.x, e.z, e.r, e.flight, kind === 'rock' ? 0xff2a2a : 0x9dff4a);
  }

  // Vraća listu udara: [{ x, z, r, dmg, kind }]
  update(dt) {
    const impacts = [];
    this.list = this.list.filter((s) => {
      s.t += dt;
      const k = Math.min(1, s.t / s.flight);
      const x = s.fromX + (s.x - s.fromX) * k;
      const z = s.fromZ + (s.z - s.fromZ) * k;
      const y = s.fromY * (1 - k) + Math.sin(k * Math.PI) * 4.5;
      s.mesh.position.set(x, y, z);
      s.mesh.rotation.x += dt * 6;
      if (s.kind === 'acid' && Math.random() < 0.5) this.effects.acidTrail(x, y, z);
      if (k >= 1) {
        this.scene.remove(s.mesh);
        impacts.push({ x: s.x, z: s.z, r: s.r, dmg: s.dmg, kind: s.kind });
        return false;
      }
      return true;
    });
    this.rings = this.rings.filter((r) => {
      r.t += dt;
      const k = Math.min(1, r.t / r.time);
      r.fill.scale.setScalar(Math.max(0.01, r.r * k));
      r.ring.material.opacity = 0.6 + Math.sin(r.t * 20) * 0.3;
      if (k >= 1) {
        this.scene.remove(r.ring, r.fill);
        r.ring.material.dispose();
        r.fill.material.dispose();
        return false;
      }
      return true;
    });
    return impacts;
  }

  clear() {
    this.list.forEach((s) => this.scene.remove(s.mesh));
    this.rings.forEach((r) => {
      this.scene.remove(r.ring, r.fill);
      r.ring.material.dispose();
      r.fill.material.dispose();
    });
    this.list = [];
    this.rings = [];
  }
}
