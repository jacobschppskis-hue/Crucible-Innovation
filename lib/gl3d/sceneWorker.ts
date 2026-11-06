// The 3D logo + pour, off the main thread: owns the OffscreenCanvas (WebGL2) and draws on its own clock, so a slow or
// software GL never blocks the page. The main thread (logoScene.ts) posts what changes: scroll progress, the pointer,
// the canvas' box, the viewport and the liquid's new wave sources (so `sample()` here matches what is drawn). Ripples
// the logo sheds go back as 'emit' messages. Time is aligned to the page clock via the time origins, like the liquid.
import { addSource } from '../liquid/field';
import { clock } from '../liquid/loop';
import { createLogoRunner, type LogoEnv, type LogoRunner, type LogoStory } from './logoRunner';

type Msg =
  | { type: 'init'; canvas: OffscreenCanvas; origin: number; full: boolean; dpr: number; pour?: { tempo: number }; env: EnvMsg }
  | { type: 'state'; env: EnvMsg }
  | { type: 'src'; x: number; y: number; t0: number; amp: number; size: number; kind: 'ring' | 'float' }
  | { type: 'vis'; hidden: boolean }
  | { type: 'down' };
type EnvMsg = { css: { w: number; h: number }; rect: LogoEnv['rect']; scrollY: number; ptr: { x: number; y: number }; story: LogoStory; pourT?: number };

const ctx = self as unknown as {
  postMessage(m: unknown): void;
  onmessage: ((e: { data: Msg }) => void) | null;
  requestAnimationFrame?: (cb: () => void) => number;
};

const env: LogoEnv = { css: { w: 1, h: 1 }, rect: { left: 0, top: 0, width: 1, height: 1 }, scrollY: 0, ptr: { x: -9999, y: -9999 }, story: { sm: 0, sh: 0, core: 1, flare: 0, out: 0 } };
const setEnv = (m: EnvMsg) => {
  env.css.w = m.css.w;
  env.css.h = m.css.h;
  env.rect = m.rect;
  env.scrollY = m.scrollY;
  env.ptr.x = m.ptr.x;
  env.ptr.y = m.ptr.y;
  env.story = m.story;
  env.pourT = m.pourT;
};

let runner: LogoRunner | null = null;
let origin = 0;
let hidden = false;
let running = false;
let ready = false;

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

ctx.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') {
    origin = m.origin;
    setEnv(m.env);
    try {
      runner = createLogoRunner(m.canvas, env, {
        dpr: m.dpr,
        full: m.full,
        pour: m.pour,
        emit: (x, y, amp, size, t) => ctx.postMessage({ type: 'emit', x, y, amp, size, t }),
        onFirst: () => {
          if (!ready) {
            ready = true;
            ctx.postMessage({ type: 'ready' });
          }
        },
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
