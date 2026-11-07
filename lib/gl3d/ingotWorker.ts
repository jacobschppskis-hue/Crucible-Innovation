// A venture's bar, off the main thread (one worker per ingot canvas): owns the OffscreenCanvas (WebGL2) and draws
// exactly what the main frame posts (ingotScene.ts): the time on the one clock, the canvas' CSS size and the bar's pose
// (computed there, on the liquid's grid). It keeps no clock and runs no loop of its own: one tick, one draw (or a skip
// under the fps cap), one 'drawn' back after the drawing task, so the frame is committed by then. It also draws the
// relief map (lettering, mark) with the site's Archivo loaded here via FontFace, so a slow or software GL (Lighthouse,
// PageSpeed) never blocks the page.
import { createIngotRunner, type IngotRunner } from './ingotRunner';
import type { IngotKind } from './ingots';
import type { IngotPose } from './ingotPose';

type Msg =
  | { type: 'init'; canvas: OffscreenCanvas; kind: IngotKind; full: boolean; dpr: number; font?: string; css: { w: number; h: number } }
  | { type: 'tick'; t: number; css: { w: number; h: number }; pose: IngotPose; held: boolean }
  | { type: 'down' };

const ctx = self as unknown as {
  postMessage(m: unknown): void;
  onmessage: ((e: { data: Msg }) => void) | null;
  fonts?: { add(f: unknown): void };
};

const css = { w: 1, h: 1 };
let runner: IngotRunner | null = null;
let ready: Promise<void> | null = null;

ctx.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') {
    css.w = m.css.w;
    css.h = m.css.h;
    ready = (async () => {
      // The lettering is drawn once into the relief map: the site's Archivo has to be here first (workers don't see the page's fonts).
      if (m.font && ctx.fonts) {
        try {
          const face = new FontFace('Archivo', `url(${m.font})`, { weight: '400 800', stretch: '100% 125%' });
          await face.load();
          ctx.fonts.add(face);
        } catch { /* falls back to the stack */ }
      }
      try {
        runner = createIngotRunner(m.canvas, m.kind, css, {
          dpr: m.dpr,
          full: m.full,
          onDrawn: () => ctx.postMessage({ type: 'ready' }),
          onLost: () => ctx.postMessage({ type: 'lost' }),
          onStep: (q) => ctx.postMessage({ type: 'step', q }),
        });
      } catch {
        runner = null;
        ctx.postMessage({ type: 'fail' });
      }
    })();
  } else if (m.type === 'tick') {
    const t = m.t;
    const draw = () => {
      if (!runner) return;
      css.w = m.css.w;
      css.h = m.css.h;
      const drew = runner.frame(t, m.pose, m.held);
      setTimeout(() => ctx.postMessage({ type: 'drawn', t, drew }), 0);
    };
    if (runner) draw();
    else ready?.then(draw);
  } else if (m.type === 'down') runner?.down();
};
