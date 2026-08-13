// ============================================================
// MASCOT POSES + DANCE
// Instrument poses are solved, not authored: arms are aimed at the real hand
// anchors on the instrument, and seated poses derive hip height from the seat
// so any body size sits on it correctly. Poses are captured and interpolated
// as plain joint snapshots so a focus transition can blend between them.
// ============================================================
import * as THREE from 'three';
import { session, easeInOut } from '../core/session.js?v=20260813-24';
import { ui, mascot, piano, guitar, mic, mascotLabel, mascotLabelY, applyMascotScale } from '../core/studio.js?v=20260813-24';
import {
  MASCOT_HIP_LOCAL_Y,
  INSTRUMENT_VIEW_PRESETS,
  instrumentView,
  instrumentGroups,
  instrumentLocalToWorld,
} from '../view/instrument-presets.js?v=20260813-24';
import { PIANO_HAND_ANCHORS } from '../view/focus-frame.js?v=20260813-24';
import { guitarMascotStandoffZ } from '../instruments/guitar.js?v=20260813-24';
import { mascotMove, dance } from './state.js?v=20260813-24';
import { mascotCfg, MASCOT_HEIGHT_RANGE } from './appearance.js?v=20260813-24';

const danceBtn = document.getElementById('logo-btn'); // HUD logo doubles as the dance toggle

export function resetMascotPose() {
  applyMascotScale();
  mascot.group.rotation.x = 0;
  mascot.group.rotation.z = 0;
  mascot.torso.rotation.set(0, 0, 0);
  mascot.head.position.set(0, 1.56, 0);
  mascot.head.rotation.set(0, 0, 0);
  mascot.armL.position.set(-0.34, 1.28, 0);
  mascot.armR.position.set(0.34, 1.28, 0);
  mascot.armL.rotation.set(0, 0, -0.12);
  mascot.armR.rotation.set(0, 0, 0.12);
  mascot.legL.rotation.set(0, 0, 0);
  mascot.legR.rotation.set(0, 0, 0);
}

export function captureMascotInstrumentPose() {
  return {
    position: mascot.group.position.clone(),
    group: mascot.group.quaternion.clone(),
    torso: mascot.torso.quaternion.clone(),
    headPosition: mascot.head.position.clone(),
    head: mascot.head.quaternion.clone(),
    armLPosition: mascot.armL.position.clone(),
    armRPosition: mascot.armR.position.clone(),
    armL: mascot.armL.quaternion.clone(),
    armR: mascot.armR.quaternion.clone(),
    legL: mascot.legL.quaternion.clone(),
    legR: mascot.legR.quaternion.clone(),
  };
}

export function applyMascotInstrumentPose(pose) {
  mascot.group.position.copy(pose.position);
  mascot.group.quaternion.copy(pose.group);
  mascot.torso.quaternion.copy(pose.torso);
  mascot.head.position.copy(pose.headPosition);
  mascot.head.quaternion.copy(pose.head);
  mascot.armL.position.copy(pose.armLPosition);
  mascot.armR.position.copy(pose.armRPosition);
  mascot.armL.quaternion.copy(pose.armL);
  mascot.armR.quaternion.copy(pose.armR);
  mascot.legL.quaternion.copy(pose.legL);
  mascot.legR.quaternion.copy(pose.legR);
}

export function interpolateMascotInstrumentPose(from, to, amount) {
  mascot.group.position.lerpVectors(from.position, to.position, amount);
  mascot.group.quaternion.slerpQuaternions(from.group, to.group, amount);
  mascot.torso.quaternion.slerpQuaternions(from.torso, to.torso, amount);
  mascot.head.position.lerpVectors(from.headPosition, to.headPosition, amount);
  mascot.head.quaternion.slerpQuaternions(from.head, to.head, amount);
  mascot.armL.position.lerpVectors(from.armLPosition, to.armLPosition, amount);
  mascot.armR.position.lerpVectors(from.armRPosition, to.armRPosition, amount);
  mascot.armL.quaternion.slerpQuaternions(from.armL, to.armL, amount);
  mascot.armR.quaternion.slerpQuaternions(from.armR, to.armR, amount);
  mascot.legL.quaternion.slerpQuaternions(from.legL, to.legL, amount);
  mascot.legR.quaternion.slerpQuaternions(from.legR, to.legR, amount);
}

function pianoArmQuaternion(shoulderPosition, targetWorld, inverseMascotMatrix) {
  const targetLocal = targetWorld.clone().applyMatrix4(inverseMascotMatrix);
  const direction = targetLocal.sub(shoulderPosition).normalize();
  const downward = Math.max(0.08, -direction.y);
  const x = THREE.MathUtils.clamp(-Math.atan2(direction.z, downward), -1.24, -0.48);
  const z = THREE.MathUtils.clamp(Math.atan2(direction.x, downward), -0.32, 0.32);
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(x, 0, z, 'XYZ'));
}

