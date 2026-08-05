// ============================================================
// INSTRUMENT BUILDING BLOCKS
// The shared palette, material recipes and procedural textures every
// instrument is assembled from — flamed maple, sparkle wrap, brushed cymbal
// and drum head — so the four instruments read as one set.
// ============================================================
import * as THREE from 'three';

export const PURPLE = 0x9E33CA;
export const PURPLE_DARK = 0x5c1876;
export const GOLD = 0xD1A13B;
export const CREAM = 0xFDFBF7;
export const INK = 0x17121c;

export function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15, ...opts });
}
export function metal(color, roughness = 0.28) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.9 });
}
export function lacquer(color, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.28,
    metalness: 0.22,
    clearcoat: 0.7,
    clearcoatRoughness: 0.16,
    ...opts,
  });
}
export function guitarWoodTexture() {
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
export function sparkleWrapTexture() {
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
export function cymbalTexture() {
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
export function drumHeadTexture() {
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

export function cylinderBetween(a, b, r, mat, segments = 8) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, segments), mat);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}
export function markInteract(root, data) {
  root.traverse((o) => { if (o.isMesh) Object.assign(o.userData, data); });
}
