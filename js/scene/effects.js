// ============================================================
// PLAY FEEDBACK EFFECTS
// Two additive-blended particle systems that answer the player: confetti
// bursts when the vibe meter tops out, and a note glyph that pops out of
// whichever instrument was just struck. Both recycle a fixed pool.
// ============================================================
import * as THREE from 'three';

export class Fireworks {
  constructor(scene) { this.scene = scene; this.bursts = []; }
  spawn(origin) {
    const N = 150;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const vel = [];
    const palette = [new THREE.Color(0x9E33CA), new THREE.Color(0xD1A13B), new THREE.Color(0xFDFBF7), new THREE.Color(0xc988f0)];
    for (let i = 0; i < N; i++) {
      pos.set([origin.x, origin.y, origin.z], i * 3);
      const dir = new THREE.Vector3().randomDirection();
      const speed = 2.5 + Math.random() * 4.5;
      vel.push(dir.multiplyScalar(speed));
      const c = palette[(Math.random() * palette.length) | 0];
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.09, vertexColors: true, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    this.bursts.push({ pts, vel, life: 1.9, max: 1.9 });
  }
  update(dt) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.scene.remove(b.pts);
        b.pts.geometry.dispose();
        b.pts.material.dispose();
        this.bursts.splice(i, 1);
        continue;
      }
      const p = b.pts.geometry.attributes.position.array;
      for (let j = 0; j < b.vel.length; j++) {
        const v = b.vel[j];
        v.y -= 5.2 * dt;
        v.multiplyScalar(1 - 0.9 * dt);
        p[j * 3] += v.x * dt;
        p[j * 3 + 1] += v.y * dt;
        p[j * 3 + 2] += v.z * dt;
      }
      b.pts.geometry.attributes.position.needsUpdate = true;
      b.pts.material.opacity = b.life / b.max;
    }
  }
}

// ============================================================
// NOTE BURSTS (per-play feedback) + FOOTLIGHT HIT PULSE
// ============================================================
function noteGlyphTexture(glyph) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.shadowColor = 'rgba(255,255,255,.9)';
  x.shadowBlur = 14;
  x.fillStyle = '#ffffff';
  x.font = '700 84px "Georgia", serif';
  x.fillText(glyph, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const NOTE_COLORS = {
  drums: 0xc988f0,
  piano: 0xD1A13B,
  guitar: 0xf0b264,
  mic: 0xc988f0,
  loop: 0xFDFBF7,
};
const NOTE_ANCHORS = {
  drums: new THREE.Vector3(-2.8, 2.3, -1.7),
  piano: new THREE.Vector3(3.5, 2.2, -1.3),
  guitar: new THREE.Vector3(-1.35, 1.95, 1.75),
  mic: new THREE.Vector3(1.0, 2.05, 2.4),
};

export class NoteBursts {
  constructor(sceneRef) {
    this.pool = [];
    this.textures = [noteGlyphTexture('♪'), noteGlyphTexture('♫')];
    for (let i = 0; i < 18; i++) {
      const material = new THREE.SpriteMaterial({
        map: this.textures[i % 2],
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(0.34, 0.34, 1);
      sprite.visible = false;
      sceneRef.add(sprite);
      this.pool.push({ sprite, life: 0, max: 1.05, sway: 0, drift: 0 });
    }
    this.cursor = 0;
  }

  spawn(kind) {
    const anchor = NOTE_ANCHORS[kind];
    if (!anchor) return;
    const item = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    item.life = item.max;
    item.sway = Math.random() * Math.PI * 2;
    item.drift = 0.25 + Math.random() * 0.3;
    item.sprite.visible = true;
    item.sprite.material.color.setHex(NOTE_COLORS[kind] ?? 0xFDFBF7);
    item.sprite.material.opacity = 0.95;
    item.sprite.position.set(
      anchor.x + (Math.random() - 0.5) * 0.9,
      anchor.y + Math.random() * 0.25,
      anchor.z + (Math.random() - 0.5) * 0.5,
    );
    item.base = 0.28 + Math.random() * 0.16;
    item.pop = 1;
    item.sprite.scale.set(item.base * 1.35, item.base * 1.35, 1);
  }

  update(dt, reducedMotion) {
    for (const item of this.pool) {
      if (item.life <= 0) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.sprite.visible = false;
        item.sprite.material.opacity = 0;
        continue;
      }
      const k = item.life / item.max;
      item.sprite.position.y += item.drift * dt * (reducedMotion ? 0.4 : 1);
      if (!reducedMotion) {
        item.sprite.position.x += Math.sin(item.sway + (1 - k) * 5.2) * 0.13 * dt;
      }
      // spawn pop that eases back to base scale
      item.pop *= Math.pow(0.001, dt);
      const scale = item.base * (1 + 0.35 * item.pop);
      item.sprite.scale.set(scale, scale, 1);
      item.sprite.material.opacity = k < 0.75 ? k / 0.75 * 0.95 : 0.95;
    }
  }
}

// Footlight response to play events: quick bump that decays. Play feedback is
// kept under prefers-reduced-motion (only ambient shimmer is culled there).
export const hitPulse = { value: 0 };
export function bumpHitPulse(strength = 1) {
  hitPulse.value = Math.min(1.35, hitPulse.value + 0.55 * strength);
}

