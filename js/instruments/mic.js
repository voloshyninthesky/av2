// ============================================================
// VOCAL MICROPHONE
// Ribbon mic on a boom stand, with a cable that grounds it to the stage.
// ============================================================
import * as THREE from 'three';
import {
  GOLD,
  markInteract,
  metal,
  std,
} from './shared.js?v=20260813-24';

export function buildMic() {
  const mic = new THREE.Group();
  const chrome = metal(0xd9d9e2, 0.14);
  chrome.emissive = new THREE.Color(0xffffff);
  chrome.emissiveIntensity = 0.045;
  const darkMetal = metal(0x2c2c34, 0.4);

  // round base with a rubber edge ring + stage cable running off to the wing
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.05, 28), darkMetal);
  base.position.y = 0.025;
  mic.add(base);
  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.295, 0.014, 6, 28), std(0x17121c, { roughness: 0.92 }));
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = 0.012;
  mic.add(baseRing);
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.24, 0.03, -0.08),
    new THREE.Vector3(0.5, 0.015, -0.28),
    new THREE.Vector3(0.9, 0.012, -0.3),
    new THREE.Vector3(1.3, 0.012, -0.12),
  ]);
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(cableCurve, 16, 0.016, 6),
    std(0x131019, { roughness: 0.9, metalness: 0.05 }),
  );
  mic.add(cable);
  const xlr = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.09, 8), chrome);
  xlr.rotation.z = Math.PI / 2;
  xlr.rotation.y = 0.4;
  xlr.position.set(0.3, 0.032, -0.13);
  mic.add(xlr);

  // pole + clutch
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.32, 10), chrome);
  pole.position.y = 0.71;
  mic.add(pole);
  const clutch = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.07, 10), metal(GOLD, 0.35));
  clutch.position.y = 1.38;
  mic.add(clutch);

  // head (tilts slightly back)
  const headGroup = new THREE.Group();
  // dark windscreen core caged by the chrome rings/ribs — vintage grille read
  const capsule = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.093, 0.14, 8, 18),
    std(0x241d2e, { roughness: 0.92, metalness: 0.04 }),
  );
  headGroup.add(capsule);
  // grille rings
  const micInstance = new THREE.Object3D();
  const grilleRings = new THREE.InstancedMesh(
    new THREE.TorusGeometry(0.097, 0.009, 8, 26),
    chrome,
    5,
  );
  for (let i = 0; i < 5; i++) {
    micInstance.position.set(0, -0.08 + i * 0.045, 0);
    micInstance.rotation.set(Math.PI / 2, 0, 0);
    micInstance.updateMatrix();
    grilleRings.setMatrixAt(i, micInstance.matrix);
  }
  grilleRings.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  grilleRings.computeBoundingSphere();
  headGroup.add(grilleRings);
  // vertical ribs
  const grilleRibs = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.008, 0.2, 0.008),
    chrome,
    6,
  );
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    micInstance.position.set(Math.cos(a) * 0.096, 0, Math.sin(a) * 0.096);
    micInstance.rotation.set(0, 0, 0);
    micInstance.updateMatrix();
    grilleRibs.setMatrixAt(i, micInstance.matrix);
  }
  grilleRibs.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  grilleRibs.computeBoundingSphere();
  headGroup.add(grilleRibs);
  // gold band
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.096, 0.014, 8, 26), metal(GOLD, 0.3));
  band.rotation.x = Math.PI / 2;
  band.position.y = -0.13;
  headGroup.add(band);
  // yoke
  const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.014, 8, 20, Math.PI), darkMetal);
  yoke.rotation.z = Math.PI;
  yoke.position.y = -0.16;
  headGroup.add(yoke);

  headGroup.position.y = 1.56;
  headGroup.rotation.x = -0.18;
  mic.add(headGroup);

  // feedback pulse ring on the floor
  const pulseMat = new THREE.MeshBasicMaterial({
    color: GOLD, transparent: true, opacity: 0, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pulse = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 8, 40), pulseMat);
  pulse.rotation.x = Math.PI / 2;
  pulse.position.y = 0.02;
  pulse.visible = false;
  mic.add(pulse);

  const micHitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const lowHit = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.24, 0.65), micHitMat);
  lowHit.position.y = 0.12;
  lowHit.visible = false;
  mic.add(lowHit);
  const midHit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.76, 0.3), micHitMat);
  midHit.position.y = 0.86;
  midHit.visible = false;
  mic.add(midHit);
  const highHit = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), micHitMat);
  highHit.position.y = 1.55;
  highHit.visible = false;
  mic.add(highHit);

  // The stand is a pitch axis and always was: three zones climbing it, low to
  // high. What changed is that they carry a scale *degree* rather than a fixed
  // frequency — this layer sits below play/ and cannot know what key the stage
  // is in, so it names the degree and lets the router resolve it. Reaching
  // higher also brightens the vowel, which is what a voice does anyway.
  markInteract(headGroup, { instrument: 'mic', vocalDegree: 5, vocalVowel: 0.15 });
  markInteract(pole, { instrument: 'mic', vocalDegree: 3, vocalVowel: 0.5 });
  markInteract(base, { instrument: 'mic', vocalDegree: 1, vocalVowel: 0.85 });
  markInteract(highHit, { instrument: 'mic', vocalDegree: 5, vocalVowel: 0.15 });
  markInteract(midHit, { instrument: 'mic', vocalDegree: 3, vocalVowel: 0.5 });
  markInteract(lowHit, { instrument: 'mic', vocalDegree: 1, vocalVowel: 0.85 });
  // Same rule as the guitar: base, pole and head capsule define the shadow;
  // grille rings, ribs, bands and the XLR do not.
  const micShadowCasters = new Set([base, pole, capsule]);
  mic.traverse((o) => { if (o.isMesh) o.castShadow = micShadowCasters.has(o); });

  let bob = 0, pulseT = 0, time = 0;
  // Where the sung note sits in the voice's range, 0 low to 1 high, eased
  // towards rather than snapped so a glide reads as one movement. The mic is
  // the ribbon's other notation surface: the stand already says "up is
  // higher" — the three hit zones climb it in pitch order — so the head lifts
  // with the note instead of only nodding that a note happened.
  let reach = 0.5, reachTarget = 0.5;

  return {
    group: mic,
    label: 'Вокал',
    labelAnchor: new THREE.Vector3(0, 2.2, 0),
    sing(pitch = null) {
      bob = 1;
      pulseT = 1;
      pulse.visible = true;
      if (Number.isFinite(pitch)) reachTarget = Math.max(0, Math.min(1, pitch));
    },
    update(dt) {
      time += dt;
      bob *= Math.pow(0.02, dt);
      reach += (reachTarget - reach) * Math.min(1, dt * 9);
      const lift = (reach - 0.5) * 0.34;
      const idleNod = Math.sin(time * 0.85) * 0.02;
      const idleRoll = Math.sin(time * 0.6) * 0.012;
      headGroup.rotation.x = -0.18 - lift + Math.sin(time * 18) * bob * 0.16 + idleNod;
      headGroup.rotation.z = Math.sin(time * 14) * bob * 0.1 + idleRoll;
      if (pulseT > 0) {
        pulseT = Math.max(0, pulseT - dt * 1.4);
        const p = 1 - pulseT;
        pulse.scale.setScalar(1 + p * 3.2);
        pulseMat.opacity = pulseT * 0.7;
        if (pulseT === 0) pulse.visible = false;
      }
    },
  };
}
