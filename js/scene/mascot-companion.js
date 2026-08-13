// ============================================================
// MASCOT TIER COMPANION
// The persistent mark of the gift's rarity: the ceremony stays identical for
// everyone (SPEC §13), but the character that walks out of it is accompanied
// by birds — one family, and the ladder is the COUNT. One small sparrow makes
// low, timid flights around a rare character and rests on the boards; an epic
// pair circles on opposite orbits and lands on the character's shoulders; a
// legendary trio goes gold and crowns them — both shoulders and the top of
// the head. Common stays alone; the ladder only reads because its bottom
// rung is unmarked.
//
// This replaced the additive aura outright. A glow on the boards fought the
// stage's own lighting and read as a decal; a small creature moving with
// intent reads as *someone's* at any distance, in one glance. All birds on
// purpose: one build reused across tiers keeps the family coherent, and the
// count is legible from the back row — one on the boards, two on your
// shoulders, three golden ones crowning you.
//
// Procedural, not generated: a Tripo bird is a fused mesh whose wings cannot
// hinge, and the avian rig has no flight preset to retarget — a generated
// companion would cost ~2 MB per tier and animate worse than these ~9 meshes.
// The generated-asset budget belongs to static hero props (the wardrobe).
//
// All four birds are built once at boot and toggled / recoloured per tier, so
// a 20-pull stress pass allocates nothing (SPEC §13 acceptance). No lights,
// no shadows (the curated shadow rule: only major masses cast), and per-frame
// animation is transform-level only. Material opacity is deliberately never
// written here — the stage-fall fade owns opacity for every material under
// mascot.group, and a second writer would fight its restore on respawn.
// ============================================================
import * as THREE from 'three';
import { prefersReducedMotion } from '../core/quality.js?v=20260813-16';
// Deliberately no instrument-view import: this module is loaded by
// core/studio.js, and view/instrument-presets.js imports studio back — the
// cycle would hit the TDZ at boot. main.js passes the "visitor is at an
// instrument" flag into update() instead.

const WHITE = new THREE.Color(0xffffff);

// The rare solo flyer, told apart by timidity: low, brief flights — under
// the resting hands — resting twice as long as it flies, flapping in a hurry
// the way small birds do. Its rest spot sits on the boards.
const SPARROW_FLIGHT = {
  radius: 0.5, height: 0.45, bobRate: 2.9, speed: 1.6, period: 16, flyFor: 7,
  rest: { x: -0.38, z: 0.32 }, restYaw: -0.5, flapRate: 18,
};

