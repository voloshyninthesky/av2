// ============================================================
// ACOUSTIC GUITAR
// Body, neck, frets and six strings on a stand. The strings and the strum
// plane are addressable so a touch on the neck can be resolved back to the
// string it crossed.
// ============================================================
import * as THREE from 'three';
import {
  GOLD,
  PURPLE_DARK,
  cylinderBetween,
  guitarWoodTexture,
  lacquer,
  metal,
  std,
} from './shared.js?v=20260807-07';

// Where the mascot stands behind the held guitar, in guitar-group space: a
// bigger body steps farther back so the head clears the strings. Canonical
// home for the formula — createGuitarMascotPose (mascot/pose.js) and the
// chest-riding playPosition below must agree on it, or the focus framing
// and the pose drift apart.
export function guitarMascotStandoffZ(scaleY) {
  return THREE.MathUtils.clamp(-0.18 - 0.55 * (scaleY - 0.68), -0.44, -0.08);
}

export function buildGuitar() {
  const guitar = new THREE.Group();       // floor anchor
  const body = new THREE.Group();         // the instrument itself (wobbles)
  guitar.add(body);

  const woodMap = guitarWoodTexture();
  const woodMat = lacquer(0xffffff, { roughness: 0.3, metalness: 0.05, clearcoat: 0.85, clearcoatRoughness: 0.18 });
  woodMat.map = woodMap;
  const woodDark = std(0x4a2e14, { roughness: 0.44, metalness: 0.1 });
  const purpleMat = lacquer(PURPLE_DARK, { roughness: 0.36, clearcoat: 0.4 });
  const creamMat = std(0xf2e6cc, { roughness: 0.4, metalness: 0.04 });

  // ---- body: figure-8 silhouette, extruded ----
  const s = new THREE.Shape();
  s.moveTo(0, 0.48);
  s.bezierCurveTo(0.24, 0.48, 0.27, 0.26, 0.16, 0.08);   // upper bout right
  s.bezierCurveTo(0.11, 0.0, 0.13, -0.06, 0.3, -0.26);   // waist right
  s.bezierCurveTo(0.38, -0.36, 0.3, -0.52, 0, -0.52);    // lower bout right
  s.bezierCurveTo(-0.3, -0.52, -0.38, -0.36, -0.3, -0.26);
  s.bezierCurveTo(-0.13, -0.06, -0.11, 0.0, -0.16, 0.08);
  s.bezierCurveTo(-0.27, 0.26, -0.24, 0.48, 0, 0.48);
  const bodyGeom = new THREE.ExtrudeGeometry(s, {
    depth: 0.13, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 24,
  });
  bodyGeom.translate(0, 0, -0.065);
  // Extrude UVs are raw shape coords: remap so the sunburst centers on the top.
  woodMap.repeat.set(1 / 0.76, 1);
  woodMap.offset.set(0.5, 0.52);
  // Darker tobacco sides read as the traditional bent-rim body edge.
  const bodyMesh = new THREE.Mesh(bodyGeom, [woodMat, woodDark]);
  body.add(bodyMesh);

  // binding
  const bind = new THREE.Mesh(new THREE.TorusGeometry(0.001, 0.001, 4, 4), woodDark); // placeholder-free
  bind.visible = false;
  body.add(bind);

  // soundhole + rosette
  const holeZ = 0.095;
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.1, 28), std(0x090610, { roughness: 0.95 }));
  hole.position.set(0, 0.1, holeZ);
  body.add(hole);
  const rosette = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.012, 8, 36), purpleMat);
  rosette.position.set(0, 0.1, holeZ - 0.002);
  body.add(rosette);
  const rosetteGold = new THREE.Mesh(new THREE.TorusGeometry(0.143, 0.005, 6, 36), metal(GOLD, 0.35));
  rosetteGold.position.set(0, 0.1, holeZ - 0.003);
  body.add(rosetteGold);

  // bridge with saddle + pins
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.025), woodDark);
  bridge.position.set(0, -0.27, holeZ);
  body.add(bridge);
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.012, 0.015), creamMat);
  saddle.position.set(0, -0.258, holeZ + 0.012);
  body.add(saddle);
  const pinInstance = new THREE.Object3D();
  const bridgePins = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.006, 0.005, 0.014, 6),
    creamMat,
    6,
  );
  for (let i = 0; i < 6; i++) {
    pinInstance.position.set(-0.042 + i * 0.0168, -0.288, holeZ + 0.012);
    pinInstance.rotation.set(Math.PI / 2, 0, 0);
    pinInstance.updateMatrix();
    bridgePins.setMatrixAt(i, pinInstance.matrix);
  }
  bridgePins.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  bridgePins.computeBoundingSphere();
  body.add(bridgePins);

  // neck + fretboard (nut → body); frets use real 12-TET spacing
  const NUT_Y = 1.175;
  const BRIDGE_Y = -0.26;
  const SCALE_LEN = NUT_Y - BRIDGE_Y;
  const FRET_COUNT = 12;
  const OPEN_FREQS = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63]; // E A D G B E
  const fretY = (n) => (n <= 0 ? NUT_Y : NUT_Y - SCALE_LEN * (1 - 2 ** (-n / 12)));

  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.78, 0.05), woodMat);
  neck.position.set(0, 0.83, 0.045);
  body.add(neck);
  const fretboard = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.78, 0.012), woodDark);
  fretboard.position.set(0, 0.83, 0.075);
  body.add(fretboard);

  // nut
  const nut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.016), metal(0xf0e6d0, 0.45));
  nut.position.set(0, NUT_Y, 0.082);
  body.add(nut);

  const fretMat = metal(GOLD, 0.4);
  const guitarInstance = new THREE.Object3D();
  const frets = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.078, 0.005, 0.014),
    fretMat,
    FRET_COUNT,
  );
  for (let f = 1; f <= FRET_COUNT; f++) {
    guitarInstance.position.set(0, fretY(f), 0.082);
    guitarInstance.rotation.set(0, 0, 0);
    guitarInstance.scale.setScalar(1);
    guitarInstance.updateMatrix();
    frets.setMatrixAt(f - 1, guitarInstance.matrix);
  }
  frets.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  frets.computeBoundingSphere();
  body.add(frets);
  // position markers (3, 5, 7, 9, 12)
  const dotMat = std(0xf5efe3, { roughness: 0.55 });
  const markerFrets = [3, 5, 7, 9, 12];
  const markers = new THREE.InstancedMesh(
    new THREE.CircleGeometry(0.007, 10),
    dotMat,
    6,
  );
  let markerIndex = 0;
  for (const f of markerFrets) {
    const y = (fretY(f - 1) + fretY(f)) * 0.5;
    if (f === 12) {
      for (const sx of [-0.018, 0.018]) {
        guitarInstance.position.set(sx, y, 0.082);
        guitarInstance.rotation.set(0, 0, 0);
        guitarInstance.scale.setScalar(0.006 / 0.007);
        guitarInstance.updateMatrix();
        markers.setMatrixAt(markerIndex++, guitarInstance.matrix);
      }
    } else {
      guitarInstance.position.set(0, y, 0.082);
      guitarInstance.rotation.set(0, 0, 0);
      guitarInstance.scale.setScalar(1);
      guitarInstance.updateMatrix();
      markers.setMatrixAt(markerIndex++, guitarInstance.matrix);
    }
  }
  markers.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  markers.computeBoundingSphere();
  body.add(markers);

  // headstock + tuners
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.2, 0.045), woodDark);
  head.position.set(0, 1.3, 0.045);
  body.add(head);
  const pegMaterial = metal(0xd9d9e2);
  const pegs = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.014, 0.014, 0.05, 8),
    pegMaterial,
    6,
  );
  let pegIndex = 0;
  for (let i = 0; i < 3; i++) {
    for (const sd of [-1, 1]) {
      guitarInstance.position.set(sd * 0.08, 1.24 + i * 0.06, 0.045);
      guitarInstance.rotation.set(0, 0, Math.PI / 2);
      guitarInstance.scale.setScalar(1);
      guitarInstance.updateMatrix();
      pegs.setMatrixAt(pegIndex++, guitarInstance.matrix);
    }
  }
  pegs.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  pegs.computeBoundingSphere();
  body.add(pegs);
  // tuner buttons on the peg ends
  const tunerButtons = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.016, 8, 6),
    creamMat,
    6,
  );
  let tunerIndex = 0;
  for (let i = 0; i < 3; i++) {
    for (const sd of [-1, 1]) {
      guitarInstance.position.set(sd * 0.108, 1.24 + i * 0.06, 0.045);
      guitarInstance.rotation.set(0, 0, 0);
      guitarInstance.scale.set(0.7, 1, 1.5);
      guitarInstance.updateMatrix();
      tunerButtons.setMatrixAt(tunerIndex++, guitarInstance.matrix);
    }
  }
  guitarInstance.scale.setScalar(1);
  tunerButtons.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  tunerButtons.computeBoundingSphere();
  body.add(tunerButtons);
  // gold truss-rod cover
  const trussCover = new THREE.Mesh(new THREE.CircleGeometry(0.022, 3), metal(GOLD, 0.4));
  trussCover.position.set(0, 1.215, 0.069);
  trussCover.rotation.z = Math.PI;
  body.add(trussCover);

  // Strings + dedicated play zones. A single fretboard plane replaces the
  // overlapping per-string/per-fret hit boxes; the soundhole plane owns strums.
  const stringMat = metal(0xe8e8f0, 0.2);
  const woundStringMat = metal(0xc9a86a, 0.32);
  const stringGauges = [0.0044, 0.0039, 0.0035, 0.0029, 0.0026, 0.0024];
  const strings = [];
  const stringWobble = Array(6).fill(0);
  const pendingExcitations = [];
  const hitMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const stringXAt = (i, y) => {
    const t = (y - BRIDGE_Y) / (1.33 - BRIDGE_Y);
    const xb = -0.042 + i * 0.0168;
    const xt = -0.028 + i * 0.0112;
    return xb + (xt - xb) * t;
  };
  for (let i = 0; i < 6; i++) {
    const xt = -0.028 + i * 0.0112;
    const xb = -0.042 + i * 0.0168;
    const str = cylinderBetween(
      new THREE.Vector3(xb, BRIDGE_Y, 0.1),
      new THREE.Vector3(xt, 1.33, 0.075),
      stringGauges[i], i < 3 ? woundStringMat : stringMat, 5);
    str.userData.baseX = str.position.x;
    str.userData.phase = i * 1.3;
    str.userData.stringIndex = i;
    str.userData.stringFreq = OPEN_FREQS[i];
    str.userData.fret = 0;
    body.add(str);
    strings.push(str);
  }

  const STRUM_Y = 0.08;
  const strumPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.56), hitMat);
  strumPlane.position.set(0, STRUM_Y, 0.145);
  strumPlane.visible = false;
  Object.assign(strumPlane.userData, {
    instrument: 'guitar',
    guitarZone: 'strum',
    stringXs: OPEN_FREQS.map((_, i) => stringXAt(i, STRUM_Y)),
  });
  body.add(strumPlane);

  const fretboardPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.82), hitMat);
  fretboardPlane.position.set(0, 0.83, 0.13);
  fretboardPlane.visible = false;
  Object.assign(fretboardPlane.userData, {
    instrument: 'guitar',
    guitarZone: 'fretboard',
    centerY: 0.83,
    fretCount: FRET_COUNT,
    fretYs: Array.from({ length: FRET_COUNT + 1 }, (_, fret) => fretY(fret)),
    openFreqs: [...OPEN_FREQS],
  });
  body.add(fretboardPlane);

  // Broad approach / hover target, intentionally ignored once guitar play is focused.
  const approachCollider = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.92, 0.34), hitMat);
  approachCollider.position.set(0, 0.52, 0.01);
  approachCollider.visible = false;
  Object.assign(approachCollider.userData, {
    instrument: 'guitar',
    guitarZone: 'approach',
  });
  body.add(approachCollider);

  // purple pickguard
  const guard = new THREE.Mesh(new THREE.CircleGeometry(0.09, 24, Math.PI * 1.05, Math.PI * 0.7), purpleMat);
  guard.position.set(0.06, 0.02, holeZ + 0.001);
  body.add(guard);

  // pose the instrument: leaning back on stand
  body.position.set(0, 0.62, 0);
  body.rotation.x = -0.14;
  body.rotation.y = 0.0;

  // Focus performance pose: the guitar rises into the mascot's hands, neck to
  // the player's left, face tipped up toward the behind-the-shoulder camera so
  // strings read horizontally (low E nearest the viewer, like a held guitar).
  const STAND_POSE = { position: new THREE.Vector3(0, 0.62, 0), euler: new THREE.Euler(-0.14, 0, 0) };
  const PLAY_POSE = { position: new THREE.Vector3(-0.35, 1.1, 0.16), euler: new THREE.Euler(-1.72, -0.08, -1.55) };
  const basePose = { rx: STAND_POSE.euler.x, ry: STAND_POSE.euler.y, rz: STAND_POSE.euler.z };
  let performBlend = 0;

  // ---- A-frame stand ----
  const standMat = metal(0x2c2c34, 0.45);
  standMat.transparent = true;
  const stand = new THREE.Group();
  stand.add(cylinderBetween(new THREE.Vector3(-0.3, 0, 0.22), new THREE.Vector3(-0.08, 0.6, -0.08), 0.02, standMat));
  stand.add(cylinderBetween(new THREE.Vector3(0.3, 0, 0.22), new THREE.Vector3(0.08, 0.6, -0.08), 0.02, standMat));
  stand.add(cylinderBetween(new THREE.Vector3(-0.3, 0.02, 0.22), new THREE.Vector3(0.3, 0.02, 0.22), 0.018, standMat));
  // cradle arms with rubber tips + floor feet
  const tipMat = std(0x17121c, { roughness: 0.9, metalness: 0 });
  tipMat.transparent = true;
  stand.add(cylinderBetween(new THREE.Vector3(-0.16, 0.3, 0.1), new THREE.Vector3(-0.16, 0.34, 0.26), 0.016, standMat));
  stand.add(cylinderBetween(new THREE.Vector3(0.16, 0.3, 0.1), new THREE.Vector3(0.16, 0.34, 0.26), 0.016, standMat));
  for (const [tx, ty, tz] of [[-0.16, 0.345, 0.265], [0.16, 0.345, 0.265], [-0.3, 0.012, 0.22], [0.3, 0.012, 0.22]]) {
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), tipMat);
    tip.position.set(tx, ty, tz);
    stand.add(tip);
  }
  guitar.add(stand);

  // Only the silhouette-defining masses cast. Strings, frets, pegs, markers and
  // pins add nothing to a shadow but each one costs a shadow-pass draw call —
  // and this instrument sits inside the key light's pool.
  const guitarShadowCasters = new Set([bodyMesh, neck, head]);
  guitar.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = guitarShadowCasters.has(o);
  });

  let wobble = 0, recoil = 0, recoilDirection = 1, time = 0;

  // The whole held guitar rides the mascot's chest. Height follows the height
  // scale so short or tall bodies still read as holding it; the x/z offset
  // follows the build scale so a wide torso and head carry the guitar forward
  // with them — otherwise a broad build leans its face past the soundboard and
  // into the strings, and no focus camera angle can frame around that.
  // At the default 0.68 mascot scale this reproduces PLAY_POSE exactly.
  const CHEST_OFFSET = { x: -0.29 / 0.68, z: 0.34 / 0.68 };
  const DEFAULT_MASCOT_SCALE = 0.68;

  function playPosition(scale) {
    const heightScale = (scale?.y ?? scale) || DEFAULT_MASCOT_SCALE;
    const buildScale = (scale?.x ?? heightScale) || heightScale;
    return new THREE.Vector3(
      PLAY_POSE.position.x + CHEST_OFFSET.x * (buildScale - DEFAULT_MASCOT_SCALE),
      PLAY_POSE.position.y * heightScale,
      PLAY_POSE.position.z
        + (guitarMascotStandoffZ(heightScale) - guitarMascotStandoffZ(DEFAULT_MASCOT_SCALE))
        + CHEST_OFFSET.z * (buildScale - DEFAULT_MASCOT_SCALE),
    );
  }

  function setPerformBlend(t, scale) {
    performBlend = THREE.MathUtils.clamp(t, 0, 1);
    const k = performBlend;
    body.position.lerpVectors(STAND_POSE.position, playPosition(scale), k);
    basePose.rx = THREE.MathUtils.lerp(STAND_POSE.euler.x, PLAY_POSE.euler.x, k);
    basePose.ry = THREE.MathUtils.lerp(STAND_POSE.euler.y, PLAY_POSE.euler.y, k);
    basePose.rz = THREE.MathUtils.lerp(STAND_POSE.euler.z, PLAY_POSE.euler.z, k);
    // The empty stand under a held guitar reads as a bug — fade it away.
    const standOpacity = THREE.MathUtils.clamp(1 - k * 1.6, 0, 1);
    standMat.opacity = standOpacity;
    tipMat.opacity = standOpacity;
    stand.visible = standOpacity > 0.01;
  }

  function queuePluck(index, velocity = 1, delayMs = 0) {
    if (!Number.isInteger(index) || index < 0 || index >= strings.length) return;
    pendingExcitations.push({
      index,
      at: time + Math.max(0, delayMs) / 1000,
      velocity: THREE.MathUtils.clamp(velocity, 0.12, 1.2),
    });
    pendingExcitations.sort((a, b) => a.at - b.at);
  }

  return {
    group: guitar,
    label: 'Гітара',
    labelAnchor: new THREE.Vector3(0, 2.05, 0),
    openFreqs: [...OPEN_FREQS],
    strumPlane,
    fretboardPlane,
    getPerformancePose(scale) {
      return {
        position: playPosition(scale),
        euler: PLAY_POSE.euler.clone(),
      };
    },
    setPerformBlend,
    strum(stringEvents = [], direction = 'bass-to-treble', velocity = 1) {
      recoilDirection = direction === 'treble-to-bass' ? -1 : 1;
      recoil = Math.max(recoil, THREE.MathUtils.clamp(velocity, 0.2, 1));
      wobble = Math.max(wobble, velocity * 0.32);
      for (const stringEvent of stringEvents) {
        queuePluck(stringEvent.stringIndex, velocity, stringEvent.offsetMs ?? 0);
      }
    },
    pluck(index, velocity = 1, delayMs = 0) {
      queuePluck(index, velocity, delayMs);
    },
    update(dt, _elapsed, reducedMotion = false) {
      time += dt;
      while (pendingExcitations.length && pendingExcitations[0].at <= time) {
        const excitation = pendingExcitations.shift();
        stringWobble[excitation.index] = Math.max(stringWobble[excitation.index], excitation.velocity);
      }
      wobble *= Math.pow(0.025, dt);
      recoil *= Math.pow(0.006, dt);
      const idleZ = reducedMotion ? 0 : Math.sin(time * 0.9) * 0.006;
      const idleX = reducedMotion ? 0 : Math.sin(time * 0.65) * 0.003;
      const playRecoil = reducedMotion ? 0 : Math.sin(time * 24) * recoil * 0.012 * recoilDirection;
      body.rotation.z = basePose.rz + playRecoil + Math.sin(time * 26) * wobble * 0.016 + (wobble < 0.05 ? idleZ : 0);
      body.rotation.x = basePose.rx + Math.sin(time * 20) * wobble * 0.008 + (wobble < 0.05 ? idleX : 0);
      body.rotation.y = basePose.ry;
      for (let i = 0; i < strings.length; i++) {
        const str = strings[i];
        stringWobble[i] *= Math.pow(0.012, dt);
        const movement = stringWobble[i];
        const shimmer = !reducedMotion && movement < 0.02
          ? Math.sin(time * 3.2 + str.userData.phase) * 0.0008
          : 0;
        str.position.x = str.userData.baseX + Math.sin(time * 55 + str.userData.phase) * movement * 0.012 + shimmer;
      }
    },
  };
}
