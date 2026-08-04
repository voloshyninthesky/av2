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
  // spruce grain under a honey-to-tobacco sunburst vignette
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#d29a48';
  x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 64; i++) {
    const y = (i / 64) * 512;
    const shade = 0.82 + Math.sin(i * 0.7) * 0.1 + Math.random() * 0.08;
    x.strokeStyle = `rgba(${96 * shade | 0},${52 * shade | 0},${20 * shade | 0},${0.14 + Math.random() * 0.16})`;
    x.lineWidth = 1 + Math.random() * 1.6;
    x.beginPath();
    x.moveTo(0, y);
    x.bezierCurveTo(160, y + Math.random() * 8 - 4, 340, y + Math.random() * 8 - 4, 512, y);
    x.stroke();
  }
  for (let i = 0; i < 7; i++) {
    const cx = 80 + i * 60;
    x.strokeStyle = 'rgba(70,35,12,.18)';
    x.lineWidth = 2;
    x.beginPath();
    x.ellipse(cx, 260 + (i % 3) * 40, 18, 70, 0.1, 0, Math.PI * 2);
    x.stroke();
  }
  // sunburst: warm center, tobacco rim
  const burst = x.createRadialGradient(256, 256, 90, 256, 256, 330);
  burst.addColorStop(0, 'rgba(255,196,110,.14)');
  burst.addColorStop(0.55, 'rgba(120,58,18,.12)');
  burst.addColorStop(0.85, 'rgba(64,28,8,.5)');
  burst.addColorStop(1, 'rgba(38,16,5,.72)');
  x.fillStyle = burst;
  x.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
