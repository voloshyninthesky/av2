// ============================================================
// QUALITY TIER / STAGE LIGHTING PREFERENCES
// Owns the device-capability picture (auto/high/low tier, pixel-ratio caps,
// media queries) plus the "світло" slider, and hands the rest of the app the
// registries a scene object registers itself into so a tier or light-level
// change can reach every light, emissive and beam material at once.
// ============================================================
export const params = new URLSearchParams(location.search);
const QUALITY_PREFERENCE_KEY = 'av2.quality.v2';
const LIGHT_LEVEL_KEY = 'av2.lights.v2';
const LIGHT_LEVEL_MIN = 0;
const LIGHT_LEVEL_MAX = 100;
const LIGHT_LEVEL_DEFAULT = 78;
const LOW_QUALITY_LIGHT_LEVEL_DEFAULT = 100;
// GLAMOUR carries bloom, so the stage arrives dimmer: at 78 the guitar close-up
// blooms into glare. PIXEL has no bloom to catch and opens the lights all the way.
const HIGH_QUALITY_LIGHT_LEVEL_DEFAULT = 67;
function readStoredLightLevel() {
  try {
    const raw = localStorage.getItem(LIGHT_LEVEL_KEY);
    if (raw == null || raw === '') return null;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return Math.min(LIGHT_LEVEL_MAX, Math.max(LIGHT_LEVEL_MIN, Math.round(parsed)));
    }
  } catch (_) { /* storage is optional */ }
  return null;
}
const QUALITY_OPTIONS = new Set(['auto', 'high', 'low']);
let savedQuality = null;
try { savedQuality = localStorage.getItem(QUALITY_PREFERENCE_KEY); } catch (_) { /* storage is optional */ }
const queryQuality = params.get('quality');
export const forcedQuality = QUALITY_OPTIONS.has(queryQuality)
  ? queryQuality
  : (QUALITY_OPTIONS.has(savedQuality) ? savedQuality : 'auto');
const storedLightLevel = readStoredLightLevel();
export let stageLightLevel = storedLightLevel ?? ({
  low: LOW_QUALITY_LIGHT_LEVEL_DEFAULT,
  high: HIGH_QUALITY_LIGHT_LEVEL_DEFAULT,
}[forcedQuality] ?? LIGHT_LEVEL_DEFAULT);
const qualityOptions = document.querySelector('.quality-options');
const qualityButtons = [...document.querySelectorAll('[data-quality]')];
const qualityConfirm = document.getElementById('quality-confirm');
const qualityConfirmPanel = qualityConfirm?.querySelector('.quality-confirm-panel');
const qualityConfirmLoader = document.getElementById('quality-confirm-loader');
const qualityConfirmCancel = document.getElementById('quality-confirm-cancel');
const qualityConfirmApply = document.getElementById('quality-confirm-apply');
const lightLevelInput = document.getElementById('stage-light-level');
const lightLevelValue = document.getElementById('stage-light-level-val');
let qualityChangePending = false;
let pendingQuality = null;

function syncLightLevelUi() {
  if (lightLevelInput) {
    if (Number(lightLevelInput.value) !== stageLightLevel) {
      lightLevelInput.value = String(stageLightLevel);
    }
    lightLevelInput.setAttribute('aria-valuetext', `${stageLightLevel} відсотків`);
  }
  if (lightLevelValue) lightLevelValue.textContent = `${stageLightLevel}%`;
}

function syncQualityPreferenceUi() {
  for (const button of qualityButtons) {
    const selected = button.dataset.quality === forcedQuality;
    button.classList.toggle('is-on', selected);
    button.setAttribute('aria-checked', selected ? 'true' : 'false');
  }
  syncLightLevelUi();
}

function resetQualityPendingUi() {
  qualityChangePending = false;
  qualityOptions?.classList.remove('is-loading');
  for (const button of qualityButtons) {
    button.disabled = false;
    button.classList.remove('is-loading');
    button.removeAttribute('aria-busy');
  }
  syncQualityPreferenceUi();
}

