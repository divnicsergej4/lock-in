// Pravi stazu jednog nivoa: put na ostrvu, ivičnjake, kapije, crvene odrede, ciljnu liniju,
// neprijateljski zamak, drveće, žbunje, kamenje i ostrvca u vodi.
import * as THREE from 'three';
import { COLORS, ROAD_HALF } from './config.js';
import { isGood, opLabel } from './gates.js';
import { textGeometry } from './text3d.js';
import { Crowd } from './Crowd.js';
import { createRng } from './rng.js';
import { roadTexture, grassTexture, shadowTexture } from './textures.js';

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const GRASS_W = 7.5; // širina trave sa svake strane puta

export function buildLevel(level, parent) {
  const group = new THREE.Group();
  parent.add(group);
  const rng = createRng(level.number * 31 + 5);

  const startZ = 30;
  const endZ = level.enemy.z - 30;
  const length = startZ - endZ;
  const midZ = (startZ + endZ) / 2;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const col = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);

  // Ostrvo: pesak sa strane, trava na vrhu
  const islandW = (ROAD_HALF + GRASS_W) * 2;
  const sand = new THREE.Mesh(new THREE.BoxGeometry(islandW + 1.2, 1.2, length + 1.2), lambert(0xf3d9a4));
  sand.position.set(0, -0.72, midZ);
  group.add(sand);
  const gTex = grassTexture().clone();
  gTex.needsUpdate = true;
  gTex.repeat.set(islandW / 4, length / 4);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(islandW, length), lambert(0xffffff, { map: gTex }));
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, -0.11, midZ);
  group.add(grass);

  // Put: blago podignut, sa pločama
  const rTex = roadTexture().clone();
  rTex.needsUpdate = true;
  rTex.repeat.set(2, length / (ROAD_HALF));
  const roadTop = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, length), lambert(0xffffff, { map: rTex }));
  roadTop.rotation.x = -Math.PI / 2;
  roadTop.position.set(0, 0, midZ);
  const roadBase = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF * 2 + 0.1, 0.3, length), lambert(0xb5c0cf));
  roadBase.position.set(0, -0.155, midZ);
  group.add(roadBase, roadTop);

  // Ivičnjaci: crveno-beli blokovi
  const curbLen = 1.1;
  const curbCount = Math.floor(length / curbLen);
  const curbs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.22, curbLen * 0.96), lambert(0xffffff), curbCount * 2);
  for (let i = 0; i < curbCount; i++) {
    const z = startZ - i * curbLen - curbLen / 2;
    [-1, 1].forEach((side, j) => {
      m.makeTranslation(side * (ROAD_HALF + 0.12), 0.06, z);
      curbs.setMatrixAt(i * 2 + j, m);
      curbs.setColorAt(i * 2 + j, col.set(i % 2 ? 0xff5a5a : 0xffffff));
    });
  }
  group.add(curbs);

  // Kapije
  const gates = level.items
    .filter((it) => it.kind === 'gate')
    .map((it) => buildGate(it, group));

  // Mali crveni odredi
  const squads = level.items
    .filter((it) => it.kind === 'squad')
    .map((it) => ({
      crowd: new Crowd(group, { team: 'red', count: it.count, x: it.x, z: it.z, formation: 'block' }),
      startZ: it.z,
      alive: true,
      final: false,
    }));

  // Ciljna linija: šahovska polja
  const cell = 0.7;
  const cols = Math.ceil((ROAD_HALF * 2) / cell);
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(cell, 0.03, cell), new THREE.MeshBasicMaterial({ color: 0xffffff }), cols * 2);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < cols; c++) {
      m.makeTranslation(-ROAD_HALF + cell / 2 + c * cell, 0.02, level.finishZ - r * cell);
      tiles.setMatrixAt(r * cols + c, m);
      tiles.setColorAt(r * cols + c, col.set((r + c) % 2 ? 0x222833 : 0xffffff));
    }
  }
  group.add(tiles);
  // Završna crvena vojska i zamak
  const enemy = {
    crowd: new Crowd(group, { team: 'red', count: level.enemy.count, x: 0, z: level.enemy.z, formation: 'block' }),
    startZ: level.enemy.z,
    alive: true,
    final: true,
  };
  const castle = buildCastle();
  castle.group.position.set(0, 0, level.enemy.z - 11);
  group.add(castle.group);

  // Drveće, žbunje i kamenje na travi
  const treeCount = Math.floor(length / 1.6);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.15, 0.9, 6), lambert(COLORS.trunk), treeCount);
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.85, 1), lambert(0xffffff, { flatShading: true }), treeCount);
  const pines = new THREE.InstancedMesh(new THREE.ConeGeometry(0.75, 1.9, 7), lambert(0xffffff, { flatShading: true }), treeCount);
  const shadows = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), color: 0x1d3a1a, transparent: true, opacity: 0.35, depthWrite: false }),
    treeCount * 2,
  );
  let nRound = 0;
  let nPine = 0;
  let nShadow = 0;
  const greens = [0x3fb54a, 0x5cc94b, 0x2f9e45, 0x7bd44f];
  for (let i = 0; i < treeCount; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (ROAD_HALF + 1.3 + rng.range(0, GRASS_W - 1.8));
    const z = startZ - rng.range(0, length);
    const sc = rng.range(0.75, 1.35);
    p.set(x, -0.1 + 0.45 * sc, z);
    q.identity();
    s.setScalar(sc);
    m.compose(p, q, s);
    trunks.setMatrixAt(i, m);
    q.setFromAxisAngle(up, rng.range(0, 6));
    if (rng.chance(0.55)) {
      p.set(x, -0.1 + 1.35 * sc, z);
      m.compose(p, q, s);
      crowns.setMatrixAt(nRound, m);
      crowns.setColorAt(nRound++, col.set(rng.pick(greens)));
    } else {
      p.set(x, -0.1 + 1.6 * sc, z);
      m.compose(p, q, s);
      pines.setMatrixAt(nPine, m);
      pines.setColorAt(nPine++, col.set(rng.pick([0x2f9e45, 0x268a3d, 0x3aa84c])));
    }
    p.set(x + 0.25, -0.09, z + 0.2);
    q.identity();
    s.set(2 * sc, 1, 1.6 * sc);
    m.compose(p, q, s);
    shadows.setMatrixAt(nShadow++, m);
  }
  crowns.count = nRound;
  pines.count = nPine;

  const bushCount = Math.floor(length / 3);
  const bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.4, 1), lambert(0xffffff, { flatShading: true }), bushCount);
  const rockCount = Math.floor(length / 6);
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.35, 0), lambert(0xffffff, { flatShading: true }), rockCount);
  for (let i = 0; i < bushCount; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (ROAD_HALF + 0.9 + rng.range(0, GRASS_W - 1.2));
    const z = startZ - rng.range(0, length);
    const sc = rng.range(0.6, 1.2);
    p.set(x, 0.1 * sc, z);
    q.setFromAxisAngle(up, rng.range(0, 6));
    s.set(sc * 1.3, sc, sc * 1.3);
    m.compose(p, q, s);
    bushes.setMatrixAt(i, m);
    bushes.setColorAt(i, col.set(rng.pick([0x58c74a, 0x6fd552, 0x48b443])));
  }
  for (let i = 0; i < rockCount; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (ROAD_HALF + 1 + rng.range(0, GRASS_W - 1.4));
    const z = startZ - rng.range(0, length);
    const sc = rng.range(0.5, 1.3);
    p.set(x, 0, z);
    q.setFromEuler(new THREE.Euler(rng.range(0, 3), rng.range(0, 3), 0));
    s.set(sc * 1.2, sc * 0.7, sc);
    m.compose(p, q, s);
    rocks.setMatrixAt(i, m);
    rocks.setColorAt(i, col.set(rng.pick([0xb9c2cc, 0xa7b1bd, 0xcfd6de])));
  }
  shadows.count = nShadow;
  group.add(shadows, trunks, crowns, pines, bushes, rocks);

  // Ostrvca u daljini
  const isleCount = Math.floor(length / 18);
  for (let i = 0; i < isleCount; i++) {
    const side = i % 2 ? 1 : -1;
    const isle = new THREE.Group();
    const r = rng.range(3, 7);
    const sandDisk = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.6, 0.8, 18), lambert(0xf3d9a4));
    sandDisk.position.y = -0.55;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.6, r - 0.4, 0.3, 18), lambert(0x6fcf5a));
    top.position.y = -0.1;
    isle.add(sandDisk, top);
    const trees = rng.int(1, 4);
    for (let t = 0; t < trees; t++) {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(rng.range(0.9, 1.5), 0), lambert(rng.pick(greens), { flatShading: true }));
      crown.position.set(rng.range(-r / 2, r / 2), 1.3, rng.range(-r / 2, r / 2));
      isle.add(crown);
    }
    isle.position.set(side * rng.range(ROAD_HALF + GRASS_W + 9, 40), 0, startZ - rng.range(0, length));
    group.add(isle);
  }

  return { group, gates, squads, enemy, castle, startZ, endZ };
}

