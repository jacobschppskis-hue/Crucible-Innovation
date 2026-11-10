// The hero's mark in the world (role: mark). Framework-free. Jacob's Split Ring hangs round the sun as one huge cast
// structure: the core IS the sun, a world point the journey places (frame.sun: near over the sea in the hero, with real
// parallax and its reflection under it; a far star elsewhere), so the mark is centred on it and scaled so its core is
// exactly the sun's sphere (scale = sun.R / 4.8 mark units). This module draws the core (look's own disc is turned off
// with look.sunDisc 0 wherever the mark shows). The mark is always whole, cast and still. "Stronger together"
// (lib/world/together.ts) is a confluence on the sea below: two molten rivers join into one hotter river, drawn as heat
// in lava's sea through the `sea` hook, on the `together` place's pin progress, with one line of copy.
//
// GLSL: lib/world/glsl/mark.glsl (hooks hit/env for the sea's reflections, over for camera rays, sea for the rivers).
import type { Frame, V3 } from './frame';
import type { Uniforms } from './gl';
import type { WorldModule } from './modules';
import markGlsl from './glsl/mark.glsl';
import { BEAT, joinedFront, LINES, lineOpacity, meetFlash, sourceFront, togetherKeys } from './together';

const CORE_R = 4.8; // mark units (lib/splitRing.ts RING.core 3.6 on the 48 grid, x4/3)
const CORE_L: V3 = [9.0, 4.6, 1.9];

