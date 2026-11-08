// The hero's mark in the world (role: mark). Framework-free. Jacob's Split Ring hangs round the sun as one huge cast
// structure: the core IS the sun, a world point the journey places (frame.sun: near over the sea in the hero, with real
// parallax and its reflection under it; a far star elsewhere), so the mark is centred on it and scaled so its core is
// exactly the sun's sphere (scale = sun.R / 4.8 mark units). This module draws the core (look's own disc is turned off
// with look.sunDisc 0 wherever the mark shows). Its "stronger together" beat (lib/world/together.ts) plays on the
// `together` place's pin progress, with the captions in that section.
//
// GLSL: lib/world/glsl/mark.glsl (hooks hit/env for the sea's reflections, over for camera rays, sky for the flare).
import type { Frame, V3 } from './frame';
import type { Uniforms } from './gl';
import type { WorldModule } from './modules';
import markGlsl from './glsl/mark.glsl';
import { coreFlare, heatAmount, heatColor, LINES, lineOpacity, seaRing, weldFlash } from './together';

const CORE_R = 4.8; // mark units (lib/splitRing.ts RING.core 3.6 on the 48 grid, x4/3)
const CORE_L: V3 = [9.0, 4.6, 1.9];

/** What the rest of the world may read from the mark each frame (lava: the glitter's tint and the weld's ring). */
export const markState = {
  /** linear colour of the hot metal now (0 when cold) */
  heat: [0, 0, 0] as V3,
  /** 0..1: how much of the mark glows */
  heatAmount: 0,
  /** the beat's progress 0..1 */
  beat: 0,
  /** set to 1 on the frame the weld flashes (consume and zero it): one ring across the sea under the sun */
  ring: 0,
  /** the core (the sun) as a light: world position (far out along the sun), radius, radiance */
  core: { pos: [0, 0, 0] as V3, radius: 0, radiance: [0, 0, 0] as V3 },
};

/** The beat's progress from the `together` place's pin: a little lead-in and run-out so it starts and lands while the
 *  section is fully on screen. */
export function beatOf(f: Frame) {
  const a = f.at('together');
  const b = (a - 0.04) / 0.9;
  return b < 0 ? 0 : b > 1 ? 1 : b;
}

let lines: HTMLElement[] = [];
let stage: HTMLElement | null = null;
let box = '';
const markBox = { x: 0, y: 0, r: 0, ok: false };

export const mark: WorldModule = {
  id: 'mark',
  glsl: markGlsl,
  hooks: ['hit', 'shade', 'env', 'over', 'sky'],
  channels: { 'mark.vis': 1, 'mark.size': 1, 'mark.light': 1, 'mark.fill': 1 },
  init({ root }) {
    lines = Array.from(root.querySelectorAll<HTMLElement>('[data-together-line]'));
    stage = root.querySelector<HTMLElement>('[data-place="together"]');
  },
  update(f: Frame, u: Uniforms) {
    const b = f.still ? 0.97 : beatOf(f);
    const vis = f.ch['mark.vis'] ?? 1;
    const size = f.ch['mark.size'] ?? 1;
    const k = f.ch['mark.light'] ?? 1;
    const fill = f.ch['mark.fill'] ?? 1;
    const { pos, r, up: camUp } = f.cam;
    void camUp;
    const centre: V3 = f.sun.pos;
    const scale = (f.sun.R * size) / CORE_R;
    // square to the line of sight, upright to the planet under the sun (so it reads as the logo, never a tilted plate)
    const B = facing(centre, pos, r, norm(centre));
    const flare = coreFlare(b);
    u.set('mark_uC', [centre[0], centre[1], centre[2], scale]);
    u.set('mark_uB', [...B.right, ...B.up, ...B.out]);
    u.set('mark_uBeat', [b, weldFlash(b), flare, f.t]);
    u.set('mark_uLook', [vis, size, f.quality.q >= 0.45 ? 1 : f.quality.q > 0.2 ? 0.6 : 0, 0]);
    u.set('mark_uSky', [0.2 * fill, 0.22 * fill, 0.27 * fill]);
    u.set('mark_uSea', [0.95 * fill, 0.66 * fill, 0.44 * fill]);
    u.set('mark_uCoreL', [CORE_L[0] * k, CORE_L[1] * k, CORE_L[2] * k]);

    // the mark's screen box (centre, outer radius incl. the squares) for the captions
    const c = f.project(centre);
    if (c) {
      const edge = f.project(add(centre, mul(B.up, scale * 30.4)));
      markBox.x = c[0];
      markBox.y = c[1];
      markBox.r = edge ? Math.hypot(edge[0] - c[0], edge[1] - c[1]) : 0;
      markBox.ok = true;
    } else markBox.ok = false;

    markState.beat = b;
    markState.heat = heatColor(b);
    markState.heatAmount = heatAmount(b);
    if (seaRing(b)) markState.ring = 1;
    markState.core.pos = centre;
    markState.core.radius = CORE_R * scale;
    markState.core.radiance = [CORE_L[0] * k * (1 + flare), CORE_L[1] * k * (1 + flare), CORE_L[2] * k * (1 + flare)];
  },
  after(f: Frame) {
    // the captions: each arrives with the run it names; the payoff when the ring closes
    const b = f.still ? 0.97 : beatOf(f);
    if (stage && markBox.ok) {
      const s = `${markBox.x.toFixed(1)},${markBox.y.toFixed(1)},${markBox.r.toFixed(1)}`;
      if (s !== box) {
        box = s;
        stage.style.setProperty('--mx', `${markBox.x.toFixed(1)}px`);
        stage.style.setProperty('--my', `${markBox.y.toFixed(1)}px`);
        stage.style.setProperty('--mr', `${markBox.r.toFixed(1)}px`);
      }
    }
    for (let i = 0; i < lines.length && i < LINES.length; i++) {
      const o = lineOpacity(i, b);
      const el = lines[i];
      const s = o.toFixed(3);
      if (el.style.opacity !== s) {
        el.style.opacity = s;
        el.style.translate = `0 ${((1 - o) * 0.35).toFixed(3)}em`;
      }
    }
  },
  dispose() {
    lines = [];
    stage = null;
    box = '';
  },
};

/** The mark's frame facing the camera: square to the line of sight, upright (its up is the planet's up under the
 *  camera, made square to the line of sight), reading left to right on screen (`screenRight` = the camera's right). */
export function facing(centre: V3, camera: V3, screenRight: V3, worldUp: V3) {
  const o = norm(sub(camera, centre));
  const u0 = sub(worldUp, mul(o, dot(worldUp, o)));
  const up = len(u0) < 1e-6 ? norm(cross(o, screenRight)) : norm(u0);
  const r0 = sub(screenRight, add(mul(o, dot(screenRight, o)), mul(up, dot(screenRight, up))));
  const right = len(r0) < 1e-6 ? norm(cross(up, o)) : norm(r0);
  return { right, up, out: o };
}

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
