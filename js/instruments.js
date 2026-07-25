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
function lacquer(color, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.28,
    metalness: 0.22,
    clearcoat: 0.7,
    clearcoatRoughness: 0.16,
    ...opts,
  });
}
function guitarWoodTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#c98d3d';
  x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 48; i++) {
    const y = (i / 48) * 512;
    const shade = 0.82 + Math.sin(i * 0.7) * 0.1 + Math.random() * 0.08;
    x.strokeStyle = `rgba(${90 * shade | 0},${48 * shade | 0},${18 * shade | 0},${0.18 + Math.random() * 0.2})`;
    x.lineWidth = 1 + Math.random() * 2;
    x.beginPath();
    x.moveTo(0, y);
    x.bezierCurveTo(160, y + Math.random() * 10 - 5, 340, y + Math.random() * 10 - 5, 512, y);
    x.stroke();
  }
  for (let i = 0; i < 7; i++) {
    const cx = 80 + i * 60;
    x.strokeStyle = 'rgba(70,35,12,.22)';
    x.lineWidth = 2;
    x.beginPath();
    x.ellipse(cx, 260 + (i % 3) * 40, 18, 70, 0.1, 0, Math.PI * 2);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
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
  const shellMat = lacquer(PURPLE, { roughness: 0.32, metalness: 0.28, clearcoat: 0.55 });
  const headMat = std(CREAM, { roughness: 0.78, metalness: 0.04 });
  const goldMetal = metal(GOLD, 0.26);
  goldMetal.emissive = new THREE.Color(GOLD);
  goldMetal.emissiveIntensity = 0.07;
  const chrome = metal(0xd9d9e2, 0.18);
  const darkMetal = metal(0x2c2c34, 0.4);

  const parts = { cymbals: [] };
  const anim = { snare: 0, tom1: 0, tom2: 0, floor: 0, kick: 0, hihat: 0, crash: 0 };

  // ---- kick drum (axis towards audience, +z) ----
  const kick = new THREE.Group();
  const logoCanvas = document.createElement('canvas');
  const logoSize = 1024;
  logoCanvas.width = logoCanvas.height = logoSize;
  const lc = logoCanvas.getContext('2d');
  const logoTex = new THREE.CanvasTexture(logoCanvas);
  logoTex.colorSpace = THREE.SRGBColorSpace;
  logoTex.anisotropy = 8;

  function paintKickLogo() {
    const s = logoSize;
    const cx = s / 2;
    const cy = s / 2;
    lc.clearRect(0, 0, s, s);

    // Soft cream disc — clipped so the square canvas never shows corners.
    lc.save();
    lc.beginPath();
    lc.arc(cx, cy, s * 0.498, 0, Math.PI * 2);
    lc.clip();
    const fill = lc.createRadialGradient(cx, cy * 0.92, s * 0.08, cx, cy, s * 0.5);
    fill.addColorStop(0, '#fffaf2');
    fill.addColorStop(0.7, '#f5ebe0');
    fill.addColorStop(1, '#e8d5c4');
    lc.fillStyle = fill;
    lc.fillRect(0, 0, s, s);

    // Double brand ring, inset from the hoop
    lc.strokeStyle = 'rgba(158, 51, 202, 0.92)';
    lc.lineWidth = s * 0.013;
    lc.beginPath();
    lc.arc(cx, cy, s * 0.405, 0, Math.PI * 2);
    lc.stroke();
    lc.strokeStyle = 'rgba(209, 161, 59, 0.82)';
    lc.lineWidth = s * 0.0055;
    lc.beginPath();
    lc.arc(cx, cy, s * 0.438, 0, Math.PI * 2);
    lc.stroke();

    // Centered lockup matching the intro mark
    lc.textAlign = 'center';
    lc.textBaseline = 'middle';
    lc.fillStyle = '#6b1f8c';
    lc.font = `italic 900 ${Math.round(s * 0.1)}px "Playfair Display", Georgia, serif`;
    lc.fillText('ART VIBE', cx, cy - s * 0.012);

    lc.fillStyle = '#D1A13B';
    lc.font = `600 ${Math.round(s * 0.038)}px "Unbounded", sans-serif`;
    const studio = 'STUDIO';
    const studioGap = s * 0.026;
    let studioWidth = 0;
    for (const ch of studio) studioWidth += lc.measureText(ch).width;
    studioWidth += studioGap * (studio.length - 1);
    let sx = cx - studioWidth / 2;
    const sy = cy + s * 0.1;
    for (const ch of studio) {
      const w = lc.measureText(ch).width;
      lc.fillText(ch, sx + w / 2, sy);
      sx += w + studioGap;
    }
    lc.restore();

    logoTex.needsUpdate = true;
  }
  paintKickLogo();

  const logoMat = new THREE.MeshStandardMaterial({
    map: logoTex,
    roughness: 0.82,
    metalness: 0.04,
  });
  const kickShell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.5, 48, 1, false),
    [shellMat, headMat, headMat],
  );
  kickShell.rotation.x = Math.PI / 2;
  kick.add(kickShell);
  for (const s of [-1, 1]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.555, 0.028, 10, 40), goldMetal);
    hoop.position.z = s * 0.25;
    kick.add(hoop);
  }
  // Front disc (CircleGeometry) keeps UV orientation upright.
  const logoHead = new THREE.Mesh(new THREE.CircleGeometry(0.5, 64), logoMat);
  logoHead.position.z = 0.252;
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
    refreshLogo: paintKickLogo,
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
      parts.hihatTop.rotation.z = -0.03 + Math.sin(time * 1.7) * 0.01;
      parts.crash.rotation.z = -0.12 - Math.sin(time * 22) * anim.crash * 0.14 + Math.sin(time * 1.2) * 0.012;
      parts.crash.rotation.x = Math.sin(time * 17) * anim.crash * 0.08 + Math.sin(time * 0.9) * 0.01;
    },
  };
}