// glam sparkle wrap for drum shells: deep purple base + metal-flake speckle
// with a vertical stage-light sheen band
function sparkleWrapTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  const base = x.createLinearGradient(0, 0, 512, 0);
  base.addColorStop(0, '#43125e');
  base.addColorStop(0.35, '#6b1f96');
  base.addColorStop(0.5, '#7d2ba8');
  base.addColorStop(0.65, '#6b1f96');
  base.addColorStop(1, '#43125e');
  x.fillStyle = base;
  x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1100; i++) {
    const px = Math.random() * 512;
    const py = Math.random() * 512;
    const bright = Math.random();
    const size = 0.6 + Math.random() * 1.7;
    x.fillStyle = bright > 0.82
      ? `rgba(255,240,255,${0.5 + Math.random() * 0.5})`
      : (bright > 0.5
        ? `rgba(216,150,255,${0.3 + Math.random() * 0.4})`
        : `rgba(255,214,140,${0.25 + Math.random() * 0.35})`);
    x.fillRect(px, py, size, size);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// lathed bronze cymbal top: concentric turning rings + darker bell
function cymbalTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  const base = x.createRadialGradient(256, 256, 20, 256, 256, 256);
  base.addColorStop(0, '#8a6420');
  base.addColorStop(0.22, '#c89a3e');
  base.addColorStop(0.6, '#e0b45a');
  base.addColorStop(0.85, '#c2933c');
  base.addColorStop(1, '#a87e30');
  x.fillStyle = base;
  x.fillRect(0, 0, 512, 512);
  for (let r = 26; r < 255; r += 2.5) {
    x.strokeStyle = `rgba(${r % 5 < 2.5 ? '255,228,160' : '120,86,28'},${0.05 + Math.random() * 0.1})`;
    x.lineWidth = 1 + Math.random();
    x.beginPath();
    x.arc(256, 256, r, 0, Math.PI * 2);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// coated drum head: warm cream mylar with a faint ring and center wear
function drumHeadTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const base = x.createRadialGradient(128, 128, 16, 128, 128, 128);
  base.addColorStop(0, '#f3ead9');
  base.addColorStop(0.55, '#ece0cc');
  base.addColorStop(0.9, '#dfd0b8');
  base.addColorStop(1, '#d2c2a8');
  x.fillStyle = base;
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,252,244' : '196,180,152'},${0.06 + Math.random() * 0.08})`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 1.4, 1.4);
  }
  x.strokeStyle = 'rgba(140,120,92,.3)';
  x.lineWidth = 3;
  x.beginPath();
  x.arc(128, 128, 96, 0, Math.PI * 2);
  x.stroke();
  const wear = x.createRadialGradient(128, 140, 4, 128, 140, 44);
  wear.addColorStop(0, 'rgba(150,128,98,.28)');
  wear.addColorStop(1, 'rgba(150,128,98,0)');
  x.fillStyle = wear;
  x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
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
  const shellMat = lacquer(0xffffff, { roughness: 0.3, metalness: 0.18, clearcoat: 0.75, clearcoatRoughness: 0.14 });
  shellMat.map = sparkleWrapTexture();
  const headMat = std(CREAM, { roughness: 0.72, metalness: 0.02 });
  headMat.map = drumHeadTexture();
  const goldMetal = metal(GOLD, 0.26);
  goldMetal.emissive = new THREE.Color(GOLD);
  goldMetal.emissiveIntensity = 0.07;
  const cymbalMat = metal(0xe0b45a, 0.34);
  cymbalMat.map = cymbalTexture();
  const chrome = metal(0xd9d9e2, 0.18);
  const darkMetal = metal(0x2c2c34, 0.4);
  const rubberMat = std(0x14101a, { roughness: 0.9, metalness: 0.02 });

  // chrome tension lugs around each shell — the hardware detail that makes
  // procedural drums read as real drums
  const lugGeometry = new THREE.CapsuleGeometry(0.016, 0.05, 4, 8);
  function addLugs(group, radius, count, axis = 'y', offset = 0) {
    const lugs = new THREE.InstancedMesh(lugGeometry, chrome, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + 0.2;
      if (axis === 'y') {
        v.set(Math.cos(a) * radius, offset, Math.sin(a) * radius);
        e.set(0, -a, 0);
      } else {
        // kick drum: axis along z, lugs lie along that axis around the hoop
        v.set(Math.cos(a) * radius, Math.sin(a) * radius, offset);
        e.set(Math.PI / 2, 0, 0);
      }
      q.setFromEuler(e);
      m.compose(v, q, s);
      lugs.setMatrixAt(i, m);
    }
    lugs.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    lugs.computeBoundingSphere();
    group.add(lugs);
  }

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
  addLugs(kick, 0.585, 8, 'z', 0.19);
  // spurs keep the kick from "floating": angled legs + rubber feet
  for (const sd of [-1, 1]) {
    kick.add(cylinderBetween(
      new THREE.Vector3(sd * 0.42, -0.28, 0.18),
      new THREE.Vector3(sd * 0.58, -0.56, 0.3), 0.014, chrome));
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), rubberMat);
    foot.position.set(sd * 0.58, -0.56, 0.3);
    kick.add(foot);
  }
  // kick pedal: footboard + beater against the batter head
  const pedalBoard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.3), darkMetal);
  pedalBoard.position.set(0, -0.55, -0.46);
  pedalBoard.rotation.x = -0.3;
  kick.add(pedalBoard);
  kick.add(cylinderBetween(
    new THREE.Vector3(0, -0.52, -0.34),
    new THREE.Vector3(0, -0.12, -0.3), 0.01, chrome));
  const beater = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), std(0xe8dcc8, { roughness: 0.8 }));
  beater.position.set(0, -0.1, -0.29);
  kick.add(beater);
  kick.position.set(0, 0.58, 0);
  markInteract(kick, { instrument: 'drums', part: 'kick' });
  parts.kick = kick;
  kit.add(kick);

  // ---- snare on stand ----
  const snare = new THREE.Group();
  const snareShell = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.2, 28), [goldMetal, headMat, headMat]);
  snare.add(snareShell);
  addLugs(snare, 0.315, 8, 'y', 0);
  // strainer box on the shell side
  const strainer = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.09, 0.05), chrome);
  strainer.position.set(-0.3, -0.01, 0.1);
  snare.add(strainer);
  const snareStand = cylinderBetween(new THREE.Vector3(0, -0.75, 0), new THREE.Vector3(0, -0.1, 0), 0.02, darkMetal);
  snare.add(snareStand);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    snare.add(cylinderBetween(
      new THREE.Vector3(0, -0.55, 0),
      new THREE.Vector3(Math.cos(a) * 0.3, -0.78, Math.sin(a) * 0.3), 0.014, darkMetal));
  }
  // Pull the playing surface back toward the drummer while preserving enough
  // side-to-side clearance from the kick and hi-hat.
  snare.position.set(0.65, 0.88, -0.48);
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
    addLugs(t, r + 0.008, 6, 'y', 0);
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
  addLugs(floorTom, 0.345, 8, 'y', 0.05);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    floorTom.add(cylinderBetween(
      new THREE.Vector3(Math.cos(a) * 0.3, -0.2, Math.sin(a) * 0.3),
      new THREE.Vector3(Math.cos(a) * 0.38, -0.72, Math.sin(a) * 0.38), 0.014, chrome));
  }
  floorTom.position.set(-0.88, 0.74, -0.22);
  markInteract(floorTom, { instrument: 'drums', part: 'floor' });
  parts.floor = floorTom;
  kit.add(floorTom);

  // ---- cymbals: hi-hat + crash ----
  const mkCymbal = (r) => {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r, 0.018, 36), cymbalMat);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(r * 0.22, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), goldMetal);
    bell.position.y = 0.012;
    // felt washer + wing nut holding the cymbal on its stand
    const felt = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.14, r * 0.14, 0.016, 10), rubberMat);
    felt.position.y = r * 0.2;
    const wingNut = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 6), chrome);
    wingNut.position.y = r * 0.2 + 0.02;
    g.add(disc, bell, felt, wingNut);
    return g;
  };

  const hihat = new THREE.Group();
  hihat.add(cylinderBetween(new THREE.Vector3(0, -1.0, 0), new THREE.Vector3(0, 0, 0), 0.018, darkMetal));
  const hatBot = mkCymbal(0.28); hatBot.position.y = 0;
  const hatTop = mkCymbal(0.28); hatTop.position.y = 0.045; hatTop.rotation.z = -0.03;
  hihat.add(hatBot, hatTop);
  // clutch above the top hat + tripod feet + pedal board at the floor
  const clutch = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.07, 8), chrome);
  clutch.position.y = 0.1;
  hihat.add(clutch);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    hihat.add(cylinderBetween(
      new THREE.Vector3(0, -0.72, 0),
      new THREE.Vector3(Math.cos(a) * 0.24, -1.0, Math.sin(a) * 0.24), 0.012, darkMetal));
  }
  const hatPedal = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.016, 0.26), darkMetal);
  hatPedal.position.set(0, -0.99, 0.16);
  hatPedal.rotation.x = -0.22;
  hihat.add(hatPedal);
  hihat.position.set(1.04, 1.02, -0.38);
  markInteract(hihat, { instrument: 'drums', part: 'hihat' });
  parts.hihatTop = hatTop;
  kit.add(hihat);

  const crash = new THREE.Group();
  crash.add(cylinderBetween(new THREE.Vector3(0, -1.42, 0), new THREE.Vector3(0, 0, 0), 0.018, darkMetal));
  const crashCym = mkCymbal(0.36);
  crashCym.rotation.z = -0.12;
  crash.add(crashCym);
  crash.position.set(-0.74, 1.62, 0.14);
  markInteract(crash, { instrument: 'drums', part: 'crash' });
  parts.crash = crashCym;
  kit.add(crash);

  // ---- throne ----
  const throne = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.09, 20), std(0x3d1257, { roughness: 0.62 }));
  throne.add(seat);
  const seatPiping = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.014, 6, 24), goldMetal);
  seatPiping.rotation.x = Math.PI / 2;
  seatPiping.position.y = -0.045;
  throne.add(seatPiping);
  throne.add(cylinderBetween(new THREE.Vector3(0, -0.6, 0), new THREE.Vector3(0, -0.05, 0), 0.025, darkMetal));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.9;
    throne.add(cylinderBetween(
      new THREE.Vector3(0, -0.38, 0),
      new THREE.Vector3(Math.cos(a) * 0.26, -0.62, Math.sin(a) * 0.26), 0.014, darkMetal));
  }
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

