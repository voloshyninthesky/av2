// ============================================================
// MASCOT TIER AURA
// The persistent mark of the gift's rarity: the ceremony stays identical for
// everyone (SPEC §13), but the character that walks out of it carries its tier
// on stage — a ground ring for rare, orbiting sparks for epic, light rays and
// a golden companion bird for legendary. Common stays bare; the ladder only
// reads because its bottom rung is unmarked.
//
// Everything is built once at boot and toggled / recoloured per tier, so a
// 20-pull stress pass allocates nothing (SPEC §13 acceptance). No lights —
// a light added lazily relinks every lit program mid-ceremony — and no new
// post passes: the additive sprites read on the PIXEL tier bare, and the
// existing bloom dresses them up on GLAMOUR for free.
//
// Per-frame animation is uniform-level only: rotations, colour scale, point
// size. Material *opacity* is deliberately never written here — the stage-fall
// fade owns opacity for every material under mascot.group, and a second writer
// would fight its restore on respawn.
// ============================================================
import * as THREE from 'three';
import { prefersReducedMotion } from '../core/quality.js?v=20260813-14';
// Deliberately no instrument-view import: this module is loaded by
// core/studio.js, and view/instrument-presets.js imports studio back — the
// cycle would hit the TDZ at boot. main.js passes the "visitor is at an
// instrument" flag into update() instead.

// Trim glow on the outfit itself (chest stripe, hem, cuffs, collar, badge —
// the stripes + collar material slots). Applied by applyMascotConfig(); the
// colour is the tier accent. Kept out of the «світло» dimmer registry on
// purpose: rarity should still read on a darkened stage.
export const MASCOT_TIER_TRIM = {
  epic: 0.22,
  legendary: 0.35,
};

// What each tier wears. `ring`/`rays` scale the additive colour (for additive
// blending, colour scale is visually identical to opacity — and unlike opacity
// it is not captured by the fall-fade material map). Sparks are a draw range
// into one prebuilt buffer.
// `glyph` is the rotating rune ring's intensity and `glyphSpin` its rate (a
// counter-turn to the sparks, so the two never look locked together). `ripple`
// is the expanding pulse that leaves the mark every `rippleEvery` seconds —
// what turns a static decal into something the character is *emitting*.
const AURA_TIERS = {
  // Rare's denim sits over the warm key-light pool, which eats saturation —
  // it runs a little hotter than the ladder position alone would suggest.
  rare: {
    ring: 0.68, ringPulse: 1.4, rays: 0, sparks: 0, sparkSize: 0, spin: 0, bird: false,
    glyph: 0.32, glyphSpin: -0.10, ripple: 0.5, rippleEvery: 3.6, drift: 0,
  },
  epic: {
    ring: 0.75, ringPulse: 1.9, rays: 0, sparks: 26, sparkSize: 0.058, spin: 0.7, bird: false,
    glyph: 0.5, glyphSpin: -0.16, ripple: 0.7, rippleEvery: 2.8, drift: 0.5,
  },
  legendary: {
    ring: 0.9, ringPulse: 2.3, rays: 0.5, sparks: 44, sparkSize: 0.068, spin: 0.9, bird: true,
    glyph: 0.72, glyphSpin: -0.22, ripple: 0.9, rippleEvery: 2.2, drift: 0.8,
  },
};
const MAX_SPARKS = 44;
const WHITE = new THREE.Color(0xffffff);

