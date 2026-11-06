// Nebo sa prelivom boja i more koje se blago talasa (stalno prate kameru).
import * as THREE from 'three';

export const HORIZON = 0xc4ecff;

export function createEnvironment(scene) {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(170, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x3d9df2) },
        horizon: { value: new THREE.Color(HORIZON) },
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
    }),
  );
  sky.renderOrder = -10;
  scene.add(sky);

  const waterMat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      deep: { value: new THREE.Color(0x1f9ad6) },
      shallow: { value: new THREE.Color(0x4cc6ef) },
      foam: { value: new THREE.Color(0xd9f6ff) },
      fogColor: { value: new THREE.Color(HORIZON) },
      fogNear: { value: 50 },
      fogFar: { value: 140 },
    },
    vertexShader: `
      varying vec3 vWorld;
      varying float vDist;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vec4 mv = viewMatrix * w;
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float time;
      uniform vec3 deep;
      uniform vec3 shallow;
      uniform vec3 foam;
      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;
      varying vec3 vWorld;
      varying float vDist;
      void main() {
        vec2 p = vWorld.xz;
        float w = sin(p.x * 0.35 + time * 0.9) * 0.5 + sin(p.y * 0.28 - time * 0.7) * 0.5;
        vec3 col = mix(deep, shallow, 0.5 + 0.25 * w);
        // Svetle linije talasa
        float lines = sin(p.y * 0.9 + sin(p.x * 0.25 + time) * 2.0 + time * 1.4);
        col = mix(col, foam, smoothstep(0.93, 1.0, lines) * 0.55);
        // Pena uz obalu ostrva
        float shore = 1.0 - smoothstep(12.0, 14.5, abs(p.x));
        col = mix(col, foam, shore * (0.55 + 0.25 * sin(time * 2.0 + p.y * 0.5)));
        float f = smoothstep(fogNear, fogFar, vDist);
        gl_FragColor = vec4(mix(col, fogColor, f), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.55;
  scene.add(water);

  return {
    update(t, camera, followZ) {
      sky.position.copy(camera.position);
      water.position.z = followZ - 60;
      waterMat.uniforms.time.value = t;
    },
  };
}
