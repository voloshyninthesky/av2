// ============================================================
// UPRIGHT PIANO
// A playable keybed: every white and black key is its own mesh carrying the
// note it sounds, which is what lets the pointer, the keyboard and the solved
// hand poses all address the same keys.
// ============================================================
import * as THREE from 'three';
import {
  GOLD,
  lacquer,
  metal,
  std,
} from './shared.js?v=20260808-06';

export function buildPiano() {
  const piano = new THREE.Group();
  const bodyMat = lacquer(0x241a2e, { roughness: 0.24, metalness: 0.28, clearcoat: 0.85, clearcoatRoughness: 0.12 });
  const trimMat = metal(GOLD, 0.28);
  trimMat.emissive = new THREE.Color(GOLD);
  trimMat.emissiveIntensity = 0.08;

  // cabinet
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.25, 0.58), bodyMat);
  cabinet.position.set(0, 1.245, 0);
  piano.add(cabinet);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.06, 0.64), bodyMat);
  lid.position.set(0, 1.9, 0.01);
  piano.add(lid);
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.14, 0.62), bodyMat);
  base.position.set(0, 0.55, 0);
  piano.add(base);
  // gold trim line
  const trim = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.025, 0.6), trimMat);
  trim.position.set(0, 1.845, 0.005);
  piano.add(trim);
  // key shelf
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.055, 0.36), bodyMat);
  shelf.position.set(0, 0.6, 0.42);
  piano.add(shelf);
  // lid border inset so the top reads as framed lacquer, not a void
  const lidInset = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.012, 0.5),
    lacquer(0x2e2138, { roughness: 0.22, metalness: 0.3, clearcoat: 0.9 }),
  );
  lidInset.position.set(0, 1.936, 0.01);
  piano.add(lidInset);
  // structural back posts + rail (visible from the focus camera's far side)
  const backWood = std(0x30202c, { roughness: 0.62, metalness: 0.06 });
  for (const px of [-0.62, 0, 0.62]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.05), backWood);
    post.position.set(px, 1.23, -0.31);
    piano.add(post);
  }
  const backRail = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.14, 0.05), backWood);
  backRail.position.set(0, 1.78, -0.31);
  piano.add(backRail);
  // recessed front panels with gold beading — classic upright cabinetry
  const panelMat = lacquer(0x1b1324, { roughness: 0.3, metalness: 0.2, clearcoat: 0.7 });
  for (const px of [-0.52, 0.52]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.92, 0.02), panelMat);
    panel.position.set(px, 1.245, 0.3);
    piano.add(panel);
    const panelFrame = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.98, 0.008), trimMat);
    panelFrame.position.set(px, 1.245, 0.288);
    piano.add(panelFrame);
  }
  // top molding + fallboard above the keys
  const molding = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.05, 0.66), bodyMat);
  molding.position.set(0, 1.82, 0.02);
  piano.add(molding);
  // open fallboard resting back against the cabinet, well clear of the keys
  const fallboard = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.16, 0.05), panelMat);
  fallboard.position.set(0, 0.8, 0.33);
  fallboard.rotation.x = -1.1;
  piano.add(fallboard);
  // red key felt line
  const felt = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.02, 0.035),
    std(0x8e1f3f, { roughness: 0.85, metalness: 0 }),
  );
  felt.position.set(0, 0.667, 0.335);
  piano.add(felt);
  // brass casters
  const casterMat = metal(0x9a7428, 0.4);
  for (const [cx, cz] of [[-0.95, 0.24], [0.95, 0.24], [-0.95, -0.24], [0.95, -0.24]]) {
    const caster = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 10), casterMat);
    caster.position.set(cx, 0.46, cz);
    piano.add(caster);
  }
  // cheek blocks
  const cheeks = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.07, 0.1, 0.36),
    bodyMat,
    2,
  );
  const pianoInstance = new THREE.Object3D();
  let pianoInstanceIndex = 0;
  for (const s of [-1, 1]) {
    pianoInstance.position.set(s * 0.945, 0.66, 0.42);
    pianoInstance.rotation.set(0, 0, 0);
    pianoInstance.updateMatrix();
    cheeks.setMatrixAt(pianoInstanceIndex++, pianoInstance.matrix);
  }
  cheeks.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  cheeks.computeBoundingSphere();
  piano.add(cheeks);
  // pedals
  const lyre = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.06), bodyMat);
  lyre.position.set(0, 0.3, 0.24);
  piano.add(lyre);
  const pedals = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.05, 0.02, 0.12),
    trimMat,
    3,
  );
  for (let i = -1; i <= 1; i++) {
    pianoInstance.position.set(i * 0.09, 0.14, 0.3);
    pianoInstance.rotation.set(0, 0, 0);
    pianoInstance.updateMatrix();
    pedals.setMatrixAt(i + 1, pianoInstance.matrix);
  }
  pedals.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  pedals.computeBoundingSphere();
  piano.add(pedals);
  // ---- keys: two octaves C4..C6 ----
  const WHITE_W = 0.118, WHITE_D = 0.3, GAP = 0.004;
  const whiteGeom = new THREE.BoxGeometry(WHITE_W, 0.035, WHITE_D);
  const blackGeom = new THREE.BoxGeometry(0.07, 0.05, 0.19);
  const keys = [];
  const whitesPerOctave = 7;
  const totalWhites = 15; // C..C two octaves + final C
  const startX = -((totalWhites * (WHITE_W + GAP)) / 2) + (WHITE_W + GAP) / 2;

  const semis = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
  const blackAfter = [true, true, false, true, true, true, false]; // black key after this white?
  const C4 = 261.63;
  const freqOf = (semisFromC4) => C4 * Math.pow(2, semisFromC4 / 12);

  const whiteKeyOpts = { roughness: 0.3, metalness: 0.04 };
  const blackKeyOpts = { roughness: 0.22, metalness: 0.1 };
  let whiteIdx = 0;
  for (let oct = 0; oct < 2; oct++) {
    for (let w = 0; w < whitesPerOctave; w++) {
      const key = new THREE.Mesh(whiteGeom, std(0xfdf8ec, whiteKeyOpts));
      key.position.set(startX + whiteIdx * (WHITE_W + GAP), 0.645, 0.44);
      const semi = oct * 12 + semis[w];
      key.userData = { instrument: 'piano', freq: freqOf(semi), press: 0, baseY: 0.645, whiteIdx };
      piano.add(key);
      keys.push(key);

      if (blackAfter[w] && !(oct === 1 && w === 6)) {
        const bk = new THREE.Mesh(blackGeom, std(0x0d0a12, blackKeyOpts));
        bk.position.set(startX + whiteIdx * (WHITE_W + GAP) + (WHITE_W + GAP) / 2, 0.672, 0.385);
        const bSemi = oct * 12 + semis[w] + 1;
        bk.userData = { instrument: 'piano', freq: freqOf(bSemi), press: 0, baseY: 0.672, black: true };
        piano.add(bk);
        keys.push(bk);
      }
      whiteIdx++;
    }
  }
  // final C6
  const lastKey = new THREE.Mesh(whiteGeom, std(0xfdf8ec, whiteKeyOpts));
  lastKey.position.set(startX + whiteIdx * (WHITE_W + GAP), 0.645, 0.44);
  lastKey.userData = { instrument: 'piano', freq: freqOf(24), press: 0, baseY: 0.645, whiteIdx };
  piano.add(lastKey);
  keys.push(lastKey);

  // bench with a velvet cushion + gold piping
  const bench = new THREE.Group();
  const bSeat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.09, 0.34), bodyMat);
  bench.add(bSeat);
  const cushion = new THREE.Mesh(
    new THREE.BoxGeometry(0.96, 0.05, 0.3),
    std(0x5c1d40, { roughness: 0.82, metalness: 0 }),
  );
  cushion.position.y = 0.065;
  bench.add(cushion);
  const pipingFront = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.012, 0.012), trimMat);
  pipingFront.position.set(0, 0.045, 0.152);
  bench.add(pipingFront);
  const benchLegs = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.025, 0.02, 0.5, 8),
    bodyMat,
    4,
  );
  let benchLegIndex = 0;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    pianoInstance.position.set(sx * 0.44, -0.29, sz * 0.12);
    pianoInstance.rotation.set(0, 0, 0);
    pianoInstance.updateMatrix();
    benchLegs.setMatrixAt(benchLegIndex++, pianoInstance.matrix);
  }
  benchLegs.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  benchLegs.computeBoundingSphere();
  bench.add(benchLegs);
  bench.position.set(0, 0.54, 1.15);
  piano.add(bench);

  piano.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    if (!o.userData.instrument) Object.assign(o.userData, { instrument: 'piano', focusOnly: true });
  });

  return {
    group: piano,
    keys,
    label: 'Піаніно',
    labelAnchor: new THREE.Vector3(0, 2.45, 0.2),
    press(key) { key.userData.press = 1; },
    hold(key, held) {
      if (!key?.userData) return;
      key.userData.held = Boolean(held);
      if (held) key.userData.press = 1;
    },
    update(dt, t = 0) {
      for (const k of keys) {
        const u = k.userData;
        u.press = u.held ? 1 : Math.max(0, u.press - dt * 5);
        const dip = (u.black ? 0.016 : 0.02) * Math.min(1, u.press * 1.4);
        k.position.y = u.baseY - dip;
      }
      trimMat.emissiveIntensity = 0.06 + Math.sin(t * 1.8) * 0.035;
    },
  };
}
