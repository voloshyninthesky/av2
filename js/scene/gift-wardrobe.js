// The character's dressing-room wardrobe. Built once, including both hinged
// doors: the same furniture carries the anticipation and the opening, offline
// too. Warm timber, a broad crown, drawer and raised feet make it read as a
// wardrobe even before the little hanger badge comes into view.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Front faces +z; reveal.js turns the wardrobe toward its portrait camera.
const W = 1.34;
const H = 1.78;
const D = 0.64;
const SIDE_T = 0.075;
const LEG_H = 0.16;
const DOOR_T = 0.055;
const DOOR_SEAM = 0.018;
const OPENING_W = W - SIDE_T * 2;
const OPENING_Y0 = 0.43;
const OPENING_Y1 = 1.59;
const DOOR_W = (OPENING_W - DOOR_SEAM) / 2;
const DOOR_H = OPENING_Y1 - OPENING_Y0;

export const WARDROBE_AJAR = 0.12;
export const WARDROBE_DOOR_MAX = 2.25;

export function buildGiftWardrobe() {
  const group = new THREE.Group();
  group.name = 'giftWardrobe';
  const mats = {
    wood: new THREE.MeshStandardMaterial({ color: 0xb9804e, roughness: 0.66 }),
    edge: new THREE.MeshStandardMaterial({ color: 0xe0b27b, roughness: 0.56 }),
    panel: new THREE.MeshStandardMaterial({ color: 0x92799b, roughness: 0.72 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd6ae61, roughness: 0.4, metalness: 0.55 }),
    enchantment: new THREE.MeshStandardMaterial({
      color: 0xffdea0, emissive: 0xffcc77, emissiveIntensity: 0.6,
      roughness: 0.45, metalness: 0.15,
    }),
    interior: new THREE.MeshStandardMaterial({ color: 0x443329, roughness: 0.92 }),
    glow: new THREE.MeshBasicMaterial({
      color: 0xFDFBF7, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }),
  };

  // Small bevels catch the stage light without needing a new light or texture.
  const box = (parent, material, w, h, d, x, y, z, bevel = 0.008) => {
    const b = Math.min(bevel, w / 4, h / 4, d / 4);
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + b, -h / 2 + b);
    shape.lineTo(w / 2 - b, -h / 2 + b);
    shape.lineTo(w / 2 - b, h / 2 - b);
    shape.lineTo(-w / 2 + b, h / 2 - b);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: d - b * 2, bevelEnabled: true, bevelSize: b,
      bevelThickness: b, bevelSegments: 2, steps: 1, curveSegments: 1,
    });
    geometry.translate(0, 0, -d / 2 + b);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const rod = (parent, material, points, radius = 0.012) => {
    const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, 16, radius, 6, false), material);
    parent.add(mesh);
  };
  const carcass = new THREE.Group();
  carcass.name = 'wardrobeCarcass';
  group.add(carcass);
  const bodyH = OPENING_Y1 - LEG_H;
  const bodyY = LEG_H + bodyH / 2;
  box(carcass, mats.wood, W, bodyH, 0.05, 0, bodyY, -D / 2 + 0.025);
  for (const side of [-1, 1]) {
    box(carcass, mats.wood, SIDE_T, bodyH, D, side * (W - SIDE_T) / 2, bodyY, 0);
    box(carcass, mats.edge, 0.035, bodyH, 0.025, side * (W / 2 - 0.045), bodyY, D / 2 + 0.01);
    for (const depth of [-1, 1]) {
      // Clearly separated, tapered furniture feet rather than a sealed plinth.
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, LEG_H, 8), mats.wood);
      foot.position.set(side * (W / 2 - 0.13), LEG_H / 2, depth * (D / 2 - 0.11));
      carcass.add(foot);
    }
  }
  box(carcass, mats.interior, OPENING_W, DOOR_H, 0.025, 0, OPENING_Y0 + DOOR_H / 2, -D / 2 + 0.065);
  box(carcass, mats.wood, W + 0.06, 0.065, D + 0.035, 0, LEG_H + 0.025, 0);
  box(carcass, mats.edge, OPENING_W, 0.05, D, 0, OPENING_Y0 - 0.025, 0);
  // A real drawer gives the silhouette an unmistakable furniture proportion.
  box(carcass, mats.wood, OPENING_W - 0.015, 0.19, D - 0.04, 0, 0.3, 0);
  box(carcass, mats.edge, OPENING_W - 0.08, 0.13, 0.035, 0, 0.3, D / 2);
  for (const side of [-1, 1]) {
    const x = side * 0.30;
    rod(carcass, mats.gold, [[x - 0.065, 0.3, 0.35], [x - 0.055, 0.285, 0.39], [x + 0.055, 0.285, 0.39], [x + 0.065, 0.3, 0.35]]);
  }
  // Broad, flat, stepped crown; no pointed arch or funerary outline.
  box(carcass, mats.wood, W + 0.04, 0.12, D + 0.03, 0, 1.65, 0);
  box(carcass, mats.edge, W + 0.14, 0.065, D + 0.10, 0, H - 0.0325, 0);
  box(carcass, mats.edge, W + 0.08, 0.025, D + 0.055, 0, 1.6025, 0);
  // Brass hanger pictogram, centred on the wooden header.
  const badgeZ = D / 2 + 0.024;
  rod(carcass, mats.gold, [[0, 1.666, badgeZ], [-0.084, 1.622, badgeZ], [0.084, 1.622, badgeZ], [0, 1.666, badgeZ]], 0.007);
  rod(carcass, mats.gold, [[0, 1.666, badgeZ], [0, 1.683, badgeZ], [0.019, 1.69, badgeZ], [0.026, 1.676, badgeZ]], 0.007);

  const starShape = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const r = i % 2 ? 0.23 : 1;
    const x = Math.sin(angle) * r, y = Math.cos(angle) * r;
    if (i === 0) starShape.moveTo(x, y);
    else starShape.lineTo(x, y);
  }
  starShape.closePath();
  const star = (parent, x, y, size) => {
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(starShape), mats.enchantment);
    mesh.position.set(x, y, DOOR_T / 2 + 0.027);
    mesh.scale.setScalar(size);
    parent.add(mesh);
  };
  const makeDoor = (side) => {
    const pivot = new THREE.Group();
    pivot.name = side < 0 ? 'wardrobeDoorLeft' : 'wardrobeDoorRight';
    pivot.position.set(side * OPENING_W / 2, 0, D / 2 - DOOR_T / 2);
    const midX = -side * DOOR_W / 2;
    const midY = OPENING_Y0 + DOOR_H / 2;
    box(pivot, mats.wood, DOOR_W, DOOR_H, DOOR_T, midX, midY, 0);
    // Two framed panels per leaf break up the long vertical slab.
    for (const [y, height] of [[OPENING_Y0 + 0.22, 0.31], [OPENING_Y0 + 0.76, 0.62]]) {
      box(pivot, mats.edge, DOOR_W - 0.085, height + 0.035, 0.025, midX, y, DOOR_T / 2 + 0.004);
      box(pivot, mats.panel, DOOR_W - 0.12, height, 0.022, midX, y, DOOR_T / 2 + 0.013);
    }
    // Small celestial inlays make this a storybook dressing room. They stay
    // warm gold at every tier, so the surprise still belongs to the seam glow.
    if (side < 0) {
      const moon = new THREE.Shape();
      moon.moveTo(0.025, 0.082);
      moon.bezierCurveTo(-0.11, 0.09, -0.11, -0.09, 0.025, -0.082);
      moon.bezierCurveTo(-0.038, -0.04, -0.038, 0.04, 0.025, 0.082);
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(moon, 20), mats.enchantment);
      mesh.position.set(midX, 1.24, DOOR_T / 2 + 0.027);
      pivot.add(mesh);
    } else star(pivot, midX, 1.24, 0.075);
    star(pivot, midX - 0.095, 1.37, 0.018);
    star(pivot, midX + 0.075, 1.08, 0.027);
    star(pivot, midX + 0.105, 1.40, 0.012);
    star(pivot, midX, 0.65, 0.028);
    const handleX = -side * (DOOR_W - 0.055);
    box(pivot, mats.gold, 0.032, 0.19, 0.015, handleX, midY, DOOR_T / 2 + 0.009);
    rod(pivot, mats.gold, [[handleX, midY - 0.065, 0.046], [handleX, midY - 0.052, 0.092], [handleX, midY + 0.052, 0.092], [handleX, midY + 0.065, 0.046]], 0.012);
    group.add(pivot);
    return pivot;
  };
  const doorL = makeDoor(-1);
  const doorR = makeDoor(1);

  // Merge each rigid assembly by material at boot. Detail adds no per-frame
  // work, and only the two door pivots move during a ceremony.
  for (const assembly of [carcass, doorL, doorR]) {
    const batches = new Map();
    for (const mesh of [...assembly.children]) {
      mesh.updateMatrix();
      let geometry = mesh.geometry;
      if (geometry.index) {
        geometry = geometry.toNonIndexed();
        mesh.geometry.dispose();
      }
      geometry.applyMatrix4(mesh.matrix);
      if (!batches.has(mesh.material)) batches.set(mesh.material, []);
      batches.get(mesh.material).push(geometry);
      assembly.remove(mesh);
    }
    for (const [material, geometries] of batches) {
      const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
      mesh.castShadow = material === mats.wood;
      assembly.add(mesh);
      for (const geometry of geometries) geometry.dispose();
    }
  }

  const glow = new THREE.Mesh(new THREE.BoxGeometry(OPENING_W - 0.04, DOOR_H - 0.04, 0.025), mats.glow);
  glow.position.set(0, OPENING_Y0 + DOOR_H / 2, D / 2 - 0.11);
  group.add(glow);
  // Soft motes, a single texture and draw call, all allocated at boot.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.25)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  const moteMat = new THREE.PointsMaterial({
    color: 0xffd596, map: new THREE.CanvasTexture(canvas), size: 0.055,
    transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false,
  });
  const motePositions = new Float32Array(18 * 3);
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const motes = new THREE.Points(moteGeometry, moteMat);
  motes.name = 'wardrobeMagicMotes';
  // Positions move inside a fixed, small envelope; avoid a stale culling bound.
  moteGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0.4), 1.3);
  group.add(motes);
  const updateMagic = (time, anticipation = 0, reducedMotion = false) => {
    const t = reducedMotion ? 0 : time;
    const breath = reducedMotion ? 0.5 : 0.5 + Math.sin(t * 1.8) * 0.5;
    mats.enchantment.emissiveIntensity = 0.45 + breath * 0.25 + anticipation * 0.45;
    moteMat.opacity = 0.45 + breath * 0.15 + anticipation * 0.2;
    moteMat.size = 0.045 + anticipation * 0.02;
    for (let i = 0; i < 18; i++) {
      const phase = i * 2.39996;
      motePositions[i * 3] = Math.sin(phase + t * 0.23) * (0.43 + (i % 3) * 0.12);
      motePositions[i * 3 + 1] = 0.24 + ((i * 0.137 + t * 0.065) % 1) * 1.58;
      motePositions[i * 3 + 2] = D / 2 + 0.08 + (0.5 + Math.cos(phase + t * 0.3) * 0.5) * 0.10;
    }
    moteGeometry.attributes.position.needsUpdate = true;
  };
  updateMagic(0);
  return {
    group, carcass, doorL, doorR, glow, mats, updateMagic,
    topY: H,
    frontZ: D / 2 + 0.07,
    setDoorAngle(angle) {
      doorL.rotation.y = -angle;
      doorR.rotation.y = angle;
    },
  };
}
