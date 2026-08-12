// ============================================================
// MASCOT WALK COLLISION + ROUTING
// The stage is a 2D walkable plane with convex-hull footprints punched out of
// it by whatever the instruments and props actually occupy. Footprints come
// from visible geometry, so hiding dressing on the low tier also opens the
// floor. Routes are shortest paths over the expanded footprint corners, which
// keeps the mascot from clipping a speaker stack on the way to the piano.
// ============================================================
import * as THREE from 'three';
import { mascotCfg, MASCOT_BASE_SCALE } from './appearance.js?v=20260813-02';

const walkColliders = [];
let walkColliderRoots = [];
// Injected by main.js: clamps a point to the mascot's travel bounds. Routing
// has to respect the same limit the walk loop does, or it plans through walls.
let clampMascotPoint = (point) => point;

/** Wire up the collider sources and stage-bounds policy, then take a reading. */
export function configureWalkColliders({ roots, clampPoint }) {
  walkColliderRoots = roots;
  clampMascotPoint = clampPoint;
  refreshWalkColliders();
}

const WALK_COLLISION_STEP = 0.08;
const WALK_ROUTE_CLEARANCE = 0.1;

function convexHullXZ(points) {
  const sorted = points
    .map((point) => ({ x: point.x, z: point.z }))
    .sort((a, b) => a.x - b.x || a.z - b.z)
    .filter((point, index, all) => (
      index === 0
      || Math.abs(point.x - all[index - 1].x) > 1e-6
      || Math.abs(point.z - all[index - 1].z) > 1e-6
    ));
  if (sorted.length <= 2) return sorted;
  const cross = (a, b, c) => (
    (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
  );
  const lower = [];
  for (const point of sorted) {
    while (
      lower.length >= 2
      && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 1e-8
    ) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let index = sorted.length - 1; index >= 0; index--) {
    const point = sorted[index];
    while (
      upper.length >= 2
      && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 1e-8
    ) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function visibleWalkFootprint(root) {
  const points = [];
  const corner = new THREE.Vector3();
  const instanceMatrix = new THREE.Matrix4();
  const worldMatrix = new THREE.Matrix4();
  root.updateWorldMatrix(true, true);
  root.traverse((object) => {
    if (!object.isMesh || !object.visible || object.userData.walkCollider === false) return;
    const geometry = object.geometry;
    if (!geometry) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;
    const appendBox = (matrix) => {
      for (const x of [geometry.boundingBox.min.x, geometry.boundingBox.max.x]) {
        for (const y of [geometry.boundingBox.min.y, geometry.boundingBox.max.y]) {
          for (const z of [geometry.boundingBox.min.z, geometry.boundingBox.max.z]) {
            corner.set(x, y, z).applyMatrix4(matrix);
            points.push({ x: corner.x, z: corner.z });
          }
        }
      }
    };
    if (object.isInstancedMesh) {
      for (let index = 0; index < object.count; index++) {
        object.getMatrixAt(index, instanceMatrix);
        worldMatrix.multiplyMatrices(object.matrixWorld, instanceMatrix);
        appendBox(worldMatrix);
      }
    } else {
      appendBox(object.matrixWorld);
    }
  });
  return convexHullXZ(points);
}

export function refreshWalkColliders() {
  walkColliders.length = 0;
  for (const { id, root } of walkColliderRoots) {
    const points = visibleWalkFootprint(root);
    if (points.length < 3) continue;
    walkColliders.push({
      id,
      points,
      minX: Math.min(...points.map((point) => point.x)),
      maxX: Math.max(...points.map((point) => point.x)),
      minZ: Math.min(...points.map((point) => point.z)),
      maxZ: Math.max(...points.map((point) => point.z)),
    });
  }
}

function mascotWalkRadius() {
  return 0.29 * MASCOT_BASE_SCALE * (mascotCfg.width / 100) + 0.075;
}

function closestPointOnWalkEdge(point, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz;
  const amount = lengthSq > 1e-10
    ? THREE.MathUtils.clamp(((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSq, 0, 1)
    : 0;
  return {
    point: new THREE.Vector3(a.x + dx * amount, 0, a.z + dz * amount),
    edge: new THREE.Vector3(dx, 0, dz),
  };
}

function pointInsideWalkPolygon(point, points) {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const a = points[index];
    const b = points[previous];
    if (
      ((a.z > point.z) !== (b.z > point.z))
      && point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x
    ) inside = !inside;
  }
  return inside;
}

function closestWalkColliderContact(point, collider) {
  let closest = null;
  for (let index = 0; index < collider.points.length; index++) {
    const a = collider.points[index];
    const b = collider.points[(index + 1) % collider.points.length];
    const contact = closestPointOnWalkEdge(point, a, b);
    const distanceSq = contact.point.distanceToSquared(point);
    if (!closest || distanceSq < closest.distanceSq) {
      contact.edge.normalize();
      // Convex hull vertices are counter-clockwise: the right-hand edge normal
      // points away from the visible object.
      contact.normal = new THREE.Vector3(contact.edge.z, 0, -contact.edge.x);
      closest = { ...contact, distanceSq };
    }
  }
  const inside = pointInsideWalkPolygon(point, collider.points);
  if (!inside && closest?.distanceSq > 1e-10) {
    closest.normal.subVectors(point, closest.point).normalize();
  }
  return { ...closest, inside };
}

function pointHitsWalkCollider(point, padding = mascotWalkRadius()) {
  for (const collider of walkColliders) {
    if (
      point.x < collider.minX - padding || point.x > collider.maxX + padding
      || point.z < collider.minZ - padding || point.z > collider.maxZ + padding
    ) continue;
    const contact = closestWalkColliderContact(point, collider);
    if (contact.inside || contact.distanceSq <= padding * padding) {
      return { collider, contact };
    }
  }
  return null;
}

function walkSegmentsIntersect(a, b, c, d) {
  const cross = (p, q, r) => (
    (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x)
  );
  const onSegment = (p, q, r) => (
    q.x >= Math.min(p.x, r.x) - 1e-8 && q.x <= Math.max(p.x, r.x) + 1e-8
    && q.z >= Math.min(p.z, r.z) - 1e-8 && q.z <= Math.max(p.z, r.z) + 1e-8
  );
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  if (
    ((abC > 1e-8 && abD < -1e-8) || (abC < -1e-8 && abD > 1e-8))
    && ((cdA > 1e-8 && cdB < -1e-8) || (cdA < -1e-8 && cdB > 1e-8))
  ) return true;
  return (
    (Math.abs(abC) <= 1e-8 && onSegment(a, c, b))
    || (Math.abs(abD) <= 1e-8 && onSegment(a, d, b))
    || (Math.abs(cdA) <= 1e-8 && onSegment(c, a, d))
    || (Math.abs(cdB) <= 1e-8 && onSegment(c, b, d))
  );
}

function walkSegmentHitsCollider(a, b, collider, padding) {
  if (
    Math.max(a.x, b.x) < collider.minX - padding
    || Math.min(a.x, b.x) > collider.maxX + padding
    || Math.max(a.z, b.z) < collider.minZ - padding
    || Math.min(a.z, b.z) > collider.maxZ + padding
  ) return false;
  const paddingSq = padding * padding;
  if (
    pointInsideWalkPolygon(a, collider.points)
    || pointInsideWalkPolygon(b, collider.points)
  ) return true;
  for (let index = 0; index < collider.points.length; index++) {
    const c = collider.points[index];
    const d = collider.points[(index + 1) % collider.points.length];
    if (walkSegmentsIntersect(a, b, c, d)) return true;
    const distanceSq = Math.min(
      closestPointOnWalkEdge(a, c, d).point.distanceToSquared(a),
      closestPointOnWalkEdge(b, c, d).point.distanceToSquared(b),
      closestPointOnWalkEdge(c, a, b).point.distanceToSquared(new THREE.Vector3(c.x, 0, c.z)),
      closestPointOnWalkEdge(d, a, b).point.distanceToSquared(new THREE.Vector3(d.x, 0, d.z)),
    );
    if (distanceSq <= paddingSq) return true;
  }
  return false;
}

function mascotWalkSegmentIsClear(a, b, padding = mascotWalkRadius()) {
  return !walkColliders.some((collider) => walkSegmentHitsCollider(a, b, collider, padding));
}

function expandedWalkColliderPoints(collider, padding) {
  return collider.points.map((point, index, points) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const previousEdge = new THREE.Vector2(point.x - previous.x, point.z - previous.z).normalize();
    const nextEdge = new THREE.Vector2(next.x - point.x, next.z - point.z).normalize();
    const previousNormal = new THREE.Vector2(previousEdge.y, -previousEdge.x);
    const nextNormal = new THREE.Vector2(nextEdge.y, -nextEdge.x);
    const bisector = previousNormal.add(nextNormal);
    const denominator = Math.max(0.2, bisector.dot(nextNormal));
    bisector.multiplyScalar(padding / denominator);
    return new THREE.Vector3(point.x + bisector.x, 0, point.z + bisector.y);
  });
}

export function projectMascotToWalkablePoint(point) {
  const projected = clampMascotPoint(point.clone());
  const edgeGap = 0.015;
  for (let attempt = 0; attempt < walkColliders.length * 2; attempt++) {
    const hit = pointHitsWalkCollider(projected);
    if (!hit) break;
    projected.copy(hit.contact.point)
      .addScaledVector(hit.contact.normal, mascotWalkRadius() + edgeGap);
    projected.copy(clampMascotPoint(projected));
  }
  return projected;
}

export function planMascotWalkRoute(start, destination) {
  const from = clampMascotPoint(start.clone());
  const to = projectMascotToWalkablePoint(destination);
  const radius = mascotWalkRadius();
  if (mascotWalkSegmentIsClear(from, to, radius)) return [to];

  const nodes = [from, to];
  for (const collider of walkColliders) {
    const corners = expandedWalkColliderPoints(collider, radius + WALK_ROUTE_CLEARANCE);
    for (const point of corners) {
      const corner = clampMascotPoint(point);
      if (!pointHitsWalkCollider(corner, radius)) nodes.push(corner);
    }
  }

  const costs = Array(nodes.length).fill(Infinity);
  const previous = Array(nodes.length).fill(-1);
  const visited = Array(nodes.length).fill(false);
  costs[0] = 0;
  for (let pass = 0; pass < nodes.length; pass++) {
    let current = -1;
    for (let index = 0; index < nodes.length; index++) {
      if (!visited[index] && (current < 0 || costs[index] < costs[current])) current = index;
    }
    if (current < 0 || !Number.isFinite(costs[current]) || current === 1) break;
    visited[current] = true;
    for (let next = 0; next < nodes.length; next++) {
      if (visited[next] || !mascotWalkSegmentIsClear(nodes[current], nodes[next], radius)) continue;
      const cost = costs[current] + nodes[current].distanceTo(nodes[next]);
      if (cost < costs[next]) {
        costs[next] = cost;
        previous[next] = current;
      }
    }
  }
  if (!Number.isFinite(costs[1])) return [to];
  const route = [];
  for (let index = 1; index !== 0; index = previous[index]) {
    if (index < 0) return [to];
    route.push(nodes[index].clone());
  }
  return route.reverse();
}

export function nearestInstrumentWalkPoint(kind, origin) {
  const collider = walkColliders.find((candidate) => candidate.id === kind);
  if (!collider) return null;

  // Arrive at the closest clear edge of an instrument rather than walking to
  // the seated/performance pose inside its geometry. The focus transition can
  // then place the mascot precisely, without making their visible route take
  // an arbitrary long way around the same instrument.
  const contact = closestWalkColliderContact(origin, collider);
  const point = contact.point.clone()
    .addScaledVector(contact.normal, mascotWalkRadius() + 0.06);
  return clampMascotPoint(point);
}

export function moveMascotWithColliders(position, direction, distance) {
  const steps = Math.max(1, Math.ceil(distance / WALK_COLLISION_STEP));
  const step = direction.clone().multiplyScalar(distance / steps);
  const radius = mascotWalkRadius();
  for (let index = 0; index < steps; index++) {
    const proposed = clampMascotPoint(position.clone().add(step));
    if (!pointHitsWalkCollider(proposed, radius)) {
      position.copy(proposed);
      continue;
    }
    const hit = pointHitsWalkCollider(proposed, radius);
    const slide = step.clone();
    const intoSurface = slide.dot(hit.contact.normal);
    if (intoSurface < 0) slide.addScaledVector(hit.contact.normal, -intoSurface);
    const slid = clampMascotPoint(position.clone().add(slide));
    if (!pointHitsWalkCollider(slid, radius)) position.copy(slid);
  }
}
