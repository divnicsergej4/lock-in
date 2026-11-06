// Nebo sa prelivom boja i tlo do horizonta. Boje zavise od okruženja nivoa.
import * as THREE from 'three';

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
    uniforms: {
      top: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
    },
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

  const groundMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 300), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.12;
  ground.receiveShadow = true;
  scene.add(ground);

  return {
    setTheme(theme) {
      skyMat.uniforms.top.value.set(theme.skyTop);
      skyMat.uniforms.horizon.value.set(theme.horizon);
      if (groundMat.map) groundMat.map.dispose();
      groundMat.map = groundTexture(theme);
      groundMat.map.repeat.set(260 / 5, 300 / 5);
      groundMat.needsUpdate = true;
    },
    update(t, camera, followZ) {
      sky.position.copy(camera.position);
      // Tlo ide sa vojskom, a šara ostaje na mestu (pomeramo i teksturu)
      ground.position.z = Math.round((followZ - 90) / 5) * 5;
    },
  };
}
