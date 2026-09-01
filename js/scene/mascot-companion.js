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
// doing work the glow does more quietly. So the ladder is species + landing
// spot + glow — where the bird lands is the loudest rung of it.
//
// The bird is one creature on every character. It rides mascot.group, whose
// scale is the height / build draw, so without correction a tall thin
// character carried a tall thin bird and the giant carried a giant one — the
// bird looked drawn with the body instead of alighting on it. setTier divides
// the build back out, and the perches are measured from the rig as actually
// built (bare scalp, hair cap or headphone band; the shoulder cap) rather than
// from one authored height, so the songbird sits on a bald crown instead of
// hovering over it.
//
// Procedural, not generated: a Tripo bird is a fused mesh whose wings cannot
// hinge, and the avian rig has no flight preset to retarget — a generated
// companion would cost ~2 MB per tier and animate worse than these ~10 meshes.
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
import { prefersReducedMotion } from '../core/quality.js?v=20260901-01';
// Deliberately no instrument-view import: this module is loaded by
// core/studio.js, and view/instrument-presets.js imports studio back — the
// cycle would hit the TDZ at boot. main.js passes the "visitor is at an
// instrument" flag into update() instead.

const WHITE = new THREE.Color(0xffffff);

// A soft accent halo on the boards under the bird's owner. With one bird per
// tier the halo carries more of the ladder than it used to, so it steps up
// decisively in both brightness and reach — rare stays the quiet rung, and
// the top rung still sits below where the old aura started competing with
// the footlights.
const HALO = { rare: 0.30, epic: 0.55, legendary: 0.80 };
const HALO_SCALE = { rare: 1.0, epic: 1.1, legendary: 1.22 };
// The bird's own emissive climbs with it: the legendary one is lit from
// inside, the rare one barely.
const PLUMAGE_GLOW = { rare: 0.10, epic: 0.22, legendary: 0.30 };
// Bird size at a 100 / 100 build. setTier divides the character's build back
// out of these, so the bird is the same creature on every body.
const BIRD_SCALE = { rare: 0.8, epic: 0.92, legendary: 1.0 };
// Clearance between a perched belly and the surface it sits on.
const PERCH_CLEARANCE = 0.004;

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
// sparrow is timid — brief flights, and the only bird that rests on the
// *boards* rather than on the character, in bounding flight the way small
// birds fly: a burst of flapping, then wings tucked for the dip. It flies at
// waist height and wide of the arms: the resting hands reach ~0.45 out and
// hang near 0.78 up, so a narrower orbit at this height would fly it straight
// through them. The epic swallow owns the air on long spread-wing glides and
// lands on the shoulder. The legendary songbird flies highest — a circle at
// eye level, the one altitude no lesser bird reaches — and perches on the
// crown of the head, which is the one landing spot no lesser bird gets.
//
// `glide` is the wing habit between flap bursts: 'tuck' folds the wings in
// (bounding flight, phase-locked to the bob so the bird climbs while it
// flaps and dips while tucked), 'spread' holds them out flat. `bank` is how
// far the bird leans into its own turn.
const FLIGHT = {
  rare: {
    radius: 0.66, height: 0.80, bob: 0.08, bobRate: 2.9, speed: 1.6, period: 16, flyFor: 7,
    perch: 'floor', rest: { x: -0.38, z: 0.32 }, restYaw: -0.5,
    flapRate: 18, glide: 'tuck', glideRate: 0, bank: 0.26,
  },
  epic: {
    radius: 0.72, height: 1.02, bob: 0.06, bobRate: 2.1, speed: 1.35, period: 17, flyFor: 10,
    perch: 'shoulder', rest: { x: 0.02, z: 0.02 }, restYaw: 0.3,
    flapRate: 15, glide: 'spread', glideRate: 1.1, bank: 0.42,
  },
  legendary: {
    radius: 0.70, height: 1.72, bob: 0.06, bobRate: 2.3, speed: 1.5, period: 17, flyFor: 11,
    perch: 'crown', rest: { x: 0, z: 0.02 }, restYaw: 0,
    flapRate: 15, glide: 'spread', glideRate: 0.9, bank: 0.34,
  },
};

