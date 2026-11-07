// The venture ingots, off the main thread (one worker per ingot canvas): owns the OffscreenCanvas (WebGL2), draws the
// ingot on its own clock and draws its relief maps (lettering, lattice), so a slow or software GL (Lighthouse, PageSpeed)
// never blocks the page. The main thread (ingotScene.ts) posts the host's box, the viewport, the scroll and the liquid's
// new wave sources (so `sample()` here matches what is drawn); the ripples the ingot sheds go back as 'emit'. Time is
// aligned to the page clock via the time origins, like the liquid and the logo worker.
import { addSource } from '../liquid/field';
import { clock } from '../liquid/loop';
import { createIngotRunner, type IngotEnv, type IngotRunner } from './ingotRunner';
import type { IngotKind } from './ingots';

type Msg =
  | { type: 'init'; canvas: OffscreenCanvas; kind: IngotKind; origin: number; full: boolean; dpr: number; font?: string; env: IngotEnv }
  | { type: 'state'; env: IngotEnv }
  | { type: 'src'; x: number; y: number; t0: number; amp: number; size: number; kind: 'ring' | 'float' }
  | { type: 'vis'; hidden: boolean }
  | { type: 'down' };

const ctx = self as unknown as {
  postMessage(m: unknown): void;
  onmessage: ((e: { data: Msg }) => void) | null;
  requestAnimationFrame?: (cb: () => void) => number;
  fonts?: { add(f: unknown): void };
};

const env: IngotEnv = { css: { w: 1, h: 1 }, rect: { left: 0, top: 0, width: 1, height: 1 }, vw: 1, vh: 1, scrollX: 0, scrollY: 0, across: false };
const setEnv = (m: IngotEnv) => {
  env.css.w = m.css.w;
  env.css.h = m.css.h;
  env.rect = m.rect;
  env.vw = m.vw;
  env.vh = m.vh;
  env.scrollX = m.scrollX;
  env.scrollY = m.scrollY;
  env.across = m.across;
};

let runner: IngotRunner | null = null;
let origin = 0;
let hidden = false;
let running = false;

const now = () => (performance.timeOrigin + performance.now() - origin) / 1000;

function loop() {
  if (!runner || hidden) {
    running = false;
    return;
  }
  const t = now();
  clock.t = t;
  runner.frame(t);
  if (ctx.requestAnimationFrame) ctx.requestAnimationFrame(loop);
  else setTimeout(loop, 16);
}

function kick() {
  if (running || !runner || hidden) return;
  running = true;
  loop();
}

ctx.onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'init') {
    origin = m.origin;
    setEnv(m.env);
    // The lettering is drawn once into the relief map: the site's Archivo has to be here first (workers do not see the page's fonts).
    if (m.font && ctx.fonts) {
      try {
        const face = new FontFace('Archivo', `url(${m.font})`, { weight: '400 800', stretch: '100% 125%' });
        await face.load();
        ctx.fonts.add(face);
      } catch { /* falls back to the stack */ }
    }
    try {
      runner = createIngotRunner(m.canvas, m.kind, env, {
        dpr: m.dpr,
        full: m.full,
        emit: (x, y, amp, size, t) => ctx.postMessage({ type: 'emit', x, y, amp, size, t }),
        onDrawn: () => ctx.postMessage({ type: 'drawn' }),
        onLost: () => ctx.postMessage({ type: 'lost' }),
      });
    } catch {
      runner = null;
      return ctx.postMessage({ type: 'fail' });
    }
    kick();
  } else if (m.type === 'state') setEnv(m.env);
  else if (m.type === 'src') addSource(m.x, m.y, m.amp, m.size, { kind: m.kind, t: m.t0 });
  else if (m.type === 'vis') {
    hidden = m.hidden;
    if (!hidden) kick();
  } else if (m.type === 'down') runner?.down();
};
