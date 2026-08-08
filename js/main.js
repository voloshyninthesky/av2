// ============================================================
// ART VIBE STUDIO — interactive 3D stage
// Boot order, cross-module wiring, and the frame loop. Everything else lives
// in js/core (env + studio assembly), js/view (rig, framing, input),
// js/scene (geometry, light, effects), js/instruments, js/mascot, js/play and
// js/shell. Modules import downstream; the back-references they need are
// injected here through their init* functions so the graph stays a tree.
// ============================================================
import * as THREE from 'three';
import './core/errlog.js?v=20260808-07';
import './core/telegram.js?v=20260808-07';
import { session, easeInOut } from './core/session.js?v=20260808-07';
import { mascotMove, dance } from './mascot/state.js?v=20260808-07';
import { play } from './play/state.js?v=20260808-07';
import { raycaster, pointer, stageWalkPlane } from './view/pick.js?v=20260808-07';
import './shell/qa-hooks.js?v=20260808-07';
import {
  chipFor,
  queuePriceChip,
  flushPendingPriceChip,
  clearKeyboardJamChipTimer,
  noteInstrumentFocused,
  initVibe,
} from './play/vibe.js?v=20260808-07';
import {
  updateLoopProgress,
  initLoopPedal,
} from './play/loop.js?v=20260808-07';
import {
  currentGuitarChordName,
  allGuitarPitches,
  initGuitarPlay,
} from './play/guitar.js?v=20260808-07';
import {
  showVocalPad,
  hideVocalPad,
  showChordPad,
  hideChordPad,
  clearGuitarInteractionState,
  markHeldTouchGuitarChordUsed,
  captureHeldVocalIntoLoop,
  finishHeldLoopCapture,
  initPads,
} from './play/pads.js?v=20260808-07';
import {
  releaseAllHeldPianoNotes,
  finishHeldPianoLoopCaptures,
  captureHeldPianoIntoLoop,
  finalizeHeldPianoLoopCapture,
  initPianoNotes,
} from './play/piano-notes.js?v=20260808-07';
import {
  composer,
  initPostprocessing,
  updateMobileQualityProbe,
  qualityWarmup,
  initPostfx,
} from './shell/postfx.js?v=20260808-07';
import {
  FLY_DUR,
  shouldSkipIntro,
  startOnboard,
  updateOnboardPulse,
  startExperience,
  startWithoutIntro,
  captureAudioRecoverySnapshot,
  restoreAfterAudioContextRebuild,
  activateAudioForSound,
  initIntro,
} from './shell/intro.js?v=20260808-07';
import {
  closeSoundMixer,
  releaseKeyboardVocal,
  beginKeyboardVocal,
  initMixer,
} from './play/mixer.js?v=20260808-07';
import { mascotEditor, queueMascotRefit, mascotCam, initMascotEditor } from './mascot/editor.js?v=20260808-07';
import {
  params,
  isLowEndMobileGameMode,
  isMobileQualityProbe,
  canHover,
  prefersReducedMotion,
  stageAmbience,
  stageLightLevel,
} from './core/quality.js?v=20260808-07';
import {
  canvas,
  renderer,
  scene,
  camera,
  controls,
  CAM_START,
  CAM_END,
  TARGET,
} from './view/rig.js?v=20260808-07';
import {
  ui,
  audio,
  stage,
  dust,
  fireworks,
  drums,
  piano,
  guitar,
  mic,
  noteBursts,
  mascot,
  mascotLabel,
  addLabels,
  instruments,
  interactables,
} from './core/studio.js?v=20260808-07';
import { spotHeads, applyLowMobileSceneBudget } from './scene/lighting.js?v=20260808-07';
import {
  instrumentView,
} from './view/instrument-presets.js?v=20260808-07';
import {
  updateInstrumentViewCamera,
  initInstrumentView,
} from './view/instrument-view.js?v=20260808-07';
import {
  setDancing,
} from './mascot/pose.js?v=20260808-07';
import {
  PHOTO_SLIDES_ENABLED,
  loadSlideTextures,
  updateSlideshow,
  updateSlideshowNavLayout,
} from './scene/slideshow.js?v=20260808-07';
import { hitPulse, bumpHitPulse } from './scene/effects.js?v=20260808-07';
import {
  setGlow,
  isInstrumentCloseUp,
  onPointerMove,
  hitInteractableDetailsAt,
  isGuitarPlayFocus,
  canPlayInstrument,
  canKeyboardJamPlay,
  syncOrbitZoom,
} from './view/pointer.js?v=20260808-07';
import {
  syncViewportMeta,
  resetBrowserPageZoom,
  syncRendererToWindow,
  eventInvolvesUiChrome,
  isLiveStageZoomLocked,
  initViewport,
} from './view/viewport.js?v=20260808-07';
import {
  syncMobileInstrumentChrome,
  releaseMoveJoystick,
  resetMobileFollowCamera,
  updateMobileFollowCamera,
  clampMascotPoint,
  setMascotDestination,
  respawnMascot,
  walkMascotToInstrument,
  playNearestInstrument,
  updateMobilePlayAvailability,
  initMobileControls,
} from './view/mobile-controls.js?v=20260808-07';
import { updateMascot, updateMascotEditorPreview } from './mascot/update.js?v=20260808-07';
import { initSigns, revealSigns } from './shell/signs.js?v=20260808-07';
import { updateSigns } from './scene/signs.js?v=20260808-07';