function closeQualityConfirm() {
  pendingQuality = null;
  qualityConfirmPanel?.classList.remove('is-loading');
  if (qualityConfirmLoader) qualityConfirmLoader.hidden = true;
  if (qualityConfirmCancel) qualityConfirmCancel.disabled = false;
  if (qualityConfirmApply) qualityConfirmApply.disabled = false;
  if (qualityConfirm) qualityConfirm.hidden = true;
}

function showQualityConfirm(nextQuality) {
  if (qualityChangePending || !QUALITY_OPTIONS.has(nextQuality) || nextQuality === forcedQuality) return;
  pendingQuality = nextQuality;
  if (qualityConfirm) {
    qualityConfirm.hidden = false;
    qualityConfirmApply?.focus();
  }
}

function setQualityPreference(nextQuality, button) {
  if (qualityChangePending || !QUALITY_OPTIONS.has(nextQuality) || nextQuality === forcedQuality) return;
  qualityChangePending = true;
  qualityConfirmPanel?.classList.add('is-loading');
  if (qualityConfirmLoader) qualityConfirmLoader.hidden = false;
  if (qualityConfirmCancel) qualityConfirmCancel.disabled = true;
  if (qualityConfirmApply) qualityConfirmApply.disabled = true;
  qualityOptions?.classList.add('is-loading');
  for (const option of qualityButtons) option.disabled = true;
  button?.classList.add('is-loading');
  button?.setAttribute('aria-busy', 'true');
  try { localStorage.setItem(QUALITY_PREFERENCE_KEY, nextQuality); } catch (_) { /* storage is optional */ }
  const nextUrl = new URL(location.href);
  nextUrl.searchParams.set('quality', nextQuality);
  requestAnimationFrame(() => {
    window.setTimeout(() => location.assign(nextUrl.href), 350);
  });
}

