// ============================================================
// MASCOT TIER COMPANION
// The persistent mark of the gift's rarity: the ceremony stays identical for
// everyone (SPEC §13), but the character that walks out of it is accompanied
// by ONE bird — its own species per tier, over a halo that brightens with the
// tier. A timid sparrow keeps to the boards beside a rare character; a swallow
// lands on an epic character's shoulder; the crested songbird perches on a
// legendary character's head, lit from inside, over the brightest halo.
// Common stays alone; the ladder only reads because its bottom rung is
// unmarked.
//
// This replaced the additive aura outright. A glow on the boards fought the
// stage's own lighting and read as a decal; a small creature moving with
// intent reads as *someone's* at any distance, in one glance. One bird rather
// than a flock: two or three of them turned the stage busy and the count was
// doing work the glow does more quietly. So the ladder is now species +
// landing spot + glow — where the bird lands is the loudest rung of it.
//
// Procedural, not generated: a Tripo bird is a fused mesh whose wings cannot
// hinge, and the avian rig has no flight preset to retarget — a generated
// companion would cost ~2 MB per tier and animate worse than these ~9 meshes.
// The generated-asset budget belongs to static hero props (the wardrobe).
//
// All three birds are built once at boot and toggled / recoloured per tier, so
// a 20-pull stress pass allocates nothing (SPEC §13 acceptance). No lights,
// no shadows (the curated shadow rule: only major masses cast), and per-frame
// animation is transform-level only. Material opacity is deliberately never
// written here — the stage-fall fade owns opacity for every material under
// mascot.group, and a second writer would fight its restore on respawn.
// ============================================================
import * as THREE from 'three';
import { prefersReducedMotion } from '../core/quality.js?v=20260813-21';
// Deliberately no instrument-view import: this module is loaded by
// core/studio.js, and view/instrument-presets.js imports studio back — the
// cycle would hit the TDZ at boot. main.js passes the "visitor is at an
// instrument" flag into update() instead.

const WHITE = new THREE.Color(0xffffff);

// A soft accent halo on the boards under the bird's owner. With one bird per
// tier the halo carries more of the ladder than it used to, so it steps up
// more decisively — but the top rung still sits below where the old aura
// started competing with the footlights.
const HALO = { rare: 0.30, epic: 0.46, legendary: 0.66 };
// The bird's own emissive climbs with it: the legendary one is lit from
// inside, the rare one barely.
const PLUMAGE_GLOW = { rare: 0.10, epic: 0.20, legendary: 0.34 };

