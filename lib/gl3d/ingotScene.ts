// Main-thread side of a live ingot: one transparent canvas per bar, floating on the page's liquid and turning as it
// scrolls through. Each frame of the one clock (lib/liquid/loop.ts) it reads the host's box (an early callback, clean
// layout), computes the bar's pose on the liquid's grid (ingotPose.ts: a five-point footprint through second-order
// springs) and hands time + pose to the renderer. Normally that is a Web Worker (ingotWorker.ts, OffscreenCanvas +
// WebGL2; the drawing lives in the DOM-free ingotRunner.ts) with backpressure (one tick in flight, only the newest
// waits); where OffscreenCanvas WebGL2 is missing (WebKit today) the same runner draws here, loaded only then.
// Each scene registers as a renderer of the clock (`window.__clock.settle`), paused while it is off screen.
// components/IngotScene.tsx imports this after load + idle; it is never in the first-load JS.
import { addSource, samplePx, sampleGrid, type HG } from '../liquid/field';
import { clockHeld, onFrame, renderer } from '../liquid/loop';
import { onLongTasks } from './watchdog';
import { createBarFloat, farAway, type IngotEnv, type IngotPose } from './ingotPose';
import type { IngotKind } from './ingots';

const full = () => /[?&]liquid=full\b/.test(location.search);

