// ============================================================
// ART VIBE — procedural 3D instruments (Three.js primitives)
// ============================================================
import * as THREE from 'three';

const PURPLE = 0x9E33CA;
const PURPLE_DARK = 0x5c1876;
const GOLD = 0xD1A13B;
const CREAM = 0xFDFBF7;
const INK = 0x17121c;

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15, ...opts });
}
function metal(color, roughness = 0.28) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.9 });
}
function cylinderBetween(a, b, r, mat, segments = 8) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, segments), mat);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}
function markInteract(root, data) {
  root.traverse((o) => { if (o.isMesh) Object.assign(o.userData, data); });
}

// ============================================================
// DRUM KIT
// ============================================================
export function buildDrumKit() {
  const kit = new THREE.Group();
  const shellMat = std(PURPLE, { roughness: 0.35 });
  const headMat = std(CREAM, { roughness: 0.85 });
  const goldMetal = metal(GOLD, 0.3);
  const chrome = metal(0xd9d9e2, 0.22);
  const darkMetal = metal(0x2c2c34, 0.4);

  const parts = { cymbals: [] };
  const anim = { snare: 0, tom1: 0, tom2: 0, floor: 0, kick: 0, hihat: 0, crash: 0 };

  // ---- kick drum (axis towards audience, +z) ----
  const kick = new THREE.Group();
  const kickShell = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 36, 1, false), [shellMat, headMat, headMat]);
  kickShell.rotation.x = Math.PI / 2;
  kick.add(kickShell);
  for (const s of [-1, 1]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.555, 0.028, 10, 40), goldMetal);
    hoop.position.z = s * 0.25;
    kick.add(hoop);
  }
  // front head logo
  const logoCanvas = document.createElement('canvas');
  logoCanvas.width = logoCanvas.height = 256;
  const lc = logoCanvas.getContext('2d');
  lc.fillStyle = '#FDFBF7'; lc.fillRect(0, 0, 256, 256);
  lc.strokeStyle = '#9E33CA'; lc.lineWidth = 6;
  lc.beginPath(); lc.arc(128, 128, 108, 0, Math.PI * 2); lc.stroke();
  lc.fillStyle = '#9E33CA';
  lc.font = 'italic 900 52px "Playfair Display", Georgia, serif';
  lc.textAlign = 'center'; lc.textBaseline = 'middle';
  lc.fillText('ART VIBE', 128, 118);
  lc.fillStyle = '#D1A13B';
  lc.font = '700 22px "Unbounded", sans-serif';
  lc.fillText('STUDIO', 128, 168);
  const logoTex = new THREE.CanvasTexture(logoCanvas);
  logoTex.colorSpace = THREE.SRGBColorSpace;
  const logoHead = new THREE.Mesh(
    new THREE.CircleGeometry(0.52, 36),
    new THREE.MeshStandardMaterial({ map: logoTex, roughness: 0.85 })
  );
  logoHead.position.z = 0.251;
  kick.add(logoHead);
  kick.position.set(0, 0.58, 0);
  markInteract(kick, { instrument: 'drums', part: 'kick' });
  parts.kick = kick;
  kit.add(kick);

  // ---- snare on stand ----
  const snare = new THREE.Group();
  const snareShell = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.2, 28), [goldMetal, headMat, headMat]);
  snare.add(snareShell);
  const snareStand = cylinderBetween(new THREE.Vector3(0, -0.75, 0), new THREE.Vector3(0, -0.1, 0), 0.02, darkMetal);
  snare.add(snareStand);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    snare.add(cylinderBetween(
      new THREE.Vector3(0, -0.55, 0),
      new THREE.Vector3(Math.cos(a) * 0.3, -0.78, Math.sin(a) * 0.3), 0.014, darkMetal));
  }
  // Tuck the snare into the playable pocket between the kick, throne and
  // hi-hat instead of leaving it out on the audience-facing front line.
  snare.position.set(0.7, 0.88, -0.05);
  markInteract(snare, { instrument: 'drums', part: 'snare' });
  parts.snare = snare;
  kit.add(snare);

  // ---- mounted toms above kick ----
  const mkTom = (r, h, x, y, z, tilt) => {
    const t = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 26), [shellMat, headMat, headMat]);
    t.add(shell);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.02, 8, 30), chrome);
    rim.rotation.x = Math.PI / 2; rim.position.y = h / 2;
    t.add(rim);
    t.position.set(x, y, z);
    t.rotation.x = tilt;
    return t;
  };
  const tom1 = mkTom(0.26, 0.28, 0.3, 1.3, 0.12, -0.42);
  const tom2 = mkTom(0.29, 0.3, -0.32, 1.32, 0.1, -0.42);
  markInteract(tom1, { instrument: 'drums', part: 'tom1' });
  markInteract(tom2, { instrument: 'drums', part: 'tom2' });
  parts.tom1 = tom1; parts.tom2 = tom2;
  kit.add(tom1, tom2);

  // ---- floor tom ----
  const floorTom = new THREE.Group();
  const ftShell = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.44, 28), [shellMat, headMat, headMat]);
  floorTom.add(ftShell);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    floorTom.add(cylinderBetween(
      new THREE.Vector3(Math.cos(a) * 0.3, -0.2, Math.sin(a) * 0.3),
      new THREE.Vector3(Math.cos(a) * 0.38, -0.72, Math.sin(a) * 0.38), 0.014, chrome));
  }
  floorTom.position.set(-0.95, 0.74, 0.42);
  markInteract(floorTom, { instrument: 'drums', part: 'floor' });
  parts.floor = floorTom;
  kit.add(floorTom);

  // ---- cymbals: hi-hat + crash ----
  const mkCymbal = (r) => {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r, 0.018, 36), goldMetal);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(r * 0.22, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), goldMetal);
    bell.position.y = 0.012;
    g.add(disc, bell);
    return g;
  };

  const hihat = new THREE.Group();
  hihat.add(cylinderBetween(new THREE.Vector3(0, -1.0, 0), new THREE.Vector3(0, 0, 0), 0.018, darkMetal));
  const hatBot = mkCymbal(0.28); hatBot.position.y = 0;
  const hatTop = mkCymbal(0.28); hatTop.position.y = 0.045; hatTop.rotation.z = -0.03;
  hihat.add(hatBot, hatTop);
  hihat.position.set(1.08, 1.02, 0.3);
  markInteract(hihat, { instrument: 'drums', part: 'hihat' });
  parts.hihatTop = hatTop;
  kit.add(hihat);

  const crash = new THREE.Group();
  crash.add(cylinderBetween(new THREE.Vector3(0, -1.42, 0), new THREE.Vector3(0, 0, 0), 0.018, darkMetal));
  const crashCym = mkCymbal(0.36);
  crashCym.rotation.z = -0.12;
  crash.add(crashCym);
  crash.position.set(-1.42, 1.5, 0.1);
  markInteract(crash, { instrument: 'drums', part: 'crash' });
  parts.crash = crashCym;
  kit.add(crash);

  // ---- throne ----
  const throne = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.09, 20), std(INK, { roughness: 0.4 }));
  throne.add(seat);
  throne.add(cylinderBetween(new THREE.Vector3(0, -0.6, 0), new THREE.Vector3(0, -0.05, 0), 0.025, darkMetal));
  throne.position.set(0, 0.62, -1.05);
  kit.add(throne);

  kit.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });

  let time = 0;

  return {
    group: kit,
    label: 'Ударні',
    labelAnchor: new THREE.Vector3(0.5, 2.75, 0),
    hit(part) { anim[part] = 1; },
    update(dt) {
      time += dt;
      const decay = Math.pow(0.0001, dt); // fast spring back
      for (const k in anim) anim[k] *= decay;

      // head punches
      const s1 = 1 + anim.snare * 0.08; parts.snare.scale.set(s1, 1 - anim.snare * 0.12, s1);
      const k1 = 1 + anim.kick * 0.06; parts.kick.scale.set(k1, k1, 1);
      const t1 = 1 + anim.tom1 * 0.07; parts.tom1.scale.set(t1, 1 - anim.tom1 * 0.1, t1);
      const t2 = 1 + anim.tom2 * 0.07; parts.tom2.scale.set(t2, 1 - anim.tom2 * 0.1, t2);
      const f1 = 1 + anim.floor * 0.07; parts.floor.scale.set(f1, 1 - anim.floor * 0.1, f1);

      parts.hihatTop.position.y = 0.045 - anim.hihat * 0.03;
      parts.crash.rotation.z = -0.12 - Math.sin(time * 22) * anim.crash * 0.14;
      parts.crash.rotation.x = Math.sin(time * 17) * anim.crash * 0.08;
    },
  };
}

