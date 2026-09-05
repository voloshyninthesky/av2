import * as THREE from 'three';
import { registerDimmableEmissive } from '../core/quality.js?v=20260905-06';

// Flat woven rug grounds the kit without changing its playable height or routes.
// Repeated acoustic slats and brass rails use three draws for both stage wings.
export function buildStageDetails() {
  const group = new THREE.Group();
  group.name = 'stage-acoustic-details';
  const canvas = document.createElement('canvas');
  canvas.width = 768; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#30242d'; ctx.fillRect(0, 0, 768, 512);
  for (const [inset, color, width] of [[12, '#b89968', 4], [26, '#82634f', 12], [44, '#b89968', 2], [61, '#806653', 2]]) {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.strokeRect(inset, inset, 768 - inset * 2, 512 - inset * 2);
  }
  ctx.strokeStyle = '#9b7d614d'; ctx.lineWidth = 2;
  for (let y = 92; y < 440; y += 48) for (let x = 92; x < 710; x += 48) {
    ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x + 14, y);
    ctx.lineTo(x, y + 14); ctx.lineTo(x - 14, y); ctx.closePath(); ctx.stroke();
  }
  // Deterministic thread pattern, no grain texture downloads or random rebuilds.
  ctx.lineWidth = 1;
  for (let y = 0; y < 512; y += 3) {
    ctx.strokeStyle = y % 2 ? '#ffffff0c' : '#00000025';
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(768, y); ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 3.2), new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(-2.8, .009, -1.7);
  rug.receiveShadow = true; group.add(rug);

  const matrix = new THREE.Matrix4();
  const panels = new THREE.InstancedMesh(new THREE.BoxGeometry(1.55, 4.4, .14), new THREE.MeshStandardMaterial({ color: 0x151b1e, roughness: .96 }), 2);
  const slats = new THREE.InstancedMesh(new THREE.BoxGeometry(.052, 4.3, .12), new THREE.MeshStandardMaterial({ color: 0x82624b, roughness: .72, metalness: .08 }), 24);
  const railMat = new THREE.MeshStandardMaterial({ color: 0xc6a373, emissive: 0xd7ae76, emissiveIntensity: .45, roughness: .42, metalness: .65 });
  registerDimmableEmissive(railMat);
  const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(.025, 4.5, .035), railMat, 4);
  let n = 0, r = 0;
  for (const [i, side] of [-1, 1].entries()) {
    const x = side * 4.7;
    panels.setMatrixAt(i, matrix.makeTranslation(x, 2.65, -5.56));
    for (let j = 0; j < 12; j++) slats.setMatrixAt(n++, matrix.makeTranslation(x - .66 + j * .12, 2.65, -5.42));
    for (const offset of [-.82, .82]) rails.setMatrixAt(r++, matrix.makeTranslation(x + offset, 2.65, -5.4));
  }
  for (const mesh of [panels, slats, rails]) { mesh.computeBoundingSphere(); group.add(mesh); }
  return group;
}
