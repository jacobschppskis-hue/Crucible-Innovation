// The liquid's renderer, off the main thread: owns the OffscreenCanvas (WebGL2) and draws on its own clock. The main
// thread only posts tiny messages (new packets, scrollY, viewport, visibility); see render.ts for the other side.
// Time is aligned to the page's rAF clock (performance.now() of the main thread) via the time origins, so packet
// birth times from the main thread mean the same here and `sample()` over there matches what is drawn.

import { createEngine, type Engine } from './engine';
import { addSource, setCalm } from './field';
import { clock } from './loop';

type Msg =
  | { type: 'init'; canvas: OffscreenCanvas; origin: number; full: boolean; w: number; h: number; dpr: number; scroll: number }
  | { type: 'src'; x: number; y: number; t0: number; amp: number; size: number; kind: 'ring' | 'float'; mv?: boolean }
  | { type: 'calm'; rects: number[] }
  | { type: 'view'; w: number; h: number; dpr: number }
  | { type: 'scroll'; y: number }
  | { type: 'vis'; hidden: boolean }
  | { type: 'down' };

const ctx = self as unknown as {
  postMessage(m: unknown): void;
  onmessage: ((e: { data: Msg }) => void) | null;
  requestAnimationFrame?: (cb: () => void) => number;
};

let engine: Engine | null = null;
let origin = 0;
let scroll = 0;
let hidden = false;
let running = false;
let frames = 0;
let lastPost = 0;
let ready = false;

const now = () => (performance.timeOrigin + performance.now() - origin) / 1000;

function loop() {
  if (!engine || hidden) {
    running = false;
    return;
  }
  const t = now();
  clock.t = t;
  if (engine.draw(t, scroll)) {
    frames++;
    if (!ready) {
      ready = true;
      ctx.postMessage({ type: 'ready' });
    }
    if (t - lastPost > 0.25) {
      lastPost = t;
      ctx.postMessage({ type: 'stats', frames, live: engine.stats.live, q: engine.stats.q, soft: engine.stats.soft });
    }
  }
  if (ctx.requestAnimationFrame) ctx.requestAnimationFrame(loop);
  else setTimeout(loop, 16);
}

function kick() {
  if (running || !engine || hidden) return;
  running = true;
  engine.resume();
  loop();
}

ctx.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') {
    origin = m.origin;
    scroll = m.scroll;
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = m.canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' }) as WebGL2RenderingContext | null;
    } catch {
      gl = null;
    }
    engine = gl ? createEngine(gl, m.canvas, { full: m.full }) : null;
    if (!engine) return ctx.postMessage({ type: 'fail' });
    engine.setView(m.w, m.h, m.dpr);
    kick();
  } else if (m.type === 'calm') setCalm(m.rects);
  else if (m.type === 'src') addSource(m.x, m.y, m.amp, m.size, { kind: m.kind, t: m.t0, move: m.mv });
  else if (m.type === 'view') engine?.setView(m.w, m.h, m.dpr);
  else if (m.type === 'scroll') scroll = m.y;
  else if (m.type === 'vis') {
    hidden = m.hidden;
    if (!hidden) kick();
  } else if (m.type === 'down') engine?.stepDown(now());
};