// ============================================================
// UPRIGHT PIANO (playable keys)
// ============================================================
export function buildPiano() {
  const piano = new THREE.Group();
  const bodyMat = std(0x241a2e, { roughness: 0.32, metalness: 0.25 }); // deep purple-black lacquer
  const trimMat = metal(GOLD, 0.35);

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
  // cheek blocks
  for (const s of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.36), bodyMat);
    cheek.position.set(s * 0.945, 0.66, 0.42);
    piano.add(cheek);
  }
  // pedals
  const lyre = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.06), bodyMat);
  lyre.position.set(0, 0.3, 0.24);
  piano.add(lyre);
  for (let i = -1; i <= 1; i++) {
    const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.12), trimMat);
    pedal.position.set(i * 0.09, 0.14, 0.3);
    piano.add(pedal);
  }
  // music book
  const standBoard = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.3), bodyMat);
  standBoard.position.set(0, 1.28, 0.32);
  standBoard.rotation.x = -0.5;
  piano.add(standBoard);
  const pageMat = std(CREAM, { roughness: 0.9 });
  for (const s of [-1, 1]) {
    const page = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.005, 0.24), pageMat);
    page.position.set(s * 0.155, 1.31, 0.35);
    page.rotation.x = -0.5;
    page.rotation.y = s * -0.14;
    piano.add(page);
    // note lines
    for (let l = 0; l < 3; l++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.002, 0.012), std(INK));
      line.position.set(s * 0.155, 1.315 + l * 0.028, 0.352 - l * 0.014);
      line.rotation.x = -0.5;
      line.rotation.y = s * -0.14;
      piano.add(line);
    }
  }

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

  let whiteIdx = 0;
  for (let oct = 0; oct < 2; oct++) {
    for (let w = 0; w < whitesPerOctave; w++) {
      const key = new THREE.Mesh(whiteGeom, std(CREAM, { roughness: 0.5 }));
      key.position.set(startX + whiteIdx * (WHITE_W + GAP), 0.645, 0.44);
      const semi = oct * 12 + semis[w];
      key.userData = { instrument: 'piano', freq: freqOf(semi), press: 0, baseY: 0.645, whiteIdx };
      piano.add(key);
      keys.push(key);

      if (blackAfter[w] && !(oct === 1 && w === 6)) {
        const bk = new THREE.Mesh(blackGeom, std(0x0d0a12, { roughness: 0.35 }));
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
  const lastKey = new THREE.Mesh(whiteGeom, std(CREAM, { roughness: 0.5 }));
  lastKey.position.set(startX + whiteIdx * (WHITE_W + GAP), 0.645, 0.44);
  lastKey.userData = { instrument: 'piano', freq: freqOf(24), press: 0, baseY: 0.645, whiteIdx };
  piano.add(lastKey);
  keys.push(lastKey);

  // bench
  const bench = new THREE.Group();
  const bSeat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.09, 0.34), bodyMat);
  bench.add(bSeat);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.5, 8), bodyMat);
    leg.position.set(sx * 0.44, -0.29, sz * 0.12);
    bench.add(leg);
  }
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
    update(dt) {
      for (const k of keys) {
        const u = k.userData;
        u.press = Math.max(0, u.press - dt * 5);
        const dip = (u.black ? 0.016 : 0.02) * Math.min(1, u.press * 1.4);
        k.position.y = u.baseY - dip;
      }
    },
  };
}