// Soft pool with a bright rim — one texture carries both, so the halo is a
// single mesh / single draw call.
function makeHaloTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const x = canvas.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,0.14)');
  g.addColorStop(0.44, 'rgba(255,255,255,0.05)');
  g.addColorStop(0.60, 'rgba(255,255,255,0.10)');
  g.addColorStop(0.68, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.76, 'rgba(255,255,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// One bird per tier, each its own species and its own confidence. The rare
// sparrow is timid — low, brief flights under the resting hands, resting on
// the *boards* twice as long as it flies, flapping in a hurry the way small
// birds do. The epic swallow owns the air and lands on the shoulder. The
// legendary songbird flies highest and perches on the crown of the head,
// which is the one landing spot no lesser bird gets.
const FLIGHT = {
  rare: {
    radius: 0.50, height: 0.45, bobRate: 2.9, speed: 1.6, period: 16, flyFor: 7,
    rest: { x: -0.38, y: 0, z: 0.32 }, onFloor: true, restYaw: -0.5, flapRate: 18,
  },
  epic: {
    radius: 0.72, height: 1.02, bobRate: 2.1, speed: 1.35, period: 17, flyFor: 10,
    rest: { x: 0.34, y: 1.46, z: 0.02 }, onFloor: false, restYaw: 0.3, flapRate: 15,
  },
  legendary: {
    radius: 0.66, height: 1.28, bobRate: 2.3, speed: 1.5, period: 17, flyFor: 11,
    rest: { x: 0, y: 1.96, z: 0.02 }, onFloor: false, restYaw: 0, flapRate: 15,
  },
};

// One builder, four authored species-silhouettes, so a flock reads as a
// flock rather than clones. The differences are the ones that carry at stage
// distance: crest, tail shape, body slimness, a dark cap.
// - crest: the "finer bird" tell on the flock's lead; the sparrow goes without
// - tail 'long' | 'forked' | 'fan': songbird / swallow / little tit
// - slim: the swallow's sleeker body and longer wings
// - cap: the tit's dark head cap (shared ink material — never recoloured)
function buildBird({ crest = true, tail = 'long', cap = false, slim = false } = {}) {
  const bird = new THREE.Group();
  const plumage = new THREE.MeshStandardMaterial({ color: 0xE8BE5B, roughness: 0.55, emissive: 0xD1A13B, emissiveIntensity: 0.2 });
  const inkMat = new THREE.MeshStandardMaterial({ color: 0x17121c, roughness: 0.6 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), plumage);
  if (slim) body.scale.set(0.85, 0.78, 1.38);
  else body.scale.set(0.95, 0.85, 1.25);
  bird.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), plumage);
  head.position.set(0, 0.075, 0.085);
  bird.add(head);
  if (cap) {
    const capMesh = new THREE.Mesh(new THREE.SphereGeometry(0.054, 10, 8), inkMat);
    capMesh.scale.set(1, 0.62, 1);
    capMesh.position.set(0, 0.088, 0.083);
    bird.add(capMesh);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 6), inkMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.07, 0.14);
  bird.add(beak);
  if (crest) {
    const crestMesh = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.05, 5), plumage);
    crestMesh.position.set(0, 0.125, 0.06);
    crestMesh.rotation.x = -0.5;
    bird.add(crestMesh);
  }
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 5), inkMat);
    eye.position.set(side * 0.036, 0.088, 0.115);
    bird.add(eye);
  }
  if (tail === 'forked') {
    for (const side of [-1, 1]) {
      const streamer = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.01, 0.14), plumage);
      streamer.position.set(side * 0.02, 0.02, -0.15);
      streamer.rotation.set(-0.3, side * 0.3, 0);
      bird.add(streamer);
    }
  } else if (tail === 'fan') {
    const fan = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.012, 0.07), plumage);
    fan.position.set(0, 0.03, -0.12);
    fan.rotation.x = -0.5;
    bird.add(fan);
  } else {
    const tailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.11), plumage);
    tailMesh.position.set(0, 0.02, -0.14);
    tailMesh.rotation.x = -0.35;
    bird.add(tailMesh);
  }
  const wings = {};
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.06, 0.02, -0.005);
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), plumage);
    if (slim) wing.scale.set(0.26, 0.45, 1.75);
    else wing.scale.set(0.28, 0.5, 1.5);
    wing.position.set(side * 0.05, 0, -0.02);
    pivot.add(wing);
    bird.add(pivot);
    wings[side < 0 ? 'left' : 'right'] = pivot;
  }
  return { bird, wings, plumage };
}

