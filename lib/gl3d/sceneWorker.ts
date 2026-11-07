// The 3D logo + pour, off the main thread: owns the OffscreenCanvas (WebGL2), so a slow or software GL never blocks the
// page. It keeps no clock of its own: the main thread (logoScene.ts) posts a 'tick' with the time of each frame of the
// one clock (lib/liquid/loop.ts) and what changed (scroll progress, the pointer, the canvas' box, the liquid's new wave
// sources); the worker draws exactly that time and answers 'tock'. Ripples the logo sheds go back as 'emit' messages.
import { addSource } from '../liquid/field';
import { clock } from '../liquid/loop';
import { createLogoRunner, type LogoEnv, type LogoRunner, type LogoStory } from './logoRunner';

type Msg =
  | { type: 'init'; canvas: OffscreenCanvas; origin: number; full: boolean; dpr: number; pour?: { tempo: number }; env: EnvMsg }
  | { type: 'state'; env: EnvMsg }
  | { type: 'src'; x: number; y: number; t0: number; amp: number; size: number; kind: 'ring' | 'float' }
  | { type: 'vis'; hidden: boolean }
  | { type: 'tick'; t: number }
  | { type: 'down' };
type EnvMsg = { css: { w: number; h: number }; rect: LogoEnv['rect']; scrollY: number; top?: number; ptr: { x: number; y: number }; story: LogoStory; pourT?: number };

const ctx = self as unknown as {
  postMessage(m: unknown): void;
  onmessage: ((e: { data: Msg }) => void) | null;
};

const env: LogoEnv = { css: { w: 1, h: 1 }, rect: { left: 0, top: 0, width: 1, height: 1 }, scrollY: 0, ptr: { x: -9999, y: -9999 }, story: { sm: 0, sh: 0, core: 1, flare: 0, out: 0 } };
const setEnv = (m: EnvMsg) => {
  env.css.w = m.css.w;
  env.css.h = m.css.h;
  env.rect = m.rect;
  env.scrollY = m.scrollY;
  env.top = m.top;
  env.ptr.x = m.ptr.x;
  env.ptr.y = m.ptr.y;
  env.story = m.story;
  env.pourT = m.pourT;
};

let runner: LogoRunner | null = null;
let hidden = false;
let ready = false;

ctx.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') {
    setEnv(m.env);
    try {
      runner = createLogoRunner(m.canvas, env, {
        dpr: m.dpr,
        full: m.full,
        pour: m.pour,
        emit: (x, y, amp, size, t) => ctx.postMessage({ type: 'emit', x, y, amp, size, t }),
        onSettled: () => ctx.postMessage({ type: 'settled' }),
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
  } else if (m.type === 'tick') {
    // draw the main frame's time, then acknowledge once this task (and its commit) is done
    if (runner && !hidden) {
      clock.t = m.t;
      runner.frame(m.t);
    }
    setTimeout(() => ctx.postMessage({ type: 'tock', t: m.t }), 0);
  } else if (m.type === 'state') setEnv(m.env);
  else if (m.type === 'src') addSource(m.x, m.y, m.amp, m.size, { kind: m.kind, t: m.t0 });
  else if (m.type === 'vis') hidden = m.hidden;
  else if (m.type === 'down') runner?.down();
};