// ============================================================
// ACOUSTIC GUITAR on a stand
// ============================================================
export function buildGuitar() {
  const guitar = new THREE.Group();       // floor anchor
  const body = new THREE.Group();         // the instrument itself (wobbles)
  guitar.add(body);

  const woodMat = std(0xc98d3d, { roughness: 0.45 });
  const woodDark = std(0x5a3a1c, { roughness: 0.5 });
  const purpleMat = std(PURPLE_DARK, { roughness: 0.4 });

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
  const bodyMesh = new THREE.Mesh(bodyGeom, woodMat);
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

  // bridge
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.025), woodDark);
  bridge.position.set(0, -0.27, holeZ);
  body.add(bridge);

  // neck + fretboard
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.78, 0.05), woodMat);
  neck.position.set(0, 0.83, 0.045);
  body.add(neck);
  const fretboard = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.78, 0.012), woodDark);
  fretboard.position.set(0, 0.83, 0.075);
  body.add(fretboard);
  for (let i = 0; i < 8; i++) {
    const fret = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.006, 0.014), metal(GOLD, 0.4));
    fret.position.set(0, 0.5 + i * 0.085, 0.076);
    body.add(fret);
  }

  // headstock + tuners
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.2, 0.045), woodDark);
  head.position.set(0, 1.3, 0.045);
  body.add(head);
  for (let i = 0; i < 3; i++) {
    for (const sd of [-1, 1]) {
      const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 8), metal(0xd9d9e2));
      peg.rotation.z = Math.PI / 2;
      peg.position.set(sd * 0.08, 1.24 + i * 0.06, 0.045);
      body.add(peg);
    }
  }

  // Strings are individually playable. Generous transparent hit strips keep
  // the real hairline geometry easy to tap on phones.
  const stringMat = metal(0xe8e8f0, 0.2);
  const strings = [];
  const stringFrequencies = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63];
  const stringWobble = Array(6).fill(0);
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  for (let i = 0; i < 6; i++) {
    const xt = -0.028 + i * 0.0112;
    const xb = -0.042 + i * 0.0168;
    const str = cylinderBetween(
      new THREE.Vector3(xb, -0.26, 0.1),
      new THREE.Vector3(xt, 1.33, 0.075),
      0.0032, stringMat, 5);
    str.userData.baseX = str.position.x;
    str.userData.phase = i * 1.3;
    str.userData.stringIndex = i;
    str.userData.stringFreq = stringFrequencies[i];
    body.add(str);
    strings.push(str);

    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.62, 0.055), hitMat);
    hit.position.set(-0.0875 + i * 0.035, 0.53, 0.105);
    hit.userData.stringIndex = i;
    hit.userData.stringFreq = stringFrequencies[i];
    body.add(hit);
  }

  // purple pickguard
  const guard = new THREE.Mesh(new THREE.CircleGeometry(0.09, 24, Math.PI * 1.05, Math.PI * 0.7), purpleMat);
  guard.position.set(0.06, 0.02, holeZ + 0.001);
  body.add(guard);

  // pose the instrument: leaning back on stand
  body.position.set(0, 0.62, 0);
  body.rotation.x = -0.14;
  body.rotation.y = 0.0;

  // ---- A-frame stand ----
  const standMat = metal(0x2c2c34, 0.45);
  const stand = new THREE.Group();
  stand.add(cylinderBetween(new THREE.Vector3(-0.3, 0, 0.22), new THREE.Vector3(-0.08, 0.6, -0.08), 0.02, standMat));
  stand.add(cylinderBetween(new THREE.Vector3(0.3, 0, 0.22), new THREE.Vector3(0.08, 0.6, -0.08), 0.02, standMat));
  stand.add(cylinderBetween(new THREE.Vector3(-0.3, 0.02, 0.22), new THREE.Vector3(0.3, 0.02, 0.22), 0.018, standMat));
  // cradle arms
  stand.add(cylinderBetween(new THREE.Vector3(-0.16, 0.3, 0.1), new THREE.Vector3(-0.16, 0.34, 0.26), 0.016, standMat));
  stand.add(cylinderBetween(new THREE.Vector3(0.16, 0.3, 0.1), new THREE.Vector3(0.16, 0.34, 0.26), 0.016, standMat));
  guitar.add(stand);

  markInteract(body, { instrument: 'guitar' });
  guitar.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  let wobble = 0, time = 0;

  return {
    group: guitar,
    label: 'Гітара',
    labelAnchor: new THREE.Vector3(0, 2.05, 0),
    strum() { wobble = 1; },
    pluck(index) { stringWobble[index] = 1; },
    update(dt) {
      time += dt;
      wobble *= Math.pow(0.02, dt);
      body.rotation.z = Math.sin(time * 26) * wobble * 0.05;
      body.rotation.x = -0.14 + Math.sin(time * 20) * wobble * 0.02;
      for (let i = 0; i < strings.length; i++) {
        const str = strings[i];
        stringWobble[i] *= Math.pow(0.012, dt);
        const movement = Math.max(wobble, stringWobble[i]);
        str.position.x = str.userData.baseX + Math.sin(time * 55 + str.userData.phase) * movement * 0.012;
      }
      // gentle idle sway
      if (wobble < 0.01) body.rotation.z = Math.sin(time * 0.9) * 0.006;
    },
  };
}