export function createPianoMascotPose() {
  const preset = INSTRUMENT_VIEW_PRESETS.piano;
  const scaleY = mascot.group.scale.y;
  const benchTop = 0.585;
  const mascotLocalPosition = preset.mascot.clone();
  mascotLocalPosition.y = benchTop - MASCOT_HIP_LOCAL_Y * scaleY;
  // A bigger body sits farther from the keybed (like a real pianist pushing
  // the bench back), so a tall mascot's head cannot hang over the keys in the
  // behind-the-player focus view. Clamped to the bench depth.
  mascotLocalPosition.z = THREE.MathUtils.clamp(0.44 + 0.85 * scaleY, 0.98, 1.3);
  const position = instrumentLocalToWorld('piano', mascotLocalPosition);
  const pianoQuaternion = piano.group.getWorldQuaternion(new THREE.Quaternion());
  const groupQuaternion = pianoQuaternion.multiply(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), preset.yaw),
  );
  const targetMatrix = new THREE.Matrix4().compose(
    position,
    groupQuaternion,
    mascot.group.scale,
  );
  const inverseTargetMatrix = targetMatrix.clone().invert();
  const normalizedHeight = THREE.MathUtils.clamp(
    (mascotCfg.height - MASCOT_HEIGHT_RANGE.min) / (MASCOT_HEIGHT_RANGE.max - MASCOT_HEIGHT_RANGE.min),
    0,
    1,
  );
  const legAngle = THREE.MathUtils.lerp(-0.38, -0.92, normalizedHeight);
  const armLPosition = new THREE.Vector3(-0.4, 1.26, 0.08);
  const armRPosition = new THREE.Vector3(0.4, 1.26, 0.08);

  return {
    position,
    group: groupQuaternion,
    torso: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0, 0)),
    // Keep the head over the torso and slightly toward the keybed. A negative
    // local Z moves it toward the behind-player focus camera, exaggerating the
    // hair shell and hiding the face through perspective.
    headPosition: new THREE.Vector3(0, 1.52, 0.04),
    head: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0, 0)),
    armLPosition,
    armRPosition,
    armL: pianoArmQuaternion(
      armLPosition,
      instrumentLocalToWorld('piano', PIANO_HAND_ANCHORS.armL),
      inverseTargetMatrix,
    ),
    armR: pianoArmQuaternion(
      armRPosition,
      instrumentLocalToWorld('piano', PIANO_HAND_ANCHORS.armR),
      inverseTargetMatrix,
    ),
    legL: new THREE.Quaternion().setFromEuler(new THREE.Euler(legAngle, 0, -0.08)),
    legR: new THREE.Quaternion().setFromEuler(new THREE.Euler(legAngle - 0.04, 0, 0.08)),
  };
}

// Strum-arm rest pose while holding the guitar; updateMascot layers the
// stroke motion on top of these exact baselines, so keep them in one place.
// Nearly horizontal forward reach so the hand hovers OVER the reclined
// guitar face at the soundhole instead of hiding behind the lower bout.
export const GUITAR_STRUM_ARM_BASE = { x: -1.45, z: -0.2 };

export function createGuitarMascotPose() {
  const preset = INSTRUMENT_VIEW_PRESETS.guitar;
  const localPosition = preset.mascot.clone();
  // Step a bigger body farther back from the held guitar so the head stays
  // behind the strings instead of eclipsing the soundhole. The formula is
  // shared with the guitar focus fitter, which frames this exact head.
  localPosition.z = guitarMascotStandoffZ(mascot.group.scale.y);
  const position = instrumentLocalToWorld('guitar', localPosition);
  position.y = 0;
  const guitarQuaternion = guitar.group.getWorldQuaternion(new THREE.Quaternion());
  const groupQuaternion = guitarQuaternion.multiply(
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), preset.yaw),
  );
  return {
    position,
    group: groupQuaternion,
    torso: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, 0, 0.03)),
    headPosition: new THREE.Vector3(0, 1.54, 0.05),
    // Eyes down toward the strings — the overhead camera reads it as
    // watching the hands.
    head: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0.1, 0)),
    armLPosition: new THREE.Vector3(-0.34, 1.28, 0.06),
    armRPosition: new THREE.Vector3(0.34, 1.28, 0.06),
    // armL strums over the soundhole; armR reaches out along the neck.
    armL: new THREE.Quaternion().setFromEuler(
      new THREE.Euler(GUITAR_STRUM_ARM_BASE.x, 0, GUITAR_STRUM_ARM_BASE.z),
    ),
    armR: new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.15, 0, 0.55)),
    legL: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -0.06)),
    legR: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.06)),
  };
}

