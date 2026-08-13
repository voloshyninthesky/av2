// ============================================================
// GIFT WARDROBE
// The magic wardrobe the mascot steps out of — the egg's successor. Built once
// at boot and kept invisible between ceremonies; js/mascot/reveal.js only ever
// moves, rotates and recolours it, so opening a gift allocates nothing.
//
// Two layers, deliberately:
// - A **procedural base** (carcass, cornice, legs, two hinged doors, glow slab)
//   that exists synchronously at boot. The ceremony is fully playable on it,
//   offline included — the stage never waits on a download.
// - A **generated dress** (Tripo GLB, ornate cabinet shell) that replaces the
//   procedural carcass when it arrives. The doors stay procedural in both
//   modes: a fused GLB cannot hinge, and the doors flinging open *is* the
//   reveal. The GLB is generated doorless for exactly this reason.
//
// No lights, same as the egg: a PointLight inside would sell the leak, but a
// lazily-added light relinks every lit program mid-ceremony. The additive glow
// slab behind the door seam plus the bloom ramp do the job for free.
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Front faces +z; the reveal yaws the group toward the ceremony camera.
const W = 1.04;
const H = 1.72;
const D = 0.52;
const SIDE_T = 0.06;
const LEG_H = 0.09;
const CORNICE_H = 0.10;
const DOOR_T = 0.045;
const DOOR_SEAM = 0.012;
const OPENING_W = W - SIDE_T * 2;
const OPENING_Y0 = LEG_H + 0.05;
const OPENING_Y1 = H - CORNICE_H - 0.05;
const DOOR_W = (OPENING_W - DOOR_SEAM) / 2;
const DOOR_H = OPENING_Y1 - OPENING_Y0;

// Doors crack this far during the strain and fling to this angle at the burst.
export const WARDROBE_AJAR = 0.12;
export const WARDROBE_DOOR_MAX = 2.25;

