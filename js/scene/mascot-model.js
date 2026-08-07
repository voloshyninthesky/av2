// ============================================================
// MASCOT MODEL
// Builds the blocky performer rig once and hands back every joint the pose,
// walk and dance code animates. Nothing here is stateful: appearance is
// applied afterwards from the saved config.
// ============================================================
import * as THREE from 'three';

export function makeMascotPointer() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 256, 256);
  x.shadowColor = '#9E33CA';
  x.shadowBlur = 18;
  x.fillStyle = '#9E33CA';
  x.beginPath();
  x.moveTo(78, 72); x.lineTo(178, 72); x.lineTo(128, 188);
  x.closePath();
  x.fill();
  x.shadowBlur = 0;
  x.strokeStyle = '#D1A13B';
  x.lineWidth = 8;
  x.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  spr.scale.set(0.55, 0.55, 1);
  return spr;
}
// Micro-texture painter. Near-white canvases multiplied under material.color,
// so every recolor slot keeps tinting exactly as before — the weave only takes
// the flat plastic off the surface. Deterministic (seeded) so renders and
// fingerprints stay reproducible.
function makeClothTexture(paint, repeatX, repeatY, size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  paint(ctx, size, rand);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

// Felt/knit body cloth: fine warp/weft grid plus sparse flecks.
function makeFabricTexture() {
  return makeClothTexture((x, size, rand) => {
    x.fillStyle = 'rgba(0,0,0,0.045)';
    for (let i = 0; i < size; i += 2) x.fillRect(i, 0, 1, size);
    x.fillStyle = 'rgba(0,0,0,0.03)';
    for (let i = 0; i < size; i += 3) x.fillRect(0, i, size, 1);
    for (let i = 0; i < 900; i++) {
      x.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.05)';
      x.fillRect((rand() * size) | 0, (rand() * size) | 0, 1, 1);
    }
  }, 3, 3);
}

// Ribbed varsity trim: vertical knit ridges for hem band, cuffs, stripe, collar.
function makeRibTexture() {
  return makeClothTexture((x, size) => {
    for (let i = 0; i < size; i += 8) {
      const g = x.createLinearGradient(i, 0, i + 8, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.11)');
      g.addColorStop(0.45, 'rgba(255,255,255,0)');
      g.addColorStop(0.75, 'rgba(0,0,0,0.02)');
      g.addColorStop(1, 'rgba(0,0,0,0.11)');
      x.fillStyle = g;
      x.fillRect(i, 0, 8, size);
    }
  }, 10, 2, 64);
}

// Hair strands: wavy vertical streaks, a few bright, most as soft shadow.
function makeStrandTexture() {
  return makeClothTexture((x, size, rand) => {
    for (let i = 0; i < 46; i++) {
      const sx = rand() * size;
      const wobble = 2 + rand() * 3;
      const phase = rand() * Math.PI * 2;
      x.lineWidth = 0.7 + rand() * 1.1;
      x.strokeStyle = rand() > 0.82 ? 'rgba(255,255,255,0.35)' : `rgba(0,0,0,${0.05 + rand() * 0.08})`;
      x.beginPath();
      for (let y = 0; y <= size; y += 8) {
        const px = sx + Math.sin(phase + y * 0.05) * wobble;
        if (y === 0) x.moveTo(px, y); else x.lineTo(px, y);
      }
      x.stroke();
    }
  }, 3, 2);
}

