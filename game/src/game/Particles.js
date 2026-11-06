// Sistem čestica za dim, vatru, prašinu, bljeskove i varnice.
// Svaka čestica je mala pločica okrenuta ka kameri; sve čestice jedne vrste crtaju se odjednom.
// Čestice se ne prave i ne brišu stalno, već se ponovo koriste (pooling), pa nema zastajkivanja.
import * as THREE from 'three';

const VERT = `
  attribute vec3 aOffset;
  attribute vec4 aColor;
  attribute vec2 aSizeRot;
  attribute float aSeed;
  varying vec2 vUv;
  varying vec4 vColor;
  varying float vSeed;
  varying float vDist;
  void main() {
    vUv = uv;
    vColor = aColor;
    vSeed = aSeed;
    vec4 mv = modelViewMatrix * vec4(aOffset, 1.0);
    float c = cos(aSizeRot.y);
    float s = sin(aSizeRot.y);
    vec2 p = vec2(position.x * c - position.y * s, position.x * s + position.y * c);
    mv.xy += p * aSizeRot.x;
    vDist = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

// Dim i prašina: meke "pahuljaste" mrlje, svetlije odozgo
const FRAG_SMOKE = `
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec2 vUv;
  varying vec4 vColor;
  varying float vSeed;
  varying float vDist;
  void main() {
    vec2 d = vUv - 0.5;
    float r = length(d) * 2.0;
    float lumps = sin(d.x * 9.0 + vSeed * 6.0) * sin(d.y * 8.0 - vSeed * 4.0) * 0.18
                + sin((d.x + d.y) * 15.0 + vSeed * 9.0) * 0.08;
    float a = smoothstep(1.0, 0.25, r + lumps) * vColor.a;
    if (a < 0.01) discard;
    vec3 col = vColor.rgb * (0.78 + 0.42 * vUv.y);
    float f = smoothstep(fogNear, fogFar, vDist);
    gl_FragColor = vec4(mix(col, fogColor, f), a);
    #include <colorspace_fragment>
  }
`;

// Vatra, bljesak, varnice: svetlo jezgro koje se sabira sa pozadinom
const FRAG_GLOW = `
  varying vec2 vUv;
  varying vec4 vColor;
  varying float vSeed;
  void main() {
    vec2 d = vUv - 0.5;
    float r = length(d) * 2.0;
    float core = exp(-r * r * 5.0);
    float hot = exp(-r * r * 18.0);
    vec3 col = vColor.rgb * core + vec3(1.0, 0.95, 0.8) * hot * 0.6;
    gl_FragColor = vec4(col * vColor.a, 1.0);
    #include <colorspace_fragment>
  }
