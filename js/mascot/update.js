// ============================================================
// MASCOT PER-FRAME UPDATE
// Everything that moves the mascot each frame: joystick and keyboard walking,
// route following, the walk-cycle bob, the strum-arm decay, the fall, and the
// and the fall. The gift reveal owns the mascot outright while it runs.
// ============================================================
import * as THREE from 'three';
import { session } from '../core/session.js?v=20260813-22';
import { prefersReducedMotion } from '../core/quality.js?v=20260813-22';
import { camera, controls } from '../view/rig.js?v=20260813-22';
import { ui, mascot, mascotLabel, mascotLabelY, applyMascotScale, mascotFallMaterialStates } from '../core/studio.js?v=20260813-22';
import {
  joystickInput,
  cameraForwardXZ,
  cameraRightXZ,
  updateMobileFollowCamera,
  beginMascotFall,
  respawnMascot,
} from '../view/mobile-controls.js?v=20260813-22';
import { instrumentView } from '../view/instrument-presets.js?v=20260813-22';
import { activateInstrumentView } from '../view/instrument-view.js?v=20260813-22';
import { moveMascotWithColliders } from './walk.js?v=20260813-22';
import { mascotMove, dance } from './state.js?v=20260813-22';
import { giftReveal, giftCam } from './reveal.js?v=20260813-22';
import { GUITAR_STRUM_ARM_BASE, setDancing, updateMascotDance } from './pose.js?v=20260813-22';
import { play } from '../play/state.js?v=20260813-22';

// First-person guitar view (landscape): the focus camera sits where the
// player's own eyes are, so the mascot's head — and, seen from inside, the
// disjoint arm and torso pieces — would read as floating debris over the
// strings. Hide the whole mascot exactly while the sight line runs through
// the head, the standard first-person trick: you are looking out of this
// body, so only the guitar remains. Hysteresis keeps the boundary from
// flickering; orbiting away from the sight line, portrait, and every
// non-guitar phase bring the body straight back.
const bodySightLine = new THREE.Vector3();
const bodySightOffset = new THREE.Vector3();
let guitarBodyHidden = false;

function syncGuitarFirstPersonBody() {
  // Landscape only: portrait's composition keeps the whole mascot at the
  // frame edge as a third-person pose, and it should stay visible there.
  const guitarView = instrumentView.kind === 'guitar'
    && ['entering', 'focused', 'returning'].includes(instrumentView.phase)
    && window.innerWidth >= window.innerHeight;
  if (!guitarView) {
    if (guitarBodyHidden) {
      mascot.group.visible = true;
      guitarBodyHidden = false;
    }
    return;
  }
  bodySightLine.copy(controls.target).sub(camera.position);
  const sightLength = Math.max(0.001, bodySightLine.length());
  bodySightLine.divideScalar(sightLength);
  mascot.head.getWorldPosition(bodySightOffset).sub(camera.position);
  const along = bodySightOffset.dot(bodySightLine);
  const perpendicular = Math.sqrt(Math.max(0, bodySightOffset.lengthSq() - along * along));
  // Hair shell radius at the live height/build scale, plus band clearance.
  const hairRadius = 0.52 * Math.max(mascot.group.scale.x, mascot.group.scale.y);
  const headOnSightLine = along > 0 && along < sightLength + 0.45;
  if (!guitarBodyHidden && headOnSightLine && perpendicular < hairRadius + 0.2) {
    mascot.group.visible = false;
    guitarBodyHidden = true;
  } else if (guitarBodyHidden && (!headOnSightLine || perpendicular > (hairRadius + 0.2) * 1.3)) {
    mascot.group.visible = true;
    guitarBodyHidden = false;
  }
}