// One songbird, three voices. The crest is what makes the higher tiers read
// as "a finer bird" at stage distance; the sparrow goes without.
function buildBird({ crest = true } = {}) {
  const bird = new THREE.Group();
  const plumage = new THREE.MeshStandardMaterial({ color: 0xE8BE5B, roughness: 0.55, emissive: 0xD1A13B, emissiveIntensity: 0.2 });
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

export function buildMascotCompanion() {
  const root = new THREE.Group();
  root.name = 'tier-companion';

  // rare: the sparrow — no crest, four-fifths scale, a low flyer.
  const sparrow = buildBird({ crest: false });
  sparrow.bird.scale.setScalar(0.8);
  root.add(sparrow.bird);

  // The flock. A and B serve both epic (a purple pair) and legendary (gold);
  // C flies only for legendary — the smallest of the three, because its perch
  // is the crown of the head and a big bird up there reads as a hat.
  const birdA = buildBird();
  birdA.bird.position.set(0.34, 1.46, 0.02);
  root.add(birdA.bird);
  const birdB = buildBird();
  birdB.bird.scale.setScalar(0.92);
  birdB.bird.position.set(-0.34, 1.46, 0.02);
  root.add(birdB.bird);
  const birdC = buildBird();
  birdC.bird.scale.setScalar(0.85);
  birdC.bird.position.set(0, 1.96, 0.02);
  root.add(birdC.bird);

  const state = {
    active: null, // 'sparrow' | 'pair' | 'trio' | null
    restSparrow: 1,
    perchA: 1,
    perchB: 1,
    perchC: 1,
    groundY: 0,
  };

  // `tier` is a GIFT_TIERS entry ({ id, accent }) or null. Only recolours and
  // toggles — nothing is created, so a reroll costs no allocation and no
  // program link. Plumage takes the tier accent lifted toward white (lit
  // geometry, not additive, so the plain accent already survives the stage
  // light) plus a whisper of emissive so the bird reads on a darkened stage.
  const COMPANION_OF = { rare: 'sparrow', epic: 'pair', legendary: 'trio' };
  function setTier(tier) {
    state.active = tier ? COMPANION_OF[tier.id] ?? null : null;
    root.visible = Boolean(state.active);
    sparrow.bird.visible = state.active === 'sparrow';
    birdA.bird.visible = state.active === 'pair' || state.active === 'trio';
    birdB.bird.visible = birdA.bird.visible;
    birdC.bird.visible = state.active === 'trio';
    if (!state.active) return;
    const tint = (material, lift, glow) => {
      material.color.setHex(tier.accent).lerp(WHITE, lift);
      material.emissive.setHex(tier.accent);
      material.emissiveIntensity = glow;
    };
    if (state.active === 'sparrow') tint(sparrow.plumage, 0.4, 0.1);
    else {
      // The pair takes epic purple; the trio takes legendary gold — same
      // birds, recoloured, which is what lets two tiers share the build.
      const lift = state.active === 'trio' ? 0.3 : 0.25;
      const glow = state.active === 'trio' ? 0.2 : 0.15;
      tint(birdA.plumage, lift, glow);
      tint(birdB.plumage, lift, glow);
      if (state.active === 'trio') tint(birdC.plumage, lift, glow);
    }
  }

  // A solo flyer: circle the character at its own height, then land at its
  // rest spot on the boards. The rest y takes the ground offset, so a bird
  // resting beside a seated pianist still stands on the floor.
  function updateFlyer(b, params, blendKey, t, dt, reduced, hold) {
    const cycle = t % params.period;
    const wantsRest = reduced || hold || cycle >= params.flyFor;
    state[blendKey] += ((wantsRest ? 1 : 0) - state[blendKey]) * Math.min(1, dt * 2.2);
    const blend = THREE.MathUtils.smoothstep(state[blendKey], 0.02, 0.98);

    const angle = t * params.speed;
    const orbitX = Math.sin(angle) * params.radius;
    const orbitZ = Math.cos(angle) * params.radius;
    const orbitY = params.height + Math.sin(t * params.bobRate) * 0.06;
    b.bird.position.set(
      THREE.MathUtils.lerp(orbitX, params.rest.x, blend),
      THREE.MathUtils.lerp(orbitY, state.groundY + 0.015, blend),
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

  // One bird of the flock — the original golden-bird behaviour, with a time
  // offset, an orbit direction and its own landing spot on the character.
  // All of them perch while the visitor plays: shoulders (and, for the trio,
  // the crown of the head) each get their bird.
  function updateFlockBird(b, blendKey, t, dt, reduced, holdPerch, offset, dir, perch, perchYaw, orbitR, orbitBase) {
    const bt = t + offset;
    const cycle = bt % 17;
    const wantsPerch = reduced || holdPerch || cycle >= 11;
    state[blendKey] += ((wantsPerch ? 1 : 0) - state[blendKey]) * Math.min(1, dt * 2.2);
    const blend = THREE.MathUtils.smoothstep(state[blendKey], 0.02, 0.98);

    const angle = dir * bt * 1.5;
    const orbitX = Math.sin(angle) * orbitR;
    const orbitZ = Math.cos(angle) * orbitR;
    const orbitY = orbitBase + Math.sin(bt * 2.3) * 0.07;
    b.bird.position.set(
      THREE.MathUtils.lerp(orbitX, perch.x, blend),
      THREE.MathUtils.lerp(orbitY, perch.y, blend),
      THREE.MathUtils.lerp(orbitZ, perch.z, blend),
    );
    // Face the direction of travel in flight (which reverses with the orbit),
    // drift to the mascot's forward (+ a little outward) at the perch.
    const targetYaw = blend > 0.5 ? perchYaw : angle + dir * (Math.PI / 2);
    const yawDelta = Math.atan2(Math.sin(targetYaw - b.bird.rotation.y), Math.cos(targetYaw - b.bird.rotation.y));
    b.bird.rotation.y += yawDelta * Math.min(1, dt * 8);
    b.bird.rotation.z = Math.sin(bt * 3.1) * 0.06 * (1 - blend);

    const flap = reduced ? 0 : Math.sin(bt * THREE.MathUtils.lerp(15, 6, blend));
    const raise = THREE.MathUtils.lerp(0.3 + flap * 0.6, -0.35 + flap * 0.04, blend);
    b.wings.left.rotation.z = -raise;
    b.wings.right.rotation.z = raise;
  }

  // Called unconditionally from the frame loop — the companion keeps living
  // while the reveal card is up, which is exactly when the visitor is staring
  // at their character. `hold` is main.js telling the birds the visitor is at
  // an instrument (orbiting through a piano cabinet breaks the toy).
  function update(t, dt, hold = false) {
    if (!state.active || !root.visible) return;
    const parent = root.parent;
    const parentY = parent ? parent.position.y : 0;
    const scaleY = parent ? Math.max(0.2, parent.scale.y) : 1;
    // Seated poses and the dance bounce lift mascot.group; counter that so a
    // resting bird stays on the floor. A fall (parentY < 0) rides the body
    // instead — the fall fade owns that exit.
    state.groundY = parentY > 0 ? -parentY / scaleY : 0;

    const reduced = prefersReducedMotion.matches;
    if (state.active === 'sparrow') {
      updateFlyer(sparrow, SPARROW_FLIGHT, 'restSparrow', t, dt, reduced, hold);
    } else {
      // Offsets stagger the cycles so someone is usually in the air; on a
      // hold everyone lands at once — shoulders (and the head) occupied.
      updateFlockBird(birdA, 'perchA', t, dt, reduced, hold, 0, 1, { x: 0.34, y: 1.46, z: 0.02 }, 0.3, 0.62, 1.12);
      updateFlockBird(birdB, 'perchB', t, dt, reduced, hold, 8.5, -1, { x: -0.34, y: 1.46, z: 0.02 }, -0.3, 0.55, 1.28);
      if (state.active === 'trio') {
        updateFlockBird(birdC, 'perchC', t, dt, reduced, hold, 4.2, 1, { x: 0, y: 1.96, z: 0.02 }, 0, 0.7, 1.45);
      }
    }
  }

  return { group: root, setTier, update };
}