`;

export class ParticlePool {
  constructor(scene, { max = 300, glow = false, fog = null } = {}) {
    this.max = max;
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('uv', base.getAttribute('uv'));
    this.aOffset = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aSizeRot = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2).setUsage(THREE.DynamicDrawUsage);
    this.aSeed = new THREE.InstancedBufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aOffset', this.aOffset);
    geo.setAttribute('aColor', this.aColor);
    geo.setAttribute('aSizeRot', this.aSizeRot);
    geo.setAttribute('aSeed', this.aSeed);
    geo.instanceCount = 0;
    this.geo = geo;

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: glow ? FRAG_GLOW : FRAG_SMOKE,
      transparent: true,
      depthWrite: false,
      blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        fogColor: { value: new THREE.Color(fog ? fog.color : 0xffffff) },
        fogNear: { value: fog ? fog.near : 1000 },
        fogFar: { value: fog ? fog.far : 2000 },
      },
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = glow ? 3 : 2;
    scene.add(this.mesh);

    // Podaci o česticama (niz brojeva umesto objekata = brže)
    const F = (n = 1) => new Float32Array(max * n);
    this.pos = F(3);
    this.vel = F(3);
    this.age = F();
    this.life = F();
    this.size0 = F();
    this.size1 = F();
    this.col = F(3);
    this.alpha = F();
    this.rot = F();
    this.vrot = F();
    this.drag = F();
    this.grav = F();
    this.seed = F();
    this.fadeIn = F();
    this.count = 0;
  }

  // Dodaje česticu. o = { x,y,z, vx,vy,vz, life, size, endSize, color, alpha, drag, gravity, spin, fadeIn }
  spawn(o) {
    let i = this.count;
    if (i >= this.max) {
      // Kad nema mesta, zamenjujemo nasumičnu staru česticu
      i = Math.floor(Math.random() * this.max);
    } else {
      this.count++;
    }
    const p3 = i * 3;
    this.pos[p3] = o.x;
    this.pos[p3 + 1] = o.y;
    this.pos[p3 + 2] = o.z;
    this.vel[p3] = o.vx || 0;
    this.vel[p3 + 1] = o.vy || 0;
    this.vel[p3 + 2] = o.vz || 0;
    this.age[i] = 0;
    this.life[i] = o.life || 1;
    this.size0[i] = o.size || 1;
    this.size1[i] = o.endSize ?? o.size ?? 1;
    const c = o.color;
    this.col[p3] = c.r;
    this.col[p3 + 1] = c.g;
    this.col[p3 + 2] = c.b;
    this.alpha[i] = o.alpha ?? 1;
    this.rot[i] = Math.random() * 6.28;
    this.vrot[i] = o.spin ?? (Math.random() - 0.5) * 1.5;
    this.drag[i] = o.drag ?? 0;
    this.grav[i] = o.gravity ?? 0;
    this.seed[i] = Math.random();
    this.fadeIn[i] = o.fadeIn ?? 0.08;
  }

  update(dt) {
    const off = this.aOffset.array;
    const colA = this.aColor.array;
    const sr = this.aSizeRot.array;
    const sd = this.aSeed.array;
    let i = 0;
    while (i < this.count) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        this.swapRemove(i);
        continue;
      }
      const p3 = i * 3;
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[p3] *= k;
      this.vel[p3 + 1] = this.vel[p3 + 1] * k + this.grav[i] * dt;
      this.vel[p3 + 2] *= k;
      this.pos[p3] += this.vel[p3] * dt;
      this.pos[p3 + 1] = Math.max(0.05, this.pos[p3 + 1] + this.vel[p3 + 1] * dt);
      this.pos[p3 + 2] += this.vel[p3 + 2] * dt;
      this.rot[i] += this.vrot[i] * dt;
      const t = this.age[i] / this.life[i];
      const fi = this.fadeIn[i] > 0 ? Math.min(1, this.age[i] / (this.fadeIn[i] * this.life[i])) : 1;
      const fade = (1 - t) * (1 - t * 0.3);
      off[p3] = this.pos[p3];
      off[p3 + 1] = this.pos[p3 + 1];
      off[p3 + 2] = this.pos[p3 + 2];
      colA[i * 4] = this.col[p3];
      colA[i * 4 + 1] = this.col[p3 + 1];
      colA[i * 4 + 2] = this.col[p3 + 2];
      colA[i * 4 + 3] = this.alpha[i] * fade * fi;
      sr[i * 2] = this.size0[i] + (this.size1[i] - this.size0[i]) * (1 - (1 - t) * (1 - t));
      sr[i * 2 + 1] = this.rot[i];
      sd[i] = this.seed[i];
      i++;
    }
    this.geo.instanceCount = this.count;
    this.aOffset.needsUpdate = true;
    this.aColor.needsUpdate = true;
    this.aSizeRot.needsUpdate = true;
    this.aSeed.needsUpdate = true;
  }

  swapRemove(i) {
    const j = this.count - 1;
    if (i !== j) {
      for (const arr of [this.pos, this.vel, this.col]) {
        arr[i * 3] = arr[j * 3];
        arr[i * 3 + 1] = arr[j * 3 + 1];
        arr[i * 3 + 2] = arr[j * 3 + 2];
      }
      for (const arr of [this.age, this.life, this.size0, this.size1, this.alpha, this.rot, this.vrot, this.drag, this.grav, this.seed, this.fadeIn]) {
        arr[i] = arr[j];
      }
    }
    this.count--;
  }

  clear() {
    this.count = 0;
    this.geo.instanceCount = 0;
  }
}