function makeAuraTexture(size, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Soft pool with a bright rim — one texture carries both, so the ring is a
// single mesh / single draw call.
function makeRingTexture() {
  return makeAuraTexture(256, (x, size) => {
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.14)');
    g.addColorStop(0.44, 'rgba(255,255,255,0.05)');
    g.addColorStop(0.60, 'rgba(255,255,255,0.10)');
    g.addColorStop(0.68, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.76, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
  });
}

// Ten soft spokes fading outward — the legendary "beams through haze" disc.
function makeRaysTexture() {
  return makeAuraTexture(256, (x, size) => {
    const c = size / 2;
    x.translate(c, c);
    for (let i = 0; i < 10; i++) {
      x.rotate((Math.PI * 2) / 10);
      const g = x.createLinearGradient(0, 0, 0, -c);
      g.addColorStop(0, 'rgba(255,255,255,0.5)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.16)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(0, 0);
      x.lineTo(-c * 0.085, -c);
      x.lineTo(c * 0.085, -c);
      x.closePath();
      x.fill();
    }
  });
}

// The rune ring: a broken circle of ticks and arc segments that turns slowly
// under the soft pool. Rotation is what sells it — a static decal reads as a
// texture on the floor, a turning one reads as something being *held* there.
function makeGlyphTexture() {
  return makeAuraTexture(256, (x, size) => {
    const c = size / 2;
    x.translate(c, c);
    x.strokeStyle = 'rgba(255,255,255,0.85)';
    x.lineWidth = 3;
    // Two concentric hairlines, the inner one broken into quadrant arcs.
    x.beginPath();
    x.arc(0, 0, c * 0.86, 0, Math.PI * 2);
    x.stroke();
    x.lineWidth = 5;
    for (let i = 0; i < 4; i++) {
      const start = i * (Math.PI / 2) + 0.22;
      x.beginPath();
      x.arc(0, 0, c * 0.62, start, start + Math.PI / 2 - 0.44);
      x.stroke();
    }
    // Ticks: long on the quarters, short between, so the turn has a beat.
    for (let i = 0; i < 24; i++) {
      const long = i % 6 === 0;
      x.save();
      x.rotate((i / 24) * Math.PI * 2);
      x.fillStyle = long ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)';
      x.fillRect(-2, -c * 0.86, 4, long ? c * 0.16 : c * 0.07);
      x.restore();
    }
  });
}

// A soft-edged annulus, scaled outward and faded to make the pulse ripple.
function makeRippleTexture() {
  return makeAuraTexture(128, (x, size) => {
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.72, 'rgba(255,255,255,0)');
    g.addColorStop(0.86, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
  });
}

function makeSparkTexture() {
  return makeAuraTexture(64, (x, size) => {
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
  });
}

// The legendary companion — a palm-sized songbird in the same blocky idiom as
// the mascot it belongs to. ~9 tiny meshes, none casting shadows (the curated
// shadow rule: only major masses cast). Wing pivots sit at the body sides so a
// single rotation.z flaps them.
function buildCompanionBird() {
  const bird = new THREE.Group();
  const plumage = new THREE.MeshStandardMaterial({ color: 0xE8BE5B, roughness: 0.55, emissive: 0xD1A13B, emissiveIntensity: 0.28 });
  const inkMat = new THREE.MeshStandardMaterial({ color: 0x17121c, roughness: 0.6 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), plumage);
  body.scale.set(0.95, 0.85, 1.25);
  bird.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), plumage);
  head.position.set(0, 0.075, 0.085);
  bird.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 6), inkMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.07, 0.14);
  bird.add(beak);
  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.05, 5), plumage);
  crest.position.set(0, 0.125, 0.06);
  crest.rotation.x = -0.5;
  bird.add(crest);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 5), inkMat);
    eye.position.set(side * 0.036, 0.088, 0.115);
    bird.add(eye);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.11), plumage);
  tail.position.set(0, 0.02, -0.14);
  tail.rotation.x = -0.35;
  bird.add(tail);
  const wings = {};
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.06, 0.02, -0.005);
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), plumage);
    wing.scale.set(0.28, 0.5, 1.5);
    wing.position.set(side * 0.05, 0, -0.02);
    pivot.add(wing);
    bird.add(pivot);
    wings[side < 0 ? 'left' : 'right'] = pivot;
  }
  return { bird, wings, plumage };
}

