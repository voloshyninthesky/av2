// ============================================================
// STAGE GEOMETRY
// Platform, curtains, speaker stacks and all the dressing that makes the
// venue read as a real room. Everything that can be instanced is, and the
// pieces that only earn their keep on capable hardware register themselves
// with the quality module so the low tier can drop them.
// ============================================================
import * as THREE from 'three';
import {
  woodTexture,
  curtainTexture,
  makeCurtainGeometry,
  perforatedTexture,
  softDiscTexture,
  contactShadowTexture,
} from './textures.js?v=20260813-06';
import { buildScreen } from './screen.js?v=20260813-06';
import {
  adaptiveQualityScene,
  stageAmbience,
  registerDimmableLight,
  registerDimmableEmissive,
  isLowEndMobileGameMode,
  canUpgradeMobileQuality,
} from '../core/quality.js?v=20260813-06';

// ---- stage dressing: skirt, footlight hoods, proscenium, star drop,
// upstage truss, monitor wedges, cable runs, contact shadows ----
function buildStageDressing(g, { curtainMaterial, curtainLegGeometry } = {}) {
  const dressing = new THREE.Group();
  const aubergine = new THREE.MeshStandardMaterial({ color: 0x241433, roughness: 0.52, metalness: 0.12 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xD1A13B, metalness: 0.88, roughness: 0.3 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0x9a7428, metalness: 0.92, roughness: 0.38 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0c0913, roughness: 0.7 });
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const eul = new THREE.Euler();
  const vec = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);

  // -- stage skirt: paneled front + gold beading
  const skirtPanels = new THREE.InstancedMesh(new THREE.BoxGeometry(1.9, 0.5, 0.05), aubergine, 8);
  for (let i = 0; i < 8; i++) {
    matrix.makeTranslation(-7 + i * 2, -0.33, 4.03);
    skirtPanels.setMatrixAt(i, matrix);
  }
  skirtPanels.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  skirtPanels.computeBoundingSphere();
  dressing.add(skirtPanels);
  const beading = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.52, 6), goldMat, 9);
  for (let i = 0; i < 9; i++) {
    matrix.makeTranslation(-8 + i * 2, -0.33, 4.05);
    beading.setMatrixAt(i, matrix);
  }
  beading.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  beading.computeBoundingSphere();
  dressing.add(beading);

  // -- brass footlight hoods behind each bulb
  const hoods = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI),
    brassMat,
    9,
  );
  eul.set(-1.25, 0, 0);
  quat.setFromEuler(eul);
  for (let i = 0; i < 9; i++) {
    vec.set(-6 + i * 1.5, 0.055, 3.96);
    matrix.compose(vec, quat, one);
    hoods.setMatrixAt(i, matrix);
  }
  hoods.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  hoods.computeBoundingSphere();
  dressing.add(hoods);

  // -- proscenium: fluted columns + gold-trimmed header framing the stage
  const columnShaftGeometry = new THREE.CylinderGeometry(0.3, 0.36, 7.7, 14);
  const columnPlinthGeometry = new THREE.BoxGeometry(0.92, 0.52, 0.92);
  const columnCapitalGeometry = new THREE.BoxGeometry(0.95, 0.35, 0.95);
  const collarGeometry = new THREE.TorusGeometry(0.34, 0.035, 8, 18);
  for (const s of [-1, 1]) {
    const col = new THREE.Group();
    const plinth = new THREE.Mesh(columnPlinthGeometry, aubergine);
    plinth.position.y = -0.34;
    col.add(plinth);
    const shaft = new THREE.Mesh(columnShaftGeometry, aubergine);
    shaft.position.y = 3.77;
    col.add(shaft);
    for (const cy of [0.05, 7.45]) {
      const collar = new THREE.Mesh(collarGeometry, goldMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = cy;
      col.add(collar);
    }
    const capital = new THREE.Mesh(columnCapitalGeometry, aubergine);
    capital.position.y = 7.72;
    col.add(capital);
    col.position.set(s * 8.55, 0, 2.5);
    dressing.add(col);
  }
  const header = new THREE.Mesh(new THREE.BoxGeometry(18.6, 0.85, 0.7), aubergine);
  header.position.set(0, 8.32, 2.5);
  dressing.add(header);
  const headerTrim = new THREE.Mesh(new THREE.BoxGeometry(18.6, 0.1, 0.74), goldMat);
  headerTrim.position.set(0, 7.87, 2.5);
  dressing.add(headerTrim);
  const crest = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), goldMat);
  crest.position.set(0, 8.32, 2.87);
  dressing.add(crest);

  // -- star drop: pin lights across the back wall, instanced as one draw
  const starCount = 140;
  const starMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: softDiscTexture(),
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const stars = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.07, 0.07), starMat, starCount);
  const starColor = new THREE.Color();
  for (let i = 0; i < starCount; i++) {
    vec.set(
      (Math.random() - 0.5) * 27,
      0.5 + Math.random() * 9.6,
      -5.8,
    );
    matrix.makeTranslation(vec.x, vec.y, vec.z);
    stars.setMatrixAt(i, matrix);
    const warm = Math.random();
    starColor.setRGB(
      0.55 + warm * 0.45,
      0.45 + warm * 0.4,
      0.65 + Math.random() * 0.35,
    ).multiplyScalar(0.3 + Math.random() * 0.7);
    stars.setColorAt(i, starColor);
  }
  stars.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  if (stars.instanceColor) stars.instanceColor.setUsage(THREE.StaticDrawUsage);
  stars.computeBoundingSphere();
  dressing.add(stars);
  adaptiveQualityScene.starDrop = stars;
  stageAmbience.starMat = starMat;

  // -- upstage truss + clamps so the hanging screen spot reads as rigged
  const trussMat2 = new THREE.MeshStandardMaterial({ color: 0x1a1420, metalness: 0.7, roughness: 0.4 });
  const upstageBar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 13, 10), trussMat2);
  upstageBar.rotation.z = Math.PI / 2;
  upstageBar.position.set(0, 7.9, -2.5);
  dressing.add(upstageBar);
  const drops = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.045, 1.6, 8), trussMat2, 4);
  let dropIndex = 0;
  for (const dx of [-6.2, 6.2]) {
    for (const dz of [1.6, -2.5]) {
      const dy = dz > 0 ? 7.5 : 8.7;
      matrix.makeTranslation(dx, dy, dz);
      drops.setMatrixAt(dropIndex++, matrix);
    }
  }
  drops.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  drops.computeBoundingSphere();
  dressing.add(drops);
  const clamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 0.09, 0.13), darkMat, 5);
  const clampXs = [-4.6, -1.55, 1.55, 4.6, 0];
  for (let i = 0; i < clampXs.length; i++) {
    const cz = i === 4 ? -2.5 : 1.6;
    const cy = i === 4 ? 7.86 : 6.66;
    matrix.makeTranslation(clampXs[i], cy, cz);
    clamps.setMatrixAt(i, matrix);
  }
  clamps.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  clamps.computeBoundingSphere();
  dressing.add(clamps);

  // -- monitor wedges at the stage lip, angled back toward the performers
  const grilleTex = perforatedTexture();
  const grilleMat = new THREE.MeshStandardMaterial({ map: grilleTex, roughness: 0.85, metalness: 0.05 });
  for (const s of [-1, 1]) {
    const wedge = new THREE.Group();
    // No cast shadow: a 0.4-tall wedge at the stage lip throws its shadow off
    // the front edge, so it would only cost a shadow-pass draw call.
    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.4, 0.58), darkMat);
    wedge.add(shell);
    const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.32), grilleMat);
    grille.position.set(0, 0.03, -0.295);
    grille.rotation.y = Math.PI;
    wedge.add(grille);
    const jack = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.03), trussMat2);
    jack.position.set(0.3, -0.08, 0.295);
    wedge.add(jack);
    wedge.position.set(s * 2.35, 0.23, 3.42);
    wedge.rotation.x = 0.6;
    wedge.rotation.y = s * 0.14;
    dressing.add(wedge);
    g.userData.walkColliderRoots.push({ id: `monitor-${s < 0 ? 'left' : 'right'}`, root: wedge });
  }

  // -- cable runs + gaffer tape (hidden on the low tier)
  const cableGroup = new THREE.Group();
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x131019, roughness: 0.9, metalness: 0.05 });
  const cablePaths = [
    [[-6.1, 3.15], [-6.9, 2.2], [-7.4, 0.2], [-7.7, -2.2], [-7.8, -3.6]],
    [[6.1, 3.15], [7.0, 2.4], [7.5, 0.4], [7.7, -2.0], [7.8, -3.6]],
    [[1.15, 2.32], [2.4, 2.15], [4.2, 1.4], [6.2, 0.4], [7.5, -0.6]],
  ];
  for (const path of cablePaths) {
    const curve = new THREE.CatmullRomCurve3(path.map(([px, pz]) => new THREE.Vector3(px, 0.016, pz)));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 22, 0.021, 6), cableMat);
    cableGroup.add(tube);
  }
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0x2e2937, roughness: 0.6 });
  const tape = new THREE.InstancedMesh(new THREE.BoxGeometry(0.17, 0.006, 0.11), tapeMat, 6);
  const tapeSpots = [[-6.9, 2.2, 0.5], [-7.5, -1.0, 0.15], [6.95, 2.35, -0.4], [7.6, -0.8, 0.1], [3.2, 1.85, -0.9], [5.9, 0.55, -0.75]];
  for (let i = 0; i < tapeSpots.length; i++) {
    eul.set(0, tapeSpots[i][2], 0);
    quat.setFromEuler(eul);
    vec.set(tapeSpots[i][0], 0.03, tapeSpots[i][1]);
    matrix.compose(vec, quat, one);
    tape.setMatrixAt(i, matrix);
  }
  tape.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  tape.computeBoundingSphere();
  cableGroup.add(tape);
  dressing.add(cableGroup);
  adaptiveQualityScene.lowTierDressing.push(cableGroup, drops, clamps);

  // -- off-stage wing fill so wide framings never read as empty void:
  // extra drape stacks, stacked road cases, and a lighting boom
  if (curtainMaterial && curtainLegGeometry) {
    for (const [wx, wz, wr] of [[-9.9, -2.3, 0.4], [9.9, -2.3, -0.4], [-11.2, -0.4, 0.55], [11.2, -0.4, -0.55]]) {
      const wingDrape = new THREE.Mesh(curtainLegGeometry, curtainMaterial);
      wingDrape.position.set(wx, 3.75, wz);
      wingDrape.rotation.y = wr;
      dressing.add(wingDrape);
    }
  }
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x191423, roughness: 0.62, metalness: 0.22 });
  const caseTrimMat = new THREE.MeshStandardMaterial({ color: 0x8f93a5, roughness: 0.35, metalness: 0.85 });
  const roadCases = new THREE.InstancedMesh(new THREE.BoxGeometry(1.15, 0.78, 0.62), caseMat, 5);
  const caseLids = new THREE.InstancedMesh(new THREE.BoxGeometry(1.19, 0.05, 0.66), caseTrimMat, 5);
  const caseSpots = [
    [-9.55, 0.32, 0.7, 0.28], [-9.55, 1.12, 0.7, 0.28], [-9.35, 0.32, 1.9, -0.15],
    [9.65, 0.32, 1.1, -0.3], [9.5, 1.12, 1.1, -0.3],
  ];
  for (let i = 0; i < caseSpots.length; i++) {
    const [cx, cy, cz, cr] = caseSpots[i];
    eul.set(0, cr, 0);
    quat.setFromEuler(eul);
    vec.set(cx, cy - 0.6, cz);
    matrix.compose(vec, quat, one);
    roadCases.setMatrixAt(i, matrix);
    vec.y += 0.41;
    matrix.compose(vec, quat, one);
    caseLids.setMatrixAt(i, matrix);
  }
  for (const inst of [roadCases, caseLids]) {
    inst.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    inst.computeBoundingSphere();
    dressing.add(inst);
  }
  const boomMat = new THREE.MeshStandardMaterial({ color: 0x1a1420, metalness: 0.7, roughness: 0.4 });
  const boomPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 6.2, 8), boomMat);
  boomPole.position.set(-9.15, 2.5, 1.9);
  dressing.add(boomPole);
  const boomArm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.6, 8), boomMat);
  boomArm.rotation.z = Math.PI / 2.3;
  boomArm.position.set(-8.75, 5.35, 1.9);
  dressing.add(boomArm);
  const boomHead = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.3, 10), boomMat);
  boomHead.position.set(-8.25, 5.05, 1.9);
  boomHead.rotation.z = 0.7;
  dressing.add(boomHead);

  // -- fake contact shadows grounding instruments and props
  const shadowTex = contactShadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const contacts = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), shadowMat, 8);
  const contactSpots = [
    [-2.8, -1.7, 3.1, 2.6],   // drums
    [-1.35, 1.75, 1.5, 1.3],  // guitar
    [1.0, 2.4, 1.05, 1.05],   // mic
    [3.5, -1.3, 3.2, 2.2],    // piano
    [-6.4, 3.2, 1.9, 1.7],    // speaker L
    [6.4, 3.2, 1.9, 1.7],     // speaker R
    [-2.35, 3.42, 1.15, 0.85],// monitor L
    [2.35, 3.42, 1.15, 0.85], // monitor R
  ];
  eul.set(-Math.PI / 2, 0, 0);
  quat.setFromEuler(eul);
  for (let i = 0; i < contactSpots.length; i++) {
    const [cx, cz, sx, sz] = contactSpots[i];
    vec.set(cx, 0.014, cz);
    matrix.compose(vec, quat, new THREE.Vector3(sx, sz, 1));
    contacts.setMatrixAt(i, matrix);
  }
  contacts.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  contacts.computeBoundingSphere();
  contacts.renderOrder = 1;
  dressing.add(contacts);

  g.add(dressing);
}