/** URL of the site's Archivo file (next/font writes the @font-face), so the worker can load the same face. Found once. */
let fontUrl: string | null | undefined;
function archivoUrl(): string | undefined {
  if (fontUrl === undefined) fontUrl = findArchivo() ?? null;
  return fontUrl ?? undefined;
}
function findArchivo(): string | undefined {
  const fam = getComputedStyle(document.documentElement).getPropertyValue('--font-archivo').trim().split(',')[0].replace(/["']/g, '').trim();
  if (!fam) return undefined;
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule) || rule.style.getPropertyValue('font-family').replace(/["']/g, '').trim() !== fam) continue;
      const m = /url\(\s*["']?([^"')]+)/.exec(rule.style.getPropertyValue('src'));
      if (m) return new URL(m[1], sheet.href || location.href).href;
    }
  }
  return undefined;
}

// Can a worker draw WebGL2 into an OffscreenCanvas? Learnt from the first worker that tries (WebKit has none: its worker
// fails, the owner re-keys the canvas and draws here), then remembered for the page and the session, so later bars skip
// the transfer and the failing worker. (Asking a throwaway context here instead costs a long task on software GL.)
const KEY = 'ingot-worker-gl';
let workerGL: boolean | undefined;
const workerKnownBad = () => {
  if (workerGL === undefined) {
    try { if (sessionStorage.getItem(KEY) === '0') workerGL = false; } catch { /* no storage */ }
  }
  return workerGL === false;
};
const learn = (ok: boolean) => {
  workerGL = ok;
  try { sessionStorage.setItem(KEY, ok ? '1' : '0'); } catch { /* no storage */ }
};

/**
 * Start a bar on `canvas`, placed by `host` (the element that scrolls with the text). `across()` says whether it travels
 * sideways (the pinned track) or up the page. `worker: false` forces the main-thread path. Returns the function that
 * releases everything. `onWorkerFail`: the worker can't draw (the canvas is spent then: the owner re-keys it and starts
 * again with `worker: false`); `onFail`: nothing can (the still stays).
 */
export function startIngot(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  kind: IngotKind,
  o: { across: () => boolean; worker: boolean; onDrawn: () => void; onLost: () => void; onFail: () => void; onWorkerFail: () => void },
): () => void {
  const env: IngotEnv = { css: { w: 1, h: 1 }, rect: { left: 0, top: 0, width: 1, height: 1 }, vw: 1, vh: 1, scrollX: 0, scrollY: 0, across: false };
  // The host's box. Up the page it only moves with the scroll, so it is measured every 20th frame (and on resize) and
  // otherwise follows scrollX/Y; on the pinned track it moves on its own, so it is measured every frame.
  let n = 0, px = 0, py = 0, sized = false;
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { sized = false; });
  ro?.observe(host);
  const read = () => {
    env.across = o.across();
    env.vw = innerWidth;
    env.vh = innerHeight;
    env.scrollX = scrollX;
    env.scrollY = scrollY;
    if (env.across || !sized || n++ % 20 === 0) {
      const r = host.getBoundingClientRect();
      if (!sized) {
        env.css.w = canvas.clientWidth; // the canvas overhangs the host's box (room to turn and bob)
        env.css.h = canvas.clientHeight;
        sized = true;
      }
      env.rect = { left: r.left, top: r.top, width: r.width, height: r.height };
      px = r.left + env.scrollX;
      py = r.top + env.scrollY;
    } else {
      env.rect.left = px - env.scrollX;
      env.rect.top = py - env.scrollY;
    }
  };
  read();
  const surface = (x: number, y: number, out: HG) => samplePx(x, y, undefined, out);
  const waves = (x: number, y: number, out: HG) => sampleGrid(x, y, out);
  const float = createBarFloat((x, y) => addSource(x, y, 0.2, 12, { kind: 'float' }));
  // For the motion harness: each bar's pose this frame (read-only, updated in place; no DOM writes).
  const w = window as unknown as { __ingots?: Record<string, { pose: IngotPose; t: number }> };
  const probe = { pose: float.pose, t: 0 };
  (w.__ingots ??= {})[kind] = probe;
  const useWorker = o.worker && !workerKnownBad() && typeof Worker !== 'undefined' && typeof canvas.transferControlToOffscreen === 'function';
  const reg = renderer(`ingot-${kind}`, useWorker ? 'worker' : 'main');
  const offRead = onFrame(read, { early: true });
  let stopped = false;
  const mark = (q: number) => host.setAttribute('data-q', String(q));

  // The pose for this frame, or null when the bar is far from the viewport (its renderer is paused then).
  let wasFar = false;
  const poseNow = (t: number, dt: number): IngotPose | null => {
    const far = document.hidden || farAway(env);
    if (far !== wasFar) {
      wasFar = far;
      reg.setPaused(far);
      if (!far) float.resume();
    }
    if (far) return null;
    probe.t = t;
    return float.step(env, t, dt, surface, waves);
  };

  const startWorker = (): (() => void) | null => {
    const font = archivoUrl();
    if (!font) return null;
    let worker: Worker;
    let off: OffscreenCanvas;
    try {
      worker = new Worker(new URL('./ingotWorker.ts', import.meta.url));
      off = canvas.transferControlToOffscreen();
    } catch {
      return null;
    }
    worker.postMessage({ type: 'init', canvas: off, kind, full: full(), dpr: devicePixelRatio || 1, font, css: { ...env.css } }, [off]);
    let dead = false;
    let busy = false;
    let pending: { t: number; pose: IngotPose } | null = null;
    const post = (t: number, pose: IngotPose) => {
      busy = true;
      worker.postMessage({ type: 'tick', t, css: { w: env.css.w, h: env.css.h }, pose: { ...pose }, held: clockHeld() });
    };
    const offFrame = onFrame((t, dt) => {
      const pose = poseNow(t, dt);
      if (!pose) return;
      if (busy) pending = { t, pose: { ...pose } };
      else post(t, pose);
    });
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === 'drawn') {
        busy = false;
        reg.done(m.t);
        if (pending) {
          const p = pending;
          pending = null;
          post(p.t, p.pose);
        }
      } else if (m.type === 'ready') { learn(true); o.onDrawn(); }
      else if (m.type === 'step') mark(m.q);
      else if (m.type === 'lost') o.onLost();
      else if (m.type === 'fail') { learn(false); fail(); }
    };
    worker.onerror = () => fail();
    const offLong = onLongTasks(() => { if (!clockHeld()) worker.postMessage({ type: 'down' }); });
    function fail() {
      if (dead) return;
      dead = true;
      stop();
      if (!stopped) o.onWorkerFail();
    }
    function stop() {
      offFrame();
      offLong();
      worker.terminate();
    }
    return stop;
  };

  const startMain = (): (() => void) => {
    let stopFn: (() => void) | null = null;
    let dead = false;
    Promise.all([import('./ingotRunner'), import('./ingots')])
      .then(async ([{ createIngotRunner }, { loadIngotFont }]) => {
        await loadIngotFont(); // the lettering is drawn once, so the site's Archivo has to be in first
        if (dead) return;
        const runner = createIngotRunner(canvas, kind, env.css, { dpr: devicePixelRatio || 1, full: full(), onDrawn: o.onDrawn, onLost: o.onLost, onStep: mark });
        const offLong = onLongTasks(() => { if (!clockHeld()) runner.down(); });
        const offFrame = onFrame((t, dt) => {
          const pose = poseNow(t, dt);
          if (!pose) return;
          runner.frame(t, pose, clockHeld());
          reg.done(t);
        });
        stopFn = () => {
          offFrame();
          offLong();
          runner.dispose();
        };
      })
      .catch(() => {
        if (!dead) o.onFail();
      });
    return () => {
      dead = true;
      stopFn?.();
    };
  };

  const stopRender = (useWorker ? startWorker() : null) ?? startMain();
  return () => {
    stopped = true;
    stopRender();
    offRead();
    ro?.disconnect();
    reg.off();
    host.removeAttribute('data-q');
    if (w.__ingots?.[kind] === probe) delete w.__ingots[kind];
  };
}
