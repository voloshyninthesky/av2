// ============================================================
// PROCEDURAL CANVAS TEXTURES
// Every surface the stage needs is painted at runtime so the site ships no
// image assets: planks with a matching roughness map, velvet, the title
// slide, speaker grille cloth, and the soft sprites particles ride on.
// ============================================================
import * as THREE from 'three';

export function woodTexture() {
  // Staggered varnished planks + matching roughness map so the key light
  // produces streaky lacquer highlights instead of one flat pink wash.
  const SIZE = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const x = c.getContext('2d');
  const rough = document.createElement('canvas');
  rough.width = rough.height = SIZE;
  const rx = rough.getContext('2d');
  rx.fillStyle = '#8c8c8c';
  rx.fillRect(0, 0, SIZE, SIZE);

  const ROWS = 12;
  const H = SIZE / ROWS;
  for (let row = 0; row < ROWS; row++) {
    const y0 = row * H;
    const stagger = ((row % 3) / 3) * SIZE * 0.5;
    for (let seg = -1; seg < 3; seg++) {
      const x0 = seg * (SIZE / 2) + stagger;
      const w = SIZE / 2;
      const shade = 0.78 + Math.random() * 0.34;
      const warm = 0.92 + Math.random() * 0.16;
      const grad = x.createLinearGradient(x0, y0, x0, y0 + H);
      grad.addColorStop(0, `rgb(${118 * shade * warm | 0},${76 * shade | 0},${44 * shade | 0})`);
      grad.addColorStop(0.5, `rgb(${128 * shade * warm | 0},${84 * shade | 0},${50 * shade | 0})`);
      grad.addColorStop(1, `rgb(${106 * shade * warm | 0},${68 * shade | 0},${40 * shade | 0})`);
      x.fillStyle = grad;
      x.fillRect(x0, y0, w, H);
      // grain
      x.strokeStyle = `rgba(58,32,14,${0.16 + Math.random() * 0.18})`;
      x.lineWidth = 1;
      for (let i = 0; i < 9; i++) {
        const gy = y0 + 4 + Math.random() * (H - 8);
        x.beginPath();
        x.moveTo(x0, gy);
        x.bezierCurveTo(
          x0 + w * 0.3, gy + Math.random() * 8 - 4,
          x0 + w * 0.7, gy + Math.random() * 8 - 4,
          x0 + w, gy,
        );
        x.stroke();
      }
      // occasional knot
      if (Math.random() < 0.16) {
        const kx = x0 + 40 + Math.random() * (w - 80);
        const ky = y0 + H * (0.3 + Math.random() * 0.4);
        x.strokeStyle = 'rgba(52,28,12,.26)';
        x.lineWidth = 1.2;
        for (let r = 3; r < 9; r += 3.2) {
          x.beginPath();
          x.ellipse(kx, ky, r * 1.5, r, 0.15, 0, Math.PI * 2);
          x.stroke();
        }
      }
      // butt seam + nails
      x.fillStyle = 'rgba(28,14,7,.85)';
      x.fillRect(x0 + w - 2, y0, 3, H);
      x.fillStyle = 'rgba(30,20,14,.9)';
      x.beginPath();
      x.arc(x0 + w - 12, y0 + H * 0.28, 2.2, 0, Math.PI * 2);
      x.arc(x0 + w - 12, y0 + H * 0.72, 2.2, 0, Math.PI * 2);
      x.fill();
      // roughness: varnish streaks along the plank (dark = glossy)
      const glossy = 96 + ((Math.random() * 70) | 0);
      rx.fillStyle = `rgb(${glossy},${glossy},${glossy})`;
      rx.fillRect(x0, y0 + 2, w, H - 4);
      rx.fillStyle = 'rgba(215,215,215,.9)';
      rx.fillRect(x0, y0, w, 2.5);
    }
    // long row gap
    x.fillStyle = 'rgba(30,16,8,.7)';
    x.fillRect(0, y0 - 1, SIZE, 1.8);
    rx.fillStyle = 'rgb(225,225,225)';
    rx.fillRect(0, y0 - 1, SIZE, 1.8);
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2.6, 2.1);
  t.anisotropy = 8;
  const r = new THREE.CanvasTexture(rough);
  r.wrapS = r.wrapT = THREE.RepeatWrapping;
  r.repeat.set(2.6, 2.1);
  r.anisotropy = 4;
  return { map: t, roughnessMap: r };
}

