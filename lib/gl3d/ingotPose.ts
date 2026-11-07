// How a venture's bar sits and floats, GL-free and DOM-free (the main thread computes the pose every frame of the one
// clock and posts it to the ingot's renderer; scripts/ingot-stills.mjs uses the resting pose).
//
// The bar lies on the liquid with its stamped top face toward the viewer: the liquid's frame is tilted TILT about x, so
// the top face is 35° off the view axis and the front wall faces you at about 41°. It sits at a 3/4 yaw (one end face
// always in view) and turns about the liquid's normal as it passes through the viewport (eased, sprung). It floats on
// the surface under its whole footprint: five points (its four corners and its centre) give the mean height (bob), the
// tilt of the best plane along and across the bar (roll, pitch) and the mean slope (drift); `buoy3` (lib/liquid/buoy.ts)
// follows them through second-order springs with soft (tanh) limits, so the motion is continuous: no dead band, no
// clamps, and nothing it sheds itself is fed back on a timer.
import { buoy3, STRONG, type BuoyOpts } from '../liquid/buoy';
import type { Footprint, HG } from '../liquid/field';
import { BAR } from './geometry';

/** World units that fill the canvas height. The canvas is 5:4: the host's 8:5 box plus 14% above and below, so the bar
 *  can turn, bob and tilt without being clipped (components/Ventures.css `.ing-canvas`). */
export const FRAME = 106;
/** The canvas' aspect (width / height). */
export const ASPECT = 1.25;
export const FOV = 32;
/** The liquid's tilt toward the viewer (rad about x): the bar's top normal ends up 35° off the view axis. */
export const TILT = -0.61;
/** Vertical shift (world units) that centres the tilted bar's silhouette in the canvas. */
export const LIFT = 2.6;
/** Yaw about the liquid's normal (rad): the resting 3/4 turn, the swing over a viewport pass, and the swing on the home
 *  track (smaller, so bars travelling sideways don't spin like coins). */
export const YAW = { base: 0.45, swing: 0.36, track: 0.3 };
/** The floating: a heavy bar, so a little slower than the logo's pieces; the strongest level on the page. */
const BUOY: BuoyOpts = { ...STRONG, tilt: 0.075, s0: 0.035, f: 0.62, zeta: 0.74 };

/** Pose in page terms: yaw, roll (lifts the bar's +x end), pitch (lifts its far side) in rad; bob (up), dx, dy in CSS px. */
export type IngotPose = { yaw: number; bob: number; roll: number; pitch: number; dx: number; dy: number };
export const REST: IngotPose = { yaw: YAW.base, bob: 0, roll: 0, pitch: 0, dx: 0, dy: 0 };

/** The host's box and the page: client px, the canvas' CSS size, and whether it travels sideways (the pinned track). */
export type IngotEnv = {
  css: { w: number; h: number };
  rect: { left: number; top: number; width: number; height: number };
  vw: number;
  vh: number;
  scrollX: number;
  scrollY: number;
  across: boolean;
};

/** Far from the viewport (the scene then draws nothing and its renderer is paused). */
export const farAway = (e: IngotEnv) =>
  e.rect.top + e.rect.height < -e.vh * 0.2 || e.rect.top > e.vh * 1.2 || e.rect.left + e.rect.width < -e.vw * 0.2 || e.rect.left > e.vw * 1.2;

/** A smooth odd ease over the pass, -1..1 with zero slope at both ends. */
const ease = (u: number) => u * (1.5 - 0.5 * u * u);
const clamp1 = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v);
const ELEV = Math.cos(TILT); // how much of the liquid's depth shows on the page (its far axis is foreshortened)

/**
 * The floating bar. `step(env, t, dt, surface, waves)`: `surface(x, docY, out)` is the liquid at page px (height px,
 * slopes; the idle swell included), `waves` the interaction waves alone (optional: only they make the bar shed a ripple);
 * returns the pose for this frame. `ripple` is called (rarely) where the bar sheds a small ripple of its own.
 */
