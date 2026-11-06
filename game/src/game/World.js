// Pravi stazu jednog nivoa: put, kapije, crvene odrede, ciljnu liniju, neprijateljsku bazu i drveće.
import * as THREE from 'three';
import { COLORS, ROAD_HALF } from './config.js';
import { isGood, opLabel } from './gates.js';
import { textGeometry } from './pixelText.js';
import { Crowd } from './Crowd.js';
import { createRng } from './rng.js';

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

export function buildLevel(level, parent) {
  const group = new THREE.Group();
  parent.add(group);
  const rng = createRng(level.number * 31 + 5);

  const startZ = 24;
  const endZ = level.enemy.z - 26;
  const length = startZ - endZ;
  const midZ = (startZ + endZ) / 2;

  // Put
  const road = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF * 2, 0.3, length), lambert(COLORS.road));
  road.position.set(0, -0.15, midZ);
  group.add(road);

  // Ivice puta
  const edgeGeo = new THREE.BoxGeometry(0.35, 0.4, length);
  const edgeMat = lambert(COLORS.roadEdge);
  [-1, 1].forEach((side) => {
    const e = new THREE.Mesh(edgeGeo, edgeMat);
    e.position.set(side * (ROAD_HALF + 0.17), 0.05, midZ);
    group.add(e);
  });

  // Isprekidane linije na putu (da se vidi brzina)
  const stripeCount = Math.floor(length / 6);
  const stripes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.16, 0.02, 2.2),
    new THREE.MeshBasicMaterial({ color: 0xdfe5ee }),
    stripeCount * 2,
  );
  const m = new THREE.Matrix4();
  for (let i = 0; i < stripeCount; i++) {
    const z = startZ - i * 6;
    m.makeTranslation(-ROAD_HALF / 2, 0.01, z);
    stripes.setMatrixAt(i * 2, m);
    m.makeTranslation(ROAD_HALF / 2, 0.01, z);
    stripes.setMatrixAt(i * 2 + 1, m);
  }
  group.add(stripes);

  // Kapije
  const gates = level.items
    .filter((it) => it.kind === 'gate')
    .map((it) => {
      const g = new THREE.Group();
      g.position.z = it.z;
      const make = (op, sideX) => {
        const good = isGood(op);
        const panelMat = new THREE.MeshBasicMaterial({
          color: good ? COLORS.gateGood : COLORS.gateBad,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        });
        const panel = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF - 0.2, 2.5, 0.08), panelMat);
        panel.position.set(sideX, 1.25, 0);
        const labelMat = new THREE.MeshBasicMaterial({ color: COLORS.white, transparent: true });
        const label = new THREE.Mesh(textGeometry(opLabel(op)), labelMat);
        label.scale.setScalar(0.95);
        label.position.set(sideX, 1.45, 0.12);
        // Svetla traka na vrhu kapije
        const topMat = lambert(good ? 0x1683e0 : 0xe02641);
        const top = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF - 0.1, 0.22, 0.22), topMat);
        top.position.set(sideX, 2.6, 0);
        g.add(panel, label, top);
        return { op, panel, label, top, panelMat, labelMat };
      };
      const left = make(it.left, -ROAD_HALF / 2);
      const right = make(it.right, ROAD_HALF / 2);
      const postGeo = new THREE.BoxGeometry(0.22, 2.8, 0.22);
      const postMat = lambert(COLORS.post);
      [-ROAD_HALF, 0, ROAD_HALF].forEach((x) => {
        const p = new THREE.Mesh(postGeo, postMat);
        p.position.set(x, 1.4, 0);
        g.add(p);
      });
      group.add(g);
      return { z: it.z, left, right, used: false, fade: 0, chosen: null };
    });

  // Mali crveni odredi usput
  const squads = level.items
    .filter((it) => it.kind === 'squad')
    .map((it) => ({
      crowd: new Crowd(group, { team: 'red', count: it.count, x: it.x, z: it.z, formation: 'block' }),
      startZ: it.z,
      alive: true,
      final: false,
    }));

  // Ciljna linija (šahovska polja)
  const checker = new THREE.Group();
  const cell = 0.7;
  const cols = Math.ceil((ROAD_HALF * 2) / cell);
  const blackMat = new THREE.MeshBasicMaterial({ color: 0x222833 });
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const cellGeo = new THREE.BoxGeometry(cell, 0.03, cell);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = new THREE.Mesh(cellGeo, (r + c) % 2 ? blackMat : whiteMat);
      tile.position.set(-ROAD_HALF + cell / 2 + c * cell, 0.02, level.finishZ - r * cell);
      checker.add(tile);
    }
  }
  group.add(checker);

  // Završna crvena vojska i njena baza
  const enemy = {
    crowd: new Crowd(group, { team: 'red', count: level.enemy.count, x: 0, z: level.enemy.z, formation: 'block' }),
    startZ: level.enemy.z,
    alive: true,
    final: true,
  };
  const base = new THREE.Group();
  base.position.set(0, 0, level.enemy.z - 9);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.2, 2.4), lambert(0xe8e1d6));
  tower.position.y = 1.6;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.8, 4), lambert(COLORS.redDark));
  roof.position.y = 4.1;
  roof.rotation.y = Math.PI / 4;
  const door = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 0.1), lambert(0x6b4a33));
  door.position.set(0, 0.75, 1.21);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2), lambert(0xdddddd));
  pole.position.set(0, 6, 0);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.65, 0.04), lambert(COLORS.red));
  flag.position.set(0.58, 6.7, 0);
  base.add(tower, roof, door, pole, flag);
  group.add(base);

  // Drveće i kamenje pored puta
  const treeCount = Math.floor(length / 2.2);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 0.8, 6), lambert(COLORS.trunk), treeCount);
  const leaves = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.8, 0),
    lambert(COLORS.leaf, { flatShading: true }),
    treeCount,
  );
  const leafColor = new THREE.Color();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let i = 0; i < treeCount; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (ROAD_HALF + 1.6 + rng.range(0, 12));
    const z = startZ - rng.range(0, length);
    const sc = rng.range(0.7, 1.5);
    p.set(x, 0.4 * sc, z);
    s.setScalar(sc);
    m.compose(p, q, s);
    trunks.setMatrixAt(i, m);
    p.set(x, 1.15 * sc, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.range(0, 6));
    m.compose(p, q, s);
    leaves.setMatrixAt(i, m);
    q.identity();
    leaves.setColorAt(i, leafColor.set(rng.chance(0.5) ? COLORS.leaf : COLORS.leaf2));
  }
  group.add(trunks, leaves);

  return { group, gates, squads, enemy, startZ, endZ };
}

// Briše sve iz nivoa i oslobađa memoriju.
export function disposeLevel(world, parent) {
  world.squads.forEach((s) => s.crowd.dispose());
  world.enemy.crowd.dispose();
  parent.remove(world.group);
  world.group.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((mt) => !mt.userData.shared && mt.dispose());
    }
  });
}
