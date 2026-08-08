// ============================================================
// INSTRUMENT FOCUS PRESETS
// Where the camera sits, where the mascot stands or sits, and how they walk in
// for each instrument — expressed in that instrument's own local space so
// moving a prop on stage carries its whole close-up with it.
// ============================================================
import * as THREE from 'three';
import { drums, piano, guitar, mic } from '../core/studio.js?v=20260808-03';
import { isMobileGameMode } from '../core/quality.js?v=20260808-03';

export const instrumentGroups = { drums: drums.group, piano: piano.group, guitar: guitar.group, mic: mic.group };
export const instrumentWorldPositions = Object.fromEntries(
  Object.keys(instrumentGroups).map((kind) => [kind, new THREE.Vector3()]),
);
export const MASCOT_HIP_LOCAL_Y = 0.76;

export const INSTRUMENT_VIEW_PRESETS = {
  drums: {
    // y is derived from seatTop at pose time; only x/z are read from here.
    mascot: new THREE.Vector3(0, 0.15, -1.05),
    seatTop: 0.665,
    yaw: 0,
    seated: true,
    approach: [],
    camera: new THREE.Vector3(1.2, 2.18, -2.2),
    cameraMobile: new THREE.Vector3(0.92, 3.5, -3.55),
    target: new THREE.Vector3(0, 0.94, 0.05),
    targetMobile: new THREE.Vector3(0, 0.8, -0.05),
    arms: [-0.88, -1.05],
  },
  piano: {
    mascot: new THREE.Vector3(0, 0.07, 1.02),
    yaw: Math.PI,
    seated: true,
    approach: [],
    // Base direction only: the measured piano fitter owns distance and offset.
    // Steep behind-the-player view (~72°) so the keybed reads as a horizontal
    // GarageBand-like strip above the pianist's own head at every mascot size.
    camera: new THREE.Vector3(0.15, 3.9, 1.55),
    target: new THREE.Vector3(0, 0.66, 0.5),
  },
  guitar: {
    mascot: new THREE.Vector3(-0.06, 0, -0.18),
    yaw: 0,
    seated: false,
    approach: [],
    // The guitar is held across the mascot (see the performance pose in
    // instruments.js). Only the eye direction lives here; the guitar fitter
    // owns distance and offset.
    //
    // Azimuth follows the viewport because a guitar is long and thin, and a
    // diagonal one wastes the frame: each orientation lays the instrument
    // along the screen's long axis. Landscape is the player's own first-person
    // view — looking down from behind the head, neck to the screen left, low E
    // nearest the viewer, exactly the orientation a guitarist sees. The head
    // physically overhangs the strings for tall or wide builds, so the sight
    // line often passes through it; syncGuitarFirstPersonHead (mascot/update)
    // hides the head whenever that happens, the same way first-person games
    // hide the player model's head. Portrait stands the guitar up, body
    // low-right and head at the left edge.
    camera: new THREE.Vector3(-0.45, 3.7, -0.9),
    cameraPortrait: new THREE.Vector3(-1.23, 3.7, 0.37),
    target: new THREE.Vector3(0.05, 1.06, 0.28),
  },
  mic: {
    mascot: new THREE.Vector3(0.42, 0, 0.58),
    yaw: -2.52,
    seated: false,
    approach: [],
    camera: new THREE.Vector3(-1.45, 1.75, 2),
    cameraMobile: new THREE.Vector3(-1.82, 2.05, 2.58),
    target: new THREE.Vector3(0, 1.2, 0),
    arms: [-0.42, -0.78],
  },
};

export const instrumentView = {
  phase: 'idle',
  kind: null,
  transition: null,
  refit: null,
  home: null,
  homeMascotPosition: null,
  offerPriceChipOnIdle: null,
};

export function instrumentViewCameraPoint(kind, preset) {
  return isMobileGameMode() && preset.cameraMobile ? preset.cameraMobile : preset.camera;
}

export function instrumentLocalToWorld(kind, point) {
  const group = instrumentGroups[kind];
  group.updateWorldMatrix(true, false);
  return group.localToWorld(point.clone());
}