// ============================================================
// COORDINATION
// Cross-module wiring that no single feature owns: the phase change that
// ripples through pads, held notes and exposure, and the hooks each module
// needs back into the ones downstream of it.
// ============================================================
/** Mesh currently under a hovering desktop pointer, or null. */
let hovered = null;
/** Whether that mesh is currently lit, which a close-up suppresses. */
let hoverGlowing = false;

const danceBtn = document.getElementById('logo-btn'); // HUD logo doubles as the dance toggle

function setSceneLabelsVisible(visible) {
  if (mascotLabel && !mascotMove.fall) mascotLabel.visible = visible;
}

function syncInstrumentExposure() {
  const portrait = window.innerWidth / window.innerHeight < 1;
  const baseExposure = portrait ? 0.98 : 1.12;
  const performancePhase = instrumentView.phase === 'entering' || instrumentView.phase === 'focused';
  if (performancePhase && instrumentView.kind === 'piano') {
    renderer.toneMappingExposure = baseExposure * 0.48;
  } else if (performancePhase && instrumentView.kind === 'guitar') {
    renderer.toneMappingExposure = baseExposure * 0.78;
  } else {
    renderer.toneMappingExposure = baseExposure;
  }
}

// Close-ups interrupt pads, held notes and joystick gestures; hand the focus
// module those teardowns so it does not have to reach back into play code.
initInstrumentView({
  setInstrumentViewPhase,
  releaseAllHeldPianoNotes,
  clearGuitarInteractionState,
  releaseMoveJoystick,
  resetMobileFollowCamera,
  flushPendingPriceChip,
});

initPostfx({ syncRendererToWindow });
initViewport({
  syncInstrumentExposure,
  resizeComposer: () => {
    if (!composer) return;
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(window.innerWidth, window.innerHeight);
  },
});
initMobileControls({ playNearestInstrument });
initIntro({
  syncViewportMeta,
  syncRendererToWindow,
  resetBrowserPageZoom,
  hoveredMesh: () => hovered,
});
initMascotEditor({ respawnMascot, closeSoundMixer, syncInstrumentExposure });
initSigns();
// Filling the meter opens the loop pedal and signing together. vibe.js sits
// below shell/, so the reveal is handed down rather than imported upward.
initVibe({ onFirstFill: revealSigns });

// The play modules form one instrument: recording closes held notes, held
// notes need the audio route live, and every route asks the stage whether it
// is allowed to sound right now. Those back-references are wired here rather
// than imported, so js/play/* stays a one-way dependency chain.
initLoopPedal({
  activateAudioForSound,
  allGuitarPitches,
  showVocalPad,
  hideVocalPad,
  captureHeldVocalIntoLoop,
  finishHeldLoopCapture,
  captureHeldPianoIntoLoop,
  finishHeldPianoLoopCaptures,
  finalizeHeldPianoLoopCapture,
});
initGuitarPlay({ isGuitarPlayFocus, markHeldTouchGuitarChordUsed });
initPads({
  activateAudioForSound,
  isGuitarPlayFocus,
  isLiveStageZoomLocked,
  eventInvolvesUiChrome,
  releaseKeyboardVocal,
  currentGuitarChordName,
});
initPianoNotes({
  activateAudioForSound,
  canPlayInstrument,
  canKeyboardJamPlay,
  hitInteractableDetailsAt,
  onPointerMove,
  playNearestInstrument,
  walkMascotToInstrument,
  setMascotDestination,
  beginKeyboardVocal,
  releaseKeyboardVocal,
});
initMixer({
  activateAudioForSound,
  canKeyboardJamPlay,
  captureAudioRecoverySnapshot,
  restoreAfterAudioContextRebuild,
});