function buildGate(it, group) {
  const g = new THREE.Group();
  g.position.z = it.z;
  const W = ROAD_HALF - 0.2;
  const H = 2.6;

  const make = (op, sideX) => {
    const good = isGood(op);
    const base = new THREE.Color(good ? 0x1e9bff : 0xff3d5a);
    // Ploča koja je jača pri dnu i bleđa pri vrhu
    const geo = new THREE.PlaneGeometry(W, H, 1, 6);
    const colors = [];
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) + H / 2) / H;
      colors.push(base.r, base.g, base.b, 0.75 - t * 0.45);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    const panelMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const panel = new THREE.Mesh(geo, panelMat);
    panel.position.set(sideX, H / 2, 0);

    const faceMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    const sideMat = new THREE.MeshBasicMaterial({ color: good ? 0x0d5fb3 : 0xa8142f, transparent: true });
    const label = new THREE.Mesh(textGeometry(opLabel(op), 0.22), [faceMat, sideMat]);
    label.scale.setScalar(1.05);
    label.position.set(sideX, 1.45, 0.05);

    const topMat = lambert(good ? 0x1683e0 : 0xe02641);
    const top = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, 0.26, 0.26), topMat);
    top.position.set(sideX, H + 0.05, 0);

    // Svetla traka na putu ispred kapije
    const glowMat = new THREE.MeshBasicMaterial({ color: base, transparent: true, opacity: 0.22, depthWrite: false });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(W, 1.4).rotateX(-Math.PI / 2), glowMat);
    glow.position.set(sideX, 0.015, 0.75);

    g.add(glow, panel, label, top);
    return { op, panel, label, top, panelMat, labelMats: [faceMat, sideMat], glowMat };
  };
  const left = make(it.left, -ROAD_HALF / 2);
  const right = make(it.right, ROAD_HALF / 2);

  const postGeo = new THREE.CylinderGeometry(0.13, 0.15, H + 0.3, 10);
  const postMat = lambert(0xffffff);
  const capGeo = new THREE.SphereGeometry(0.2, 10, 8);
  const capMat = lambert(0xffc934);
  [-ROAD_HALF, 0, ROAD_HALF].forEach((x) => {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(x, (H + 0.3) / 2, 0);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(x, H + 0.35, 0);
    g.add(post, cap);
  });
  group.add(g);
  return { z: it.z, left, right, used: false, fade: 0, chosen: null };
}

