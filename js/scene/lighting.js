// ============================================================
// STAGE LIGHTING + ATMOSPHERE
// Spotlights and their visible cones, the procedural environment map that
// gives lacquer and chrome something to reflect, and the dust motes that
// make the beams legible. `applyLowMobileSceneBudget` is the one lever the
// render probe pulls when the device cannot keep up.
// ============================================================
import * as THREE from 'three';
import { softDiscTexture } from './textures.js?v=20260804-10';
import {
  adaptiveQualityScene,
  registerDimmableLight,
  registerDimmableBeam,
  isMobileGameMode,
  isLowEndMobileGameMode,
  usesLowMobileSceneBudget,
  canUpgradeMobileQuality,
} from '../core/quality.js?v=20260804-10';

// ---- truss + spotlights + visible cones ----
export const spotHeads = [];
export const STAGE_BEAM_BOUNDS = new THREE.Vector4(-7.98, 7.98, -4.98, 3.98);

export function visibleBeamMaterial(color, clipToStage = false) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.06,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  });

  // Every beam dissolves toward its wide base instead of terminating in a hard
  // cut: the open cylinder's bright rim otherwise reads as a dark circle
  // "sitting" at the base of the light against the backdrop. Cylinder UV v runs
  // 1 at the fixture (narrow top) to 0 at the base, so fading on v kills the
  // rim while the upper beam keeps its punch. The clipped variant additionally
  // masks the shell to the platform footprint so nothing hangs over the void.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.stageBeamBounds = { value: STAGE_BEAM_BOUNDS };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vBeamWorldPosition;\nvarying float vBeamAxial;',
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vBeamWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vBeamAxial = uv.y;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec4 stageBeamBounds;\nvarying vec3 vBeamWorldPosition;\nvarying float vBeamAxial;',
      )
      .replace(
        '#include <opaque_fragment>',
        `
          diffuseColor.a *= smoothstep(0.0, 0.55, vBeamAxial);
          ${clipToStage ? `
          float beamFade = 0.24;
          float beamStageMask =
            smoothstep(stageBeamBounds.x, stageBeamBounds.x + beamFade, vBeamWorldPosition.x) *
            (1.0 - smoothstep(stageBeamBounds.y - beamFade, stageBeamBounds.y, vBeamWorldPosition.x)) *
            smoothstep(stageBeamBounds.z, stageBeamBounds.z + beamFade, vBeamWorldPosition.z) *
            (1.0 - smoothstep(stageBeamBounds.w - beamFade, stageBeamBounds.w, vBeamWorldPosition.z));
          diffuseColor.a *= beamStageMask;` : ''}
          if (diffuseColor.a < 0.001) discard;
          #include <opaque_fragment>
        `,
      );
  };
  material.customProgramCacheKey = () => `axial-fade-visible-beam-v2-${clipToStage ? 'clipped' : 'open'}`;
  return material;
}

/** Dim procedural HDR for lacquer/chrome reflections (no external assets). */
export function installStageEnvironment(scene, renderer) {
  try {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, '#2e163f');
    sky.addColorStop(0.42, '#160e22');
    sky.addColorStop(0.55, '#0c0714');
    sky.addColorStop(1, '#05030a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 512, 256);
    // Soft key / fill panels — keep alpha modest (r160 has no environmentIntensity).
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = '#ffe2b0';
    ctx.fillRect(10, 88, 72, 52);
    ctx.fillRect(430, 88, 72, 52);
    ctx.fillStyle = '#9E33CA';
    ctx.fillRect(208, 22, 96, 38);
    ctx.fillStyle = '#D1A13B';
    ctx.fillRect(228, 198, 56, 30);
    ctx.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    tex.dispose();
    pmrem.dispose();
  } catch (_) {
    /* env is optional polish */
  }
}

