// ============================================================
// POST-PROCESSING + ADAPTIVE RENDER PROBE
// Bloom is earned, not assumed. Every device starts on the cheap path and runs
// a two-stage frame-time probe; only a device that sustains the medium stage
// gets the composer switched on, and only one that then sustains the full
// stage keeps it. Coarse CPU/RAM hints are never used as a proxy for GPU power.
// ============================================================
import * as THREE from 'three';
import {
  params,
  isAppleMobile,
  deviceMemory,
  hardwareConcurrency,
  isMobileGameMode,
  autoQualityProbe,
  stageLightLevel,
  adaptiveQualityScene,
  mobileQualityProbe,
  isMobileQualityProbe,
  isLowEndMobileGameMode,
  canUpgradeMobileQuality,
  setLowMobileQuality,
  qualityTierLabel,
  loadPostprocessingModules,
} from '../core/quality.js?v=20260806-18';
import { renderer, scene, camera } from '../view/rig.js?v=20260806-18';
import { applyLowMobileSceneBudget } from '../scene/lighting.js?v=20260806-18';
import { loadedSlideCount } from '../scene/slideshow.js?v=20260806-18';

// Settling the tier resizes the renderer, which only main.js can sequence.
let hooks = { syncRendererToWindow: () => {} };
export function initPostfx(next) {
  hooks = { ...hooks, ...next };
}

export let composer = null;
export let bloomPass = null;
let postprocessingInit = null;