for (const button of qualityButtons) {
  button.addEventListener('click', () => showQualityConfirm(button.dataset.quality));
}
qualityConfirmCancel?.addEventListener('click', closeQualityConfirm);
qualityConfirmApply?.addEventListener('click', () => {
  const option = qualityButtons.find((button) => button.dataset.quality === pendingQuality);
  if (pendingQuality) setQualityPreference(pendingQuality, option);
});
qualityConfirm?.addEventListener('click', (event) => {
  if (event.target === qualityConfirm) closeQualityConfirm();
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !qualityConfirm?.hidden) closeQualityConfirm();
});
if (lightLevelInput) {
  lightLevelInput.min = String(LIGHT_LEVEL_MIN);
  lightLevelInput.max = String(LIGHT_LEVEL_MAX);
  lightLevelInput.value = String(stageLightLevel);
  const onLightLevelInput = () => setStageLightLevel(lightLevelInput.value);
  lightLevelInput.addEventListener('input', onLightLevelInput);
  lightLevelInput.addEventListener('change', onLightLevelInput);
}
window.addEventListener('pageshow', (event) => {
  if (event.persisted && qualityChangePending) resetQualityPendingUi();
});
syncQualityPreferenceUi();
const coarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)');
// iPadOS may present itself as macOS, so use touch capability as a fallback.
export const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent || '')
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const deviceMemory = Number(navigator.deviceMemory) || null;
export const hardwareConcurrency = Number(navigator.hardwareConcurrency) || null;
export const isMobileGameMode = () => window.innerWidth <= 720 || coarsePointer.matches;
const hasForcedQuality = forcedQuality === 'low' || forcedQuality === 'high';
// AUTO begins without expensive effects on every device, then earns full quality
// by sustaining a representative two-stage render probe. Never treat coarse
// CPU/RAM browser hints as a proxy for GPU power.
export const autoQualityProbe = !hasForcedQuality;
let lowMobileQuality = forcedQuality === 'low' || autoQualityProbe;
export const mobileQualityProbe = {
  active: autoQualityProbe,
  phase: autoQualityProbe ? 'medium' : 'complete',
  startedAt: 0,
  lastFrameAt: 0,
  samples: [],
  p90: null,
};
export const canUpgradeMobileQuality = autoQualityProbe;
export const isLowEndMobileGameMode = () => lowMobileQuality;
export const isMobileQualityProbe = () => mobileQualityProbe.active;
export const usesLowMobileSceneBudget = () => isLowEndMobileGameMode() && !isMobileQualityProbe();
export const MOBILE_MAX_PIXEL_RATIO = 1.5;
export const LOW_END_MOBILE_MAX_PIXEL_RATIO = 1;
export const DESKTOP_MAX_PIXEL_RATIO = 2;
export const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
export const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
export const stageAmbience = { curtains: [], valance: null };
export const adaptiveQualityScene = {
  bulbLights: [],
  lowPrioritySpots: [],
  shadowSpots: [],
  dimmableLights: [],
  dimmableEmissives: [],
  dimmableBeams: [],
  // Decorative dressing hidden on the low mobile tier (cables, upstage truss
  // heads, star-drop overdraw) — visible fidelity trimmed before frame rate.
  lowTierDressing: [],
  starDrop: null,
  dust: null,
};
export function registerDimmableLight(light) {
  adaptiveQualityScene.dimmableLights.push({ light, base: light.intensity });
}
export function registerDimmableEmissive(material) {
  adaptiveQualityScene.dimmableEmissives.push({
    material,
    base: material.emissiveIntensity ?? 1,
  });
}
export function registerDimmableBeam(material) {
  adaptiveQualityScene.dimmableBeams.push({
    material,
    base: material.opacity,
  });
}
export function applyStageLightLevel(level = stageLightLevel) {
  const next = Math.min(LIGHT_LEVEL_MAX, Math.max(LIGHT_LEVEL_MIN, Math.round(Number(level) || 0)));
  stageLightLevel = next;
  const scale = next / 100;
  for (const entry of adaptiveQualityScene.dimmableLights) {
    entry.light.intensity = entry.base * scale;
  }
  for (const entry of adaptiveQualityScene.dimmableEmissives) {
    entry.material.emissiveIntensity = entry.base * scale;
  }
  for (const entry of adaptiveQualityScene.dimmableBeams) {
    entry.material.opacity = entry.base * scale;
  }
}
function setStageLightLevel(level, { persist = true } = {}) {
  applyStageLightLevel(level);
  if (persist) {
    try { localStorage.setItem(LIGHT_LEVEL_KEY, String(stageLightLevel)); } catch (_) { /* storage is optional */ }
  }
  syncLightLevelUi();
}
export const qualityTierLabel = () => isMobileQualityProbe()
  ? 'mobile-probe'
  : (isLowEndMobileGameMode() ? 'low-mobile' : 'full');
document.documentElement.dataset.qualityTier = qualityTierLabel();
document.documentElement.dataset.postprocessing = 'off';
document.documentElement.dataset.frameRateCap = isMobileQualityProbe()
  ? 'probe'
  : (isLowEndMobileGameMode() ? '30' : 'native');
document.documentElement.classList.toggle('low-mobile', isLowEndMobileGameMode());
let postprocessingModules = null;
export function loadPostprocessingModules() {
  if (!postprocessingModules) {
    postprocessingModules = Promise.all([
    import('three/addons/postprocessing/EffectComposer.js'),
    import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/UnrealBloomPass.js'),
    import('three/addons/postprocessing/OutputPass.js'),
    import('three/addons/postprocessing/ShaderPass.js'),
    ]);
  }
  return postprocessingModules;
}

// The adaptive render probe (js/shell/postfx.js) settles the tier once it has
// enough frame samples; it owns the decision, this module owns the state.
export function setLowMobileQuality(next) {
  lowMobileQuality = !!next;
}
