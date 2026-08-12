// ============================================================
// BACKDROP SLIDESHOW
// Drives the screen shader's crossfade timeline and keeps the invisible
// swipe/tap target pinned over the screen's projected rectangle, so the nav
// tracks the plane however the camera moves.
// ============================================================
import * as THREE from 'three';
import { screenUniforms, slideshowScreen } from './screen.js?v=20260813-02';
import { params, isMobileGameMode } from '../core/quality.js?v=20260813-02';

// ---- slideshow state ----
// Temporary launch setting: keep the branded Art Vibe title on the stage screen
// and do not load or rotate through promotional photos.
export const PHOTO_SLIDES_ENABLED = false;
const ss = { texs: [], i: -1, t: 0, SLIDE: 5.5, FADE: 1.5, started: false };
const slideshowNav = document.getElementById('slideshow-nav');
const screenCorners = [
  new THREE.Vector3(-3.8, -2.1375, 0),
  new THREE.Vector3(3.8, -2.1375, 0),
  new THREE.Vector3(3.8, 2.1375, 0),
  new THREE.Vector3(-3.8, 2.1375, 0),
];
const screenCenterWorld = new THREE.Vector3();
const screenNormalWorld = new THREE.Vector3();
const screenQuaternionWorld = new THREE.Quaternion();
const screenTowardCamera = new THREE.Vector3();
const projectedScreenCorners = screenCorners.map(() => new THREE.Vector3());
const slideshowLayoutCache = {
  initialized: false,
  width: 0,
  height: 0,
  cameraWorld: new THREE.Matrix4(),
  projection: new THREE.Matrix4(),
  screenWorld: new THREE.Matrix4(),
};

function setSlideshowNavStyle(property, value) {
  if (slideshowNav.style[property] !== value) slideshowNav.style[property] = value;
}

export function updateSlideshowNavLayout(camera) {
  if (slideshowNav.hidden || !slideshowScreen) return;
  slideshowScreen.updateWorldMatrix(true, false);
  camera.updateMatrixWorld();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  if (
    slideshowLayoutCache.initialized
    && slideshowLayoutCache.width === viewportWidth
    && slideshowLayoutCache.height === viewportHeight
    && slideshowLayoutCache.cameraWorld.equals(camera.matrixWorld)
    && slideshowLayoutCache.projection.equals(camera.projectionMatrix)
    && slideshowLayoutCache.screenWorld.equals(slideshowScreen.matrixWorld)
  ) return;
  slideshowLayoutCache.initialized = true;
  slideshowLayoutCache.width = viewportWidth;
  slideshowLayoutCache.height = viewportHeight;
  slideshowLayoutCache.cameraWorld.copy(camera.matrixWorld);
  slideshowLayoutCache.projection.copy(camera.projectionMatrix);
  slideshowLayoutCache.screenWorld.copy(slideshowScreen.matrixWorld);

  slideshowScreen.getWorldPosition(screenCenterWorld);
  slideshowScreen.getWorldQuaternion(screenQuaternionWorld);
  screenNormalWorld.set(0, 0, 1).applyQuaternion(screenQuaternionWorld);
  screenTowardCamera.copy(camera.position).sub(screenCenterWorld).normalize();
  const facingCamera = screenNormalWorld.dot(screenTowardCamera);
  if (facingCamera <= 0.02) {
    setSlideshowNavStyle('visibility', 'hidden');
    return;
  }

  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  let inFront = true;
  for (let i = 0; i < screenCorners.length; i++) {
    const point = projectedScreenCorners[i]
      .copy(screenCorners[i])
      .applyMatrix4(slideshowScreen.matrixWorld)
      .project(camera);
    const x = (point.x * 0.5 + 0.5) * viewportWidth;
    const y = (-point.y * 0.5 + 0.5) * viewportHeight;
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
    inFront &&= point.z > -1 && point.z < 1;
  }
  const width = right - left;
  const height = bottom - top;
  const onScreen = right > 0 && left < viewportWidth && bottom > 0 && top < viewportHeight;
  if (!onScreen || !inFront || width < 70 || height < 45) {
    setSlideshowNavStyle('visibility', 'hidden');
    return;
  }

  setSlideshowNavStyle('visibility', 'visible');
  setSlideshowNavStyle('left', `${left}px`);
  setSlideshowNavStyle('top', `${top}px`);
  setSlideshowNavStyle('width', `${width}px`);
  setSlideshowNavStyle('height', `${height}px`);
}

function setSlide(index) {
  if (!ss.started || !ss.texs.length) return;
  const count = ss.texs.length;
  ss.i = ((index % count) + count) % count;
  ss.t = 0;
  screenUniforms.texA.value = ss.texs[ss.i];
  screenUniforms.texB.value = ss.texs[(ss.i + 1) % count];
  screenUniforms.progress.value = 0;
  screenUniforms.slideT.value = 0;
  screenUniforms.pan.value.set(
    (ss.i % 2 ? -1 : 1) * 0.025,
    ((ss.i % 3) - 1) * 0.012
  );
}

function stepSlide(delta) {
  if (!ss.started) return;
  const visibleIndex = screenUniforms.progress.value > 0.5 ? ss.i + 1 : ss.i;
  setSlide(visibleIndex + delta);
}

