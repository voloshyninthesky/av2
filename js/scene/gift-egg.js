// ============================================================
// GIFT EGG
// The egg the mascot hatches out of. Built once at boot and kept invisible
// between ceremonies — js/mascot/reveal.js only ever moves, scales and recolours
// it, so opening a gift allocates nothing.
//
// Two shell halves that separate along a **jagged seam**, because a clean
// equatorial cut reads as a sliced egg rather than a hatched one. The seam is a
// five-lobe wave, so the two halves interlock and the crack is legible from any
// stage angle. Both halves are generated from one surface function, which is
// what keeps them watertight against each other.
//
// Three meshes, two materials, no lights. A PointLight inside would sell the
// leak, but adding one lazily changes the scene's light count and three.js then
// relinks every lit program — the exact stall warmQualitySwitch() exists to
// avoid, landing mid-ceremony. The additive glow shell plus the bloom ramp do
// the same job for free.
// ============================================================
import * as THREE from 'three';

const SHELL = 0xFDFBF7;

// Fat end down, ~1.4:1 tall — the proportion that reads "egg" rather than
// "ovoid blob". R is the equatorial radius before the asymmetry factor.
const R = 0.27;
const H = 0.78;
const BULGE = 0.18;
// Above the equator, so the smaller piece is the one that pops off.
const SEAM = 0.60;
const SEAM_WAVE = 0.04;
const SEAM_LOBES = 5;

const COLUMNS = 32;
const ROWS_BOTTOM = 14;
const ROWS_TOP = 10;

const seamAt = (u) => SEAM + SEAM_WAVE * Math.sin(u * SEAM_LOBES);

// v = 0 at the bottom pole, 1 at the top. The (1 + BULGE·cosθ) factor widens
// the lower half and narrows the upper one, which is the whole egg shape.
function eggPoint(u, v, target) {
  const theta = v * Math.PI;
  const radius = R * Math.sin(theta) * (1 + BULGE * Math.cos(theta));
  return target.set(
    radius * Math.cos(u),
    H * 0.5 * (1 - Math.cos(theta)),
    radius * Math.sin(u),
  );
}

// One half of the shell as a (columns × rows) grid, with each column spanning
// its own slice of v so the shared edge lands on the jagged seam.
function buildShellHalf(rows, vAt) {
  const positions = new Float32Array((COLUMNS + 1) * (rows + 1) * 3);
  const point = new THREE.Vector3();
  let offset = 0;
  for (let i = 0; i <= COLUMNS; i++) {
    // The last column repeats the first so the wrap seam gets its own normals
    // instead of being smoothed across the whole egg.
    const u = (i / COLUMNS) * Math.PI * 2;
    for (let j = 0; j <= rows; j++) {
      eggPoint(u, vAt(u, j / rows), point);
      positions[offset++] = point.x;
      positions[offset++] = point.y;
      positions[offset++] = point.z;
    }
  }
  const indices = [];
  for (let i = 0; i < COLUMNS; i++) {
    for (let j = 0; j < rows; j++) {
      const a = i * (rows + 1) + j;
      const b = a + rows + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

export function buildGiftEgg() {
  const group = new THREE.Group();
  group.name = 'giftEgg';

  const shell = new THREE.MeshStandardMaterial({
    color: SHELL, roughness: 0.72, metalness: 0.03,
    side: THREE.DoubleSide, // the open seam shows the inside of both halves
  });
  const glowMat = new THREE.MeshBasicMaterial({
    color: SHELL, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });

  // Bottom: pole → seam. Top: seam → pole. Same surface, complementary ranges.
  const shellBottom = new THREE.Mesh(
    buildShellHalf(ROWS_BOTTOM, (u, t) => seamAt(u) * t),
    shell,
  );
  shellBottom.castShadow = true;
  group.add(shellBottom);

  const shellTop = new THREE.Mesh(
    buildShellHalf(ROWS_TOP, (u, t) => { const s = seamAt(u); return s + (1 - s) * t; }),
    shell,
  );
  shellTop.castShadow = true;
  group.add(shellTop);

  // Sits just under the seam, so the light reads as coming from inside the egg
  // as the halves part rather than from a lamp hovering over it.
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), glowMat);
  glow.scale.set(R * 0.78, H * 0.30, R * 0.78);
  glow.position.y = H * SEAM * 0.82;
  group.add(glow);

  return {
    group,
    body: shellBottom,
    lid: shellTop,
    glow,
    mats: { shell, glow: glowMat },
    // The top half is modelled in place, so its rest offset is zero.
    lidRestY: 0,
    topY: H,
  };
}
