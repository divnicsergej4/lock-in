// Nebo sa prelivom boja, zvezde i mesec (noću) i tlo do horizonta. Sve zavisi od okruženja nivoa.
import * as THREE from 'three';
import { glowTexture } from '../fx/textures.js';

function groundTexture(theme) {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  const [a, b] = [theme.ground, theme.ground2];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const checker = (Math.floor((x / size) * 2) + Math.floor((y / size) * 2)) % 2;
      const n = Math.sin(x * 0.7) * Math.sin(y * 0.55) * 5 + Math.sin(x * 2.3 + y * 1.7) * 3;
      const c = checker ? a : b;
      const i = (y * size + x) * 4;
      data[i] = Math.max(0, Math.min(255, c[0] + n));
      data[i + 1] = Math.max(0, Math.min(255, c[1] + n));
      data[i + 2] = Math.max(0, Math.min(255, c[2] + n));
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export function createEnvironment(scene) {
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top;
      uniform vec3 horizon;
      varying vec3 vDir;
      void main() {
        float t = clamp(vDir.y * 2.2, 0.0, 1.0);
        gl_FragColor = vec4(mix(horizon, top, pow(t, 0.8)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(170, 24, 12), skyMat);
  sky.renderOrder = -10;
  scene.add(sky);

  // Zvezde
  const starCount = 260;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const e = 0.18 + Math.random() * 1.2;
    starPos[i * 3] = Math.cos(a) * Math.cos(e) * 160;
    starPos[i * 3 + 1] = Math.sin(e) * 160;
    starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 160;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8, depthWrite: false }));
  stars.renderOrder = -9;
  scene.add(stars);

  // Mesec
  const moon = new THREE.Mesh(new THREE.CircleGeometry(7, 32), new THREE.MeshBasicMaterial({ color: 0xe8efff, fog: false }));
  const moonGlow = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x6f8fc0, transparent: true, opacity: 0.55, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  moon.renderOrder = moonGlow.renderOrder = -8;
  scene.add(moon, moonGlow);

  const groundMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.06, -60);
  ground.receiveShadow = true;
  scene.add(ground);

  return {
    setTheme(theme) {
      skyMat.uniforms.top.value.set(theme.skyTop);
      skyMat.uniforms.horizon.value.set(theme.horizon);
      stars.visible = theme.stars;
      moon.visible = moonGlow.visible = theme.moon;
      if (groundMat.map) groundMat.map.dispose();
      groundMat.map = groundTexture(theme);
      groundMat.map.repeat.set(60, 60);
      groundMat.needsUpdate = true;
    },
    update(camera) {
      sky.position.copy(camera.position);
      stars.position.copy(camera.position);
      // Mesec stoji visoko levo, uvek okrenut ka kameri
      moon.position.set(camera.position.x - 55, camera.position.y + 62, camera.position.z - 120);
      moon.lookAt(camera.position);
      moonGlow.position.copy(moon.position);
      moonGlow.quaternion.copy(moon.quaternion);
    },
  };
}