// One builder, authored species-silhouettes, so the three read as three
// birds rather than three clones. The differences are the ones that carry at
// stage distance: crest, tail shape, body slimness, a dark cap, and the
// wing — a real span out to the side, thin, that folds back along the flank
// when the bird lands.
// - crest: the "finer bird" tell on the songbird; the sparrow goes without
// - tail 'long' | 'forked' | 'fan': songbird / swallow / little tit
// - slim: the swallow's sleeker body and longer, swept wings
// - cap: a dark head cap (shared ink material — never recoloured)
// Every bird is two-tone — a paler breast under the plumage — because at
// close range (the reveal portrait, the instrument close-ups) a single-colour
// blob reads as a chick, and a light belly is the second-strongest "bird"
// tell after the silhouette.
function buildBird({ crest = true, tail = 'long', cap = false, slim = false, phase = 0 } = {}) {
  const bird = new THREE.Group();
  // Bank about the nose, pitch about the (banked) shoulders, then yaw to the
  // heading. The default XYZ order would pitch about the world axis instead.
  bird.rotation.order = 'YXZ';
  const plumage = new THREE.MeshStandardMaterial({ color: 0xE8BE5B, roughness: 0.55, emissive: 0xD1A13B, emissiveIntensity: 0.2 });
  const breast = new THREE.MeshStandardMaterial({ color: 0xF3E2A8, roughness: 0.6, emissive: 0xD1A13B, emissiveIntensity: 0.1 });
  const inkMat = new THREE.MeshStandardMaterial({ color: 0x17121c, roughness: 0.6 });

  const bodyScale = slim ? [0.85, 0.78, 1.38] : [0.95, 0.85, 1.25];
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), plumage);
  body.scale.set(...bodyScale);
  bird.add(body);
  const breastMesh = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), breast);
  breastMesh.scale.set(bodyScale[0] * 0.82, bodyScale[1] * 0.8, bodyScale[2] * 0.8);
  breastMesh.position.set(0, -0.02, 0.038);
  bird.add(breastMesh);

  // The head is its own pivot so a perched bird can look about.
  const head = new THREE.Group();
  head.position.set(0, 0.075, 0.085);
  bird.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), plumage));
  if (cap) {
    const capMesh = new THREE.Mesh(new THREE.SphereGeometry(0.054, 10, 8), inkMat);
    capMesh.scale.set(1, 0.62, 1);
    capMesh.position.set(0, 0.013, -0.002);
    head.add(capMesh);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 6), inkMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.005, 0.058);
  head.add(beak);
  if (crest) {
    const crestMesh = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.055, 5), plumage);
    crestMesh.position.set(0, 0.052, -0.022);
    crestMesh.rotation.x = -0.55;
    head.add(crestMesh);
  }
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 5), inkMat);
    eye.position.set(side * 0.038, 0.014, 0.034);
    head.add(eye);
  }

  // The tail hangs off its own root so it can flick.
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.02, -0.085);
  bird.add(tailGroup);
  if (tail === 'forked') {
    for (const side of [-1, 1]) {
      const streamer = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.01, 0.14), plumage);
      streamer.position.set(side * 0.02, 0, -0.065);
      streamer.rotation.set(-0.3, side * 0.3, 0);
      tailGroup.add(streamer);
    }
  } else if (tail === 'fan') {
    const fan = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.012, 0.07), plumage);
    fan.position.set(0, 0.01, -0.035);
    fan.rotation.x = -0.5;
    tailGroup.add(fan);
  } else {
    const tailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.11), plumage);
    tailMesh.position.set(0, 0, -0.055);
    tailMesh.rotation.x = -0.35;
    tailGroup.add(tailMesh);
  }

  // Wings: a flattened ellipsoid spanning out from a pivot at the shoulder.
  // rotation.z on the pivot is the flap (tip up / down); rotation.y sweeps
  // the span back along the flank for the perched fold.
  const wings = {};
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.062, 0.02, -0.005);
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), plumage);
    if (slim) {
      wing.scale.set(1.9, 0.18, 0.7);
      wing.position.set(side * 0.09, 0, -0.012);
    } else {
      wing.scale.set(1.5, 0.22, 0.88);
      wing.position.set(side * 0.075, 0, -0.008);
    }
    pivot.add(wing);
    bird.add(pivot);
    wings[side < 0 ? 'left' : 'right'] = pivot;
  }
  // Belly line below the bird's origin — what a perch height is measured to.
  const footDrop = 0.075 * bodyScale[1];
  return { bird, wings, head, tail: tailGroup, plumage, breast, footDrop, phase, sweep: slim ? 0.3 : 0 };
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
  // rare — a small crestless sparrow.
  const sparrow = buildBird({ crest: false, phase: 0 });
  root.add(sparrow.bird);
  // epic — a slim, forked-tail, dark-capped swallow.
  const swallow = buildBird({ crest: false, tail: 'forked', slim: true, cap: true, phase: 1.7 });
  root.add(swallow.bird);
  // legendary — the crested songbird, the finest of the three.
  const songbird = buildBird({ phase: 3.1 });
  root.add(songbird.bird);

  const BIRD_OF = { rare: sparrow, epic: swallow, legendary: songbird };

  const state = {
    tierId: null,
    bird: null,
    flight: null,
    rest: 1,
    restX: 0,
    restY: 0,
    restZ: 0,
    groundY: 0,
    lastOwnerX: null,
    lastOwnerZ: null,
    ownerMoving: 0,
  };

  // The birds climb a METAL ladder — pewter, silver, gold — while the tier
  // accent stays on the halo, which is where the accent belongs. A violet
  // swallow read as a toy; silver stands beside the pewter sparrow as plainly
  // one rank finer, and leaves gold alone at the top. The finish is a real
  // metal now, not a flat tint: the stage's environment map puts a highlight
  // on silver and gold under the key light, and the accent-tinted plumage no
  // longer needs to be lifted almost to white to survive it. Pewter stays
  // dull. Lit geometry, not additive, plus the emissive that climbs with the
  // tier so the bird reads on a darkened stage.
  function dressBird(bird, tier) {
    const glow = PLUMAGE_GLOW[tier.id] ?? 0.1;
    if (tier.id === 'epic') {
      bird.plumage.color.setHex(0xd9e2ea);
      bird.plumage.emissive.setHex(0x9fb6cc);
      bird.plumage.metalness = 0.55;
      bird.plumage.roughness = 0.30;
      bird.breast.color.setHex(0xf6f8fa);
      bird.breast.emissive.setHex(0xb9c9d8);
      bird.breast.metalness = 0.25;
      bird.breast.roughness = 0.42;
    } else if (tier.id === 'legendary') {
      // Deeper than the accent itself: under the key light a gold this
      // reflective plus its own glow reads as cream unless the base colour
      // has somewhere darker to start from. The accent stays on the halo.
      bird.plumage.color.setHex(0xB88A1C);
      bird.plumage.emissive.setHex(tier.accent);
      bird.plumage.metalness = 0.7;
      bird.plumage.roughness = 0.3;
      bird.breast.color.setHex(0xE3C25E);
      bird.breast.emissive.setHex(tier.accent);
      bird.breast.metalness = 0.35;
      bird.breast.roughness = 0.42;
    } else {
      bird.plumage.color.setHex(tier.accent).lerp(WHITE, 0.4);
      bird.plumage.emissive.setHex(tier.accent);
      bird.plumage.metalness = 0.18;
      bird.plumage.roughness = 0.62;
      bird.breast.color.setHex(tier.accent).lerp(WHITE, 0.72);
      bird.breast.emissive.setHex(tier.accent);
      bird.breast.metalness = 0.08;
      bird.breast.roughness = 0.7;
    }
    bird.plumage.emissiveIntensity = glow;
    bird.breast.emissiveIntensity = glow * 0.55;
    bird.plumage.envMapIntensity = 1.3;
    bird.breast.envMapIntensity = 1.0;
  }

  // `tier` is a GIFT_TIERS entry ({ id, accent }) or null. `fit` is how the
  // character was built — the crown height and shoulder perch from the rig,
  // and the height / build draw as fractions of 100 — so the bird lands on
  // the head that is actually there and keeps one world size on top of it.
  // Only recolours, rescales and toggles — nothing is created, so a reroll
  // costs no allocation and no program link.
  function setTier(tier, fit = {}) {
    const bird = tier ? BIRD_OF[tier.id] ?? null : null;
    state.tierId = bird ? tier.id : null;
    state.bird = bird;
    state.flight = bird ? FLIGHT[tier.id] : null;
    root.visible = Boolean(bird);
    sparrow.bird.visible = bird === sparrow;
    swallow.bird.visible = bird === swallow;
    songbird.bird.visible = bird === songbird;
    if (!bird) return;
    dressBird(bird, tier);

    const width = fit.build?.width > 0 ? fit.build.width : 1;
    const height = fit.build?.height > 0 ? fit.build.height : 1;
    const size = BIRD_SCALE[tier.id] ?? 1;
    bird.bird.scale.set(size / width, size / height, size / width);

    const flight = state.flight;
    const shoulder = fit.shoulder ?? { x: 0.318, y: 1.377, z: 0 };
    const crownY = Number.isFinite(fit.crownY) ? fit.crownY : 1.887;
    const belly = bird.footDrop * bird.bird.scale.y + PERCH_CLEARANCE;
    if (flight.perch === 'shoulder') {
      state.restX = shoulder.x + flight.rest.x;
      state.restY = shoulder.y + belly;
      state.restZ = shoulder.z + flight.rest.z;
    } else if (flight.perch === 'crown') {
      state.restX = flight.rest.x;
      state.restY = crownY + belly;
      state.restZ = flight.rest.z;
    } else {
      state.restX = flight.rest.x;
      state.restY = belly; // plus the live ground offset, added per frame
      state.restZ = flight.rest.z;
    }

    haloBase.setHex(tier.accent).getHSL(scratchHSL);
    haloBase
      .setHSL(scratchHSL.h, Math.min(1, scratchHSL.s * 1.75), scratchHSL.l)
      .multiplyScalar(HALO[tier.id] ?? 0.3);
    haloMat.color.copy(haloBase);
    halo.scale.setScalar(HALO_SCALE[tier.id] ?? 1);
  }

  // The one flight path, shared by all three birds and differentiated by
  // their FLIGHT entry: circle the character, then land at the tier's rest
  // spot — the boards for rare, the shoulder for epic, the crown of the head
  // for legendary. A floor rest takes the ground offset, so a bird resting
  // beside a seated pianist still stands on the boards.
  //
  // `ownerMoving` sends a FLOOR-rester back into the air: its rest spot is
  // body-relative (the whole companion rides mascot.group), so a walking
  // owner would drag a sitting bird across the boards — a bird sliding on
  // its feet reads as a glitch where a perched bird riding a shoulder reads
  // as a perch. Birds take off when their person walks; they land again when
  // the person stops.
  //
  // What makes it read as flight rather than an orbiting prop: the bird
  // banks into its own turn, its nose follows the climb and the dip, the
  // wings flap in bursts and glide between them, and it flares — nose up,
  // wings spread — through the landing. Perched, it keeps living in small
  // ways: the head snaps between looks the way a bird's does, the tail
  // flicks, and every so often the wings ruffle.
  function updateFlyer(b, params, t, dt, reduced, hold) {
    const cycle = t % params.period;
    const grounded = params.perch === 'floor' && state.ownerMoving > 0.5;
    const wantsRest = !grounded && (reduced || hold || cycle >= params.flyFor);
    state.rest += ((wantsRest ? 1 : 0) - state.rest) * Math.min(1, dt * 2.2);
    const blend = THREE.MathUtils.smoothstep(state.rest, 0.02, 0.98);
    // Peaks midway through a landing or a takeoff — the braking flare.
    const flare = Math.sin(Math.PI * THREE.MathUtils.smoothstep(state.rest, 0.1, 0.9));

    const angle = t * params.speed;
    const orbitX = Math.sin(angle) * params.radius;
    const orbitZ = Math.cos(angle) * params.radius;
    const bobPhase = t * params.bobRate;
    const orbitY = params.height + Math.sin(bobPhase) * params.bob;
    const restY = params.perch === 'floor' ? state.groundY + state.restY : state.restY;
    b.bird.position.set(
      THREE.MathUtils.lerp(orbitX, state.restX, blend),
      THREE.MathUtils.lerp(orbitY, restY, blend),
      THREE.MathUtils.lerp(orbitZ, state.restZ, blend),
    );
    const targetYaw = blend > 0.5 ? params.restYaw : angle + Math.PI / 2;
    const yawDelta = Math.atan2(Math.sin(targetYaw - b.bird.rotation.y), Math.cos(targetYaw - b.bird.rotation.y));
    b.bird.rotation.y += yawDelta * Math.min(1, dt * 8);
    // Bank into the turn (the orbit's centre is on the bird's own +x side),
    // pitch with the vertical velocity, flare nose-up through the landing.
    const climb = Math.cos(bobPhase) * params.bobRate * params.bob;
    const airPitch = -Math.atan2(climb, params.speed * params.radius) * 0.8;
    b.bird.rotation.z = -params.bank * (1 - blend);
    b.bird.rotation.x = airPitch * (1 - blend) - 0.45 * flare;

    // Wings. Airborne: flap bursts with a glide habit between them. Perched:
    // folded back along the flank, tips down, with the occasional ruffle.
    let raiseFly;
    let foldFly = b.sweep;
    if (reduced) {
      raiseFly = 0.15;
    } else {
      const flap = Math.sin(t * params.flapRate);
      const flapping = 0.25 + flap * 0.6;
      if (params.glide === 'tuck') {
        // Phase-locked to the bob: climb while flapping, dip while tucked.
        const burst = THREE.MathUtils.smoothstep(0.5 + 0.5 * Math.cos(bobPhase), 0.3, 0.65);
        raiseFly = THREE.MathUtils.lerp(-0.5, flapping, burst);
        foldFly = THREE.MathUtils.lerp(0.9, 0, burst);
      } else {
        const burst = THREE.MathUtils.smoothstep(0.5 + 0.5 * Math.sin(t * params.glideRate + b.phase), 0.35, 0.6);
        raiseFly = THREE.MathUtils.lerp(0.12, flapping, burst);
      }
    }
    const ruffle = reduced ? 0 : Math.pow(Math.max(0, Math.sin(t * 0.41 + b.phase)), 40) * Math.abs(Math.sin(t * 30));
    const raiseRest = -0.45 + ruffle * 0.5;
    let raise = THREE.MathUtils.lerp(raiseFly, raiseRest, blend);
    let fold = THREE.MathUtils.lerp(foldFly, 1.2, blend);
    raise = THREE.MathUtils.lerp(raise, 0.3, flare * 0.8);
    fold = THREE.MathUtils.lerp(fold, 0, flare * 0.8);
    b.wings.left.rotation.z = -raise;
    b.wings.right.rotation.z = raise;
    b.wings.left.rotation.y = -fold;
    b.wings.right.rotation.y = fold;

    // Perched life: a bird's head does not turn, it snaps between looks and
    // holds each one. Airborne it faces the way it flies.
    const perched = blend > 0.9 && !reduced;
    const look = perched
      ? THREE.MathUtils.clamp(Math.round(Math.sin(t * 0.9 + b.phase) * 1.1 + Math.sin(t * 0.37 + b.phase * 2) * 0.5), -1, 1) * 0.55
      : 0;
    b.head.rotation.y += (look - b.head.rotation.y) * Math.min(1, dt * 12);
    b.head.rotation.z = perched ? Math.sin(t * 0.53 + b.phase) * 0.12 : 0;
    b.tail.rotation.x = perched ? -0.4 * Math.pow(Math.max(0, Math.sin(t * 1.9 + b.phase)), 16) : 0;
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

    // Owner motion, from the parent's own XZ delta — no upward import needed.
    // Smoothed, and speed-capped so a respawn teleport cannot latch "moving";
    // the smoothing also keeps the takeoff/landing from flickering at the
    // start and end of a walk.
    if (parent) {
      const dx = parent.position.x - (state.lastOwnerX ?? parent.position.x);
      const dz = parent.position.z - (state.lastOwnerZ ?? parent.position.z);
      state.lastOwnerX = parent.position.x;
      state.lastOwnerZ = parent.position.z;
      const speed = Math.hypot(dx, dz) / Math.max(dt, 1e-4);
      const moving = speed > 0.15 && speed < 20 ? 1 : 0;
      state.ownerMoving += (moving - state.ownerMoving) * Math.min(1, dt * 6);
    }

    const reduced = prefersReducedMotion.matches;
    // The halo breathes, barely; under reduced motion it stands still.
    haloMat.color.copy(haloBase);
    if (!reduced) haloMat.color.multiplyScalar(1 + 0.08 * Math.sin(t * 1.6));
    updateFlyer(state.bird, state.flight, t, dt, reduced, hold);
  }

  return { group: root, setTier, update };
}