function setInstrumentViewPhase(phase, kind = instrumentView.kind) {
  const previousPhase = instrumentView.phase;
  instrumentView.phase = phase;
  instrumentView.kind = phase === 'idle' ? null : kind;
  document.documentElement.dataset.instrumentView = phase;
  if (instrumentView.kind) document.documentElement.dataset.instrument = instrumentView.kind;
  else delete document.documentElement.dataset.instrument;
  setSceneLabelsVisible(!['entering', 'focused'].includes(phase));
  syncMobileInstrumentChrome();
  syncInstrumentExposure();
  // Reaching a close-up is interest enough on its own: queue the chip here so
  // it still lands on the way out of a focus the visitor never played. The
  // count feeds vibe.js's own gate — nothing queues before the second focus.
  if (phase === 'focused' && kind) {
    clearKeyboardJamChipTimer(kind);
    noteInstrumentFocused();
    queuePriceChip(kind);
  }
  if (phase === 'focused' && kind === 'mic') {
    hideChordPad();
    showVocalPad(false);
    document.documentElement.classList.remove('guitar-focused', 'guitar-fretting');
  } else if (phase === 'focused' && kind === 'guitar') {
    hideVocalPad();
    showChordPad();
    document.documentElement.classList.add('guitar-focused');
  } else if (previousPhase === 'focused' && phase !== 'focused') {
    // Leaving focus: clear performance holds. Keep keyboard jam alive while
    // merely approaching / entering from idle so multi-instrument play continues.
    hideVocalPad();
    hideChordPad();
    releaseAllHeldPianoNotes();
    releaseKeyboardVocal();
    document.documentElement.classList.remove('guitar-focused', 'guitar-fretting');
    clearGuitarInteractionState();
    audio.muteGuitar();
  } else if (phase !== 'focused') {
    hideVocalPad();
    hideChordPad();
    document.documentElement.classList.remove('guitar-focused', 'guitar-fretting');
  }
  // Pinch-zoom is allowed in every phase now; only a finger resting on a play
  // surface suspends it, so strums / held keys are never read as a pinch.
  syncOrbitZoom();
}

// ---- dance (HUD logo click) — toggle mascot tektonik routine ----
danceBtn?.addEventListener('click', (event) => {
  event.stopPropagation();
  setDancing(!dance.active);
});

// debug hook (headless testing)
window.__mascotDebug = () => ({
  y: mascot.group.position.y,
  armLz: mascot.armL.rotation.z,
  armRz: mascot.armR.rotation.z,
  dancing: dance.active,
});

// ============================================================
// RESIZE
// ============================================================
window.addEventListener('resize', syncRendererToWindow);

// ============================================================
// MAIN LOOP
// ============================================================
const clock = new THREE.Clock();
let firstFrame = true;
let lastRenderedFrameAt = -Infinity;

function renderIntervalMs() {
  if (isMobileQualityProbe()) return 0;
  if (!session.started) return 1000 / 10;
  if (ui.modalOpen) return 1000 / 15;
  if (isLowEndMobileGameMode()) return 1000 / 30;
  return 0;
}