// ============================================================
// ACOUSTIC GUITAR on a stand
// ============================================================
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

  // The held height rides the mascot's chest, so a customized short or tall
  // mascot still reads as holding the guitar rather than reaching for it.
  function playPosition(heightScale) {
    const position = PLAY_POSE.position.clone();
    position.y *= heightScale;
    return position;
  }

  function setPerformBlend(t, heightScale = 1) {
    performBlend = THREE.MathUtils.clamp(t, 0, 1);
    const k = performBlend;
    body.position.lerpVectors(STAND_POSE.position, playPosition(heightScale), k);
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
    getPerformancePose(heightScale = 1) {
      return {
        position: playPosition(heightScale),
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

// ============================================================
// VINTAGE MICROPHONE
// ============================================================
export function buildMic() {
  const mic = new THREE.Group();
  const chrome = metal(0xd9d9e2, 0.14);
  chrome.emissive = new THREE.Color(0xffffff);
  chrome.emissiveIntensity = 0.045;
  const darkMetal = metal(0x2c2c34, 0.4);

  // round base with a rubber edge ring + stage cable running off to the wing
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.05, 28), darkMetal);
  base.position.y = 0.025;
  mic.add(base);
  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.295, 0.014, 6, 28), std(0x17121c, { roughness: 0.92 }));
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = 0.012;
  mic.add(baseRing);
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.24, 0.03, -0.08),
    new THREE.Vector3(0.5, 0.015, -0.28),
    new THREE.Vector3(0.9, 0.012, -0.3),
    new THREE.Vector3(1.3, 0.012, -0.12),
  ]);
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(cableCurve, 16, 0.016, 6),
    std(0x131019, { roughness: 0.9, metalness: 0.05 }),
  );
  mic.add(cable);
  const xlr = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.09, 8), chrome);
  xlr.rotation.z = Math.PI / 2;
  xlr.rotation.y = 0.4;
  xlr.position.set(0.3, 0.032, -0.13);
  mic.add(xlr);

  // pole + clutch
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.32, 10), chrome);
  pole.position.y = 0.71;
  mic.add(pole);
  const clutch = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.07, 10), metal(GOLD, 0.35));
  clutch.position.y = 1.38;
  mic.add(clutch);

  // head (tilts slightly back)
  const headGroup = new THREE.Group();
  // dark windscreen core caged by the chrome rings/ribs — vintage grille read
  const capsule = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.093, 0.14, 8, 18),
    std(0x241d2e, { roughness: 0.92, metalness: 0.04 }),
  );
  headGroup.add(capsule);
  // grille rings
  const micInstance = new THREE.Object3D();
  const grilleRings = new THREE.InstancedMesh(
    new THREE.TorusGeometry(0.097, 0.009, 8, 26),
    chrome,
    5,
  );
  for (let i = 0; i < 5; i++) {
    micInstance.position.set(0, -0.08 + i * 0.045, 0);
    micInstance.rotation.set(Math.PI / 2, 0, 0);
    micInstance.updateMatrix();
    grilleRings.setMatrixAt(i, micInstance.matrix);
  }
  grilleRings.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  grilleRings.computeBoundingSphere();
  headGroup.add(grilleRings);
  // vertical ribs
  const grilleRibs = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.008, 0.2, 0.008),
    chrome,
    6,
  );
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    micInstance.position.set(Math.cos(a) * 0.096, 0, Math.sin(a) * 0.096);
    micInstance.rotation.set(0, 0, 0);
    micInstance.updateMatrix();
    grilleRibs.setMatrixAt(i, micInstance.matrix);
  }
  grilleRibs.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  grilleRibs.computeBoundingSphere();
  headGroup.add(grilleRibs);
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
  pulse.visible = false;
  mic.add(pulse);

  const micHitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const lowHit = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.24, 0.65), micHitMat);
  lowHit.position.y = 0.12;
  lowHit.visible = false;
  mic.add(lowHit);
  const midHit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.76, 0.3), micHitMat);
  midHit.position.y = 0.86;
  midHit.visible = false;
  mic.add(midHit);
  const highHit = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), micHitMat);
  highHit.position.y = 1.55;
  highHit.visible = false;
  mic.add(highHit);

  markInteract(headGroup, { instrument: 'mic', vocalFreq: 392.0, vocalVowel: 2 });
  markInteract(pole, { instrument: 'mic', vocalFreq: 329.63, vocalVowel: 1 });
  markInteract(base, { instrument: 'mic', vocalFreq: 261.63, vocalVowel: 0 });
  markInteract(highHit, { instrument: 'mic', vocalFreq: 392.0, vocalVowel: 2 });
  markInteract(midHit, { instrument: 'mic', vocalFreq: 329.63, vocalVowel: 1 });
  markInteract(lowHit, { instrument: 'mic', vocalFreq: 261.63, vocalVowel: 0 });
  // Same rule as the guitar: base, pole and head capsule define the shadow;
  // grille rings, ribs, bands and the XLR do not.
  const micShadowCasters = new Set([base, pole, capsule]);
  mic.traverse((o) => { if (o.isMesh) o.castShadow = micShadowCasters.has(o); });

  let bob = 0, pulseT = 0, time = 0;

  return {
    group: mic,
    label: 'Вокал',
    labelAnchor: new THREE.Vector3(0, 2.2, 0),
    sing() { bob = 1; pulseT = 1; pulse.visible = true; },
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
        if (pulseT === 0) pulse.visible = false;
      }
    },
  };
}