// ============================================================
// VINTAGE MICROPHONE
// ============================================================
export function buildMic() {
  const mic = new THREE.Group();
  const chrome = metal(0xd9d9e2, 0.18);
  const darkMetal = metal(0x2c2c34, 0.4);

  // round base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.05, 28), darkMetal);
  base.position.y = 0.025;
  mic.add(base);

  // pole + clutch
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.32, 10), chrome);
  pole.position.y = 0.71;
  mic.add(pole);
  const clutch = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.07, 10), metal(GOLD, 0.35));
  clutch.position.y = 1.38;
  mic.add(clutch);

  // head (tilts slightly back)
  const headGroup = new THREE.Group();
  const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.14, 8, 18), chrome);
  headGroup.add(capsule);
  // grille rings
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.097, 0.009, 8, 26), darkMetal);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.08 + i * 0.045;
    headGroup.add(ring);
  }
  // vertical ribs
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.2, 0.008), darkMetal);
    rib.position.set(Math.cos(a) * 0.096, 0, Math.sin(a) * 0.096);
    headGroup.add(rib);
  }
  // gold band
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.096, 0.014, 8, 26), metal(GOLD, 0.3));
  band.rotation.x = Math.PI / 2;
  band.position.y = -0.13;
  headGroup.add(band);
  // yoke
  const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.014, 8, 20, Math.PI), darkMetal);
  yoke.rotation.z = Math.PI;
  yoke.position.y = -0.16;
  headGroup.add(yoke);

  headGroup.position.y = 1.56;
  headGroup.rotation.x = -0.18;
  mic.add(headGroup);

  // feedback pulse ring on the floor
  const pulseMat = new THREE.MeshBasicMaterial({
    color: GOLD, transparent: true, opacity: 0, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pulse = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 8, 40), pulseMat);
  pulse.rotation.x = Math.PI / 2;
  pulse.position.y = 0.02;
  mic.add(pulse);

  const micHitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const lowHit = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.24, 0.65), micHitMat);
  lowHit.position.y = 0.12;
  mic.add(lowHit);
  const midHit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.76, 0.3), micHitMat);
  midHit.position.y = 0.86;
  mic.add(midHit);
  const highHit = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), micHitMat);
  highHit.position.y = 1.55;
  mic.add(highHit);

  markInteract(headGroup, { instrument: 'mic', vocalFreq: 392.0, vocalVowel: 2 });
  markInteract(pole, { instrument: 'mic', vocalFreq: 329.63, vocalVowel: 1 });
  markInteract(base, { instrument: 'mic', vocalFreq: 261.63, vocalVowel: 0 });
  markInteract(highHit, { instrument: 'mic', vocalFreq: 392.0, vocalVowel: 2 });
  markInteract(midHit, { instrument: 'mic', vocalFreq: 329.63, vocalVowel: 1 });
  markInteract(lowHit, { instrument: 'mic', vocalFreq: 261.63, vocalVowel: 0 });
  mic.traverse((o) => { if (o.isMesh && o !== pulse && o.material !== micHitMat) o.castShadow = true; });

  let bob = 0, pulseT = 0, time = 0;

  return {
    group: mic,
    label: 'Вокал',
    labelAnchor: new THREE.Vector3(0, 2.2, 0),
    sing() { bob = 1; pulseT = 1; },
    update(dt) {
      time += dt;
      bob *= Math.pow(0.02, dt);
      headGroup.rotation.x = -0.18 + Math.sin(time * 18) * bob * 0.16;
      headGroup.rotation.z = Math.sin(time * 14) * bob * 0.1;
      if (pulseT > 0) {
        pulseT = Math.max(0, pulseT - dt * 1.4);
        const p = 1 - pulseT;
        pulse.scale.setScalar(1 + p * 3.2);
        pulseMat.opacity = pulseT * 0.7;
      }
    },
  };
}