export function curtainTexture() {
  // Velvet with asymmetric fold lighting: broad lit face, tight shadow core,
  // subtle nap sparkle, and slight fold drift so pleats do not tile visibly.
  const c = document.createElement('canvas');
  c.width = 512; c.height = 1024;
  const x = c.getContext('2d');
  x.fillStyle = '#1c0a28';
  x.fillRect(0, 0, 512, 1024);
  const FOLDS = 12;
  const fw = 512 / FOLDS;
  for (let i = 0; i < FOLDS; i++) {
    const x0 = i * fw;
    const drift = Math.sin(i * 2.7) * fw * 0.1;
    const g = x.createLinearGradient(x0 + drift, 0, x0 + fw + drift, 0);
    g.addColorStop(0, '#160722');
    g.addColorStop(0.22, '#3b1554');
    g.addColorStop(0.48, '#5c2478');
    g.addColorStop(0.58, '#6b2f88');
    g.addColorStop(0.72, '#43185e');
    g.addColorStop(1, '#160722');
    x.fillStyle = g;
    x.fillRect(x0 - 2, 0, fw + 4, 1024);
  }
  // velvet nap: faint vertical noise streaks
  for (let i = 0; i < 340; i++) {
    const sx = Math.random() * 512;
    const sy = Math.random() * 1024;
    const len = 20 + Math.random() * 90;
    x.strokeStyle = `rgba(${Math.random() < 0.5 ? '201,136,240' : '90,40,120'},${0.03 + Math.random() * 0.05})`;
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(sx, sy);
    x.lineTo(sx + Math.random() * 4 - 2, sy + len);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// Plane with sinusoidal pleat depth so curtain silhouettes read as cloth from
// oblique camera angles, not as flat posters.
export function makeCurtainGeometry(width, height, folds, depth) {
  const geo = new THREE.PlaneGeometry(width, height, folds * 6, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const u = (px / width + 0.5) * folds * Math.PI * 2;
    const taper = 0.75 + 0.25 * Math.sin((px / width) * Math.PI);
    pos.setZ(i, (Math.sin(u) * 0.5 + Math.sin(u * 0.5 + 1.3) * 0.5) * depth * taper);
  }
  geo.computeVertexNormals();
  return geo;
}

// title slide (first frame of the backdrop slideshow + fallback)
export function titleSlideTexture() {
  const c = document.createElement('canvas');
  c.width = 1600; c.height = 900;
  const x = c.getContext('2d');
  x.fillStyle = '#160a20';
  x.fillRect(0, 0, 1600, 900);
  const glow = x.createRadialGradient(800, 430, 60, 800, 430, 700);
  glow.addColorStop(0, 'rgba(158,51,202,.4)');
  glow.addColorStop(1, 'rgba(158,51,202,0)');
  x.fillStyle = glow;
  x.fillRect(0, 0, 1600, 900);
  x.strokeStyle = '#D1A13B';
  x.lineWidth = 6;
  x.strokeRect(36, 36, 1528, 828);
  x.strokeStyle = 'rgba(209,161,59,.35)';
  x.lineWidth = 2;
  x.strokeRect(56, 56, 1488, 788);
  x.textAlign = 'center';
  x.fillStyle = '#D1A13B';
  x.shadowColor = '#9E33CA';
  x.shadowBlur = 60;
  x.font = 'italic 900 210px "Playfair Display", Georgia, serif';
  x.fillText('ART VIBE', 800, 445);
  x.shadowBlur = 22;
  x.fillStyle = '#c988f0';
  x.font = '500 62px "Unbounded", sans-serif';
  x.fillText('S T U D I O', 800, 560);
  x.shadowBlur = 0;
  x.fillStyle = '#FDFBF7';
  x.font = '700 38px "Unbounded", sans-serif';
  x.fillText('ВЧИСЬ ТВОРИТИ І ТВОРИ НАВЧАЮЧИСЬ', 800, 690);
  x.fillStyle = '#D1A13B';
  x.font = '400 30px "JetBrains Mono", monospace';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// small brand plate under the screen
export function plateTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = '#160a20';
  x.fillRect(0, 0, 1024, 160);
  x.strokeStyle = '#D1A13B';
  x.lineWidth = 5;
  x.strokeRect(8, 8, 1008, 144);
  x.textAlign = 'center';
  x.fillStyle = '#D1A13B';
  x.font = '700 62px "Unbounded", sans-serif';
  x.fillText('ART VIBE STUDIO', 512, 103);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// speaker/monitor cloth: perforated grille with a soft top sheen
export function perforatedTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const base = x.createLinearGradient(0, 0, 0, 256);
  base.addColorStop(0, '#242030');
  base.addColorStop(1, '#141018');
  x.fillStyle = base;
  x.fillRect(0, 0, 256, 256);
  for (let gy = 6; gy < 256; gy += 12) {
    for (let gx = 6 + ((gy / 12) % 2) * 6; gx < 256; gx += 12) {
      x.fillStyle = 'rgba(5,3,8,.9)';
      x.beginPath();
      x.arc(gx, gy, 3.1, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = 'rgba(120,105,140,.24)';
      x.beginPath();
      x.arc(gx - 0.8, gy - 0.8, 1.1, 0, Math.PI * 2);
      x.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// soft round sprite shared by dust motes and star-drop pins so additive
// particles read as light points, not hard screen-space squares
let softDiscTextureCache = null;
export function softDiscTexture() {
  if (softDiscTextureCache) return softDiscTextureCache;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const grad = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grad;
  x.fillRect(0, 0, 64, 64);
  softDiscTextureCache = new THREE.CanvasTexture(c);
  return softDiscTextureCache;
}

// soft radial blob for fake contact shadows under props and instruments
export function contactShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const grad = x.createRadialGradient(128, 128, 12, 128, 128, 126);
  grad.addColorStop(0, 'rgba(4,2,8,.62)');
  grad.addColorStop(0.55, 'rgba(4,2,8,.4)');
  grad.addColorStop(1, 'rgba(4,2,8,0)');
  x.fillStyle = grad;
  x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
