// Pravi scenu jednog nivoa: put sa dve trake (levo zombiji, desno polja napredovanja), zid između traka,
// trotoare, zgrade sa bočnim ulicama (ili šumu), predmete pored puta, bazu iza junaka, vatre i svetla.
import * as THREE from 'three';
import { LANE_X, ROAD_HALF, MEDIAN_START_Z, ALLEYS_Z, FIELD_SPEED } from '../core/config.js';
import { createRng } from '../core/rng.js';
import { asphaltTexture, dirtTexture, sidewalkTexture, facadeTexture, facadeGlowTexture, shopTexture, splatTexture, glowTexture, shadowTexture } from '../fx/textures.js';
import { buildStreetSide } from './buildings.js';
import * as M from '../gfx/models.js';

const FRONT_X = 8.4; // fasade zgrada
const Z_NEAR = 14;
const Z_FAR = -135;

let vcMat;
function vertexColorMat() {
  if (!vcMat) {
    vcMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    vcMat.userData.shared = true;
  }
  return vcMat;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);

function instanced(group, geo, list, material = vertexColorMat(), { shadow = true, receive = true } = {}) {
  if (!list.length) return null;
  const mesh = new THREE.InstancedMesh(geo, material, list.length);
  list.forEach((it, i) => {
    _e.set(it.rx || 0, it.yaw || 0, it.rz || 0);
    _q.setFromEuler(_e);
    _m.compose(_p.set(it.x, it.y || 0, it.z), _q, _s.setScalar(it.s || 1));
    mesh.setMatrixAt(i, _m);
  });
  mesh.castShadow = shadow;
  mesh.receiveShadow = receive;
  group.add(mesh);
  return mesh;
}