export function buildMascotAura() {
  const root = new THREE.Group();
  root.name = 'tier-aura';

  // Ground marks live in their own group so the per-frame floor compensation
  // (seated poses lift mascot.group; the ring must stay on the boards) never
  // touches the body-centred sparks or the bird.
  const ground = new THREE.Group();
  root.add(ground);

  const ringGeo = new THREE.CircleGeometry(0.78, 40);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    map: makeRingTexture(), transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.03;
  ground.add(ring);

  // Rune ring, just above the soft pool and just under the rays.
  const glyphGeo = new THREE.CircleGeometry(0.70, 36);
  glyphGeo.rotateX(-Math.PI / 2);
  const glyphMat = new THREE.MeshBasicMaterial({
    map: makeGlyphTexture(), transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const glyph = new THREE.Mesh(glyphGeo, glyphMat);
  glyph.position.y = 0.038;
  ground.add(glyph);

  // Pulse ripple: one mesh re-scaled from the centre on a period rather than a
  // spawned pool, because only ever one is in flight and a pool would allocate.
  const rippleGeo = new THREE.CircleGeometry(1, 28);
  rippleGeo.rotateX(-Math.PI / 2);
  const rippleMat = new THREE.MeshBasicMaterial({
    map: makeRippleTexture(), transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const ripple = new THREE.Mesh(rippleGeo, rippleMat);
  ripple.position.y = 0.034;
  ground.add(ripple);

  const raysGeo = new THREE.CircleGeometry(0.62, 32);
  raysGeo.rotateX(-Math.PI / 2);
  const raysMat = new THREE.MeshBasicMaterial({
    map: makeRaysTexture(), transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const rays = new THREE.Mesh(raysGeo, raysMat);
  rays.position.y = 0.045;
  ground.add(rays);

  // One fixed buffer; tiers select a draw range into it. Golden-ratio offsets
  // spread the orbit so no two sparks share a column or a height band.
  const sparkPositions = new Float32Array(MAX_SPARKS * 3);
  for (let i = 0; i < MAX_SPARKS; i++) {
    const angle = i * 2.399963;
    const radius = 0.5 + 0.18 * ((i * 0.618) % 1);
    sparkPositions[i * 3] = Math.sin(angle) * radius;
    sparkPositions[i * 3 + 1] = 0.25 + 1.3 * ((i * 0.382) % 1);
    sparkPositions[i * 3 + 2] = Math.cos(angle) * radius;
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  sparkGeo.computeBoundingSphere();
  const sparkMat = new THREE.PointsMaterial({
    map: makeSparkTexture(), size: 0.06, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  root.add(sparks);

  const { bird, wings, plumage } = buildCompanionBird();
  bird.position.set(0.34, 1.46, 0.02);
  root.add(bird);

  // Sparks drift upward from their authored height and wrap, so the ring of
  // glints reads as embers coming off the character rather than as a fixed
  // constellation turning with them. The base heights are kept because the
  // wrap has to return to them exactly.
  const sparkBaseY = new Float32Array(MAX_SPARKS);
  for (let i = 0; i < MAX_SPARKS; i++) sparkBaseY[i] = sparkPositions[i * 3 + 1];
  const SPARK_RISE = 0.55;
  // The bounding sphere was computed from the authored heights, and the drift
  // walks points above them. Left alone, the whole cloud pops out at the top
  // of the frame in a close-up — the frustum test is against a sphere that no
  // longer contains it. Grown once, here, rather than recomputed per frame.
  sparkGeo.boundingSphere.radius += SPARK_RISE;

  const state = {
    params: null,
    ringBase: new THREE.Color(),
    glyphBase: new THREE.Color(),
    rippleBase: new THREE.Color(),
    sparkBase: new THREE.Color(),
    perchBlend: 1,
  };

  // Additive blending over the warm wood floor is an uphill fight for anything
  // that isn't already warm: the floor's own red channel is near the top of the
  // range, so adding a half-saturated colour lands on white and the tier reads
  // as "a glow" rather than as its accent. Rare's denim blue is the case that
  // proves it. Pushing saturation before the intensity scale keeps the hue
  // legible against the boards; gold and purple barely move, blue survives.
  const scratchHSL = { h: 0, s: 0, l: 0 };
  function accentTint(out, hex, scale) {
    out.setHex(hex).getHSL(scratchHSL);
    return out
      .setHSL(scratchHSL.h, Math.min(1, scratchHSL.s * 1.75), scratchHSL.l)
      .multiplyScalar(scale);
  }

  // `tier` is a GIFT_TIERS entry ({ id, accent }) or null. Only recolours and
  // toggles — nothing is created, so a reroll costs no allocation and no
  // program link.
  function setTier(tier) {
    const params = tier ? AURA_TIERS[tier.id] : null;
    state.params = params || null;
    root.visible = Boolean(params);
    if (!params) return;
    accentTint(state.ringBase, tier.accent, params.ring);
    ringMat.color.copy(state.ringBase);
    // The rune ring and the ripple carry more white than the pool: at these
    // line widths a saturated accent turns to mud against the boards, and the
    // hue is already established by the pool underneath them.
    accentTint(state.glyphBase, tier.accent, params.glyph).lerp(WHITE, 0.25);
    glyphMat.color.copy(state.glyphBase);
    glyph.visible = params.glyph > 0;
    accentTint(state.rippleBase, tier.accent, params.ripple).lerp(WHITE, 0.2);
    ripple.visible = params.ripple > 0;
    rays.visible = params.rays > 0;
    accentTint(raysMat.color, tier.accent, params.rays);
    // Sparks keep a lift toward white — they read as glints rather than as
    // coloured dots, and at 6 cm they are too small to carry a hue on their own.
    accentTint(state.sparkBase, tier.accent, 1).lerp(WHITE, 0.35);
    sparkMat.color.copy(state.sparkBase);
    sparkMat.size = params.sparkSize;
    sparkGeo.setDrawRange(0, params.sparks);
    sparks.visible = params.sparks > 0;
    bird.visible = params.bird;
    // The bird is lit geometry, not additive, so it keeps the plain accent —
    // the saturation push exists to survive additive blending and would only
    // make the plumage garish here.
    plumage.color.setHex(tier.accent).lerp(WHITE, 0.3);
    plumage.emissive.setHex(tier.accent);
  }

  function updateBird(t, dt, reduced, holdPerch) {
    // Perch on the right shoulder while the visitor plays (orbiting through a
    // piano cabinet breaks the toy) and under reduced motion; otherwise cycle
    // a long circling flight with a shoulder rest.
    const cycle = t % 17;
    const wantsPerch = reduced || holdPerch || cycle >= 11;
    const target = wantsPerch ? 1 : 0;
    state.perchBlend += (target - state.perchBlend) * Math.min(1, dt * 2.2);
    const blend = THREE.MathUtils.smoothstep(state.perchBlend, 0.02, 0.98);

    const angle = t * 1.5;
    const orbitX = Math.sin(angle) * 0.62;
    const orbitZ = Math.cos(angle) * 0.62;
    const orbitY = 1.12 + Math.sin(t * 2.3) * 0.07;
    bird.position.set(
      THREE.MathUtils.lerp(orbitX, 0.34, blend),
      THREE.MathUtils.lerp(orbitY, 1.46, blend),
      THREE.MathUtils.lerp(orbitZ, 0.02, blend),
    );
    // Face the direction of travel in flight, drift to the mascot's forward
    // (+ a little outward) at the perch; steer the shortest way around.
    const targetYaw = blend > 0.5 ? 0.3 : angle + Math.PI / 2;
    const yawDelta = Math.atan2(Math.sin(targetYaw - bird.rotation.y), Math.cos(targetYaw - bird.rotation.y));
    bird.rotation.y += yawDelta * Math.min(1, dt * 8);
    bird.rotation.z = Math.sin(t * 3.1) * 0.06 * (1 - blend);

    const flap = reduced ? 0 : Math.sin(t * THREE.MathUtils.lerp(15, 6, blend));
    const raise = THREE.MathUtils.lerp(0.3 + flap * 0.6, -0.35 + flap * 0.04, blend);
    wings.left.rotation.z = -raise;
    wings.right.rotation.z = raise;
  }

  // Called unconditionally from the frame loop — the aura keeps breathing
  // while the reveal card is up, which is exactly when the visitor is staring
  // at their character. `holdPerch` is main.js telling the bird the visitor is
  // at an instrument (orbiting through a piano cabinet breaks the toy).
  function update(t, dt, holdPerch = false) {
    const params = state.params;
    if (!params || !root.visible) return;
    const parent = root.parent;
    const parentY = parent ? parent.position.y : 0;
    const scaleY = parent ? Math.max(0.2, parent.scale.y) : 1;
    // Seated poses and the dance bounce lift mascot.group; counter that so the
    // ring stays on the floor. A fall (parentY < 0) rides the body instead —
    // the fall fade owns that exit.
    ground.position.y = parentY > 0 ? -parentY / scaleY : 0;

    const reduced = prefersReducedMotion.matches;
    if (reduced) {
      // Every motion here is ambient shimmer, which reduced motion culls — the
      // tier still reads from the mark's shape and colour, standing still.
      ringMat.color.copy(state.ringBase);
      glyph.rotation.y = 0.3;
      glyphMat.color.copy(state.glyphBase);
      ripple.visible = false;
      rays.rotation.y = 0.4;
      sparks.rotation.y = 0;
      sparkMat.size = params.sparkSize;
    } else {
      const pulse = 1 + 0.15 * Math.sin(t * params.ringPulse);
      ringMat.color.copy(state.ringBase).multiplyScalar(pulse);
      // Counter-turn, so pool, runes and sparks never lock into one rotation.
      glyph.rotation.y = t * params.glyphSpin;
      glyphMat.color.copy(state.glyphBase).multiplyScalar(1 + 0.1 * Math.sin(t * params.ringPulse * 0.7));
      rays.rotation.y = t * 0.3;
      sparks.rotation.y = t * params.spin;
      sparkMat.size = params.sparkSize * (1 + 0.22 * Math.sin(t * 3.7));

      // One ripple in flight: phase 0→1 over its period, scaling out and
      // fading. Driven off `t` rather than accumulated, so it cannot drift.
      if (params.ripple > 0) {
        const phase = (t % params.rippleEvery) / params.rippleEvery;
        const eased = phase * (2 - phase);
        ripple.visible = true;
        ripple.scale.setScalar(0.42 + eased * 0.72);
        rippleMat.color.copy(state.rippleBase).multiplyScalar(Math.max(0, 1 - phase) ** 1.6);
      }

      // Rising embers: a shared offset walks every spark up its own column and
      // wraps. 44 floats a frame, no allocation, and it is what makes the
      // orbit feel like it is coming off the character.
      if (params.drift > 0 && params.sparks > 0) {
        const array = sparkGeo.attributes.position.array;
        for (let i = 0; i < params.sparks; i++) {
          const rise = (t * params.drift * 0.42 + i * 0.137) % 1;
          array[i * 3 + 1] = sparkBaseY[i] + rise * SPARK_RISE;
        }
        sparkGeo.attributes.position.needsUpdate = true;
      }
    }
    sparks.visible = params.sparks > 0 && parentY >= -0.02;
    if (bird.visible) updateBird(t, dt, reduced, holdPerch);
  }

  return { group: root, setTier, update };
}