function animate(frameTime = performance.now()) {
  requestAnimationFrame(animate);
  if (document.hidden) return;
  // A tier switch is linking its rebuilt shader programs on the driver's
  // background threads. Rendering now would block on a half-linked program —
  // the stall the warm-up exists to remove — so hold until postfx clears it.
  if (qualityWarmup) return;
  const interval = renderIntervalMs();
  if (interval && frameTime - lastRenderedFrameAt < interval - 0.5) return;
  lastRenderedFrameAt = frameTime;
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // renderer.info accumulates across every composer pass in this frame;
  // autoReset would keep only the final output quad's numbers.
  renderer.info.reset();

  // camera fly-in
  if (session.flyT >= 0) {
    session.flyT += dt;
    const k = Math.min(1, session.flyT / FLY_DUR);
    const e = easeInOut(k);
    camera.position.lerpVectors(CAM_START, CAM_END, e);
    camera.lookAt(TARGET);
    if (k >= 1) {
      session.flyT = -1;
      controls.enabled = true;
      ui.showHUD();
      startOnboard();
    }
  } else if (mascotCam.active) {
    // ОБРАЗ modal camera framing (tween toward / away from the mascot).
    mascotCam.t += dt;
    const k = Math.min(1, mascotCam.t / (prefersReducedMotion.matches ? 0.01 : 0.6));
    const e = easeInOut(k);
    camera.position.lerpVectors(mascotCam.fromPos, mascotCam.toPos, e);
    controls.target.lerpVectors(mascotCam.fromTgt, mascotCam.toTgt, e);
    camera.lookAt(controls.target);
    if (k >= 1) {
      mascotCam.active = false;
      if (mascotCam.returning) controls.enabled = true;
    }
  } else if (!updateInstrumentViewCamera(dt) && controls.enabled) {
    controls.update();
  }

  // instruments
  for (const inst of instruments) inst.update(dt, t, prefersReducedMotion.matches);
  updateMascot(dt);
  updateMobilePlayAvailability();
  updateOnboardPulse(t);

  // stage atmosphere (materials/motion only — lights unchanged)
  if (!prefersReducedMotion.matches) {
    for (const curtain of stageAmbience.curtains) {
      curtain.rotation.y = curtain.userData.baseRotY + Math.sin(t * 0.55 + curtain.userData.side) * 0.035;
    }
    if (stageAmbience.valance) {
      stageAmbience.valance.position.y = stageAmbience.valance.userData.baseY + Math.sin(t * 0.7) * 0.025;
    }
    if (stageAmbience.starMat) {
      stageAmbience.starMat.opacity = 0.78 + Math.sin(t * 0.9) * 0.14;
    }
    for (let i = 0; i < spotHeads.length; i++) {
      const sh = spotHeads[i];
      const lens = sh.lensMat;
      const pulse = 0.72 + Math.sin(t * 1.4 + i * 1.1) * 0.28;
      const lightScale = Math.max(0.18, stageLightLevel / 100);
      lens.color.setHex(sh.base);
      lens.color.multiplyScalar((0.75 + pulse * 0.35) * lightScale);
      // Concert moving-head sweep: light, target, and clipped beam ride the mount.
      if (sh.sweep) sh.mount.rotation.z = Math.sin(t * 0.42 + i * 2.1) * sh.sweep * 2.8;
    }
  }

  // Dust motion is evaluated in the vertex shader; only one scalar changes.
  dust.userData.time.value = t;

  // play-feedback: floating notes + footlight bump (kept under reduced motion —
  // it is action feedback, not ambient shimmer)
  noteBursts.update(dt, prefersReducedMotion.matches);
  if (hitPulse.value > 0.001) {
    hitPulse.value *= Math.pow(0.008, dt);
    const fp = stageAmbience.footPulse;
    if (fp) {
      const dimScale = stageLightLevel / 100;
      const boost = 1 + hitPulse.value * 0.85;
      fp.mat.emissiveIntensity = fp.matBase * dimScale * boost;
      for (const bulbLight of fp.lights) {
        if (bulbLight.visible) bulbLight.intensity = fp.lightBase * dimScale * boost;
      }
    }
  }

  // vibe decay
  if (play.vibe > 0 && !play.vibeFull && performance.now() - play.lastVibeAdd > 1500) {
    play.vibe = Math.max(0, play.vibe - 6 * dt);
    ui.setVibe(play.vibe);
  }

  // hover raycast
  if (session.started && !ui.modalOpen && canHover.matches) {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(interactables, false);
    const hit = hits.length ? hits[0].object : null;
    // The glow says "walk over here". Inside a close-up you are already there
    // and the pointer plays instead, so lighting the instrument only smears it.
    const glow = Boolean(hit) && !isInstrumentCloseUp();
    if (hit !== hovered || glow !== hoverGlowing) {
      if (hoverGlowing) setGlow(hovered, false);
      hovered = hit;
      hoverGlowing = glow;
      if (hoverGlowing) setGlow(hovered, true);
    }
    canvas.style.cursor = hovered ? 'pointer' : '';
  } else {
    if (hoverGlowing) setGlow(hovered, false);
    hovered = null;
    hoverGlowing = false;
    if (!canHover.matches) canvas.style.cursor = '';
  }

  fireworks.update(dt);
  updateSlideshow(dt);
  updateSigns(dt);
  updateSlideshowNavLayout(camera);
  updateLoopProgress();

  if (composer) composer.render();
  else renderer.render(scene, camera);

  updateMobileQualityProbe(frameTime);

  if (firstFrame) {
    firstFrame = false;
    window.__sceneReady = true;
    document.documentElement.dataset.sceneReady = 'true';
  }
}

// ============================================================
// INIT (wait for fonts so canvas textures look right)
// ============================================================
Promise.all([
  Promise.race([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise((r) => setTimeout(r, 3500)),
  ]),
  initPostprocessing(),
]).then(() => {
  drums.refreshLogo?.();
  if (PHOTO_SLIDES_ENABLED) {
    loadSlideTextures(renderer.capabilities.getMaxAnisotropy()).then((loaded) => {
      if (!loaded) window.__dbg = 'no photos loaded';
    }).catch((e) => { window.__dbg = `load err: ${e}`; });
  } else {
    window.__dbg = 'photo slideshow disabled: Art Vibe title slide only';
  }
  addLabels();
  renderer.compile(scene, camera);
  animate();

  if (shouldSkipIntro()) {
    startWithoutIntro();
  } else {
    startExperience();
  }

  const shot = params.get('shot');
  if (shot) {
    setTimeout(() => {
      if (shot === 'chip') {
        chipFor('guitar', { force: true });
        clearTimeout(ui._chipTimer);
      }
      else if (shot === 'vibe-toast') ui.toast('Максимальний вайб! Тепер ти можеш більше.', 60000, 'vibe-max');
      else if (shot === 'toast') ui.toast('У студії доступні <span class="hl">вокал, гітара, барабани та фортепіано</span>', 60000);
      else ui.open(shot, params.get('anchor') || undefined);
    }, 400);
  }
});