let slideSwipe = null;
slideshowNav.addEventListener('pointerdown', (event) => {
  slideSwipe = { x: event.clientX, y: event.clientY, id: event.pointerId };
  slideshowNav.setPointerCapture?.(event.pointerId);
});
slideshowNav.addEventListener('pointerup', (event) => {
  if (!slideSwipe || slideSwipe.id !== event.pointerId) return;
  const dx = event.clientX - slideSwipe.x;
  const dy = event.clientY - slideSwipe.y;
  slideSwipe = null;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.25) stepSlide(dx < 0 ? 1 : -1);
});
slideshowNav.addEventListener('pointercancel', () => { slideSwipe = null; });

function loadSlideImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load slide: ${file}`));
    image.src = file;
  });
}

async function makeSlideTexture(file, maxAnisotropy) {
  const image = await loadSlideImage(file);
  const maxDimension = isMobileGameMode() ? 1024 : 1600;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvasImage = document.createElement('canvas');
  canvasImage.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvasImage.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvasImage.getContext('2d', { alpha: false });
  context.drawImage(image, 0, 0, canvasImage.width, canvasImage.height);

  const texture = new THREE.CanvasTexture(canvasImage);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = isMobileGameMode()
    ? 1
    : Math.min(4, maxAnisotropy);
  texture.userData.sourceFile = file;
  return texture;
}

function waitForSlideLoadBudget() {
  return new Promise((resolve) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => resolve(), { timeout: 800 });
    } else {
      window.setTimeout(resolve, 80);
    }
  });
}

export async function loadSlideTextures(maxAnisotropy) {
  const fallbackFiles = ['/img/wicked-ensemble.jpg', '/img/wicked-cast.jpg', '/img/wicked-duet.jpg', '/img/stage-guitar.jpg'];

  // `slides.json` is the complete manifest of images in /img that belong in the slideshow.
  // Keeping it separate lets the stage load every supplied slide without bundling a stale list in the app.
  // Paths here and in the manifest are site-absolute — the stage is served from /stage/.
  const files = await fetch('/img/slides.json')
    .then((response) => response.ok ? response.json() : fallbackFiles)
    .then((files) => Array.isArray(files) && files.length ? files : fallbackFiles)
    .catch(() => fallbackFiles);

  let loaded = 0;
  const debugTimelineTextures = [];
  const deferDebugTimeline = params.has('sstime');
  for (const file of files) {
    if (loaded > 0) await waitForSlideLoadBudget();
    try {
      const texture = await makeSlideTexture(file, maxAnisotropy);
      if (deferDebugTimeline) debugTimelineTextures.push(texture);
      else if (!ss.started) startSlideshow([texture]);
      else ss.texs.push(texture);
      loaded++;
      window.__dbg = `slideshow loaded: ${loaded}/${files.length}`;
    } catch (_) {
      /* A missing promotional image should not block the scene. */
    }
  }
  if (deferDebugTimeline && debugTimelineTextures.length) {
    startSlideshow(debugTimelineTextures);
  }
  return loaded;
}

function startSlideshow(photos) {
  ss.texs = [screenUniforms.texA.value, ...photos]; // title slide stays in rotation
  ss.i = 0; // texs[0] (title) is currently shown
  ss.t = 0; // hold frame 0 (the Art Vibe title) for a complete slide interval
  screenUniforms.progress.value = 0;
  screenUniforms.texB.value = ss.texs[1] || ss.texs[0];
  ss.started = true;
  slideshowNav.hidden = false;
  window.__dbg = `slideshow started: ${ss.texs.length} slides`;

  // debug: fast-forward slideshow timeline (?sstime=SECONDS)
  const ff = Number(params.get('sstime') || 0);
  if (ff > 0) {
    const cycle = ss.SLIDE + ss.FADE;
    const wraps = Math.floor(ff / cycle);
    ss.i = wraps % ss.texs.length;
    screenUniforms.texA.value = ss.texs[ss.i];
    screenUniforms.texB.value = ss.texs[(ss.i + 1) % ss.texs.length];
    ss.t = ff % cycle;
  }
}

export function updateSlideshow(dt) {
  if (!ss.started || ss.texs.length < 2) return;
  ss.t += dt;
  const cycle = ss.SLIDE + ss.FADE;
  if (ss.t >= cycle) {
    ss.t -= cycle;
    ss.i = (ss.i + 1) % ss.texs.length;
    screenUniforms.texA.value = ss.texs[ss.i];
    screenUniforms.texB.value = ss.texs[(ss.i + 1) % ss.texs.length];
    screenUniforms.pan.value.set(
      (ss.i % 2 ? -1 : 1) * 0.025,
      ((ss.i % 3) - 1) * 0.012
    );
  }
  screenUniforms.progress.value = THREE.MathUtils.clamp((ss.t - ss.SLIDE) / ss.FADE, 0, 1);
  screenUniforms.slideT.value = Math.min(1, ss.t / cycle);
}

/** Resize/framing changed, so the cached projection of the screen is stale. */
export function invalidateSlideshowNavLayout() {
  slideshowLayoutCache.initialized = false;
}

/** Photos actually loaded, excluding the always-present title slide (QA hook). */
export function loadedSlideCount() {
  return Math.max(0, ss.texs.length - 1);
}