export function buildWorld(level, scene, { menu = false } = {}) {
  const theme = level.theme;
  const group = new THREE.Group();
  scene.add(group);
  const rng = createRng(level.number * 101 + 17);
  const city = !!theme.buildings;
  const len = Z_NEAR - Z_FAR;
  const midZ = (Z_NEAR + Z_FAR) / 2;
  const emitters = []; // vatra i dim (Game ih pokreće kroz efekte)
  const glows = []; // svetleće tačke (lampe, vatre) koje trepere
  const blinkers = []; // rotacije policijskih kola

  // ---------- Put ----------
  const ownTextures = []; // kopije tekstura koje pripadaju samo ovom nivou (brišu se na kraju)
  const roadTex = (theme.roadTex === 'dirt' ? dirtTexture() : asphaltTexture()).clone();
  roadTex.needsUpdate = true;
  ownTextures.push(roadTex);
  roadTex.repeat.set(2, len / 8);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, len), new THREE.MeshLambertMaterial({ color: theme.road, map: roadTex }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, midZ);
  road.receiveShadow = true;
  group.add(road);

  // Linije na putu
  if (theme.lines) {
    const lineMat = new THREE.MeshBasicMaterial({ color: theme.lines, transparent: true, opacity: 0.75 });
    [-1, 1].forEach((sd) => {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.14, len), lineMat);
      l.rotation.x = -Math.PI / 2;
      l.position.set(sd * (ROAD_HALF - 0.25), 0.012, midZ);
      group.add(l);
    });
  }

  // Zid između traka (betonski u gradu, ograda od dasaka u šumi)
  const medianItems = [];
  for (let z = MEDIAN_START_Z - 1.2; z > Z_FAR; z -= 2.45) medianItems.push({ x: 0, z, yaw: 0, s: 1 });
  if (city) instanced(group, M.jersey(), medianItems);
  else instanced(group, M.fence(), medianItems.map((it) => ({ ...it, yaw: Math.PI / 2 })));

  // Svetleće strelice na desnoj traci pokazuju da odatle dolaze polja napredovanja
  const chevronMat = new THREE.MeshBasicMaterial({ color: theme.fieldGlow, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending });
  const chevrons = new THREE.InstancedMesh(M.chevron(), chevronMat, 16);
  chevrons.renderOrder = 1;
  group.add(chevrons);

  // Mrlje krvi i gar na levoj traci (atmosfera)
  const splatMat = new THREE.MeshBasicMaterial({ map: splatTexture(), color: 0x3a0d0a, transparent: true, opacity: 0.7, depthWrite: false });
  const splats = [];
  for (let i = 0; i < 18; i++) splats.push({ x: -LANE_X + rng.range(-2, 2), y: 0.015, z: rng.range(-60, 4), yaw: rng.range(0, 6), s: rng.range(0.8, 2.2) });
  const splatGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  instanced(group, splatGeo, splats, splatMat, { shadow: false, receive: false });

  // ---------- Trotoari i zgrade (grad) ----------
  if (city) {
    const swTex = sidewalkTexture().clone();
    swTex.needsUpdate = true;
    ownTextures.push(swTex);
    swTex.repeat.set(3.3, len);
    const swMat = new THREE.MeshLambertMaterial({ color: theme.sidewalk, map: swTex });
    [-1, 1].forEach((sd) => {
      const w = FRONT_X - ROAD_HALF;
      const sw = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, len), swMat);
      sw.position.set(sd * (ROAD_HALF + w / 2), 0.09, midZ);
      sw.receiveShadow = true;
      group.add(sw);
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, len), new THREE.MeshLambertMaterial({ color: 0x8c8a86 }));
      curb.position.set(sd * (ROAD_HALF + 0.11), 0.1, midZ);
      curb.receiveShadow = true;
      group.add(curb);
    });

    const b = theme.buildings;
    const upperMat = new THREE.MeshLambertMaterial({
      map: facadeTexture(b.style),
      vertexColors: true,
      emissive: b.night ? 0xffffff : 0x000000,
      emissiveMap: b.night ? facadeGlowTexture(b.style) : null,
      emissiveIntensity: b.night ? 0.85 : 0,
    });
    const shopMat = new THREE.MeshLambertMaterial({ map: shopTexture(), vertexColors: true });
    [-1, 1].forEach((sd) => {
      const geo = buildStreetSide(rng, { side: sd, frontX: FRONT_X, fromZ: Z_NEAR, toZ: Z_FAR, gaps: ALLEYS_Z, colors: b.colors, ruin: b.style === 'ruin' });
      const mesh = new THREE.Mesh(geo, [upperMat, shopMat]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    });

    // Zgrade na kraju ulice (zatvaraju pogled u magli)
    const endMat = new THREE.MeshLambertMaterial({ color: theme.fog.color });
    for (let i = 0; i < 6; i++) {
      const h = rng.range(10, 26);
      const m = new THREE.Mesh(new THREE.BoxGeometry(rng.range(8, 14), h, 8), endMat);
      m.position.set(-20 + i * 8, h / 2, Z_FAR - 6);
      group.add(m);
    }
  }

  // ---------- Predmeti pored puta ----------
  const props = {};
  const add = (kind, it) => (props[kind] = props[kind] || []).push(it);
  const shadowSpots = [];
  const sideX = (sd, min, max) => sd * rng.range(min, max);

  if (city) {
    // Lampe duž trotoara
    if (theme.lamps !== 'none') {
      for (let z = 6; z > -110; z -= 13) {
        [-1, 1].forEach((sd) => {
          const lz = z + (sd > 0 ? 6 : 0);
          if (ALLEYS_Z.some((a) => Math.abs(a - lz) < 2.5)) return;
          add('lamp', { x: sd * (ROAD_HALF + 0.6), z: lz, yaw: sd > 0 ? Math.PI : 0 });
          if (theme.lamps === 'flicker' && rng.chance(0.55)) {
            glows.push({ x: sd * (ROAD_HALF + 0.6) - sd * 0.6, y: 3.28, z: lz, size: 2.6, color: 0xffd9a0, flicker: rng.chance(0.4), ground: true });
          }
        });
      }
    }
    // Automobili, kontejneri, smeće, hidranti, čunjevi, ruševine
    for (let z = 10; z > -100; z -= rng.range(5, 9)) {
      const sd = rng.chance(0.5) ? 1 : -1;
      if (ALLEYS_Z.some((a) => Math.abs(a - z) < 3)) {
        add('dumpster', { x: sd * (FRONT_X + 1.2), z, yaw: sd * Math.PI / 2 });
        continue;
      }
      const r = rng.next();
      if (r < 0.3) {
        const burnt = theme.id === 'ruins' || rng.chance(0.3);
        const color = rng.pick([0x8a3a32, 0x2f5a8a, 0xb0b4b8, 0x3a6a3a, 0xc9a23a]);
        add(burnt ? 'carBurnt' : 'car-' + color, { x: sd * rng.range(6.3, 6.9), z, yaw: rng.range(-0.25, 0.25) + (rng.chance(0.5) ? Math.PI : 0), color });
        shadowSpots.push([sd * 6.6, z, 2.6]);
        if (burnt && rng.chance(0.5)) emitters.push({ type: 'smoke', x: sd * 6.6, y: 1.2, z, rate: 5, acc: 0 });
      } else if (r < 0.45) add('trash', { x: sd * rng.range(6.0, 7.6), z, yaw: rng.range(0, 6) });
      else if (r < 0.55) add('hydrant', { x: sd * 5.6, z, yaw: 0 });
      else if (r < 0.7) add('cone', { x: sideX(sd, 5.5, 7.5), z, yaw: rng.range(0, 6), rz: rng.chance(0.3) ? 1.5 : 0, y: 0.18 });
      else if (r < 0.85 && theme.id === 'ruins') {
        add('rubble', { x: sd * rng.range(6, 7.6), z, yaw: rng.range(0, 6), s: rng.range(0.9, 1.6) });
      } else add('jersey', { x: sd * rng.range(6.2, 7.2), z, yaw: rng.range(-0.4, 0.4) });
    }
    // Policijska kola blizu baze, sa rotacijom koja trepće
    add('police', { x: 6.7, z: -7, yaw: 0.3 });
    blinkers.push({ x: 6.7 - 0.06, y: 1.48, z: -7.06 });
  } else {
    // ---------- Šuma ----------
    const trees = [];
    const dead = [];
    const bushes = [];
    for (let i = 0; i < 260; i++) {
      const sd = i % 2 ? 1 : -1;
      const z = rng.range(Z_FAR, Z_NEAR);
      let x = sd * rng.range(6.4, 34);
      if (ALLEYS_Z.some((a) => Math.abs(a - z) < 2.2) && Math.abs(x) < 12) x = sd * rng.range(12, 34);
      const s = rng.range(0.8, 1.5);
      if (rng.chance(0.18)) dead.push({ x, z, yaw: rng.range(0, 6), s: s * 1.4 });
      else trees.push({ x, z, yaw: rng.range(0, 6), s });
      if (Math.abs(x) < 16) shadowSpots.push([x, z, 2 * s]);
    }
    for (let i = 0; i < 70; i++) {
      const sd = i % 2 ? 1 : -1;
      bushes.push({ x: sd * rng.range(5.8, 12), z: rng.range(-90, 12), yaw: rng.range(0, 6), s: rng.range(0.7, 1.3) });
    }
    instanced(group, M.darkPine(), trees);
    instanced(group, M.deadTree(), dead);
    instanced(group, M.bush(), bushes);
    for (let z = 8; z > -100; z -= rng.range(9, 15)) {
      const sd = rng.chance(0.5) ? 1 : -1;
      if (rng.chance(0.5)) add('log', { x: sd * rng.range(6.2, 8), z, yaw: rng.range(-0.4, 0.4) + Math.PI / 2 });
      else add('rocks', { x: sd * rng.range(6, 8.5), z, yaw: rng.range(0, 6), s: rng.range(0.8, 1.6) });
    }
    add('cabin', { x: 13, z: -24, yaw: -Math.PI / 2 - 0.3 });
    glows.push({ x: 13 - 1.8, y: 1.3, z: -24 + 1, size: 2.2, color: 0xffb35a, flicker: true, ground: false });
    add('carBurnt', { x: -6.8, z: -18, yaw: 0.4 });
    // Ograda uz put
    const fences = [];
    for (let z = 6; z > -70; z -= 2.1) {
      [-1, 1].forEach((sd) => {
        if (ALLEYS_Z.some((a) => Math.abs(a - z) < 2.2)) return;
        if (rng.chance(0.75)) fences.push({ x: sd * (ROAD_HALF + 0.5), z, yaw: Math.PI / 2 + rng.range(-0.06, 0.06), rz: rng.range(-0.08, 0.08) });
      });
    }
    instanced(group, M.fence(), fences);
  }

  // ---------- Vatre ----------
  for (let i = 0; i < theme.fires; i++) {
    const sd = rng.chance(0.5) ? 1 : -1;
    const z = rng.range(-70, 4);
    const x = city ? sd * rng.range(5.8, 7.6) : sd * rng.range(6.2, 9);
    if (city) add('barrelFire', { x, z, yaw: 0 });
    emitters.push({ type: 'fire', x, y: city ? 0.95 : 0.4, z, rate: 9, acc: 0 });
    if (rng.chance(0.6)) emitters.push({ type: 'smoke', x, y: 1.6, z, rate: 3, acc: 0 });
    glows.push({ x, y: city ? 1.2 : 0.6, z, size: 3.2, color: 0xff8a3a, flicker: true, ground: true });
  }
  // Požari u prozorima razorenih zgrada
  if (theme.id === 'ruins') {
    for (let i = 0; i < 8; i++) {
      const sd = rng.chance(0.5) ? 1 : -1;
      const z = rng.range(-80, -6);
      const y = rng.range(5, 12);
      emitters.push({ type: 'fire', x: sd * (FRONT_X - 0.2), y, z, rate: 7, acc: 0 });
      emitters.push({ type: 'smoke', x: sd * (FRONT_X - 0.4), y: y + 1, z, rate: 2.5, acc: 0 });
      glows.push({ x: sd * (FRONT_X - 0.3), y, z, size: 4, color: 0xff6a2a, flicker: true, ground: false });
    }
  }

  // ---------- Baza iza junaka ----------
  add('sandbags', { x: -3.4, z: 2.6, yaw: 0, s: 1.15 });
  add('sandbags', { x: 3.4, z: 2.6, yaw: 0, s: 1.15 });
  add('sandbags', { x: -5.4, z: 1.6, yaw: 0.5, s: 1.15 });
  add('sandbags', { x: 5.4, z: 1.6, yaw: -0.5, s: 1.15 });
  add('crate', { x: -4.8, z: 3.6, yaw: 0.3 });
  add('crate', { x: -4.2, z: 3.9, yaw: -0.2, s: 0.8 });
  add('crate', { x: 4.6, z: 3.8, yaw: 0.6 });
  add('truck', { x: -7.6, z: 7.5, yaw: 0.25 });
  add('flood', { x: 6.3, z: 3.2, yaw: 0.5 });
  add('flood', { x: -6.3, z: 3.2, yaw: -0.5 });
  if (theme.id === 'forest') {
    add('campfire', { x: 5.6, z: 5.6, yaw: 0 });
    emitters.push({ type: 'fire', x: 5.6, y: 0.25, z: 5.6, rate: 10, acc: 0 });
    glows.push({ x: 5.6, y: 0.6, z: 5.6, size: 3, color: 0xff9a3a, flicker: true, ground: true });
  }
  [-1, 1].forEach((sd) => glows.push({ x: sd * 6.15, y: 3.42, z: 3.0, size: 2.4, color: 0xfff3d0, flicker: false, ground: false }));

  // Eksplozivna buradi u levoj traci (pogodi ih i zombiji oko njih stradaju)
  const barrels = (level.barrels || []).map((b) => ({ x: b.x, z: b.z, alive: true, hp: 30, isBarrel: true }));
  const barrelMesh = instanced(group, M.barrel(), barrels.map((b) => ({ x: b.x, z: b.z, s: 1.4 })));
  barrels.forEach((b, i) => {
    b.mesh = barrelMesh;
    b.index = i;
    b.aimPoint = () => [b.x, 0.5, b.z];
  });

  // Postavljanje predmeta
  const PROPS = {
    lamp: M.streetLamp(), dumpster: M.dumpster(), trash: M.trashBags(), hydrant: M.hydrant(), cone: M.trafficCone(),
    rubble: M.rubblePile(), jersey: M.jersey(), police: M.policeCar(), carBurnt: M.car(0x333333, true), log: M.log(),
    rocks: M.rockCluster(0x6f7268), cabin: M.cabin(), sandbags: M.sandbags(), crate: M.crate(), truck: M.militaryTruck(),
    flood: M.floodlight(), campfire: M.campfire(), barrelFire: M.barrel(),
  };
  for (const [kind, list] of Object.entries(props)) {
    let geo = PROPS[kind];
    if (!geo && kind.startsWith('car-')) geo = M.car(list[0].color, false);
    if (geo) instanced(group, geo, list);
  }

  // Meke senke ispod predmeta
  if (shadowSpots.length) {
    const sm = new THREE.MeshBasicMaterial({ map: shadowTexture(), color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
    const sh = instanced(group, new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), shadowSpots.map(([x, z, r]) => ({ x, y: 0.03, z, s: r * 1.4 })), sm, { shadow: false, receive: false });
    if (sh) sh.renderOrder = -1;
  }

  // Svetleće tačke (sjaj lampi i vatri) i sjaj na zemlji ispod njih — sve u dva modela (brže crtanje)
  const glowGeo = new THREE.PlaneGeometry(1, 1);
  const glowMatI = new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const glowMesh = new THREE.InstancedMesh(glowGeo, glowMatI, Math.max(1, glows.length));
  glowMesh.count = glows.length;
  glowMesh.renderOrder = 3;
  glowMesh.frustumCulled = false;
  const pools = glows.filter((g) => g.ground);
  const poolMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), glowMatI, Math.max(1, pools.length));
  poolMesh.count = pools.length;
  poolMesh.frustumCulled = false;
  const _gc = new THREE.Color();
  pools.forEach((g, i) => {
    _m.compose(_p.set(g.x, 0.03, g.z), _q.identity(), _s.set(g.size * 2.2, 1, g.size * 2.2));
    poolMesh.setMatrixAt(i, _m);
    poolMesh.setColorAt(i, _gc.set(g.color).multiplyScalar(0.3));
  });
  if (pools.length) poolMesh.instanceColor.needsUpdate = true;
  if (glows.length) glowMesh.setColorAt(0, _gc.set(0xffffff));
  group.add(glowMesh, poolMesh);
  const glowSprites = glows.map((g) => ({ ...g, phase: rng.range(0, 6), poolIndex: pools.indexOf(g) }));
  const blinkMeshes = blinkers.map((b) => {
    const red = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xff2a2a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const blue = red.clone();
    blue.material = red.material.clone();
    blue.material.color.set(0x2a6aff);
    red.position.set(b.x - 0.3, b.y, b.z);
    blue.position.set(b.x + 0.3, b.y, b.z);
    group.add(red, blue);
    return { red, blue };
  });

  // Spisak bočnih ulica (zombiji izlaze iz njih)
  const alleys = { left: ALLEYS_Z.slice(), right: ALLEYS_Z.slice() };

  let chevronOffset = 0;
  return {
    group, theme, emitters, barrels, alleys,
    update(dt, t, camera) {
      // Strelice klize ka junaku
      chevronOffset = (chevronOffset + FIELD_SPEED * dt) % 4.4;
      for (let i = 0; i < 16; i++) {
        const z = -66 + i * 4.4 + chevronOffset;
        _m.compose(_p.set(LANE_X, 0.02, z), _q.identity(), _s.set(1.1, 1, 1.1));
        chevrons.setMatrixAt(i, _m);
      }
      chevrons.instanceMatrix.needsUpdate = true;
      // Svetla trepere, okrenuta ka kameri
      glowSprites.forEach((g, i) => {
        let k = 1;
        if (g.flicker) k = 0.75 + Math.sin(t * 11 + g.phase) * 0.12 + Math.sin(t * 23 + g.phase * 2) * 0.1;
        _m.compose(_p.set(g.x, g.y, g.z), camera.quaternion, _s.setScalar(g.size));
        glowMesh.setMatrixAt(i, _m);
        glowMesh.setColorAt(i, _gc.set(g.color).multiplyScalar(0.85 * k));
        if (g.poolIndex >= 0) poolMesh.setColorAt(g.poolIndex, _gc.set(g.color).multiplyScalar(0.3 * k));
      });
      if (glowSprites.length) {
        glowMesh.instanceMatrix.needsUpdate = true;
        glowMesh.instanceColor.needsUpdate = true;
        if (pools.length) poolMesh.instanceColor.needsUpdate = true;
      }
      const on = Math.sin(t * 9) > 0;
      for (const b of blinkMeshes) {
        b.red.quaternion.copy(camera.quaternion);
        b.blue.quaternion.copy(camera.quaternion);
        b.red.material.opacity = on ? 1 : 0.1;
        b.blue.material.opacity = on ? 0.1 : 1;
      }
    },
    hideBarrel(b) {
      _m.makeScale(0, 0, 0);
      b.mesh.setMatrixAt(b.index, _m);
      b.mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      scene.remove(group);
      group.traverse((o) => {
        if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
        if (o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((mt) => {
            if (!mt.userData.shared) mt.dispose();
          });
        }
      });
      ownTextures.forEach((tx) => tx.dispose());
    },
  };
}