// ============================================================
// UPRIGHT PIANO (playable keys)
// ============================================================
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
  const pageMat = std(CREAM, { roughness: 0.88 });
  const sheetPages = [];
  for (const s of [-1, 1]) {
    const page = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.005, 0.24), pageMat);
    page.position.set(s * 0.155, 1.31, 0.35);
    page.rotation.x = -0.5;
    page.rotation.y = s * -0.14;
    page.userData.baseRotY = page.rotation.y;
    page.userData.side = s;
    piano.add(page);
    sheetPages.push(page);
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
    update(dt, t = 0) {
      for (const k of keys) {
        const u = k.userData;
        u.press = Math.max(0, u.press - dt * 5);
        const dip = (u.black ? 0.016 : 0.02) * Math.min(1, u.press * 1.4);
        k.position.y = u.baseY - dip;
      }
      for (const page of sheetPages) {
        page.rotation.y = page.userData.baseRotY + Math.sin(t * 1.4 + page.userData.side) * 0.018;
      }
      trimMat.emissiveIntensity = 0.06 + Math.sin(t * 1.8) * 0.035;
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

  const woodMap = guitarWoodTexture();
  const woodMat = std(0xc98d3d, { map: woodMap, roughness: 0.42, metalness: 0.08 });
  const woodDark = std(0x5a3a1c, { roughness: 0.48, metalness: 0.1 });
  const purpleMat = lacquer(PURPLE_DARK, { roughness: 0.36, clearcoat: 0.4 });

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
  for (let f = 1; f <= FRET_COUNT; f++) {
    const fret = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.005, 0.014), fretMat);
    fret.position.set(0, fretY(f), 0.082);
    body.add(fret);
  }
  // position markers (3, 5, 7, 9, 12)
  const dotMat = std(0xf5efe3, { roughness: 0.55 });
  for (const f of [3, 5, 7, 9, 12]) {
    const y = (fretY(f - 1) + fretY(f)) * 0.5;
    if (f === 12) {
      for (const sx of [-0.018, 0.018]) {
        const d = new THREE.Mesh(new THREE.CircleGeometry(0.006, 10), dotMat);
        d.position.set(sx, y, 0.082);
        body.add(d);
      }
    } else {
      const d = new THREE.Mesh(new THREE.CircleGeometry(0.007, 10), dotMat);
      d.position.set(0, y, 0.082);
      body.add(d);
    }
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

  // Strings + playable zones: neck frets change pitch; body taps = open strings.
  const stringMat = metal(0xe8e8f0, 0.2);
  const strings = [];
  const stringWobble = Array(6).fill(0);
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
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
      0.0032, stringMat, 5);
    str.userData.baseX = str.position.x;
    str.userData.phase = i * 1.3;
    str.userData.stringIndex = i;
    str.userData.stringFreq = OPEN_FREQS[i];
    str.userData.fret = 0;
    body.add(str);
    strings.push(str);

    // Open-string pluck pad over the soundhole / lower bout
    const openHit = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.42, 0.05), hitMat);
    openHit.position.set(stringXAt(i, 0.02), 0.02, 0.11);
    openHit.userData.stringIndex = i;
    openHit.userData.stringFreq = OPEN_FREQS[i];
    openHit.userData.fret = 0;
    body.add(openHit);

    // One hit cell per fret (fingerboard behind that fret)
    for (let f = 1; f <= FRET_COUNT; f++) {
      const y0 = fretY(f - 1);
      const y1 = fretY(f);
      const mid = (y0 + y1) * 0.5;
      const h = Math.max(0.018, y0 - y1);
      const cell = new THREE.Mesh(new THREE.BoxGeometry(0.028, h * 0.92, 0.04), hitMat);
      cell.position.set(stringXAt(i, mid), mid, 0.105);
      cell.userData.stringIndex = i;
      cell.userData.fret = f;
      cell.userData.stringFreq = OPEN_FREQS[i] * (2 ** (f / 12));
      body.add(cell);
    }
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
  guitar.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = o.material !== hitMat;
  });

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
      const idleZ = Math.sin(time * 0.9) * 0.01;
      const idleX = Math.sin(time * 0.65) * 0.006;
      body.rotation.z = Math.sin(time * 26) * wobble * 0.05 + (wobble < 0.05 ? idleZ : 0);
      body.rotation.x = -0.14 + Math.sin(time * 20) * wobble * 0.02 + (wobble < 0.05 ? idleX : 0);
      for (let i = 0; i < strings.length; i++) {
        const str = strings[i];
        stringWobble[i] *= Math.pow(0.012, dt);
        const movement = Math.max(wobble, stringWobble[i]);
        const shimmer = movement < 0.02 ? Math.sin(time * 3.2 + str.userData.phase) * 0.0012 : 0;
        str.position.x = str.userData.baseX + Math.sin(time * 55 + str.userData.phase) * movement * 0.012 + shimmer;
      }
    },
  };
}

// ============================================================
// VINTAGE MICROPHONE
// ============================================================
export function buildMic() {
  const mic = new THREE.Group();
  const chrome = metal(0xd9d9e2, 0.14);
  chrome.emissive = new THREE.Color(0xffffff);
  chrome.emissiveIntensity = 0.045;
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
      const idleNod = Math.sin(time * 0.85) * 0.02;
      const idleRoll = Math.sin(time * 0.6) * 0.012;
      headGroup.rotation.x = -0.18 + Math.sin(time * 18) * bob * 0.16 + idleNod;
      headGroup.rotation.z = Math.sin(time * 14) * bob * 0.1 + idleRoll;
      if (pulseT > 0) {
        pulseT = Math.max(0, pulseT - dt * 1.4);
        const p = 1 - pulseT;
        pulse.scale.setScalar(1 + p * 3.2);
        pulseMat.opacity = pulseT * 0.7;
      }
    },
  };
}
