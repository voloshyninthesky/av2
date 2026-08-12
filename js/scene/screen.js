// ============================================================
// BACKDROP SCREEN
// The upstage LED wall: a shader plane that crossfades two slide textures
// with a Ken Burns drift. `screenUniforms` is the seam the slideshow drives.
// ============================================================
import * as THREE from 'three';
import { titleSlideTexture, plateTexture, backCreditTexture } from './textures.js?v=20260813-02';

// ---- backdrop screen: shader slideshow w/ crossfade + Ken Burns ----
export const screenUniforms = {
  texA: { value: null },
  texB: { value: null },
  progress: { value: 0 },
  slideT: { value: 0 },
  pan: { value: new THREE.Vector2(0.02, 0.008) },
  dim: { value: 0.94 },
};
export let slideshowScreen = null;

export function buildScreen() {
  const g = new THREE.Group();

  const frameBack = new THREE.Mesh(
    new THREE.PlaneGeometry(8.06, 4.68),
    new THREE.MeshBasicMaterial({ color: 0x0d0714, fog: false })
  );
  frameBack.position.set(0, 5.35, -5.5);
  g.add(frameBack);

  const frameGold = new THREE.Mesh(
    new THREE.PlaneGeometry(7.9, 4.52),
    new THREE.MeshBasicMaterial({ color: 0xD1A13B, fog: false })
  );
  frameGold.position.set(0, 5.35, -5.48);
  g.add(frameGold);

  const titleTex = titleSlideTexture();
  screenUniforms.texA.value = titleTex;
  screenUniforms.texB.value = titleTex;

  const screenMat = new THREE.ShaderMaterial({
    uniforms: screenUniforms,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D texA, texB;
      uniform float progress, slideT, dim;
      uniform vec2 pan;
      varying vec2 vUv;
      vec2 kenburns(vec2 uv, float t, vec2 p) {
        float z = 1.0 + 0.09 * t;
        return (uv - 0.5 - p * t) / z + 0.5;
      }
      void main() {
        vec4 a = texture2D(texA, kenburns(vUv, slideT, pan));
        vec4 b = texture2D(texB, kenburns(vUv, 0.0, -pan));
        vec4 c = mix(a, b, smoothstep(0.0, 1.0, progress));
        float vig = smoothstep(1.0, 0.45, distance(vUv, vec2(0.5)));
        gl_FragColor = vec4(c.rgb * dim * (0.72 + 0.28 * vig), 1.0);
      }`,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 4.275), screenMat);
  screen.position.set(0, 5.35, -5.45);
  slideshowScreen = screen;
  g.add(screen);

  // brand plate under the screen
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(3.5, 0.55),
    new THREE.MeshBasicMaterial({ map: plateTexture(), fog: false })
  );
  plate.position.set(0, 2.62, -5.45);
  g.add(plate);

  // Maker's mark on the reverse of the wall, found by orbiting behind the stage.
  // The whole screen stack and the backdrop wall are FrontSide, so from back
  // there they are culled and this is the only thing facing you — hence its own
  // plane turned to face -Z, sitting just behind `frameBack`.
  const credit = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 0.5),
    new THREE.MeshBasicMaterial({ map: backCreditTexture(), fog: false })
  );
  credit.position.set(0, 5.35, -5.52);
  credit.rotation.y = Math.PI;
  g.add(credit);

  return g;
}
