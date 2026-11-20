// Meci, sačma i granate. Svaki metak leti svojom putanjom i proverava sudar sa svim što može da pogodi
// (zombiji, šef, polja napredovanja, eksplozivna buradi). Sve se ponovo koristi (pooling).
import * as THREE from 'three';
import { MAX_PROJECTILES } from '../core/config.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _d = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);
const _c = new THREE.Color();
const GRAVITY = -14;

// Najmanje rastojanje (u ravni xz) od tačke (px,pz) do duži (ax,az)-(bx,bz); vraća [rastojanje^2, t]
function segPoint(ax, az, bx, bz, px, pz) {
  const vx = bx - ax;
  const vz = bz - az;
  const len2 = vx * vx + vz * vz || 1e-6;
  let t = ((px - ax) * vx + (pz - az) * vz) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + vx * t - px;
  const cz = az + vz * t - pz;
  return [cx * cx + cz * cz, t];
}

export class Projectiles {
  constructor(scene, effects) {
    this.effects = effects;
    this.list = [];
    this.tracers = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      MAX_PROJECTILES,
    );
    this.tracers.setColorAt(0, _c.set(0xffffff));
    this.grenades = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.09, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0x4d5a36, emissive: 0x331a00 }),
      40,
    );
    [this.tracers, this.grenades].forEach((m) => {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
    });
    this.tracers.renderOrder = 4;
  }

  // dir = jedinični vektor [x,y,z]; o = { dmg, speed, range, kind, color, width, fire, knock, splash, crit, target }
  fire(from, dir, o) {
    if (this.list.length >= MAX_PROJECTILES) return false;
    const pr = {
      x: from.x, y: from.y, z: from.z,
      vx: dir[0] * o.speed, vy: dir[1] * o.speed, vz: dir[2] * o.speed,
      traveled: 0, ...o,
    };
    if (o.kind === 'grenade' && o.target) {
      // Luk do mete: vreme leta po horizontalnoj razdaljini
      const tx = o.target[0] - from.x;
      const tz = o.target[2] - from.z;
      const dist = Math.hypot(tx, tz);
      const time = Math.max(0.35, dist / o.speed);
      pr.vx = tx / time;
      pr.vz = tz / time;
      pr.vy = (0.2 - from.y) / time - 0.5 * GRAVITY * time;
    }
    this.list.push(pr);
    return true;
  }

  // targets = { zombies: [], boss, fields: [], barrels: [] }; onHit(pr, what, obj, point)
  update(dt, targets, onHit) {
    let nt = 0;
    let ng = 0;
    const alive = [];
    for (const pr of this.list) {
      const ax = pr.x;
      const ay = pr.y;
      const az = pr.z;
      if (pr.kind === 'grenade') pr.vy += GRAVITY * dt;
      const bx = ax + pr.vx * dt;
      const by = ay + pr.vy * dt;
      const bz = az + pr.vz * dt;
      const step = Math.hypot(bx - ax, by - ay, bz - az);
      pr.traveled += step;

      // Traži prvi pogodak na putanji ovog koraka
      let best = null;
      let bestT = 2;
      const minZ = Math.min(az, bz) - 2.5;
      const maxZ = Math.max(az, bz) + 2.5;
      for (const zb of targets.zombies) {
        if (!zb.alive || zb.z < minZ || zb.z > maxZ) continue;
        const r = zb.def.radius * zb.scale / 1.6 + (pr.kind === 'grenade' ? 0.25 : 0.06);
        const [d2, t] = segPoint(ax, az, bx, bz, zb.x, zb.z);
        if (d2 < r * r && t < bestT) {
          const yy = ay + (by - ay) * t;
          if (yy > -0.1 && yy < 1.2 * zb.scale) {
            best = ['zombie', zb];
            bestT = t;
          }
        }
      }
      const boss = targets.boss;
      if (boss && boss.alive && boss.z > minZ - 3 && boss.z < maxZ + 3) {
        const [d2, t] = segPoint(ax, az, bx, bz, boss.x, boss.z);
        if (d2 < boss.radius * boss.radius && t < bestT) {
          best = ['boss', boss];
          bestT = t;
        }
      }
      for (const b of targets.barrels) {
        if (!b.alive) continue;
        const [d2, t] = segPoint(ax, az, bx, bz, b.x, b.z);
        if (d2 < 0.36 * 0.36 && t < bestT && ay < 1.6) {
          best = ['barrel', b];
          bestT = t;
        }
      }
      // Polja napredovanja su uspravne ploče: metak ih pogodi kad pređe njihovu ravan
      for (const f of targets.fields) {
        if (!f.alive || !(az > f.z && bz <= f.z)) continue;
        const t = (az - f.z) / (az - bz || 1e-6);
        const x = ax + (bx - ax) * t;
        const y = ay + (by - ay) * t;
        if (Math.abs(x - f.x) < f.halfW && y > 0 && y < f.height && t < bestT) {
          best = ['field', f];
          bestT = t;
        }
      }

      if (best) {
        const hx = ax + (bx - ax) * bestT;
        const hy = ay + (by - ay) * bestT;
        const hz = az + (bz - az) * bestT;
        const keepFlying = onHit(pr, best[0], best[1], [hx, hy, hz]);
        if (!keepFlying) continue;
      }
      if (pr.kind === 'grenade' && by <= 0.08) {
        onHit(pr, 'ground', null, [bx, 0.1, bz]);
        continue;
      }
      if (pr.traveled > pr.range || by < -0.2 || Math.abs(bx) > 14) {
        if (pr.kind === 'grenade') onHit(pr, 'ground', null, [bx, 0.1, bz]);
        continue;
      }
      pr.x = bx;
      pr.y = by;
      pr.z = bz;

      if (pr.kind === 'grenade') {
        _m.compose(_p.set(bx, by, bz), _q.identity(), _s.set(1, 1, 1));
        this.grenades.setMatrixAt(ng++, _m);
        if (Math.random() < 0.6) this.effects.rocketTrail(bx, by, bz);
      } else {
        _d.set(pr.vx, pr.vy, pr.vz).normalize();
        _q.setFromUnitVectors(_z, _d);
        const len = pr.kind === 'pellet' ? 0.5 : 0.95;
        _m.compose(_p.set(bx, by, bz), _q, _s.set(pr.width, pr.width, len));
        this.tracers.setMatrixAt(nt, _m);
        this.tracers.setColorAt(nt++, _c.set(pr.color));
      }
      alive.push(pr);
    }
    this.list = alive;
    this.tracers.count = nt;
    this.grenades.count = ng;
    this.tracers.instanceMatrix.needsUpdate = true;
    if (this.tracers.instanceColor) this.tracers.instanceColor.needsUpdate = true;
    this.grenades.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.list = [];
    this.tracers.count = 0;
    this.grenades.count = 0;
  }
}