function buildCastle() {
  const group = new THREE.Group();
  const stone = lambert(0xece4d4);
  const stoneDark = lambert(0xd3c8b4);
  const roofMat = lambert(0xd8323a);

  const keep = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.4, 3), stone);
  keep.position.y = 1.7;
  group.add(keep);
  // Zupci na vrhu zida
  const merlonGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  for (let i = 0; i < 6; i++) {
    const mm = new THREE.Mesh(merlonGeo, stoneDark);
    mm.position.set(-2.35 + i * 0.94, 3.65, 1.25);
    group.add(mm);
  }
  // Kapija
  const gate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.9, 0.12), lambert(0x5a3a24));
  gate.position.set(0, 0.95, 1.52);
  const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.12, 16, 1, false, 0, Math.PI), lambert(0x5a3a24));
  arch.rotation.set(Math.PI / 2, 0, -Math.PI / 2);
  arch.position.set(0, 1.9, 1.52);
  group.add(gate, arch);
  // Kule
  [-1, 1].forEach((side) => {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 4.8, 14), stone);
    tower.position.set(side * 3.1, 2.4, 0.4);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.35, 2, 14), roofMat);
    roof.position.set(side * 3.1, 5.8, 0.4);
    const window = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.55, 0.1), lambert(0x3a2a20));
    window.position.set(side * 3.1, 3.4, 1.45);
    group.add(tower, roof, window);
  });
  // Zastava koja se vijori
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6), lambert(0xdddddd));
  pole.position.set(0, 5.2, 0);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8, 8, 1), lambert(COLORS.red, { side: THREE.DoubleSide }));
  flag.geometry.translate(0.65, 0, 0);
  flag.position.set(0.05, 6.1, 0);
  group.add(pole, flag);

  return { group, flag, basePos: flag.geometry.getAttribute('position').array.slice() };
}

// Zastava se talasa
export function animateWorld(world, t) {
  const { flag, basePos } = world.castle;
  const pos = flag.geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = basePos[i * 3];
    pos.setZ(i, Math.sin(x * 4 - t * 6) * 0.12 * x);
  }
  pos.needsUpdate = true;
}

// Briše sve iz nivoa i oslobađa memoriju.
export function disposeLevel(world, parent) {
  world.squads.forEach((sq) => sq.crowd.dispose());
  world.enemy.crowd.dispose();
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
