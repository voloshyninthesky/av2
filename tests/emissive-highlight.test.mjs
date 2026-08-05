import test from 'node:test';
import assert from 'node:assert/strict';

import { glowMesh, unglowMesh } from '../js/view/emissive.js';

function makeMaterial(hex, intensity = 1) {
  let value = hex;
  return {
    emissive: { getHex: () => value, setHex: (next) => { value = next; } },
    emissiveIntensity: intensity,
    userData: {},
  };
}

const REST = 0x120a18;
const GLOW = 0xD1A13B;

test('a glow lifts and drops back to the material rest colour', () => {
  const material = makeMaterial(REST, 0.2);
  const mesh = { material };

  glowMesh(mesh, GLOW, 0.5);
  assert.equal(material.emissive.getHex(), GLOW);
  assert.equal(material.emissiveIntensity, 0.5);

  unglowMesh(mesh);
  assert.equal(material.emissive.getHex(), REST);
  assert.equal(material.emissiveIntensity, 0.2);
});

// The piano cabinet, lid, base and shelf are one lacquer material. Lighting
// them mesh by mesh must not let a later mesh mistake the glow for its rest.
test('meshes sharing a material go dark again after a hover', () => {
  const material = makeMaterial(REST, 0.2);
  const cabinet = { material };
  const lid = { material };

  for (const mesh of [cabinet, lid]) glowMesh(mesh, GLOW, 0.5);
  for (const mesh of [cabinet, lid]) unglowMesh(mesh);

  assert.equal(material.emissive.getHex(), REST);
  assert.equal(material.emissiveIntensity, 0.2);
});

test('a second hover still restores the rest colour', () => {
  const material = makeMaterial(REST, 0.2);
  const cabinet = { material };
  const lid = { material };

  for (const pass of [0, 1]) {
    void pass;
    for (const mesh of [cabinet, lid]) glowMesh(mesh, GLOW, 0.5);
    for (const mesh of [cabinet, lid]) unglowMesh(mesh);
  }

  assert.equal(material.emissive.getHex(), REST);
});

test('an unlit mesh survives a stray release', () => {
  const material = makeMaterial(REST, 0.2);
  unglowMesh({ material });
  assert.equal(material.emissive.getHex(), REST);
  assert.equal(material.emissiveIntensity, 0.2);
  unglowMesh(null);
  unglowMesh({});
});