export function buildLights() {
  const g = new THREE.Group();
  // Soft sky/ground gradient instead of flat wash — spots keep their punch.
  const hemi = new THREE.HemisphereLight(0x6a4a88, 0x1a0e22, 0.48);
  const ambient = new THREE.AmbientLight(0x584a74, 0.16);
  g.add(hemi);
  g.add(ambient);
  registerDimmableLight(hemi);
  registerDimmableLight(ambient);

  // Cool rim from upstage separates performers/instruments from the backdrop
  // without lifting the overall exposure. Culled on the low mobile tier.
  if (!isLowEndMobileGameMode() || canUpgradeMobileQuality) {
    const rim = new THREE.SpotLight(0x7a5cff, 185, 26, 0.72, 0.9, 1.5);
    rim.position.set(0, 7.4, -5.2);
    rim.target.position.set(0, 1.1, 2.4);
    g.add(rim, rim.target);
    adaptiveQualityScene.lowPrioritySpots.push(rim);
    registerDimmableLight(rim);
  }

  // truss bar
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x1a1420, metalness: 0.7, roughness: 0.4 });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 13, 10), trussMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 6.7, 1.6);
  g.add(bar);

  const spots = [
    { x: -4.6, color: 0x9E33CA, intensity: 540, target: new THREE.Vector3(-2.8, 1.0, -1.7), coneR: 1.7, coneFloorY: 0.025, sweep: 0.05 },
    { x: -1.55, color: 0xD1A13B, intensity: 450, target: new THREE.Vector3(-1.35, 0.8, 1.75), coneR: 1.3, coneFloorY: 0.025, lowPriority: true },
    // Key light: the only shadow caster, aimed at the downstage performer spot
    // so the mascot starts lit and grounded. Its pool also washes the mic.
    { x: 1.05, color: 0xfff0d8, intensity: 300, target: new THREE.Vector3(0.25, 1.15, 2.3), coneR: 1.55, coneFloorY: 0.025, shadow: true },
    { x: 4.6, color: 0xD1A13B, intensity: 500, target: new THREE.Vector3(3.5, 1.0, -1.3), coneR: 1.7, coneFloorY: 0.025, sweep: -0.05 },
    { x: 0, color: 0x7a1fa2, intensity: 250, target: new THREE.Vector3(0, 5.35, -5.45), coneR: 2.6, y: 7.6, z: -2.5, lowPriority: true },
  ];

  // broad warm front fill (no visible cone) so instruments read well
  // Front-of-house fill: the key light comes from the truss above, so this is
  // what actually keeps faces readable under a hairline. Broad and soft.
  const fill = new THREE.SpotLight(0xffe8c8, 125, 45, 0.62, 0.9, 1.8);
  fill.position.set(0, 7.5, 14);
  fill.target.position.set(0, 0.8, 0);
  g.add(fill, fill.target);
  registerDimmableLight(fill);

  const spotlightHousingGeometry = new THREE.CylinderGeometry(0.09, 0.13, 0.3, 12);
  const spotlightLensGeometry = new THREE.CircleGeometry(0.1, 16);
  const spotlightYokeGeometry = new THREE.TorusGeometry(0.11, 0.016, 6, 14, Math.PI);
  for (const s of spots) {
    const y = s.y ?? 6.62, z = s.z ?? 1.6;
    // Fixture mount: head, light, target, and beam share one pivot so the two
    // outer spots can sweep as a unit like concert moving heads.
    const mount = new THREE.Group();
    mount.position.set(s.x, y, z);
    g.add(mount);
    mount.updateMatrixWorld(true);

    const head = new THREE.Group();
    const housing = new THREE.Mesh(spotlightHousingGeometry, trussMat);
    head.add(housing);
    const yokeArm = new THREE.Mesh(spotlightYokeGeometry, trussMat);
    yokeArm.position.y = 0.2;
    head.add(yokeArm);
    const lens = new THREE.Mesh(
      spotlightLensGeometry,
      new THREE.MeshBasicMaterial({ color: s.color, fog: false })
    );
    lens.position.y = -0.16;
    lens.rotation.x = Math.PI / 2;
    head.add(lens);
    mount.add(head);
    head.lookAt(s.target);
    head.rotateX(Math.PI / 2);
    spotHeads.push({ head, lensMat: lens.material, base: s.color, mount, sweep: s.sweep || 0 });

    // Keep every visible fixture and beam but omit the two least noticeable
    // real light sources on the low tier. This reduces per-fragment PBR work
    // without making the truss look incomplete.
    if (!isLowEndMobileGameMode() || !s.lowPriority || canUpgradeMobileQuality) {
      // Shadow-casting fixtures get a tighter cone: it reads more like a real
      // followspot and shrinks the shadow frustum to the performers in it.
      const spot = new THREE.SpotLight(s.color, s.intensity, 30, s.shadow ? 0.4 : 0.47, 0.78, 1.6);
      spot.position.set(0, 0, 0);
      spot.target.position.set(s.target.x - s.x, s.target.y - y, s.target.z - z);
      if (s.shadow) {
        spot.castShadow = !isLowEndMobileGameMode();
        const shadowSize = isMobileGameMode() ? 512 : 2048;
        spot.shadow.mapSize.set(shadowSize, shadowSize);
        spot.shadow.bias = -0.0002;
        spot.shadow.normalBias = 0.035;
        spot.shadow.focus = 1;
        spot.shadow.camera.near = 1.5;
        // Tight far plane: the pool is ~7 units below the truss, so anything
        // past this cannot cast into it and would only cost shadow draw calls.
        spot.shadow.camera.far = 9.5;
        spot.shadow.camera.updateProjectionMatrix();
        adaptiveQualityScene.shadowSpots.push(spot);
      }
      if (s.lowPriority) adaptiveQualityScene.lowPrioritySpots.push(spot);
      mount.add(spot, spot.target);
      registerDimmableLight(spot);
    }

    // Visible beam: SpotLight targets steer the light but do not stop it.
    // Extend stage beams along the same ray until they meet the platform top,
    // otherwise the decorative cone appears to hover above the illuminated floor.
    const from = new THREE.Vector3(s.x, y, z);
    const targetVector = new THREE.Vector3().subVectors(s.target, from);
    const coneEnd = s.target.clone();
    let coneEndRadius = s.coneR;
    if (Number.isFinite(s.coneFloorY) && Math.abs(targetVector.y) > 0.0001) {
      const floorScale = (s.coneFloorY - from.y) / targetVector.y;
      if (floorScale > 0) {
        coneEnd.copy(from).addScaledVector(targetVector, floorScale);
        coneEndRadius = 0.09 + (s.coneR - 0.09) * floorScale;
      }
    }
    const len = from.distanceTo(coneEnd);
    const beamMat = visibleBeamMaterial(s.color, Number.isFinite(s.coneFloorY));
    registerDimmableBeam(beamMat);
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, coneEndRadius, len, usesLowMobileSceneBudget() ? 12 : 24, 1, true),
      beamMat,
    );
    cone.position.copy(from).add(coneEnd).multiplyScalar(0.5).sub(from);
    const dir = new THREE.Vector3().subVectors(coneEnd, from).normalize();
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    mount.add(cone);
  }
  return g;
}

