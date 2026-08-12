// ============================================================
// DRUM KIT
// Kick, snare, two toms, hi-hat and crash on a real rack, each head and
// cymbal animated by its own recoil so a hit reads before the sound lands.
// ============================================================
import * as THREE from 'three';
import {
  CREAM,
  GOLD,
  cylinderBetween,
  cymbalTexture,
  drumHeadTexture,
  lacquer,
  markInteract,
  metal,
  sparkleWrapTexture,
  std,
} from './shared.js?v=20260813-01';

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
