// Pravi stazu jednog nivoa: put na ostrvu, ivičnjake, kapije, crvene odrede, ciljnu liniju,
// neprijateljsku tvrđavu, vojne predmete (džakovi, prepreke, tenkovi, šatori, bunkeri, osmatračnice,
// buradi, sanduci), drveće, travu, cveće i ostrvca u vodi.
import * as THREE from 'three';
import { COLORS, ROAD_HALF } from './config.js';
import { isGood, opLabel } from './gates.js';
import { textGeometry } from './text3d.js';
import { Crowd } from './Crowd.js';
import { createRng } from './rng.js';
import { roadTexture, grassTexture, shadowTexture } from './textures.js';
import * as M from './models.js';

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const GRASS_W = 7.5; // širina trave sa svake strane puta

let propMat;
function vcMat() {
  if (!propMat) {
    propMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    propMat.userData.shared = true;
  }
  return propMat;
}

export function buildLevel(level, parent, { fallen, effects } = {}) {
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
  const emitters = [];
  const barrels = [];

  // Ostrvo: pesak sa strane, trava na vrhu
  const islandW = (ROAD_HALF + GRASS_W) * 2;
  const sand = new THREE.Mesh(new THREE.BoxGeometry(islandW + 1.2, 1.2, length + 1.2), lambert(0xf3d9a4));
  sand.position.set(0, -0.72, midZ);
  sand.receiveShadow = true;
  group.add(sand);
  const gTex = grassTexture().clone();
  gTex.needsUpdate = true;
  gTex.repeat.set(islandW / 4, length / 4);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(islandW, length), lambert(0xffffff, { map: gTex }));
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, -0.11, midZ);
  grass.receiveShadow = true;
  group.add(grass);

  // Put: blago podignut, sa betonskim pločama
  const rTex = roadTexture().clone();
  rTex.needsUpdate = true;
  rTex.repeat.set(2, length / ROAD_HALF);
  const roadTop = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, length), lambert(0xffffff, { map: rTex }));
  roadTop.rotation.x = -Math.PI / 2;
  roadTop.position.set(0, 0, midZ);
  roadTop.receiveShadow = true;
  const roadBase = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF * 2 + 0.1, 0.3, length), lambert(0xa9b3c0));
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
  curbs.receiveShadow = true;
  group.add(curbs);

  // Kapije
  const gates = level.items.filter((it) => it.kind === 'gate').map((it) => buildGate(it, group));

  // Mali crveni odredi
  const squads = level.items
    .filter((it) => it.kind === 'squad')
    .map((it) => ({
      crowd: new Crowd(group, { team: 'red', count: it.count, x: it.x, z: it.z, formation: 'block', fallen: fallen.red, effects }),
      startZ: it.z,
      alive: true,
      final: false,
    }));

  // Ciljna linija: šahovska polja
  const cell = 0.7;
  const cols = Math.ceil((ROAD_HALF * 2) / cell);
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(cell, 0.03, cell), lambert(0xffffff), cols * 2);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < cols; c++) {
      m.makeTranslation(-ROAD_HALF + cell / 2 + c * cell, 0.02, level.finishZ - r * cell);
      tiles.setMatrixAt(r * cols + c, m);
      tiles.setColorAt(r * cols + c, col.set((r + c) % 2 ? 0x222833 : 0xffffff));
    }
  }
  tiles.receiveShadow = true;
  group.add(tiles);

  // Završna crvena vojska i tvrđava
  const enemy = {
    crowd: new Crowd(group, { team: 'red', count: level.enemy.count, x: 0, z: level.enemy.z, formation: 'block', fallen: fallen.red, effects }),
    startZ: level.enemy.z,
    alive: true,
    final: true,
  };
  const castle = buildFortress(level.enemy.z - 11);
  group.add(castle.group);
  // Džakovi ispred tvrđave
  const fortBags = [];
  [-1, 1].forEach((side) => {
    for (let i = 0; i < 2; i++) fortBags.push([side * (1.6 + i * 1.65), level.enemy.z - 7.5, 0]);
  });

  // ----- Vojni predmeti pored puta -----
  const place = []; // [vrsta, x, z, okret, veličina]
  const sideX = (side, min, max) => side * (ROAD_HALF + min + rng.range(0, max - min));
  for (let z = startZ - 14; z > endZ + 20; z -= rng.range(9, 14)) {
    const side = rng.chance(0.5) ? 1 : -1;
    const kind = rng.pick(['bags', 'bags', 'wreck', 'camp', 'tower', 'bunker', 'hedge']);
    if (kind === 'bags') {
      const x = side * (ROAD_HALF + 1.4);
      place.push(['sandbags', x, z, Math.PI / 2, 1], ['sandbags', x, z - 1.5, Math.PI / 2, 1]);
      place.push(['crate', x + side * 1.1, z - 0.6, rng.range(0, 1), 1]);
      if (rng.chance(0.6)) place.push(['crate', x + side * 1.2, z + 0.1, rng.range(0, 1), 0.8]);
    } else if (kind === 'wreck') {
      const x = sideX(side, 3.6, 5.2);
      const yaw = rng.range(-0.6, 0.6) + (side > 0 ? 0.3 : -0.3);
      place.push(['tank', x, z, yaw, 0.9]);
      emitters.push({ type: 'smoke', x, y: 1.4, z, rate: 9, acc: 0 });
      emitters.push({ type: 'fire', x: x - 0.2, y: 1.2, z: z + 0.5, rate: 14, acc: 0 });
      place.push(['hedgehog', side * (ROAD_HALF + 1.5), z + 2, rng.range(0, 3), 1]);
    } else if (kind === 'camp') {
      const x = sideX(side, 3.5, 5.5);
      place.push(['tent', x, z, rng.range(-0.3, 0.3), 1], ['tent', x + side * 0.4, z - 2.4, rng.range(-0.3, 0.3), 0.9]);
      place.push(['crate', x - side * 1.5, z - 1, rng.range(0, 1), 1]);
      place.push(['barrelStatic', x - side * 1.4, z - 1.8, 0, 1]);
    } else if (kind === 'tower') {
      place.push(['tower', sideX(side, 3.8, 5.5), z, rng.range(0, 1.5), 1]);
      place.push(['sandbags', side * (ROAD_HALF + 1.4), z + 1, Math.PI / 2, 1]);
    } else if (kind === 'bunker') {
      place.push(['bunker', sideX(side, 3.2, 4.5), z, side > 0 ? -Math.PI / 2 : Math.PI / 2, 1]);
    } else {
      for (let i = 0; i < 3; i++) place.push(['hedgehog', side * (ROAD_HALF + 1.3 + i * 1.3), z + rng.range(-0.6, 0.6), rng.range(0, 3), 1]);
    }
    // Eksplozivna buradi uz sam put (eksplodiraju kad vojska prođe)
    if (rng.chance(0.45) && z < -15) {
      const bx = -side * (ROAD_HALF + 0.85);
      const bz = z + rng.range(-3, 3);
      place.push(['barrel', bx, bz, rng.range(0, 3), 1]);
      if (rng.chance(0.5)) place.push(['barrel', bx - side * 0.5, bz + 0.45, rng.range(0, 3), 1]);
    }
  }
  fortBags.forEach(([x, z]) => place.push(['sandbags', x, z, 0, 1]));

  const PROP_GEO = {
    sandbags: M.sandbags(), hedgehog: M.hedgehog(), barrel: M.barrel(), barrelStatic: M.barrel(), crate: M.crate(),
    tank: M.tankWreck(), tent: M.tent(), bunker: M.bunker(), tower: M.watchtower(),
  };
  const byKind = {};
  place.forEach((it) => (byKind[it[0]] = byKind[it[0]] || []).push(it));
  const propShadows = [];
  for (const [kind, list] of Object.entries(byKind)) {
    const mesh = new THREE.InstancedMesh(PROP_GEO[kind], vcMat(), list.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    list.forEach(([, x, z, yaw, sc], i) => {
      q.setFromAxisAngle(up, yaw);
      m.compose(p.set(x, -0.1, z), q, s.setScalar(sc));
      mesh.setMatrixAt(i, m);
      if (kind === 'barrel') barrels.push({ mesh, index: i, x, z, alive: true });
      const r = { tank: 3.2, bunker: 2.6, tower: 2.2, tent: 2.2, sandbags: 1.8 }[kind] || 0.9;
      propShadows.push([x, z, r * sc]);
    });
    group.add(mesh);
  }

  // Drveće (sada ređe, da ima mesta za vojne predmete)
  const treeCount = Math.floor(length / 2.6);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.15, 0.9, 6), lambert(COLORS.trunk), treeCount);
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.85, 1), lambert(0xffffff, { flatShading: true }), treeCount);
  const pines = new THREE.InstancedMesh(new THREE.ConeGeometry(0.75, 1.9, 7), lambert(0xffffff, { flatShading: true }), treeCount);
  [trunks, crowns, pines].forEach((t) => (t.castShadow = true));
  let nRound = 0;
  let nPine = 0;
  const greens = [0x3fb54a, 0x5cc94b, 0x2f9e45, 0x7bd44f];
  for (let i = 0; i < treeCount; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (ROAD_HALF + 5.6 + rng.range(0, GRASS_W - 6.2));
    const z = startZ - rng.range(0, length);
    const sc = rng.range(0.75, 1.35);
    m.compose(p.set(x, -0.1 + 0.45 * sc, z), q.identity(), s.setScalar(sc));
    trunks.setMatrixAt(i, m);
    q.setFromAxisAngle(up, rng.range(0, 6));
    if (rng.chance(0.55)) {
      m.compose(p.set(x, -0.1 + 1.35 * sc, z), q, s);
      crowns.setMatrixAt(nRound, m);
      crowns.setColorAt(nRound++, col.set(rng.pick(greens)));
    } else {
      m.compose(p.set(x, -0.1 + 1.6 * sc, z), q, s);
      pines.setMatrixAt(nPine, m);
      pines.setColorAt(nPine++, col.set(rng.pick([0x2f9e45, 0x268a3d, 0x3aa84c])));
    }
    propShadows.push([x + 0.2, z + 0.2, 1.8 * sc]);
  }
  crowns.count = nRound;
  pines.count = nPine;

  // Meke senke ispod predmeta i drveća (kao ambient occlusion)
  const shadows = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), color: 0x1d3a1a, transparent: true, opacity: 0.32, depthWrite: false }),
    propShadows.length,
  );
  propShadows.forEach(([x, z, r], i) => {
    m.compose(p.set(x, -0.09, z), q.identity(), s.set(r, 1, r));
    shadows.setMatrixAt(i, m);
  });
  shadows.renderOrder = -1;

  // Trava, cveće, žbunje, kamenje
  const tuftCount = Math.floor(length * 2.2);
  const tufts = new THREE.InstancedMesh(M.grassTuft(), vcMat(), tuftCount);
  for (let i = 0; i < tuftCount; i++) {
    const side = i % 2 ? 1 : -1;
    m.compose(
      p.set(side * (ROAD_HALF + 0.6 + rng.range(0, GRASS_W - 0.8)), -0.1, startZ - rng.range(0, length)),
      q.setFromAxisAngle(up, rng.range(0, 6)),
      s.setScalar(rng.range(0.7, 1.4)),
    );
    tufts.setMatrixAt(i, m);
  }
  const flowerCount = Math.floor(length * 0.6);
  const flowers = new THREE.InstancedMesh(M.flower(), vcMat(), flowerCount);
  for (let i = 0; i < flowerCount; i++) {
    const side = i % 2 ? 1 : -1;
    m.compose(
      p.set(side * (ROAD_HALF + 0.8 + rng.range(0, GRASS_W - 1)), -0.1, startZ - rng.range(0, length)),
      q.setFromAxisAngle(up, rng.range(0, 6)),
      s.setScalar(rng.range(0.8, 1.3)),
    );
    flowers.setMatrixAt(i, m);
  }
  const bushCount = Math.floor(length / 3.5);
  const bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.4, 1), lambert(0xffffff, { flatShading: true }), bushCount);
  bushes.castShadow = true;
  for (let i = 0; i < bushCount; i++) {
    const side = i % 2 ? 1 : -1;
    const sc = rng.range(0.6, 1.2);
    m.compose(
      p.set(side * (ROAD_HALF + 0.9 + rng.range(0, GRASS_W - 1.2)), 0.1 * sc, startZ - rng.range(0, length)),
      q.setFromAxisAngle(up, rng.range(0, 6)),
      s.set(sc * 1.3, sc, sc * 1.3),
    );
    bushes.setMatrixAt(i, m);
    bushes.setColorAt(i, col.set(rng.pick([0x58c74a, 0x6fd552, 0x48b443])));
  }
  const rockCount = Math.floor(length / 6);
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.35, 0), lambert(0xffffff, { flatShading: true }), rockCount);
  rocks.castShadow = true;
  for (let i = 0; i < rockCount; i++) {
    const side = i % 2 ? 1 : -1;
    const sc = rng.range(0.5, 1.3);
    m.compose(
      p.set(side * (ROAD_HALF + 1 + rng.range(0, GRASS_W - 1.4)), 0, startZ - rng.range(0, length)),
      q.setFromEuler(new THREE.Euler(rng.range(0, 3), rng.range(0, 3), 0)),
      s.set(sc * 1.2, sc * 0.7, sc),
    );
    rocks.setMatrixAt(i, m);
    rocks.setColorAt(i, col.set(rng.pick([0xb9c2cc, 0xa7b1bd, 0xcfd6de])));
  }
  // Tamnije mrlje zemlje na travi
  const patchCount = Math.floor(length / 5);
  const patches = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), color: 0x7a5a32, transparent: true, opacity: 0.4, depthWrite: false }),
    patchCount,
  );
  for (let i = 0; i < patchCount; i++) {
    const side = i % 2 ? 1 : -1;
    const r = rng.range(1.5, 3.5);
    m.compose(
      p.set(side * (ROAD_HALF + 1.5 + rng.range(0, GRASS_W - 2.5)), -0.095, startZ - rng.range(0, length)),
      q.setFromAxisAngle(up, rng.range(0, 6)),
      s.set(r, 1, r * rng.range(0.6, 1)),
    );
    patches.setMatrixAt(i, m);
  }
  patches.renderOrder = -2;
  group.add(patches, shadows, trunks, crowns, pines, tufts, flowers, bushes, rocks);

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

  return { group, gates, squads, enemy, castle, emitters, barrels, startZ, endZ };
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

    const top = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, 0.26, 0.26), lambert(good ? 0x1683e0 : 0xe02641));
    top.position.set(sideX, H + 0.05, 0);
    top.castShadow = true;

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
    post.castShadow = true;
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(x, H + 0.35, 0);
    g.add(post, cap);
  });
  group.add(g);
  return { z: it.z, left, right, used: false, fade: 0, chosen: null };
}