export function buildMascotCompanion() {
  const root = new THREE.Group();
  root.name = 'tier-companion';

  // The halo. Additive over the boards eats saturation (the floor's red
  // channel is near the top of the range), so the accent gets a saturation
  // push before the intensity scale — gold and purple barely move, rare's
  // denim blue survives instead of washing to white.
  const haloGeo = new THREE.CircleGeometry(0.78, 40);
  haloGeo.rotateX(-Math.PI / 2);
  const haloMat = new THREE.MeshBasicMaterial({
    map: makeHaloTexture(), transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.position.y = 0.03;
  root.add(halo);
  const haloBase = new THREE.Color();
  const scratchHSL = { h: 0, s: 0, l: 0 };

  // One bird per tier, each its own species so a reroll changes the creature
  // and not just its colour. All three exist at boot; only one is ever shown.
  // rare — a small crestless sparrow, four-fifths scale.
  const sparrow = buildBird({ crest: false });
  sparrow.bird.scale.setScalar(0.8);
  root.add(sparrow.bird);
  // epic — a slim, forked-tail swallow.
  const swallow = buildBird({ crest: false, tail: 'forked', slim: true });
  swallow.bird.scale.setScalar(0.92);
  swallow.bird.position.set(0.34, 1.46, 0.02);
  root.add(swallow.bird);
  // legendary — the crested songbird, the finest of the three.
  const songbird = buildBird();
  songbird.bird.position.set(0, 1.96, 0.02);
  root.add(songbird.bird);

  const BIRD_OF = { rare: sparrow, epic: swallow, legendary: songbird };

  const state = {
    tierId: null,
    bird: null,
    flight: null,
    rest: 1,
    groundY: 0,
  };

  // `tier` is a GIFT_TIERS entry ({ id, accent }) or null. Only recolours and
  // toggles — nothing is created, so a reroll costs no allocation and no
  // program link. Plumage takes the tier accent lifted toward white (lit
  // geometry, not additive, so the plain accent already survives the stage
  // light) plus a whisper of emissive so the bird reads on a darkened stage.
  function setTier(tier) {
    const bird = tier ? BIRD_OF[tier.id] ?? null : null;
    state.tierId = bird ? tier.id : null;
    state.bird = bird;
    state.flight = bird ? FLIGHT[tier.id] : null;
    root.visible = Boolean(bird);
    sparrow.bird.visible = bird === sparrow;
    swallow.bird.visible = bird === swallow;
    songbird.bird.visible = bird === songbird;
    if (!bird) return;
    // Lit geometry, not additive, so the plain accent already survives the
    // stage light; the lift keeps small birds from turning into dark blobs
    // and the emissive is what climbs with the tier.
    bird.plumage.color.setHex(tier.accent).lerp(WHITE, state.tierId === 'rare' ? 0.4 : 0.28);
    bird.plumage.emissive.setHex(tier.accent);
    bird.plumage.emissiveIntensity = PLUMAGE_GLOW[tier.id] ?? 0.1;
    haloBase.setHex(tier.accent).getHSL(scratchHSL);
    haloBase
      .setHSL(scratchHSL.h, Math.min(1, scratchHSL.s * 1.75), scratchHSL.l)
      .multiplyScalar(HALO[tier.id] ?? 0.3);
    haloMat.color.copy(haloBase);
  }

  // A solo flyer: circle the character at its own height, then land at its
  // rest spot on the boards. The rest y takes the ground offset, so a bird
  // resting beside a seated pianist still stands on the floor.
  // The one flight path, shared by all three birds and differentiated by
  // their FLIGHT entry: circle the character, then land at the tier's rest
  // spot — the boards for rare, the shoulder for epic, the crown of the head
  // for legendary. A floor rest takes the ground offset, so a bird resting
  // beside a seated pianist still stands on the boards.
  function updateFlyer(b, params, t, dt, reduced, hold) {
    const cycle = t % params.period;
    const wantsRest = reduced || hold || cycle >= params.flyFor;
    state.rest += ((wantsRest ? 1 : 0) - state.rest) * Math.min(1, dt * 2.2);
    const blend = THREE.MathUtils.smoothstep(state.rest, 0.02, 0.98);

    const angle = t * params.speed;
    const orbitX = Math.sin(angle) * params.radius;
    const orbitZ = Math.cos(angle) * params.radius;
    const orbitY = params.height + Math.sin(t * params.bobRate) * 0.06;
    const restY = params.onFloor ? state.groundY + 0.015 : params.rest.y;
    b.bird.position.set(
      THREE.MathUtils.lerp(orbitX, params.rest.x, blend),
      THREE.MathUtils.lerp(orbitY, restY, blend),
      THREE.MathUtils.lerp(orbitZ, params.rest.z, blend),
    );
    const targetYaw = blend > 0.5 ? params.restYaw : angle + Math.PI / 2;
    const yawDelta = Math.atan2(Math.sin(targetYaw - b.bird.rotation.y), Math.cos(targetYaw - b.bird.rotation.y));
    b.bird.rotation.y += yawDelta * Math.min(1, dt * 8);
    b.bird.rotation.z = Math.sin(t * 3.1) * 0.06 * (1 - blend);

    const flap = reduced ? 0 : Math.sin(t * THREE.MathUtils.lerp(params.flapRate, 6, blend));
    const raise = THREE.MathUtils.lerp(0.3 + flap * 0.6, -0.35 + flap * 0.04, blend);
    b.wings.left.rotation.z = -raise;
    b.wings.right.rotation.z = raise;
  }

  // Called unconditionally from the frame loop — the companion keeps living
  // while the reveal card is up, which is exactly when the visitor is staring
  // at their character. `hold` is main.js telling the bird the visitor is at
  // an instrument (orbiting through a piano cabinet breaks the toy).
  function update(t, dt, hold = false) {
    if (!state.bird || !root.visible) return;
    const parent = root.parent;
    const parentY = parent ? parent.position.y : 0;
    const scaleY = parent ? Math.max(0.2, parent.scale.y) : 1;
    // Seated poses and the dance bounce lift mascot.group; counter that so a
    // resting bird stays on the floor. A fall (parentY < 0) rides the body
    // instead — the fall fade owns that exit.
    state.groundY = parentY > 0 ? -parentY / scaleY : 0;
    halo.position.y = state.groundY + 0.03;

    const reduced = prefersReducedMotion.matches;
    // The halo breathes, barely; under reduced motion it stands still.
    haloMat.color.copy(haloBase);
    if (!reduced) haloMat.color.multiplyScalar(1 + 0.08 * Math.sin(t * 1.6));
    updateFlyer(state.bird, state.flight, t, dt, reduced, hold);
  }

  return { group: root, setTier, update };
}