/** What the rest of the world may read from the mark each frame. */
export const markState = {
  /** the together beat's progress 0..1 */
  beat: 0,
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

/** The beat as shown: it follows the scroll (forward and back) but never faster than the rivers can be read, and
 *  slowest around their meeting, so a fast thumb flick still sees them join. With a fixed clock (?t=,
 *  dt 0) or a long gap it snaps to the scroll, so test frames stay a pure function of scroll. */
let shown = -1;
function follow(target: number, dt: number) {
  if (shown < 0 || dt <= 0 || dt > 0.25) return (shown = target);
  const near = Math.abs(shown - BEAT.meet) < 0.1 || (shown - BEAT.meet) * (target - BEAT.meet) < 0;
  const rate = near ? 0.3 : 1.6; // beat units per second
  const d = target - shown, m = rate * dt;
  shown += d > m ? m : d < -m ? -m : d;
  return shown;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * The arrival home: 0 where the last screen before the loop place begins (the end of `dawn`), 1 at the seam, where the
 * loop place fills the viewport and the journey is the hero's first frame again. -1 when the page does not loop.
 */
export function arrival(f: Frame) {
  const lp = f.places.loop;
  if (!lp || !(f.loopLen > 0)) return -1;
  return clamp01((f.y - (lp.top - f.h)) / f.h);
}

/**
 * What the mark shows of itself, a pure function of the scroll that is the same at progress 0 and 1 (the loop):
 * - `vis`: whole through the hero and "stronger together"; it leaves the frame by the camera's own turn into the
 *   story (and is switched off only once it is off screen); through the rest of the lap it is not drawn; on the way
 *   home it is back, whole, behind the sun's glare.
 * - `glare`: the sun's blaze on the way home. It swells as the camera turns down onto the evening sea facing the sun,
 *   then settles through the last half screen: the blaze draws in to the core and the mark resolves out of it, from
 *   the outside in. Exactly 0 (and vis exactly 1) at the seam.
 */
export function presence(f: Frame) {
  const x = arrival(f);
  if (x > 0) {
    const up = sstep(0, 0.3, x);
    const down = 1 - sstep(0.42, 1, x);
    const glare = up * down;
    return { vis: sstep(0.28, 0.4, x), glare, width: 0.4 + 0.6 * Math.sqrt(glare) };
  }
  const st = f.places.story ? f.at('story') : 0;
  return { vis: 1 - sstep(0, 0.08, st), glare: 0, width: 1 };
}

let lines: HTMLElement[] = [];
let stage: HTMLElement | null = null;
let box = '';
const markBox = { x: 0, y: 0, r: 0, ok: false };

export const mark: WorldModule = {
  id: 'mark',
  glsl: markGlsl,
  hooks: ['hit', 'shade', 'env', 'over', 'sky', 'sea', 'crisp'],
  // the crisp pass draws the mark at the screen's own resolution (up to dpr 3 on phones) inside this box
  crispBox(f: Frame) {
    const b = screenBox(f);
    if (!b || (f.ch['mark.vis'] ?? 1) * presence(f).vis <= 0.002) return null;
    const r = b.r * 1.08 + 6;
    if (b.x + r < 0 || b.x - r > f.w || b.y + r < 0 || b.y - r > f.h) return null;
    return [b.x - r, b.y - r, b.x + r, b.y + r];
  },
  keys: togetherKeys,
  channels: { 'mark.vis': 1, 'mark.size': 1, 'mark.light': 1, 'mark.fill': 1 },
  init({ root }) {
    lines = Array.from(root.querySelectorAll<HTMLElement>('[data-together-line]'));
    (window as unknown as { __mark?: typeof markState }).__mark = markState; // test hook
    stage = root.querySelector<HTMLElement>('[data-place="together"]');
  },
  update(f: Frame, u: Uniforms) {
    const b = f.still ? 0.97 : follow(beatOf(f), f.dt);
    const pr = presence(f);
    const vis = (f.ch['mark.vis'] ?? 1) * pr.vis;
    const size = f.ch['mark.size'] ?? 1;
    const k = f.ch['mark.light'] ?? 1;
    const fill = f.ch['mark.fill'] ?? 1;
    const { pos, r, up: camUp } = f.cam;
    void camUp;
    const centre: V3 = f.sun.pos;
    const scale = (f.sun.R * size) / CORE_R;
    // square to the line of sight, upright to the planet under the sun (so it reads as the logo, never a tilted plate)
    const B = facing(centre, pos, r, norm(centre));
    const flare = 0;
    u.set('mark_uC', [centre[0], centre[1], centre[2], scale]);
    u.set('mark_uB', [...B.right, ...B.up, ...B.out]);
    u.set('mark_uBeat', [b, 0, 0, f.t]);
    // the confluence (its origin: the together camera's start, s 8, along the great circle)
    const on = f.at('together') > 0 && f.at('story') < 1 ? 1 : 0;
    u.set('mark_uRiv', [8, sourceFront(b), joinedFront(b), meetFlash(b)]);
    u.set('mark_uRivT', [f.t, on]);
    u.set('mark_uLook', [vis, size, f.quality.q >= 0.45 ? 1 : f.quality.q > 0.2 ? 0.6 : 0, 0]);
    // the world the metal mirrors (radiance): the dusk sky above, the sea's glow below, the afterglow on the horizon
    u.set('mark_uSky', [0.175 * fill, 0.18 * fill, 0.205 * fill]);
    u.set('mark_uSea', [0.4 * fill, 0.15 * fill, 0.05 * fill]);
    u.set('mark_uGlow', [0.6 * fill, 0.3 * fill, 0.13 * fill]);
    u.set('mark_uGlare', [pr.glare, pr.width, 0, 0]);
    u.set('mark_uCoreL', [CORE_L[0] * k, CORE_L[1] * k, CORE_L[2] * k]);

    // the mark's screen box (centre, outer radius incl. the squares)
    const sb = screenBox(f);
    markBox.ok = !!sb;
    if (sb) Object.assign(markBox, { x: sb.x, y: sb.y, r: sb.r });
    // small on screen: the brand mark (its squares are 5.6 units, the Split Ring's 4.27 of 30.4 radius). Crossfade
    // while the Split Ring's squares are 2.6..3.6 CSS px, never a pop.
    const sq = sb ? (sb.r * 4.27) / 30.4 : 99;
    const t = Math.min(1, Math.max(0, (sq - 2.6) / 1.0));
    u.set('mark_uBrand', 1 - t * t * (3 - 2 * t));

    markState.beat = b;
    markState.core.pos = centre;
    markState.core.radius = CORE_R * scale;
    markState.core.radiance = [CORE_L[0] * k * (1 + flare), CORE_L[1] * k * (1 + flare), CORE_L[2] * k * (1 + flare)];
  },
  after(f: Frame) {
    // the one line: when the rivers meet
    const b = f.still ? 0.97 : shown < 0 ? beatOf(f) : shown;
    if (stage && markBox.ok) {
      const s = `${markBox.x.toFixed(1)},${markBox.y.toFixed(1)},${markBox.r.toFixed(1)}`;
      if (s !== box) {
        box = s;
        stage.style.setProperty('--mx', `${markBox.x.toFixed(1)}px`);
        stage.style.setProperty('--my', `${markBox.y.toFixed(1)}px`);
        stage.style.setProperty('--mr', `${markBox.r.toFixed(1)}px`);
      }
    }
    // the captions belong to the pinned stage: they are gone before the section scrolls away (so they never ride up
    // under the nav or share the screen with story's heading), whatever the beat is still finishing
    const a = f.at('together');
    const pin = f.still ? 1 : Math.min(1, Math.max(0, (a - 0.005) / 0.02)) * Math.min(1, Math.max(0, (0.985 - a) / 0.035));
    for (let i = 0; i < lines.length && i < LINES.length; i++) {
      const o = lineOpacity(i, b) * pin;
      const el = lines[i];
      const s = o.toFixed(3);
      if (el.style.opacity !== s) {
        el.style.opacity = s;
        el.style.translate = `0 ${((1 - o) * 0.35).toFixed(3)}em`;
      }
    }
  },
  dispose() {
    shown = -1;
    lines = [];
    stage = null;
    box = '';
  },
};

/** The mark's centre and outer radius (incl. the squares) on screen, CSS px, or null behind the camera. */
function screenBox(f: Frame) {
  const centre = f.sun.pos;
  const c = f.project(centre);
  if (!c) return null;
  const B = facing(centre, f.cam.pos, f.cam.r, norm(centre));
  const scale = (f.sun.R * (f.ch['mark.size'] ?? 1)) / CORE_R;
  const edge = f.project(add(centre, mul(B.up, scale * 30.4)));
  return { x: c[0], y: c[1], r: edge ? Math.hypot(edge[0] - c[0], edge[1] - c[1]) : 0 };
}

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