export async function initPostprocessing() {
  if (isLowEndMobileGameMode() || composer) return;
  if (postprocessingInit) return postprocessingInit;
  postprocessingInit = (async () => {
  let modules = null;
  try {
    modules = await loadPostprocessingModules();
  } catch (_) {
    return;
  }
  try {
    const [
      { EffectComposer },
      { RenderPass },
      { UnrealBloomPass },
      { OutputPass },
      { ShaderPass },
    ] = modules;
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // Bloom sells the authored emissives (footlights, star drop, lenses) only.
    // Threshold keeps lit cream/white surfaces out of the glow.
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      isMobileGameMode() ? 0.2 : 0.32,
      0.35,
      0.88,
    );
    // Bloom only processes fullscreen color. Depth/stencil attachments on its
    // eleven internal targets consume memory without affecting the result.
    const bloomTargets = [
      bloomPass.renderTargetBright,
      ...bloomPass.renderTargetsHorizontal,
      ...bloomPass.renderTargetsVertical,
    ];
    for (const target of bloomTargets) {
      target.depthBuffer = false;
      target.stencilBuffer = false;
    }
    composer.addPass(bloomPass);
    // Subtle theatre vignette (desktop only — mobile composers stay bloom-only
    // because every full-screen pass scales with DPR²).
    if (!isMobileGameMode()) {
      const vignettePass = new ShaderPass({
        uniforms: {
          tDiffuse: { value: null },
          uStrength: { value: 0.5 },
          uSize: { value: 0.78 },
        },
        vertexShader: /* glsl */`
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */`
          uniform sampler2D tDiffuse;
          uniform float uStrength, uSize;
          varying vec2 vUv;
          void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            float d = distance(vUv, vec2(0.5));
            c.rgb *= mix(1.0, smoothstep(uSize, uSize - 0.45, d), uStrength);
            gl_FragColor = c;
          }`,
      });
      composer.addPass(vignettePass);
    }
    composer.addPass(new OutputPass());
    document.documentElement.dataset.postprocessing = 'on';
  } catch (_) {
    composer?.dispose();
    composer = null;
    bloomPass = null;
  }
  })();
  try {
    await postprocessingInit;
  } finally {
    postprocessingInit = null;
  }
}

export function disablePostprocessing() {
  composer?.dispose();
  composer = null;
  bloomPass = null;
  document.documentElement.dataset.postprocessing = 'off';
}

export function syncQualityDomState() {
  document.documentElement.dataset.qualityTier = qualityTierLabel();
  document.documentElement.dataset.frameRateCap = isMobileQualityProbe()
    ? 'probe'
    : (isLowEndMobileGameMode() ? '30' : 'native');
  document.documentElement.classList.toggle('low-mobile', isLowEndMobileGameMode());
  document.documentElement.dataset.shadows = renderer.shadowMap.enabled ? 'on' : 'off';
}

function beginMobileProbeWindow(phase, frameTime) {
  mobileQualityProbe.phase = phase;
  mobileQualityProbe.startedAt = frameTime;
  mobileQualityProbe.lastFrameAt = frameTime;
  mobileQualityProbe.samples.length = 0;
}

function settleMobileQuality(low, p90) {
  mobileQualityProbe.active = false;
  mobileQualityProbe.phase = low ? 'low' : 'full';
  mobileQualityProbe.p90 = p90;
  setLowMobileQuality(low);
  if (low) disablePostprocessing();
  applyLowMobileSceneBudget();
  hooks.syncRendererToWindow();
  syncQualityDomState();
}

function promoteMobileQuality(frameTime) {
  setLowMobileQuality(false);
  applyLowMobileSceneBudget();
  hooks.syncRendererToWindow();
  syncQualityDomState();
  mobileQualityProbe.phase = 'promoting';
  void initPostprocessing().finally(() => {
    if (!mobileQualityProbe.active || mobileQualityProbe.phase !== 'promoting') return;
    beginMobileProbeWindow('full', performance.now());
  });
}

export function updateMobileQualityProbe(frameTime) {
  if (!isMobileQualityProbe() || mobileQualityProbe.phase === 'promoting') return;
  if (!mobileQualityProbe.startedAt) {
    beginMobileProbeWindow(mobileQualityProbe.phase, frameTime);
    return;
  }
  const elapsed = frameTime - mobileQualityProbe.startedAt;
  const delta = frameTime - mobileQualityProbe.lastFrameAt;
  mobileQualityProbe.lastFrameAt = frameTime;
  // Ignore shader/texture warm-up, then take one second of actual frame pacing.
  if (elapsed > 350 && delta > 0 && delta < 100) mobileQualityProbe.samples.push(delta);
  if (elapsed < 1350 || !mobileQualityProbe.samples.length) return;
  const sorted = [...mobileQualityProbe.samples].sort((a, b) => a - b);
  const p90 = sorted[Math.floor((sorted.length - 1) * 0.9)];
  if (mobileQualityProbe.phase === 'medium') {
    if (p90 <= 19) promoteMobileQuality(frameTime);
    else settleMobileQuality(true, p90);
    return;
  }
  // Full effects need to remain close to display cadence. Otherwise the app
  // immediately returns to the stable 30 FPS low budget.
  settleMobileQuality(p90 > 22, p90);
}
window.__qualityDebug = () => {
  const lightCounts = { point: 0, spot: 0, shadowCasting: 0 };
  scene.traverse((object) => {
    if (object.isPointLight) lightCounts.point++;
    if (object.isSpotLight) lightCounts.spot++;
    if (object.isLight && object.castShadow) lightCounts.shadowCasting++;
  });
  return {
    mobile: isMobileGameMode(),
    appleMobile: isAppleMobile,
    autoProbe: autoQualityProbe,
    tier: qualityTierLabel(),
    deviceMemory,
    hardwareConcurrency,
    pixelRatio: renderer.getPixelRatio(),
    postprocessing: Boolean(composer),
    bloom: Boolean(bloomPass),
    shadows: renderer.shadowMap.enabled,
    frameRateCap: isMobileQualityProbe() ? 'probe' : (isLowEndMobileGameMode() ? 30 : null),
    mobileProbe: { phase: mobileQualityProbe.phase, p90: mobileQualityProbe.p90 },
    lightLevel: stageLightLevel,
    lightCounts,
    slidesLoaded: loadedSlideCount(),
  };
};