export function updateMascot(dt) {
  // Ahead of the first-person check: that helper owns `mascot.group.visible`,
  // and the reveal hides the mascot inside the gift box. Leaving guitar focus to
  // open a gift would otherwise let its "not in guitar view" branch un-hide the
  // body one frame later, spoiling the box.
  if (giftReveal.active) return;
  syncGuitarFirstPersonBody();
  if (!session.started || session.flyT >= 0) return;
  if (ui.modalOpen) return;
  if (mascotMove.fall) {
    const fall = mascotMove.fall;
    fall.t += dt;
    const fallProgress = Math.min(1, fall.t / fall.duration);
    mascot.group.position.addScaledVector(fall.velocity, dt);
    mascot.group.position.y = -0.05 - 0.48 * fall.t - 0.38 * fall.t * fall.t;
    applyMascotScale(1 - fallProgress * 0.24);
    mascot.group.rotation.z += dt * 1.7;
    mascot.group.rotation.x += dt * 0.82;
    for (const material of mascotFallMaterialStates.keys()) {
      material.opacity = THREE.MathUtils.lerp(0.92, 0.3, fallProgress);
    }
    const cameraDrop = THREE.MathUtils.smoothstep(fallProgress, 0, 1) * 3.35;
    camera.position.copy(fall.cameraPosition);
    camera.position.y -= cameraDrop;
    controls.target.copy(fall.cameraTarget);
    controls.target.y -= cameraDrop;
    camera.lookAt(controls.target);
    if (mascotLabel) {
      mascotLabel.visible = fall.t < 0.42;
      mascotLabel.position.set(mascot.group.position.x, mascot.group.position.y + mascotLabelY(), mascot.group.position.z);
    }
    if (fall.t >= fall.duration) {
      respawnMascot();
      // Walking off the stage costs you the character you had: a new egg is
      // waiting when you land. The old toast just told the visitor off for
      // finding the edge — this turns the same discovery into the reveal.
      ui.open('gift');
    }
    return;
  }
  if (instrumentView.phase === 'entering' || instrumentView.phase === 'focused' || instrumentView.phase === 'returning') {
    // Focused only: during 'entering' the transition lerp owns the arm pose.
    if (instrumentView.kind === 'guitar' && instrumentView.phase === 'focused') {
      play.guitarStrokeMotion *= Math.pow(0.012, dt);
      if (play.guitarStrokeMotion < 0.002) play.guitarStrokeMotion = 0;
      const motion = prefersReducedMotion.matches ? 0 : play.guitarStrokeMotion;
      mascot.armL.rotation.x = GUITAR_STRUM_ARM_BASE.x + motion * 0.14;
      mascot.armL.rotation.z = GUITAR_STRUM_ARM_BASE.z + play.guitarStrokeDirection * motion * 0.3;
    }
    if (mascotLabel) {
      mascotLabel.visible = instrumentView.phase === 'returning';
      if (mascotLabel.visible) {
        mascotLabel.position.set(mascot.group.position.x, mascot.group.position.y + mascotLabelY(), mascot.group.position.z);
      }
    }
    return;
  }
  const direction = new THREE.Vector3();

  if (joystickInput.lengthSq() > 0) {
    camera.getWorldDirection(cameraForwardXZ);
    cameraForwardXZ.y = 0;
    if (cameraForwardXZ.lengthSq() < 0.001) cameraForwardXZ.set(0, 0, -1);
    cameraForwardXZ.normalize();
    cameraRightXZ.crossVectors(cameraForwardXZ, camera.up).normalize();
    direction.addScaledVector(cameraRightXZ, joystickInput.x);
    direction.addScaledVector(cameraForwardXZ, -joystickInput.y);
  }

  // Any walk input / queued destination takes the mascot out of the dance.
  if (dance.active && (direction.lengthSq() > 0 || mascotMove.destination || instrumentView.phase !== 'idle')) {
    setDancing(false);
  }

  if (direction.lengthSq() > 0) {
    if (instrumentView.phase !== 'idle') {
      // Focus stays until ✕ — ignore walk input while approaching / seated.
      direction.set(0, 0, 0);
    } else {
      mascotMove.destination = null;
    }
  }
  else if (mascotMove.destination) {
    direction.subVectors(mascotMove.destination, mascot.group.position).setY(0);
    if (direction.length() < 0.08) {
      if (mascotMove.waypoints.length) {
        mascotMove.destination = mascotMove.waypoints.shift();
        direction.subVectors(mascotMove.destination, mascot.group.position).setY(0);
      } else {
        const arrivedKind = mascotMove.destinationKind;
        mascotMove.destination = null;
        mascotMove.destinationKind = null;
        direction.set(0, 0, 0);
        if (arrivedKind) {
          activateInstrumentView(arrivedKind);
          return;
        }
      }
    }
  }

  const walking = !dance.active && direction.lengthSq() > 0;
  if (walking) {
    const moveStrength = Math.min(1, direction.length());
    direction.normalize();
    moveMascotWithColliders(mascot.group.position, direction, mascotMove.speed * dt * moveStrength);
    const targetRotation = Math.atan2(direction.x, direction.z);
    const rotationDelta = Math.atan2(Math.sin(targetRotation - mascot.group.rotation.y), Math.cos(targetRotation - mascot.group.rotation.y));
    mascot.group.rotation.y += rotationDelta * Math.min(1, dt * 10);
    mascotMove.phase += dt * 10;
    if (
      mascot.group.position.x < mascotMove.stageEdge.minX ||
      mascot.group.position.x > mascotMove.stageEdge.maxX ||
      mascot.group.position.z > mascotMove.stageEdge.frontZ
    ) {
      beginMascotFall(direction);
      return;
    }
  }

  if (dance.active) {
    updateMascotDance(dt);
  } else {
    const stride = walking ? Math.sin(mascotMove.phase) * 0.58 : 0;
    const relax = Math.min(1, dt * 10);
    mascot.legL.rotation.x = THREE.MathUtils.lerp(mascot.legL.rotation.x, stride, relax);
    mascot.legR.rotation.x = THREE.MathUtils.lerp(mascot.legR.rotation.x, -stride, relax);
    mascot.armL.rotation.x = THREE.MathUtils.lerp(mascot.armL.rotation.x, -stride * 0.75, relax);
    mascot.armR.rotation.x = THREE.MathUtils.lerp(mascot.armR.rotation.x, stride * 0.75, relax);
    // Relax dance-only rotations back to neutral (no-ops outside the dance).
    mascot.armL.rotation.z = THREE.MathUtils.lerp(mascot.armL.rotation.z, -0.12, relax);
    mascot.armR.rotation.z = THREE.MathUtils.lerp(mascot.armR.rotation.z, 0.12, relax);
    mascot.legL.rotation.z = THREE.MathUtils.lerp(mascot.legL.rotation.z, 0, relax);
    mascot.legR.rotation.z = THREE.MathUtils.lerp(mascot.legR.rotation.z, 0, relax);
    mascot.head.rotation.x = THREE.MathUtils.lerp(mascot.head.rotation.x, 0, relax);
    mascot.group.position.y = walking ? Math.abs(Math.sin(mascotMove.phase * 2)) * 0.035 : 0;
    mascot.torso.rotation.z = walking ? Math.sin(mascotMove.phase) * 0.035 : 0;
    mascot.head.rotation.z = walking ? -Math.sin(mascotMove.phase) * 0.025 : 0;
  }

  if (mascotLabel) {
    const bob = prefersReducedMotion.matches ? 0 : Math.sin(performance.now() * 0.003) * 0.04;
    mascotLabel.position.set(
      mascot.group.position.x,
      mascot.group.position.y + mascotLabelY() + bob,
      mascot.group.position.z,
    );
    const pulse = prefersReducedMotion.matches ? 1 : 1 + Math.sin(performance.now() * 0.004) * 0.06;
    mascotLabel.scale.setScalar(0.55 * pulse);
  }

  // The gift's return tween owns the rig until it lands. The follow camera
  // running alongside it would write to the same camera every frame, and two
  // eased motions pulling at once is what reads as a stutter after ГОТОВО.
  if (!giftCam.active) updateMobileFollowCamera(dt);
}