export function buildGiftWardrobe() {
  const group = new THREE.Group();
  group.name = 'giftWardrobe';

  const mats = {
    lacquer: new THREE.MeshStandardMaterial({ color: 0x3d1d5c, roughness: 0.5, metalness: 0.08 }),
    lacquerDark: new THREE.MeshStandardMaterial({ color: 0x2a0f3a, roughness: 0.6, metalness: 0.06 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xD1A13B, roughness: 0.35, metalness: 0.65 }),
    interior: new THREE.MeshStandardMaterial({ color: 0x17121c, roughness: 0.92 }),
    glow: new THREE.MeshBasicMaterial({
      color: 0xFDFBF7, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }),
  };

  // ---- procedural carcass (hidden when the GLB dress arrives) ----
  const carcass = new THREE.Group();
  const addBox = (parent, material, w, h, d, x, y, z, shadow = false) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    parent.add(mesh);
    return mesh;
  };
  const BODY_H = H - LEG_H - CORNICE_H;
  const bodyMidY = LEG_H + BODY_H / 2;
  addBox(carcass, mats.lacquer, W, BODY_H, 0.04, 0, bodyMidY, -D / 2 + 0.02, true); // back
  addBox(carcass, mats.lacquer, SIDE_T, BODY_H, D, -(W - SIDE_T) / 2, bodyMidY, 0, true);
  addBox(carcass, mats.lacquer, SIDE_T, BODY_H, D, (W - SIDE_T) / 2, bodyMidY, 0, true);
  addBox(carcass, mats.lacquer, OPENING_W, OPENING_Y0 - LEG_H, D, 0, (LEG_H + OPENING_Y0) / 2, 0); // base rail
  addBox(carcass, mats.lacquer, OPENING_W, H - CORNICE_H - OPENING_Y1, D, 0, (OPENING_Y1 + H - CORNICE_H) / 2, 0); // top rail
  addBox(carcass, mats.lacquerDark, W + 0.12, CORNICE_H, D + 0.10, 0, H - CORNICE_H / 2, 0, true); // cornice
  addBox(carcass, mats.gold, W + 0.13, 0.022, D + 0.11, 0, H - CORNICE_H - 0.011, 0); // cornice trim
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(carcass, mats.lacquerDark, 0.09, LEG_H, 0.09, sx * (W / 2 - 0.09), LEG_H / 2, sz * (D / 2 - 0.09));
    }
  }
  // Dark interior back wall — what the crack of light is seen against.
  addBox(carcass, mats.interior, OPENING_W, DOOR_H, 0.02, 0, OPENING_Y0 + DOOR_H / 2, -D / 2 + 0.05);
  group.add(carcass);

  // ---- glow slab just behind the door seam ----
  // Light reads as pouring out of the wardrobe as the doors part, not as a
  // lamp in front of it.
  const glow = new THREE.Mesh(new THREE.BoxGeometry(OPENING_W - 0.06, DOOR_H - 0.04, 0.05), mats.glow);
  glow.position.set(0, OPENING_Y0 + DOOR_H / 2, D / 2 - 0.11);
  group.add(glow);

  // ---- hinged doors (procedural in both dress modes) ----
  // Pivots sit on the hinge lines; setDoorAngle mirrors one angle onto both.
  // Left door extends +x from its hinge, so a NEGATIVE y-rotation swings its
  // free edge toward the camera; the right door mirrors that.
  // Each pivot carries two skins: the solid lacquer door of the procedural
  // base, and a "door of light" — an additive panel on the shared glow
  // material. The generated shell has its doors fused shut in the mesh, so in
  // dressed mode the solid skins hide and the light doors carry the fling:
  // what bursts open out of a sealed magic wardrobe is light.
  const makeDoor = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * (OPENING_W / 2), 0, D / 2 - DOOR_T / 2);
    const doorMidX = -side * (DOOR_W / 2 + DOOR_SEAM / 2);
    const solid = [];
    const panel = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W, DOOR_H, DOOR_T), mats.lacquer);
    panel.position.set(doorMidX, OPENING_Y0 + DOOR_H / 2, 0);
    panel.castShadow = true;
    pivot.add(panel);
    solid.push(panel);
    const inset = new THREE.Mesh(
      new THREE.BoxGeometry(DOOR_W - 0.10, DOOR_H - 0.12, 0.02),
      mats.lacquerDark,
    );
    inset.position.set(doorMidX, OPENING_Y0 + DOOR_H / 2, DOOR_T / 2);
    pivot.add(inset);
    solid.push(inset);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.02, DOOR_H - 0.06, 0.02), mats.gold);
    trim.position.set(-side * (DOOR_W + DOOR_SEAM / 2 - 0.025), OPENING_Y0 + DOOR_H / 2, DOOR_T / 2);
    pivot.add(trim);
    solid.push(trim);
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), mats.gold);
    handle.position.set(-side * (DOOR_W + DOOR_SEAM / 2 - 0.07), OPENING_Y0 + DOOR_H * 0.52, DOOR_T / 2 + 0.02);
    pivot.add(handle);
    solid.push(handle);
    pivot.userData.solid = solid;
    group.add(pivot);
    return pivot;
  };
  const doorL = makeDoor(-1);
  const doorR = makeDoor(1);

  // Dressed mode: the generated shell is the wardrobe while it is shut, and
  // the procedural carcass takes back over on the burst frame so the doors can
  // actually swing. A generated mesh is fused — its doors cannot hinge — and
  // the two ways around that were both worse: swinging glowing rectangles out
  // of a sealed cabinet read as the hack it was, and cutting to a *second*
  // generated model (doors modelled open) dragged in a different silhouette,
  // a different depth, and door knobs that loomed into frame like gold eggs.
  // Cutting to the base under the burst flash keeps one coherent box.
  let shell = null;
  let dressed = false;
  let doorAngle = 0;
  const OPEN_AT = WARDROBE_AJAR + 0.25;
  // Measured, not guessed: the generator ignores "front facing", and this
  // shell came out with its doors on local −x. Verified by rendering it at
  // four yaws under the stage lights.
  const SHELL_YAW = -Math.PI / 2;
  // Two glow poses: a hairline at the door seam while shut, a broader pool
  // inside the cabinet once open. The open pose stays well back — pushed
  // forward it becomes an additive sheet over the character who just stepped
  // out, which washes the whole reveal to gold.
  const glowSeam = { scale: new THREE.Vector3(0.075, 0.94, 0.5), z: D / 2 - 0.10 };
  const glowOpen = { scale: new THREE.Vector3(1, 1, 1), z: D / 2 - 0.11 };
  const applyGlowPose = (pose) => {
    glow.scale.copy(pose.scale);
    glow.position.z = pose.z;
  };

  // Fits the generated shell to the procedural wardrobe's exact box: front
  // facing +z, then scaled per axis to W × H × D and stood on the floor.
  // Non-uniform on purpose — the shell is a cabinet, a few percent of stretch
  // is invisible, and matching the box exactly is what makes the burst-frame
  // cut between shell and carcass read as one prop rather than two.
  const fitShell = (modelScene) => {
    modelScene.rotation.y = SHELL_YAW;
    const bounds = new THREE.Box3().setFromObject(modelScene);
    const size = bounds.getSize(new THREE.Vector3());
    if (!size.x || !size.y || !size.z) return false;
    modelScene.scale.set(W / size.x, H / size.y, D / size.z);
    bounds.setFromObject(modelScene);
    const center = bounds.getCenter(new THREE.Vector3());
    modelScene.position.x -= center.x;
    modelScene.position.z -= center.z;
    modelScene.position.y -= bounds.min.y;
    modelScene.traverse((object) => {
      if (object.isMesh) object.castShadow = true;
    });
    return true;
  };

  const handle = {
    group,
    carcass,
    doorL,
    doorR,
    glow,
    mats,
    topY: H,
    // How far the prop reaches toward the camera from its own origin. The
    // reveal stands the wardrobe back by this much so the character lands in
    // front of it, not inside it. Fixed, because the generated shell is fitted
    // to this exact box.
    frontZ: D / 2,
    // Set by reveal.js for the length of a ceremony; the loader waits it out
    // rather than repainting the prop mid-reveal.
    ceremonyRunning: false,
    // One angle drives the doors: 0 shut, WARDROBE_AJAR straining,
    // WARDROBE_DOOR_MAX flung open. The procedural doors hinge on it directly.
    // Dressed, the generated shell owns everything below OPEN_AT and hands
    // over to the carcass above it — a threshold the ceremony crosses only on
    // the burst frame, under the flash.
    setDoorAngle(angle) {
      doorAngle = angle;
      doorL.rotation.y = -angle;
      doorR.rotation.y = angle;
      if (!dressed) return;
      const open = angle >= OPEN_AT;
      shell.visible = !open;
      carcass.visible = open;
      for (const pivot of [doorL, doorR]) {
        for (const mesh of pivot.userData.solid) mesh.visible = open;
      }
      applyGlowPose(open ? glowOpen : glowSeam);
    },
    // Dress the base in the generated shell. The base is not disposed: it is
    // both the offline fallback and the open half of the prop.
    dress(modelScene) {
      if (!fitShell(modelScene)) return;
      shell = modelScene;
      group.add(modelScene);
      // Re-derived through setDoorAngle rather than set here, so one place
      // decides what is visible at a given angle — including when the dress
      // lands mid-fly with the doors already shut.
      dressed = true;
      handle.setDoorAngle(doorAngle);
    },
  };
  return handle;
}

// Fire-and-forget dress-up. The ceremony must never wait on the network, and a
// failed download simply leaves the procedural wardrobe standing — same rule as
// the signs boards.
//
// The gate is `ceremonyRunning`, not visibility: on a first run the wardrobe is
// on stage from frame 0, and gating on "visible" would mean the one visitor who
// actually watches a ceremony — the first-run one — never sees the generated
// art. Dressing during the load screen or the fly-in is invisible; dressing
// mid-ceremony would repaint the prop under the visitor's eyes, so that is the
// only window the swap waits out. reveal.js owns the flag.
export function loadGiftWardrobeModel(handle, url) {
  new GLTFLoader().loadAsync(url).then((gltf) => {
    const apply = () => {
      if (handle.ceremonyRunning) {
        setTimeout(apply, 1000);
        return;
      }
      handle.dress(gltf.scene);
    };
    apply();
  }).catch(() => { /* procedural base stands in */ });
}