// ---- compact young stage mascot ----
export function buildMascot() {
  const group = new THREE.Group();
  group.name = 'Ти';

  const fabricTex = makeFabricTexture();
  const ribTex = makeRibTexture();
  const strandTex = makeStrandTexture();

  // Recolorable outfit slots (mascot customization recolors these in place).
  const mats = {
    top: new THREE.MeshStandardMaterial({ color: 0xFDFBF7, roughness: 0.75, envMapIntensity: 0.65, map: fabricTex }),
    panel: new THREE.MeshStandardMaterial({ color: 0x233f9d, roughness: 0.72, map: fabricTex }),
    stripes: new THREE.MeshStandardMaterial({ color: 0x008542, roughness: 0.76, map: ribTex }),
    sleeveL: new THREE.MeshStandardMaterial({ color: 0x008542, roughness: 0.76, map: fabricTex }),
    sleeveR: new THREE.MeshStandardMaterial({ color: 0x7fa1bd, roughness: 0.82, map: fabricTex }),
    shoulder: new THREE.MeshStandardMaterial({ color: 0xb93a3a, roughness: 0.76, map: fabricTex }),
    collar: new THREE.MeshStandardMaterial({ color: 0xFFD100, roughness: 0.7, map: ribTex }),
    pants: new THREE.MeshStandardMaterial({ color: 0x5B82A6, roughness: 0.82, map: fabricTex }),
    shoes: new THREE.MeshStandardMaterial({ color: 0x17121c, roughness: 0.7 }),
  };
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x5a2f22, roughness: 0.6, envMapIntensity: 0.7, map: strandTex });
  // Skin tones come from the customization config; keep env response low so
  // close-up palms/faces do not clip to white under stacked warm spots.
  const skin = new THREE.MeshStandardMaterial({ color: 0xf2c4a6, roughness: 0.88, envMapIntensity: 0.5 });
  const ink = new THREE.MeshStandardMaterial({ color: 0x17121c, roughness: 0.7 });
  const rose = new THREE.MeshStandardMaterial({ color: 0xb86d72, roughness: 0.8 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xd7d9dd, roughness: 0.22, metalness: 0.88 });
  const headphoneMats = {
    shell: new THREE.MeshStandardMaterial({ color: 0x233f9d, roughness: 0.42, metalness: 0.12 }),
    detail: new THREE.MeshStandardMaterial({ color: 0x008542, roughness: 0.55, metalness: 0.08 }),
  };

  // Varsity-jacket read: center placket, chest stripe, hem band, symmetric
  // shoulder yokes. Same recolorable slots, calmer composition.
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.58, 14), mats.top);
  torso.position.y = 1.08;
  group.add(torso);
  const placket = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.5, 0.03), mats.panel);
  placket.position.set(0, 1.06, 0.298);
  group.add(placket);
  const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.03), mats.stripes);
  chestStripe.position.set(0, 1.2, 0.29);
  group.add(chestStripe);
  const hemBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.317, 0.327, 0.06, 14, 1, true),
    mats.stripes,
  );
  hemBand.position.y = 0.82;
  group.add(hemBand);
  for (const side of [-1, 1]) {
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.05), mats.shoulder);
    yoke.position.set(side * 0.21, 1.3, 0.26);
    yoke.rotation.z = -side * 0.28;
    group.add(yoke);
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.04), mats.collar);
    collar.position.set(side * 0.07, 1.31, 0.3);
    collar.rotation.z = side * 0.58;
    group.add(collar);
  }
  const waistband = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.028, 7, 22), mats.pants);
  waistband.rotation.x = Math.PI / 2;
  waistband.position.y = 0.78;
  group.add(waistband);
  const buckle = new THREE.Mesh(
    new THREE.CircleGeometry(0.035, 12),
    new THREE.MeshStandardMaterial({ color: 0xD1A13B, metalness: 0.85, roughness: 0.35 }),
  );
  buckle.position.set(0, 0.78, 0.315);
  group.add(buckle);
  // neck fills the head/torso gap during walk and seated poses
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.12, 10), skin);
  neck.position.y = 1.4;
  group.add(neck);

  const head = new THREE.Group();
  head.position.y = 1.56;
  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), hairMat);
  hairBack.scale.set(1.08, 1.55, 0.82);
  hairBack.position.set(0, -0.13, -0.05);
  head.add(hairBack);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.27, 18, 14), skin);
  face.position.z = 0.035;
  head.add(face);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.287, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat);
  hairCap.position.set(0, 0.04, 0.05);
  head.add(hairCap);
  // Side locks. Each style places them itself (x/y/z) — long hair must fall
  // beside and behind the jaw, never across the chin, or it reads as a beard.
  const locks = [];
  for (const side of [-1, 1]) {
    const lock = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), hairMat);
    lock.userData.side = side;
    lock.scale.set(0.72, 3.3, 0.7);
    lock.position.set(side * 0.255, -0.28, 0.08);
    head.add(lock);
    locks.push(lock);
  }
  // Fringe/bangs: a curved shell patch hugging the front of the skull, so the
  // hairline arcs over the brow instead of the hair cap's flat cut edge.
  // Styles restyle it by scale/rotation, never by new geometry.
  const fringe = new THREE.Mesh(
    new THREE.SphereGeometry(0.305, 22, 14, Math.PI / 2 - 1.05, 2.1, 0.3, 0.98),
    hairMat,
  );
  fringe.position.set(0, 0.04, 0.045);
  head.add(fringe);
  // Back fall: the tapered mass below the skull that the back/cap spheres
  // cannot fake — long hair actually hangs down the back with it. Styles place
  // or hide it like every other piece.
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), hairMat);
  tail.position.set(0, -0.44, -0.17);
  head.add(tail);
  // Layered eye: sclera almond behind a large iris and pupil, so the
  // customizable iris color actually reads instead of tinting one dark blob.
  // The iris keeps its dedicated material (recolored in place); the pupil
  // reuses the shared ink material, which is never recolored.
  const scleraMat = new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.35 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x17121c, roughness: 0.4 });
  const eyeShine = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const x of [-0.09, 0.09]) {
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), scleraMat);
    sclera.scale.set(1.35, 0.8, 0.5);
    sclera.position.set(x, 0.025, 0.281);
    head.add(sclera);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0225, 10, 8), eyeMat);
    iris.scale.set(1, 1, 0.55);
    iris.position.set(x, 0.023, 0.292);
    head.add(iris);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), ink);
    pupil.scale.set(1, 1, 0.5);
    pupil.position.set(x, 0.023, 0.301);
    head.add(pupil);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 5), eyeShine);
    shine.position.set(x + 0.008, 0.034, 0.305);
    head.add(shine);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.012), hairMat);
    brow.position.set(x, 0.085, 0.284);
    brow.rotation.z = -Math.sign(x) * 0.1;
    head.add(brow);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), skin);
  nose.scale.set(0.85, 0.7, 0.55);
  nose.position.set(0, -0.028, 0.298);
  head.add(nose);
  // Three curated mouths. Neutral is a calm closed lip with a hint of curve —
  // a wide, shallow arc rather than a flat bar, so it still reads as a face.
  const neutralMouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.115, 0.0068, 6, 14, Math.PI * 0.36),
    rose,
  );
  neutralMouth.position.set(0, 0.023, 0.288);
  neutralMouth.rotation.z = Math.PI * 1.32;
  head.add(neutralMouth);
  const softSmile = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.0075, 6, 12, Math.PI), rose);
  softSmile.position.set(0, -0.062, 0.292);
  softSmile.rotation.z = Math.PI;
  head.add(softSmile);
  const wideSmile = new THREE.Group();
  const mouthOpen = new THREE.Mesh(
    new THREE.CircleGeometry(0.052, 14, Math.PI, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x5e2430, roughness: 0.7 }),
  );
  mouthOpen.position.set(0, -0.058, 0.291);
  wideSmile.add(mouthOpen);
  const teeth = new THREE.Mesh(
    new THREE.BoxGeometry(0.078, 0.015, 0.008),
    new THREE.MeshStandardMaterial({ color: 0xe9e2d4, roughness: 0.5 }),
  );
  teeth.position.set(0, -0.063, 0.293);
  wideSmile.add(teeth);
  const wideLip = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.007, 6, 12, Math.PI), rose);
  wideLip.position.set(0, -0.058, 0.292);
  wideLip.rotation.z = Math.PI;
  wideSmile.add(wideLip);
  head.add(wideSmile);
  const accessoryGroups = {
    none: new THREE.Group(),
    hoops: new THREE.Group(),
    glasses: new THREE.Group(),
    headphones: new THREE.Group(),
  };
  for (const x of [-0.285, 0.285]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.011, 6, 16), silver);
    hoop.position.set(x, -0.02, 0.035);
    hoop.rotation.y = Math.PI / 2;
    accessoryGroups.hoops.add(hoop);
  }
  // Tinted glass fills inside the rims — depthWrite off so the transparent
  // pass draws them over the eye stack without sorting artifacts.
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0xa8c6dd, transparent: true, opacity: 0.2, roughness: 0.08,
    metalness: 0.25, envMapIntensity: 1.4, depthWrite: false,
  });
  for (const x of [-0.095, 0.095]) {
    const lens = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.012, 6, 18), ink);
    lens.position.set(x, 0.018, 0.304);
    accessoryGroups.glasses.add(lens);
    const lensFill = new THREE.Mesh(new THREE.CircleGeometry(0.058, 18), lensMat);
    lensFill.position.set(x, 0.018, 0.31);
    accessoryGroups.glasses.add(lensFill);
  }
  const glassesBridge = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.012, 0.012), ink);
  glassesBridge.position.set(0, 0.018, 0.304);
  accessoryGroups.glasses.add(glassesBridge);
  for (const x of [-1, 1]) {
    const temple = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.19), ink);
    temple.position.set(x * 0.163, 0.02, 0.21);
    temple.rotation.y = -x * 0.08;
    accessoryGroups.glasses.add(temple);
  }
  const headphoneBand = new THREE.Mesh(
    new THREE.TorusGeometry(0.305, 0.026, 7, 24, Math.PI),
    headphoneMats.shell,
  );
  headphoneBand.position.set(0, 0.015, 0);
  accessoryGroups.headphones.add(headphoneBand);
  const headphoneBandDetail = new THREE.Mesh(
    new THREE.TorusGeometry(0.305, 0.01, 5, 24, Math.PI),
    headphoneMats.detail,
  );
  headphoneBandDetail.position.set(0, 0.015, 0.025);
  accessoryGroups.headphones.add(headphoneBandDetail);
  for (const x of [-0.295, 0.295]) {
    const cup = new THREE.Mesh(new THREE.CapsuleGeometry(0.057, 0.07, 5, 10), headphoneMats.shell);
    cup.scale.set(0.78, 1, 0.9);
    cup.position.set(x, -0.07, 0.04);
    cup.rotation.z = x < 0 ? -0.08 : 0.08;
    accessoryGroups.headphones.add(cup);
    const cupDetail = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.052, 4, 9), headphoneMats.detail);
    cupDetail.scale.set(0.7, 1, 0.55);
    cupDetail.position.set(x, -0.07, 0.097);
    cupDetail.rotation.z = cup.rotation.z;
    accessoryGroups.headphones.add(cupDetail);
  }
  for (const accessory of Object.values(accessoryGroups)) {
    accessory.visible = accessory === accessoryGroups.hoops;
    head.add(accessory);
  }
  group.add(head);

  const makeLimb = (x, y, material, radius, length, { hand = false } = {}) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.92, length, 9), material);
    limb.position.y = -length / 2;
    limb.userData.majorMass = true;
    pivot.add(limb);
    if (hand) {
      const palm = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.05, 10, 8), skin);
      palm.scale.set(1.05, 0.85, 1.15);
      palm.position.y = -length - radius * 0.35;
      pivot.add(palm);
      pivot.userData.hand = palm;
    }
    group.add(pivot);
    return pivot;
  };

  const armL = makeLimb(-0.34, 1.28, mats.sleeveL, 0.085, 0.5, { hand: true });
  const armR = makeLimb(0.34, 1.28, mats.sleeveR, 0.09, 0.5, { hand: true });
  armL.rotation.z = -0.12;
  armR.rotation.z = 0.12;
  // ribbed varsity cuffs at the wrists (accent slot, rides limb poses)
  for (const [pivot, radius] of [[armL, 0.085], [armR, 0.09]]) {
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.18, radius * 1.14, 0.06, 10), mats.stripes);
    cuff.position.y = -0.44;
    pivot.add(cuff);
  }
  const legL = makeLimb(-0.15, 0.76, mats.pants, 0.145, 0.64);
  const legR = makeLimb(0.15, 0.76, mats.pants, 0.145, 0.64);

  const soleMat = new THREE.MeshStandardMaterial({ color: 0xf5f1e8, roughness: 0.6 });
  const sneakerStripeGeometry = new THREE.BoxGeometry(0.025, 0.06, 0.012);
  for (const leg of [legL, legR]) {
    const sneaker = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.16, 0.38), mats.shoes);
    sneaker.position.set(0, -0.64, 0.08);
    sneaker.userData.majorMass = true;
    leg.add(sneaker);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.045, 0.4), soleMat);
    sole.position.set(0, -0.7, 0.08);
    leg.add(sole);
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), mats.shoes);
    toe.scale.set(1.05, 0.62, 0.62);
    toe.position.set(0, -0.655, 0.24);
    leg.add(toe);
    // three identical toe stripes per shoe — one instanced draw instead of three
    const stripes = new THREE.InstancedMesh(sneakerStripeGeometry, mats.top, 3);
    const stripeMatrix = new THREE.Matrix4();
    [-0.07, 0, 0.07].forEach((x, i) => {
      stripes.setMatrixAt(i, stripeMatrix.makeTranslation(x, -0.64, 0.276));
    });
    stripes.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    stripes.computeBoundingSphere();
    leg.add(stripes);
  }

  // small accent pin on the chest stripe (reads as a band badge, not a blob)
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.028, 14), mats.collar);
  badge.position.set(-0.135, 1.2, 0.303);
  group.add(badge);

  // Only the major masses cast shadows. Trim, stripes, eyes, collar and pins
  // are too small to read in the shadow map and would roughly double the
  // shadow-pass draw calls now that the mascot stands in the key light.
  const shadowCasters = new Set([torso, neck, face, hairBack, hairCap, fringe, tail, ...locks]);
  group.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = shadowCasters.has(object) || object.userData.majorMass === true;
  });

  return {
    group, torso, head, armL, armR, legL, legR,
    handL: armL.userData.hand,
    handR: armR.userData.hand,
    custom: {
      mats, hairMat, skinMat: skin, hairBack, hairCap, fringe, tail, locks, accessoryGroups, headphoneMats,
      eyeMat,
      mouths: { soft: softSmile, wide: wideSmile, neutral: neutralMouth },
    },
  };
}