// ---- dust particles ----
export function buildDust() {
  const N = usesLowMobileSceneBudget() ? 120 : 320;
  const pos = new Float32Array(N * 3);
  const motion = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 16;
    pos[i * 3 + 1] = Math.random() * 6.5 + 0.2;
    pos[i * 3 + 2] = Math.random() * 10 - 4.5;
    motion[i * 3] = 0.05 + Math.random() * 0.12;
    motion[i * 3 + 1] = Math.random() * Math.PI * 2;
    motion[i * 3 + 2] = 0.2 + Math.random() * 0.5;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aDustMotion', new THREE.BufferAttribute(motion, 3));
  const dustTime = { value: 0 };
  const mat = new THREE.PointsMaterial({
    color: 0xe8c169, size: 0.04, map: softDiscTexture(), transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDustTime = dustTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec3 aDustMotion;
        uniform float uDustTime;`,
      )
      .replace(
        '#include <begin_vertex>',
        `float dustSpeed = aDustMotion.x;
        float dustPhase = aDustMotion.y;
        float dustSway = aDustMotion.z;
        vec3 transformed = vec3(position);
        transformed.x += dustSway * (cos(dustPhase) - cos(uDustTime * 0.35 + dustPhase));
        transformed.y = mod(position.y - 0.1 + dustSpeed * uDustTime, 6.9) + 0.1;
        transformed.z += 0.7857143 * dustSway
          * (sin(uDustTime * 0.28 + dustPhase) - sin(dustPhase));`,
      );
  };
  mat.customProgramCacheKey = () => 'gpu-dust-drift-v1';
  const pts = new THREE.Points(geo, mat);
  pts.userData.time = dustTime;
  return pts;
}

export function applyLowMobileSceneBudget() {
  const reduced = usesLowMobileSceneBudget();
  for (const light of adaptiveQualityScene.bulbLights) light.visible = !reduced;
  for (const light of adaptiveQualityScene.lowPrioritySpots) light.visible = !reduced;
  for (const light of adaptiveQualityScene.shadowSpots) light.castShadow = !isLowEndMobileGameMode();
  for (const dressing of adaptiveQualityScene.lowTierDressing) dressing.visible = !reduced;
  const stars = adaptiveQualityScene.starDrop;
  if (stars) stars.count = reduced ? 70 : 140;
  const dust = adaptiveQualityScene.dust;
  if (dust) dust.geometry.setDrawRange(0, reduced ? 120 : dust.geometry.attributes.position.count);
}