export function buildStage() {
  const g = new THREE.Group();
  g.userData.walkColliderRoots = [];

  // venue floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    // Keep the under-stage floor visually neutral. Real spotlights without
    // mobile shadow maps otherwise shine through the platform onto this plane,
    // which looks like volumetric beam geometry hanging over the void.
    new THREE.MeshBasicMaterial({ color: 0x07040d, fog: true })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.6;
  g.add(floor);

  // stage platform
  const wood = woodTexture();
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x2a1038, roughness: 0.6 });
  const topMat = new THREE.MeshStandardMaterial({
    map: wood.map,
    roughnessMap: wood.roughnessMap,
    roughness: 1.0,
    metalness: 0.06,
  });
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.6, 9),
    [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]
  );
  platform.position.set(0, -0.3, -0.5);
  platform.receiveShadow = true;
  g.add(platform);

  // gold trim on front edge
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.07, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xD1A13B, metalness: 0.85, roughness: 0.3 })
  );
  trim.position.set(0, -0.02, 4.02);
  g.add(trim);

  const lowEndLighting = isLowEndMobileGameMode();
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0x332211,
    emissive: 0xD1A13B,
    emissiveIntensity: 1.3,
    roughness: 0.5,
  });
  registerDimmableEmissive(bulbMat);
  stageAmbience.footPulse = { mat: bulbMat, matBase: 1.3, lights: [], lightBase: 6 };
  const bulbGeom = new THREE.SphereGeometry(0.05, 10, 8);
  const bulbs = new THREE.InstancedMesh(bulbGeom, bulbMat, 9);
  const bulbMatrix = new THREE.Matrix4();
  for (let i = 0; i < 9; i++) {
    const x = -6 + i * 1.5;
    bulbs.setMatrixAt(i, bulbMatrix.makeTranslation(x, 0.06, 3.9));
    // Bulbs retain their emissive look. The five tiny point lights, however,
    // are evaluated by every PBR fragment and are not perceptible on a phone.
    if (i % 2 === 0 && (!lowEndLighting || canUpgradeMobileQuality)) {
      const pl = new THREE.PointLight(0xffc878, 6, 4.2, 2);
      pl.position.set(x, 0.22, 3.65);
      g.add(pl);
      adaptiveQualityScene.bulbLights.push(pl);
      stageAmbience.footPulse.lights.push(pl);
      registerDimmableLight(pl);
    }
  }
  bulbs.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  bulbs.computeBoundingSphere();
  g.add(bulbs);

  // backdrop wall
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 12),
    new THREE.MeshStandardMaterial({ color: 0x15091f, roughness: 0.95 })
  );
  wall.position.set(0, 5, -5.85);
  g.add(wall);

  // curtains — pleated velvet with a warm sheen response
  const curt = curtainTexture();
  const curtMat = new THREE.MeshStandardMaterial({
    map: curt,
    roughness: 0.86,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  const sideCurtainGeometry = makeCurtainGeometry(3.4, 9.4, 6, 0.22);
  stageAmbience.curtains.length = 0;
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(sideCurtainGeometry, curtMat);
    c.position.set(s * 7.9, 4.1, -3.9);
    c.rotation.y = -s * 0.3;
    c.userData.baseRotY = c.rotation.y;
    c.userData.side = s;
    c.castShadow = false;
    g.add(c);
    stageAmbience.curtains.push(c);
  }
  // upstage curtain legs: a second wing layer that gives the stage depth
  const legGeometry = makeCurtainGeometry(2.6, 9.2, 5, 0.18);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(legGeometry, curtMat);
    leg.position.set(s * 5.7, 4.05, -5.1);
    leg.rotation.y = -s * 0.12;
    g.add(leg);
  }
  const valance = new THREE.Mesh(makeCurtainGeometry(19.5, 1.7, 14, 0.14), curtMat.clone());
  valance.position.set(0, 8.15, -4.1);
  valance.userData.baseY = valance.position.y;
  g.add(valance);
  stageAmbience.valance = valance;
  const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xD1A13B, metalness: 0.85, roughness: 0.32 });
  const valanceTrim = new THREE.Mesh(new THREE.BoxGeometry(19.5, 0.09, 0.05), goldTrimMat);
  valanceTrim.position.set(0, 7.32, -4.06);
  g.add(valanceTrim);
  // gold fringe under the valance: instanced tassel drops
  const fringe = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.014, 0.008, 0.22, 5),
    goldTrimMat,
    64,
  );
  const fringeMatrix = new THREE.Matrix4();
  for (let i = 0; i < 64; i++) {
    fringeMatrix.makeTranslation(-9.45 + i * 0.3, 7.22, -4.08);
    fringe.setMatrixAt(i, fringeMatrix);
  }
  fringe.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  fringe.computeBoundingSphere();
  g.add(fringe);

  // backdrop slideshow screen (replaces the old static banner)
  g.add(buildScreen());

  // speaker stacks
  const spkMat = new THREE.MeshStandardMaterial({ color: 0x0d0a12, roughness: 0.55 });
  const coneMat = new THREE.MeshStandardMaterial({ color: 0x1f1a26, roughness: 0.8 });
  const speakerBoxGeometry = new THREE.BoxGeometry(1.15, 2.0, 0.95);
  const speakerPlateGeometry = new THREE.BoxGeometry(0.4, 0.12, 0.02);
  const speakerPlateMaterial = new THREE.MeshStandardMaterial({
    color: 0xD1A13B,
    metalness: 0.8,
    roughness: 0.3,
  });
  const speakerGrilleMaterial = new THREE.MeshStandardMaterial({
    map: perforatedTexture(),
    roughness: 0.85,
    metalness: 0.05,
  });
  const speakerPipingGeometry = new THREE.BoxGeometry(0.04, 2.0, 0.04);
  const casterGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10);
  const casterMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1722, metalness: 0.6, roughness: 0.5 });
  for (const s of [-1, 1]) {
    const spk = new THREE.Group();
    const box = new THREE.Mesh(speakerBoxGeometry, spkMat);
    box.position.y = 1.0;
    box.castShadow = true;
    spk.add(box);
    // recessed cloth grille behind the cones
    const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 1.8), speakerGrilleMaterial);
    grille.position.set(0, 1.0, 0.477);
    spk.add(grille);
    for (const [ry, rr] of [[1.45, 0.34], [0.75, 0.24]]) {
      const woofer = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr * 0.7, 0.08, 24), coneMat);
      woofer.rotation.x = Math.PI / 2;
      woofer.position.set(0, ry, 0.5);
      spk.add(woofer);
      const dustCap = new THREE.Mesh(new THREE.SphereGeometry(rr * 0.28, 10, 8), spkMat);
      dustCap.position.set(0, ry, 0.53);
      spk.add(dustCap);
    }
    // gold piping down the front corners + casters grounding the cab
    const piping = new THREE.InstancedMesh(speakerPipingGeometry, speakerPlateMaterial, 2);
    const casters = new THREE.InstancedMesh(casterGeometry, casterMaterial, 4);
    const hardwareMatrix = new THREE.Matrix4();
    [[-0.55], [0.55]].forEach(([px], i) => {
      piping.setMatrixAt(i, hardwareMatrix.makeTranslation(px, 1.0, 0.46));
    });
    [[-0.45, 0.35], [0.45, 0.35], [-0.45, -0.35], [0.45, -0.35]].forEach(([cx, cz], i) => {
      casters.setMatrixAt(i, hardwareMatrix.makeTranslation(cx, 0.02, cz));
    });
    for (const inst of [piping, casters]) {
      inst.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      inst.computeBoundingSphere();
      spk.add(inst);
    }
    const plate = new THREE.Mesh(
      speakerPlateGeometry,
      speakerPlateMaterial,
    );
    plate.position.set(0, 1.92, 0.49);
    spk.add(plate);
    spk.position.set(s * 6.4, 0, 3.2);
    spk.rotation.y = -s * 0.35;
    g.add(spk);
    g.userData.walkColliderRoots.push({ id: `speaker-${s < 0 ? 'left' : 'right'}`, root: spk });
  }

  buildStageDressing(g, { curtainMaterial: curtMat, curtainLegGeometry: legGeometry });

  return g;
}
