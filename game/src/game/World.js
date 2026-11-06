// Pravi stazu jednog nivoa: put sa dve trake i zidom između, arena za šefa na kraju,
// kocke sa nagradama, zombiji, prepreke, buradi, novčići i predmeti pored puta (zavise od okruženja).
import * as THREE from 'three';
import { LANE_X, LANE_HALF, ROAD_HALF, DIVIDER_HALF } from './config.js';
import { createRng } from './rng.js';
import { roadTexture, shadowTexture } from './textures.js';
import { UpgradeCube } from './cubes.js';
import * as M from './models.js';

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

let propMat;
function vcMat() {
  if (!propMat) {
    propMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    propMat.userData.shared = true;
  }
  return propMat;
}

const ARENA_HALF = 8;
const ARENA_LEN = 40;

export function buildLevel(level, parent, horde) {
  const group = new THREE.Group();
  parent.add(group);
  const theme = level.theme;
  const rng = createRng(level.number * 31 + 5);
  const startZ = 30;
  const arenaZ = level.arenaZ;
  const endZ = arenaZ - ARENA_LEN;
  const runLen = startZ - arenaZ;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  // ----- Put sa dve trake -----
  const rTex = roadTexture().clone();
  rTex.needsUpdate = true;
  rTex.repeat.set(2, runLen / 3);
  const roadMat = lambert(theme.road, { map: rTex });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, runLen), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, (startZ + arenaZ) / 2);
  road.receiveShadow = true;
  const base = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF * 2 + 0.6, 0.3, runLen), lambert(0x7d838c));
  base.position.set(0, -0.16, (startZ + arenaZ) / 2);
  group.add(base, road);

  // Ivice traka (bele/žute linije) i ivičnjaci
  const lineMat = new THREE.MeshBasicMaterial({ color: theme.roadLine });
  [-1, 1].forEach((side) => {
    [LANE_X - LANE_HALF + 0.12, LANE_X + LANE_HALF - 0.12].forEach((x) => {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.12, runLen), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(side * x, 0.01, (startZ + arenaZ) / 2);
      group.add(line);
    });
  });
  const curbLen = 1.2;
  const curbCount = Math.floor(runLen / curbLen);
  const curbs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.26, curbLen * 0.95), lambert(0xffffff), curbCount * 2);
  const col = new THREE.Color();
  for (let i = 0; i < curbCount; i++) {
    [-1, 1].forEach((side, j) => {
      m.makeTranslation(side * (ROAD_HALF + 0.15), 0.08, startZ - i * curbLen - curbLen / 2);
      curbs.setMatrixAt(i * 2 + j, m);
      curbs.setColorAt(i * 2 + j, col.set(i % 2 ? 0xe84a4a : 0xf2f2f2));
    });
  }
  curbs.receiveShadow = true;
  group.add(curbs);

  // Zid između traka
  const divCount = Math.floor(runLen / 2);
  const divider = new THREE.InstancedMesh(M.dividerBlock(), vcMat(), divCount);
  divider.castShadow = true;
  divider.receiveShadow = true;
  for (let i = 0; i < divCount; i++) {
    m.makeTranslation(0, 0, startZ - 1 - i * 2);
    divider.setMatrixAt(i, m);
  }
  group.add(divider);

  // Natpisi na putu: ZOMBIJI levo, KOCKE desno (na početku)
  // (mali putokazi u boji)
  [
    [-LANE_X, 0x4fbf3a],
    [LANE_X, 0x2f86ff],
  ].forEach(([x, c]) => {
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 3), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55 }));
    arrow.rotation.set(-Math.PI / 2, 0, 0);
    arrow.scale.set(1, 1, 0.02);
    arrow.position.set(x, 0.02, -6);
    group.add(arrow);
  });

  // ----- Arena za šefa -----
  const arenaMat = lambert(theme.road, { map: rTex });
  const arena = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_HALF * 2, ARENA_LEN), arenaMat);
  arena.rotation.x = -Math.PI / 2;
  arena.position.set(0, 0.005, arenaZ - ARENA_LEN / 2);
  arena.receiveShadow = true;
  const arenaBase = new THREE.Mesh(new THREE.BoxGeometry(ARENA_HALF * 2 + 0.6, 0.3, ARENA_LEN), lambert(0x7d838c));
  arenaBase.position.set(0, -0.155, arenaZ - ARENA_LEN / 2);
  group.add(arenaBase, arena);
  // Krug na zemlji gde stoji šef
  const circle = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.6, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3d3d, transparent: true, opacity: 0.5 }));
  circle.position.set(0, 0.02, arenaZ - 28);
  group.add(circle);
  // Zid sa šiljcima oko arene
  const wallMat = vcMat();
  const wallCount = Math.floor(ARENA_LEN / 2) * 2;
  const walls = new THREE.InstancedMesh(M.sandbags(), wallMat, wallCount + 8);
  let wi = 0;
  for (let i = 0; i < ARENA_LEN / 2; i++) {
    [-1, 1].forEach((side) => {
      q.setFromAxisAngle(up, Math.PI / 2);
      m.compose(p.set(side * (ARENA_HALF + 0.6), 0, arenaZ - 1 - i * 2), q, s.setScalar(1.2));
      walls.setMatrixAt(wi++, m);
    });
  }
  for (let i = 0; i < 8; i++) {
    m.compose(p.set(-ARENA_HALF + 1 + i * 2, 0, endZ + 1), q.identity(), s.setScalar(1.2));
    walls.setMatrixAt(wi++, m);
  }
  walls.count = wi;
  walls.castShadow = true;
  group.add(walls);

  // ----- Kocke, prepreke, buradi, novčići, zombiji -----
  const cubes = [];
  const spikes = [];
  const barrels = [];
  const coins = [];
  const spikeItems = [];
  const barrelItems = [];
  const coinItems = [];
  for (const it of level.items) {
    if (it.kind === 'cubeRow') {
      it.cubes.forEach((c) => cubes.push(new UpgradeCube(group, c.kind, c.x, it.z, level.cubeHp)));
    } else if (it.kind === 'wave') {
      const lane = it.right ? 1 : -1;
      for (const g of it.groups) {
        for (let i = 0; i < g.count; i++) {
          const x = lane * LANE_X + rng.range(-LANE_HALF + 0.6, LANE_HALF - 0.6);
          const zz = it.z - rng.range(0, 6) - (g.type === 'brute' || g.type === 'mutant' ? 4 : 0);
          horde.spawn(g.type, x, zz);
        }
      }
    } else if (it.kind === 'spikes') {
      spikeItems.push(it);
    } else if (it.kind === 'barrel') {
      barrelItems.push(it);
    } else if (it.kind === 'coins') {
      for (let i = 0; i < it.count; i++) coinItems.push({ x: it.x, z: it.z - i * 1.4 });
    }
  }
  const instanced = (geo, list, setup) => {
    const mesh = new THREE.InstancedMesh(geo, vcMat(), Math.max(1, list.length));
    mesh.castShadow = true;
    mesh.count = list.length;
    list.forEach((it, i) => {
      setup(it, i);
      mesh.setMatrixAt(i, m);
    });
    group.add(mesh);
    return mesh;
  };
  const spikeMesh = instanced(M.spikeBarricade(), spikeItems, (it) => m.makeTranslation(it.x, 0, it.z));
  spikeItems.forEach((it, i) => spikes.push({ x: it.x, z: it.z, alive: true, mesh: spikeMesh, index: i }));
  const barrelMesh = instanced(M.barrel(), barrelItems, (it) => m.compose(p.set(it.x, 0, it.z), q.identity(), s.setScalar(1.25)));
  barrelItems.forEach((it, i) => {
    const b = { x: it.x, z: it.z, alive: true, hp: 3, pending: 0, mesh: barrelMesh, index: i, isBarrel: true };
    b.aimPoint = () => [b.x, 0.45, b.z];
    barrels.push(b);
  });
  const coinMesh = instanced(M.coinModel(), coinItems, (it) => m.makeTranslation(it.x, 0.7, it.z));
  coinItems.forEach((it, i) => coins.push({ ...it, alive: true, index: i, mesh: coinMesh }));

  // Šef na kraju
  const boss = horde.spawn('boss', 0, arenaZ - 28);
  if (boss) {
    boss.hp = boss.maxHp = level.boss.hp;
    boss.isBoss = true;
  }

  // ----- Predmeti pored puta (zavise od okruženja) -----
  const PROP = {
    ruin: [M.ruinBuilding(), 7, 11, 2.6],
    car: [M.carWreck(), 1.6, 4, 2],
    lamp: [M.streetLamp(), 0.9, 1.2, 0.6],
    bags: [M.sandbags(), 1.1, 2.5, 1.6],
    hedge: [M.hedgehog(), 1.2, 4, 1.2],
    barrels: [M.barrel(), 1, 3.5, 0.6],
    cactus: [M.cactus(), 2, 12, 1],
    rocks: [M.rockCluster(theme.ground2[0] > 200 ? 0xc8b08a : 0xa9b1bb), 1.5, 12, 1.4],
    tank: [M.tankWreck(), 3, 6, 3],
    tent: [M.tent(), 3, 7, 2],
    tree: [M.roundTree(), 2.5, 13, 1.8],
    tower: [M.watchtower(), 3, 6, 2],
    pine: [M.snowPine(), 2.5, 13, 1.8],
    bunker: [M.bunker(), 3, 5, 2.4],
    crates: [M.crate(), 1, 4, 0.8],
    deadtree: [M.deadTree(), 2, 12, 1.4],
  };
  const placed = {};
  const shadowSpots = [];
  const emitters = [];
  for (let z = startZ - 2; z > endZ - 10; z -= rng.range(2.2, 3.6)) {
    for (const side of [-1, 1]) {
      if (rng.chance(0.25)) continue;
      const kind = rng.pick(theme.props);
      const [, min, max, r] = PROP[kind];
      const edge = z < arenaZ ? ARENA_HALF + 1.2 : ROAD_HALF + 0.8;
      const x = side * (edge + min + rng.range(0, max - min));
      const yaw = kind === 'ruin' ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) + rng.range(-0.1, 0.1) : kind === 'lamp' ? (side > 0 ? Math.PI : 0) : rng.range(0, 6.28);
      const sc = kind === 'ruin' ? rng.range(0.9, 1.3) : rng.range(0.85, 1.2);
      (placed[kind] = placed[kind] || []).push([x, z, yaw, sc]);
      shadowSpots.push([x, z, r * sc]);
      if (kind === 'tank' || (kind === 'car' && rng.chance(0.4))) {
        emitters.push({ type: 'smoke', x, y: 1.3, z, rate: 8, acc: 0 });
        emitters.push({ type: 'fire', x, y: 1.0, z: z + 0.3, rate: 12, acc: 0 });
      }
    }
  }
  for (const [kind, list] of Object.entries(placed)) {
    const mesh = new THREE.InstancedMesh(PROP[kind][0], vcMat(), list.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    list.forEach(([x, z, yaw, sc], i) => {
      q.setFromAxisAngle(up, yaw);
      m.compose(p.set(x, -0.1, z), q, s.setScalar(sc));
      mesh.setMatrixAt(i, m);
    });
    group.add(mesh);
  }
  // Trava/kamenčići po tlu (u šumi trava, inače sitno kamenje)
  const tuftCount = 260;
  const tufts = new THREE.InstancedMesh(theme.name === 'ŠUMA' ? M.grassTuft() : M.rockCluster(0x8f8a80), vcMat(), tuftCount);
  for (let i = 0; i < tuftCount; i++) {
    const side = i % 2 ? 1 : -1;
    const zz = startZ - rng.range(0, startZ - endZ);
    const edge = zz < arenaZ ? ARENA_HALF + 0.9 : ROAD_HALF + 0.6;
    m.compose(
      p.set(side * (edge + rng.range(0, 12)), -0.1, zz),
      q.setFromAxisAngle(up, rng.range(0, 6)),
      s.setScalar(theme.name === 'ŠUMA' ? rng.range(0.8, 1.4) : rng.range(0.15, 0.35)),
    );
    tufts.setMatrixAt(i, m);
  }
  group.add(tufts);
  // Meke senke ispod predmeta
  const shadows = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), color: 0x101810, transparent: true, opacity: 0.35, depthWrite: false }),
    Math.max(1, shadowSpots.length),
  );
  shadowSpots.forEach(([x, z, r], i) => {
    m.compose(p.set(x, -0.1, z), q.identity(), s.set(r * 1.4, 1, r * 1.4));
    shadows.setMatrixAt(i, m);
  });
  shadows.count = shadowSpots.length;
  shadows.renderOrder = -1;
  group.add(shadows);

  return { group, cubes, spikes, barrels, coins, emitters, boss, startZ, arenaZ, endZ, arenaHalf: ARENA_HALF };
}

// Okretanje novčića
export function animateWorld(world, t) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  let dirty = false;
  for (const c of world.coins) {
    if (!c.alive) continue;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t * 3 + c.z);
    m.compose(p.set(c.x, 0.7 + Math.sin(t * 3 + c.z) * 0.1, c.z), q, s);
    c.mesh.setMatrixAt(c.index, m);
    dirty = true;
  }
  if (dirty) world.coins[0].mesh.instanceMatrix.needsUpdate = true;
}

// Sakriva jedan primerak (npr. pokupljen novčić ili razbijena prepreka)
export function hideInstance(mesh, index) {
  mesh.setMatrixAt(index, new THREE.Matrix4().makeScale(0, 0, 0));
  mesh.instanceMatrix.needsUpdate = true;
}

export function disposeLevel(world, parent) {
  world.cubes.forEach((c) => c.dispose());
  parent.remove(world.group);
  world.group.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((mt) => {
        if (mt.userData.shared) return;
        if (mt.map && mt.map !== shadowTexture()) mt.map.dispose();
        mt.dispose();
      });
    }
  });
}

export { ARENA_HALF };
export const DIVIDER = DIVIDER_HALF;
