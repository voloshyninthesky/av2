// ============================================================
// PICKING PRIMITIVES
// One raycaster, one normalised pointer, and the ground plane the mascot walks
// on. Shared because both the stage's pointer router and the play routes cast
// against the same frame's camera, and casting twice would disagree.
// ============================================================
import * as THREE from 'three';

export const raycaster = new THREE.Raycaster();
/** Pointer in NDC, parked off-screen until the first real move. */
export const pointer = new THREE.Vector2(-10, -10);
/** y = 0 stage floor, used to turn a tap into a walk destination. */
export const stageWalkPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
