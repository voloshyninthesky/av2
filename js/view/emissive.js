// ============================================================
// EMISSIVE HIGHLIGHTS
// Hover glow and onboarding pulses paint straight onto materials, and the
// instruments share materials across many meshes (one lacquer for the whole
// piano cabinet). So the rest colour is remembered per material, not per mesh:
// remembering it per mesh let the second mesh of a shared material record the
// first one's glow as its "base", and the instrument stayed lit forever.
// ============================================================

/** Capture the unlit colour once, before anything has tinted this material. */
function rememberRest(material) {
  if (material.userData._baseEmissive === undefined) {
    material.userData._baseEmissive = material.emissive.getHex();
    material.userData._baseEI = material.emissiveIntensity ?? 1;
  }
}

export function glowMesh(mesh, hex, intensity) {
  const material = mesh?.material;
  if (!material?.emissive) return;
  rememberRest(material);
  material.emissive.setHex(hex);
  material.emissiveIntensity = intensity;
}

export function unglowMesh(mesh) {
  const material = mesh?.material;
  if (!material?.emissive || material.userData._baseEmissive === undefined) return;
  material.emissive.setHex(material.userData._baseEmissive);
  material.emissiveIntensity = material.userData._baseEI;
}