function buildFortress(z) {
  const group = new THREE.Group();
  group.position.set(0, 0, z);
  const body = new THREE.Mesh(M.fortress(), vcMat());
  body.geometry.userData.shared = false; // pravi se nova za svaki nivo, pa se i briše
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6), lambert(0xdddddd));
  pole.position.set(0, 5.2, 0);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8, 8, 1), lambert(COLORS.red, { side: THREE.DoubleSide }));
  flag.geometry.translate(0.65, 0, 0);
  flag.position.set(0.05, 6.1, 0);
  group.add(pole, flag);
  return { group, flag, pole, basePos: flag.geometry.getAttribute('position').array.slice(), destroyed: 0 };
}

// Zastava se talasa; posle pobede tvrđava se ruši
export function animateWorld(world, t, dt) {
  const { flag, basePos } = world.castle;
  const pos = flag.geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = basePos[i * 3];
    pos.setZ(i, Math.sin(x * 4 - t * 6) * 0.12 * x);
  }
  pos.needsUpdate = true;
  const c = world.castle;
  if (c.collapsing) {
    c.destroyed = Math.min(1, c.destroyed + dt * 0.55);
    const d = c.destroyed * c.destroyed;
    c.group.position.y = -d * 4.5;
    c.group.rotation.z = Math.sin(t * 30) * 0.02 * (1 - c.destroyed) + d * 0.12;
    c.group.rotation.x = -d * 0.15;
  }
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