// ---- mascot dance (HUD logo click — tektonik routine) ----
const DANCE_BPM = 122;

export function setDancing(next) {
  const on = Boolean(next) && session.started && !ui.modalOpen && !mascotMove.fall
    && session.flyT < 0 && instrumentView.phase === 'idle';
  if (on === dance.active) return;
  dance.active = on;
  if (on) {
    dance.t = 0;
    dance.loop = 0;
    dance.yaw = mascot.group.rotation.y;
  }
  danceBtn?.classList.toggle('dancing', on);
  danceBtn?.setAttribute('aria-pressed', on ? 'true' : 'false');
}

// 8-beat tektonik loop: overhead arm sweeps + bounce, spin on the last two beats.
export function updateMascotDance(dt) {
  dance.t += dt;
  const beat = dance.t * (DANCE_BPM / 60);
  const rad = beat * Math.PI * 2;
  const loop = beat % 8; // 8-beat routine
  if (loop < dance.loop) dance.yaw = mascot.group.rotation.y; // wrapped after a spin
  dance.loop = loop;

  const sweep = Math.sin(rad);
  const raise = Math.sin(rad * 0.5);

  // tektonik arms: alternating overhead sweeps with a quick flick
  mascot.armL.rotation.z = -(0.35 + Math.max(0, raise) * 2.1) + Math.sin(rad * 2) * 0.16;
  mascot.armR.rotation.z = 0.35 + Math.max(0, -raise) * 2.1 + Math.cos(rad * 2) * 0.16;
  mascot.armL.rotation.x = Math.cos(rad * 0.5) * 0.5 + sweep * 0.3;
  mascot.armR.rotation.x = Math.sin(rad * 0.5) * 0.5 - sweep * 0.3;

  // bounce on the beat + hips / head groove
  mascot.group.position.y = Math.abs(sweep) * 0.085;
  mascot.torso.rotation.z = sweep * 0.13;
  mascot.head.rotation.z = -sweep * 0.1;
  mascot.head.rotation.x = Math.sin(rad * 2) * 0.05;

  // alternating footwork
  mascot.legL.rotation.x = Math.max(0, sweep) * 0.55;
  mascot.legR.rotation.x = Math.max(0, -sweep) * 0.55;
  mascot.legL.rotation.z = -0.06;
  mascot.legR.rotation.z = 0.06;

  // gentle sway, full spin on the last two beats of the loop
  if (loop >= 6) {
    const k = easeInOut(Math.min(1, (loop - 6) / 2));
    mascot.group.rotation.y = dance.yaw + k * Math.PI * 2;
  } else {
    mascot.group.rotation.y = dance.yaw + Math.sin(rad * 0.25) * 0.3;
  }
}

export function poseMascotAtInstrument(kind) {
  const preset = INSTRUMENT_VIEW_PRESETS[kind];
  const group = instrumentGroups[kind];
  if (!preset || !group) return;
  resetMascotPose();
  if (kind === 'piano' || kind === 'guitar') {
    applyMascotInstrumentPose(kind === 'piano' ? createPianoMascotPose() : createGuitarMascotPose());
    if (mascotLabel) {
      mascotLabel.visible = false;
      mascotLabel.position.set(
        mascot.group.position.x,
        mascot.group.position.y + mascotLabelY(),
        mascot.group.position.z,
      );
    }
    return;
  }
  const localMascot = preset.mascot.clone();
  if (preset.seatTop !== undefined) {
    localMascot.y = preset.seatTop - MASCOT_HIP_LOCAL_Y * mascot.group.scale.y;
  }
  mascot.group.position.copy(instrumentLocalToWorld(kind, localMascot));
  mascot.group.rotation.y = group.rotation.y + preset.yaw;
  mascot.armL.rotation.x = preset.arms[0];
  mascot.armR.rotation.x = preset.arms[1];
  mascot.armL.rotation.z = -0.24;
  mascot.armR.rotation.z = 0.24;
  if (preset.seated) {
    mascot.legL.rotation.x = -1.08;
    mascot.legR.rotation.x = -1.14;
    mascot.legL.rotation.z = -0.08;
    mascot.legR.rotation.z = 0.08;
    mascot.torso.rotation.x = -0.06;
  } else if (kind === 'guitar') {
    mascot.torso.rotation.z = 0.05;
    mascot.head.rotation.z = -0.08;
  } else if (kind === 'mic') {
    mascot.head.rotation.x = -0.08;
    mascot.head.rotation.z = 0.05;
  }
  if (mascotLabel) {
    mascotLabel.visible = false;
    mascotLabel.position.set(mascot.group.position.x, mascot.group.position.y + mascotLabelY(), mascot.group.position.z);
  }
}

