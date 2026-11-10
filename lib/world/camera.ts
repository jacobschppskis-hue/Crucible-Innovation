// The camera from journey channels, and the screen <-> world helpers every module uses.
//
// World frame: the planet's centre is the origin, radius R. The journey runs round the great circle in the y-z plane.
// Surface coords (the same in GLSL, `Sea.w`): v = R * theta (along the circle, theta = atan(z, y), wrapped to
// (-PI R, PI R], so the hero at theta 0 is seamless and the seam sits on the far side at theta = PI), u = R * phi
// (across: + is to the right when facing the travel direction). A point at (u, v) and height y:
//   P = (R + y) * (-sin phi, cos phi cos theta, cos phi sin theta)

import { V, wrapPi, type Camera, type Channels, type SeaHit, type V3 } from './frame';

const D2R = Math.PI / 180;

export function surf(R: number, u: number, v: number, y = 0): V3 {
  const th = v / R,
    ph = u / R,
    r = R + y;
  return [-r * Math.sin(ph), r * Math.cos(ph) * Math.cos(th), r * Math.cos(ph) * Math.sin(th)];
}

export function surfOf(R: number, p: V3): [number, number, number] {
  const r = V.len(p);
  return [R * Math.asin(Math.max(-1, Math.min(1, -p[0] / r))), R * wrapPi(Math.atan2(p[2], p[1])), r - R];
}

/** Builds the camera for channel values `ch` (s already unwrapped by the caller). `focalFor(fov)` gives CSS px. */
export function cameraFrom(R: number, ch: Channels, w: number, h: number, out?: Camera): Camera {
  const s = ch.s,
    x = ch.x ?? 0,
    alt = Math.max(ch.h, 0.05);
  const th = s / R;
  const theta = ((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const pos = surf(R, x, s, alt);
  const up = V.norm(pos);
  // travel direction: d/dv of the surface point, made tangent
  const a0: V3 = [0, -Math.sin(th), Math.cos(th)];
  const along = V.norm(V.madd(a0, up, -V.dot(a0, up)));
  const across = V.cross(along, up); // right when facing along
  const yaw = (ch.yaw ?? 0) * D2R,
    pitch = (ch.pitch ?? 0) * D2R,
    roll = (ch.roll ?? 0) * D2R;
  const hz = V.add(V.mul(along, Math.cos(yaw)), V.mul(across, Math.sin(yaw)));
  const f = V.norm(V.add(V.mul(hz, Math.cos(pitch)), V.mul(up, Math.sin(pitch))));
  let r = V.norm(V.cross(f, up));
  let u = V.cross(r, f);
  if (roll) {
    const c = Math.cos(roll),
      sn = Math.sin(roll);
    const r2 = V.add(V.mul(r, c), V.mul(u, sn));
    u = V.sub(V.mul(u, c), V.mul(r, sn));
    r = r2;
  }
  // keys give the vertical fov; a portrait screen taller than ~0.6 (iPhone Safari with its bars) keeps that frame's
  // WIDTH instead, so a tall phone (full screen, a 20:9 Android) sees the same horizontal composition, more sky and sea
  let fov = ch.fov ?? 50;
  const aspect = w / Math.max(h, 1);
  if (aspect < 0.6) fov = 2 * Math.atan((Math.tan(0.5 * fov * D2R) * 0.6) / aspect) / D2R;
  const focal = (0.5 * h) / Math.tan(0.5 * fov * D2R);
  const cam = out ?? ({} as Camera);
  Object.assign(cam, { pos, r, u, f, fov, focal, s, x, h: alt, theta, up, along, across });
  return cam;
}

export function rayAt(cam: Camera, w: number, h: number, x: number, y: number): V3 {
  const sx = (x - w / 2) / cam.focal,
    sy = -(y - h / 2) / cam.focal;
  return V.norm(V.add(V.add(V.mul(cam.r, sx), V.mul(cam.u, sy)), cam.f));
}

/** Near intersection of a ray from the camera with the sea sphere (numerically stable for grazing rays). */
export function seaT(R: number, cam: Camera, d: V3): number {
  const b = V.dot(cam.pos, d);
  const c = cam.h * (2 * R + cam.h);
  const disc = b * b - c;
  if (disc < 0 || b > 0) return -1;
  return c / (-b + Math.sqrt(disc));
}

export function hitSea(R: number, cam: Camera, w: number, h: number, x: number, y: number): SeaHit | null {
  const d = rayAt(cam, w, h, x, y);
  const t = seaT(R, cam, d);
  if (t <= 0) return null;
  const p = V.madd(cam.pos, d, t);
  const s = surfOf(R, p);
  return { p, w: [s[0], s[1]], t };
}

export function project(cam: Camera, w: number, h: number, p: V3): [number, number, number] | null {
  const c = V.sub(p, cam.pos);
  const z = V.dot(c, cam.f);
  if (z < 1e-3) return null;
  return [w / 2 + (V.dot(c, cam.r) / z) * cam.focal, h / 2 - (V.dot(c, cam.u) / z) * cam.focal, z];
}

export type Sun = { pos: V3; dir: V3; dist: number; R: number; rad: number };

function sunAt(R: number, ch: Channels, cam: Camera) {
  const pos = surf(R, ch.sunU ?? 0, ch.sunV ?? -150, ch.sunY ?? 30);
  const d = V.sub(pos, cam.pos);
  const dist = V.len(d);
  return { dir: V.mul(d, 1 / dist), dist, r: ch.sunR ?? 4.2 };
}

/**
 * The sun (the mark's core) between two keys `a` and `b` at eased fraction `e`, as seen from the camera: its direction
 * slerps, its distance and radius interpolate in log space. Each key's sun is a world point (sunU, sunV, sunY), so a
 * held key gives real parallax. `lap` (in world units) is added to sunV, like to s.
 */
export function sunFrom(R: number, a: Channels, b: Channels, e: number, cam: Camera, lap = 0): Sun {
  const A = sunAt(R, { ...a, sunV: (a.sunV ?? -150) + lap }, cam);
  const B = e > 0 ? sunAt(R, { ...b, sunV: (b.sunV ?? -150) + lap }, cam) : A;
  const c = Math.max(-1, Math.min(1, V.dot(A.dir, B.dir)));
  const om = Math.acos(c);
  let dir: V3;
  if (om < 1e-5) dir = A.dir;
  else {
    const so = Math.sin(om);
    dir = V.norm(V.add(V.mul(A.dir, Math.sin((1 - e) * om) / so), V.mul(B.dir, Math.sin(e * om) / so)));
  }
  const dist = Math.exp(Math.log(A.dist) + (Math.log(B.dist) - Math.log(A.dist)) * e);
  const r = Math.exp(Math.log(A.r) + (Math.log(B.r) - Math.log(A.r)) * e);
  return { pos: V.madd(cam.pos, dir, dist), dir, dist, R: r, rad: Math.asin(Math.min(1, r / dist)) };
}
