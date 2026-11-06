// The live ingot: one transparent canvas per ingot, floating on the page's liquid and turning as it scrolls through.
// components/IngotScene.tsx imports this after load + idle; it is never in the first-load JS.
import { clock, onFrame } from '../liquid/loop';
import { addSource, sample } from '../liquid/field';
import { buildIngot, PITCH, ROLL } from './ingotPose';
import type { IngotKind } from './index';
import { createAdapt } from './adapt';
import { onLongTasks } from './watchdog';
export { loadIngotFont } from './ingots';

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const YAW = 1.3; // radians of turn from one edge of the viewport to the other (about 75°)
const SLOPE_GAIN = 300; // wave slope (per px) → tilt (rad), then clamped
const DRIFT = 9000; // wave slope → buoy drift (world units), then clamped
const BOB = 26; // wave height → world units

/**
 * Start an ingot on `canvas`, placed by `host` (the element that scrolls with the text). `across()` says whether the
 * ingot travels sideways (the pinned track) or up the page, which decides what "scrolling through" means.
 * Returns the function that releases everything (loseContext). `onLost` is called if the GPU context is lost.
 */
export function startIngot(canvas: HTMLCanvasElement, host: HTMLElement, kind: IngotKind, across: () => boolean, onLost: () => void, onDrawn: () => void = () => {}) {
  const { stage, root, hot } = buildIngot(canvas, kind, { quality: 1 });
  // Software GL starts at a low step; long tasks on the main thread step it down further (never gives up).
  const adapt = createAdapt(stage, /[?&]liquid=full\b/.test(location.search));
  const offLong = onLongTasks(() => adapt.down());
  const lost = (e: Event) => { e.preventDefault(); onLost(); };
  canvas.addEventListener('webglcontextlost', lost);
  let yaw = 0, bob = 0, tx = 0, ty = 0, rx = 0, rz = 0, dx = 0, dy = 0;
  let nextRipple = clock.t + 1 + Math.random() * 2;
  let first = true;
  let drawn = false;
  let lastDraw = 0;
  const off = onFrame((t) => {
    const r = host.getBoundingClientRect();
    const vw = innerWidth, vh = innerHeight;
    if (r.bottom < -vh * 0.2 || r.top > vh * 1.2 || r.right < -vw * 0.2 || r.left > vw * 1.2) return;
    if (!adapt.allow(t)) return;
    const dt = lastDraw && t - lastDraw < 0.5 ? t - lastDraw : 1 / 60;
    lastDraw = t;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const u = across() ? (cx - vw / 2) / vw : (cy - vh / 2) / vh;
    const px = cx + scrollX, py = cy + scrollY;
    const s = sample(px, py, t);
    // Spring everything toward its target (critically damped-ish), so a wave's slope rocks it rather than snapping it.
    const k = first ? 1 : 1 - Math.exp(-dt * 7);
    first = false;
    yaw += (clamp(-u * YAW, -0.95, 0.95) - yaw) * (1 - Math.exp(-dt * 10));
    bob += (s.h * BOB - bob) * k;
    rx += (clamp(s.gy * SLOPE_GAIN, -0.05, 0.05) - rx) * k;
    rz += (clamp(-s.gx * SLOPE_GAIN, -0.05, 0.05) - rz) * k;
    tx += (clamp(s.gx * DRIFT, -8, 8) - tx) * (1 - Math.exp(-dt * 2.5));
    ty += (clamp(-s.gy * DRIFT * 0.5, -4, 4) - ty) * (1 - Math.exp(-dt * 2.5));
    dx = tx; dy = ty;
    root.position = [dx, bob + dy, 0];
    root.rotation = [PITCH + rx, yaw, ROLL + rz];
    if (hot) hot.temp = 0.3 + 0.05 * Math.sin(t * 1.3 + (kind === 'verge' ? 0 : 2));
    // Its own small ripples, a few seconds apart.
    if (t > nextRipple) {
      nextRipple = t + 2.2 + Math.random() * 1.8;
      addSource(px + (Math.random() - 0.5) * r.width * 0.5, py + r.height * 0.3, 0.22, 10, { kind: 'float' });
    }
    stage.render();
    if (!drawn) { drawn = true; onDrawn(); }
  });
  return () => {
    off();
    offLong();
    canvas.removeEventListener('webglcontextlost', lost);
    stage.dispose();
  };
}