export function createBarFloat(ripple?: (x: number, docY: number) => void) {
  const b = buoy3(BUOY);
  const fp: Footprint = { h: 0, gx: 0, gy: 0, roll: 0, pitch: 0 };
  const s: HG = { h: 0, gx: 0, gy: 0 };
  const pose: IngotPose = { ...REST };
  let yaw = NaN, yv = 0, snap = false; // turn: critically damped spring toward the pass' target
  let drag = 0, dv = 0, lastX = NaN, vs = 0; // the home track: a heavy bar lags a little behind its own travel
  let lastRipple = -1e9, hard = 0;
  const U = [-1, 1, 1, -1, 0], V = [-1, -1, 1, 1, 0];
  return {
    pose,
    /** Back from far away (it wasn't drawn): take the pass' turn at once rather than swinging to it as it comes in. */
    resume() { if (!Number.isNaN(yaw)) snap = true; },
    step(e: IngotEnv, t: number, dt: number, surface: (x: number, docY: number, out: HG) => HG, waves?: (x: number, docY: number, out: HG) => HG): IngotPose {
      dt = Math.min(Math.max(dt, 0), 0.1);
      const r = e.rect;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const u = e.across ? clamp1((cx - e.vw / 2) / (e.vw / 2 + r.width / 2)) : clamp1((cy - e.vh / 2) / (e.vh / 2 + r.height / 2));
      // Below the middle it faces you more squarely, above it turns its end toward you.
      const target = YAW.base - (e.across ? YAW.track : YAW.swing) * ease(u);
      const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
      // First frame: in view, start from the still's pose (the live bar takes over from it, then turns to where it should
      // be); out of view, start where it should be.
      if (Number.isNaN(yaw)) yaw = r.top < e.vh && r.top + r.height > 0 && r.left < e.vw && r.left + r.width > 0 ? YAW.base : target;
      if (snap) { yaw = target; yv = 0; snap = false; }
      const wy = 2 * Math.PI * 1.1;
      for (let i = 0; i < n; i++) {
        yv += (wy * wy * (target - yaw) - 2 * wy * yv) * h;
        yaw += yv * h;
      }
      // The footprint on the page: the bar's axes after the yaw, the far axis foreshortened by the tilt.
      const ppu = (e.css.h || r.height * 1.28) / FRAME, c = Math.cos(yaw), sn = Math.sin(yaw);
      const hu = (BAR.L / 2) * 0.9 * ppu, hv = (BAR.W / 2) * 0.9 * ppu;
      const px = cx + e.scrollX, py = cy + e.scrollY;
      let sh = 0, sgx = 0, sgy = 0, suh = 0, svh = 0;
      for (let k = 0; k < 5; k++) {
        const du = U[k] * hu, dvv = V[k] * hv;
        const x = px + du * c - dvv * sn, y = py - (du * sn + dvv * c) * ELEV;
        surface(x, y, s);
        sh += s.h; sgx += s.gx; sgy += s.gy;
        suh += du * s.h; svh += dvv * s.h;
      }
      fp.h = sh / 5;
      fp.gx = sgx / 5;
      fp.gy = sgy / 5;
      fp.roll = suh / (4 * hu * hu); // best plane along the bar (slope: rises toward its +x end)
      fp.pitch = svh / (4 * hv * hv); // and across it (rises toward its far side)
      const p = b.step(fp, dt);
      // Travelling sideways (the pinned track), it lags behind its own motion a little and leans into it.
      if (e.across) {
        const vx = Number.isNaN(lastX) || dt === 0 ? 0 : (cx - lastX) / dt;
        vs += (vx - vs) * (1 - Math.exp(-dt * 6)); // the track's speed, smoothed (scroll arrives in uneven steps)
        const tg = -10 * Math.tanh(vs / 900), wd = 2 * Math.PI * 0.7;
        for (let i = 0; i < n; i++) {
          dv += (wd * wd * (tg - drag) - 2 * 0.8 * wd * dv) * h;
          drag += dv * h;
        }
      } else drag *= Math.exp(-dt * 3);
      lastX = cx;
      pose.yaw = yaw;
      pose.bob = p.bob;
      pose.roll = p.roll + drag * 0.0025;
      pose.pitch = p.pitch;
      pose.dx = p.dx + drag;
      pose.dy = p.dy;
      // Its own ripple: only when a wave someone made rocks it hard (never on a timer, never from the idle swell), at most
      // one per 4 s, at its far edge, so it spreads away behind it.
      if (ripple && waves) {
        waves(px, py, s);
        hard = Math.abs(s.h) > 2.5 || Math.hypot(s.gx, s.gy) > 0.04 ? hard + dt : 0;
      }
      if (ripple && hard > 0.12 && t - lastRipple > 4) {
        lastRipple = t;
        hard = 0;
        const d = hv / 0.9 + 8;
        ripple(px - d * sn, py - d * c * ELEV);
      }
      return pose;
    },
  };
}
