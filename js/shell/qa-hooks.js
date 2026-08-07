// ============================================================
// HEADLESS QA HOOKS (?testhooks=1)
// Deterministic state driving + renderer diagnostics for the packaged canvas
// inspector. Never active for real visitors. `?headless=1` additionally pumps
// the frame loop from a worker, because a hidden tab never fires rAF and would
// otherwise freeze before the inspector could drive anything.
// ============================================================
import * as THREE from 'three';
import { params } from '../core/quality.js?v=20260807-08';
import { session } from '../core/session.js?v=20260807-08';
import { renderer, scene, camera, controls } from '../view/rig.js?v=20260807-08';
import { mascot, guitar, interactables } from '../core/studio.js?v=20260807-08';
import { INSTRUMENT_VIEW_PRESETS, instrumentView } from '../view/instrument-presets.js?v=20260807-08';
import { raycaster } from '../view/pick.js?v=20260807-08';
import { mascotMove } from '../mascot/state.js?v=20260807-08';
import { setDancing } from '../mascot/pose.js?v=20260807-08';
import { leaveInstrumentView, requestInstrumentView } from '../view/instrument-view.js?v=20260807-08';
import { addVibe, VIBE_NOTE_GAIN } from '../play/vibe.js?v=20260807-08';
import { composer } from './postfx.js?v=20260807-08';

// ============================================================
if (params.has('testhooks')) {
  renderer.info.autoReset = false;
  if (params.has('headless')) {
    // Hidden tabs never fire rAF and clamp timers to 1 Hz, which freezes the
    // whole sim before the inspector can drive it. A worker interval is exempt
    // from background throttling, so it pumps the frame loop instead.
    const frameWorker = new Worker(URL.createObjectURL(new Blob([
      'setInterval(() => postMessage(0), 33);',
    ], { type: 'text/javascript' })));
    const pendingFrames = [];
    window.requestAnimationFrame = (cb) => pendingFrames.push(cb) && pendingFrames.length;
    frameWorker.onmessage = () => {
      const batch = pendingFrames.splice(0, pendingFrames.length);
      for (const frame of batch) frame(performance.now());
    };
    Object.defineProperty(document, 'hidden', { get: () => false });
  }
  window.__THREE_GAME_DIAGNOSTICS__ = {
    get renderer() {
      return {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        programs: renderer.info.programs?.length ?? 0,
        pixelRatio: renderer.getPixelRatio(),
        shadows: renderer.shadowMap.enabled,
        postprocessing: !!composer,
      };
    },
  };
  window.__THREE_GAME_TEST_HOOKS__ = {
    seed() { /* stage has no gameplay RNG to pin */ },
    setState(name) {
      if (name === 'stage') { leaveInstrumentView({ immediate: true, offerPriceChip: false }); return; }
      if (name === 'dance') { setDancing(true); return; }
      // Divided by the note gain so this still fills the meter outright,
      // whatever that gain is tuned to.
      if (name === 'vibe') { addVibe(100 / VIBE_NOTE_GAIN); return; }
      if (INSTRUMENT_VIEW_PRESETS[name]) requestInstrumentView(name);
    },
    // Debug-only scene handle for headless isolation (hide/show suspects).
    scene,
    get state() {
      const world = (object) => object.getWorldPosition(new THREE.Vector3())
        .toArray().map((v) => +v.toFixed(2));
      return {
        phase: instrumentView.phase,
        kind: instrumentView.kind,
        started: session.started,
        flyT: session.flyT,
        mascot: mascot.group.position.toArray().map((v) => +v.toFixed(2)),
        mascotScale: +mascot.group.scale.y.toFixed(2),
        cameraDistance: +camera.position.distanceTo(controls.target).toFixed(3),
        minDistance: +controls.minDistance.toFixed(3),
        maxDistance: +controls.maxDistance.toFixed(3),
        handL: world(mascot.handL),
        handR: world(mascot.handR),
        strumPlane: world(guitar.strumPlane),
        destination: mascotMove.destination ? mascotMove.destination.toArray().map((v) => +v.toFixed(2)) : null,
        waypoints: mascotMove.waypoints.length,
        transition: Boolean(instrumentView.transition),
      };
    },
    // Headless capture: render synchronously so toDataURL reads fresh pixels
    // even when a hidden tab never composites frames.
    captureFrame() {
      if (composer) composer.render();
      else renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/png');
    },
    // Debug picking: what is under this client-pixel? Lists every hit front to
    // back so soft/transparent artifacts can be identified, not just the top hit.
    pick(clientX, clientY) {
      const ndc = new THREE.Vector2(
        (clientX / window.innerWidth) * 2 - 1,
        -(clientY / window.innerHeight) * 2 + 1,
      );
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      return ray.intersectObjects(scene.children, true).slice(0, 12).map((hit) => ({
        distance: Number(hit.distance.toFixed(2)),
        type: hit.object.type,
        geometry: hit.object.geometry?.type,
        material: Array.isArray(hit.object.material) ? 'multi' : hit.object.material?.type,
        name: hit.object.name || null,
        parentName: hit.object.parent?.name || null,
        worldPos: hit.point ? { x: +hit.point.x.toFixed(2), y: +hit.point.y.toFixed(2), z: +hit.point.z.toFixed(2) } : null,
      }));
    },
  };
}

