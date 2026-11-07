// Main-thread side of a live ingot: one transparent canvas per ingot, floating on the page's liquid and turning as it
// scrolls through. Normally the canvas is handed to a Web Worker (ingotWorker.ts, OffscreenCanvas + WebGL2; the draw
// loop and the relief-map drawing live in the DOM-free ingotRunner.ts) so a slow or software GL never blocks the page:
// this side posts only what changes (the host's box, the viewport, the scroll, new wave sources) and gets the ripples
// the ingot sheds and the first-drawn signal back. Where OffscreenCanvas WebGL2 is missing (or the font can't be found
// for the worker) the same runner draws on the main thread from the shared frame loop, loaded only then.
// components/IngotScene.tsx imports this after load + idle; it is never in the first-load JS.
import { addSource, hooks } from '../liquid/field';
import { onFrame } from '../liquid/loop';
import { onLongTasks } from './watchdog';
import type { IngotKind } from './ingots';
import type { IngotEnv } from './ingotRunner';

const full = () => /[?&]liquid=full\b/.test(location.search);

/** URL of the site's Archivo file (next/font writes the @font-face), so the worker can load the same face. */
function archivoUrl(): string | undefined {
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

/**
 * Start an ingot on `canvas`, placed by `host` (the element that scrolls with the text). `across()` says whether the
 * ingot travels sideways (the pinned track) or up the page. `worker: false` forces the main-thread path. Returns the
 * function that releases everything. `onWorkerFail` is called when the worker can't draw (the canvas is spent then:
 * the owner swaps in a fresh one and starts again with `worker: false`); `onFail` when nothing can (the still stays).
 */
export function startIngot(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  kind: IngotKind,
  o: { across: () => boolean; worker: boolean; onDrawn: () => void; onLost: () => void; onFail: () => void; onWorkerFail: () => void },
): () => void {
  const envNow = (): IngotEnv => {
    const r = host.getBoundingClientRect();
    return { css: { w: host.clientWidth, h: host.clientHeight }, rect: { left: r.left, top: r.top, width: r.width, height: r.height }, vw: innerWidth, vh: innerHeight, scrollX, scrollY, across: o.across() };
  };
  const offscreen = (e: IngotEnv) => e.rect.top + e.rect.height < -e.vh * 0.2 || e.rect.top > e.vh * 1.2 || e.rect.left + e.rect.width < -e.vw * 0.2 || e.rect.left > e.vw * 1.2;

  const startWorker = (): (() => void) | null => {
    const font = archivoUrl();
    if (!font || typeof Worker === 'undefined' || typeof canvas.transferControlToOffscreen !== 'function') return null;
    let worker: Worker;
    let off: OffscreenCanvas;
    try {
      worker = new Worker(new URL('./ingotWorker.ts', import.meta.url));
      off = canvas.transferControlToOffscreen();
    } catch {
      return null;
    }
    worker.postMessage({ type: 'init', canvas: off, kind, origin: performance.timeOrigin, full: full(), dpr: devicePixelRatio || 1, font, env: envNow() }, [off]);
    let dead = false;
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === 'drawn') o.onDrawn();
      else if (m.type === 'emit') addSource(m.x, m.y, m.amp, m.size, { kind: 'float', t: m.t });
      else if (m.type === 'lost') o.onLost();
      else if (m.type === 'fail' && !dead) {
        dead = true;
        stop();
        o.onWorkerFail();
      }
    };
    worker.onerror = () => {
      if (!dead) {
        dead = true;
        stop();
        o.onWorkerFail();
      }
    };
    const forward = (s: { x: number; y: number; t0: number; amp: number; size: number }, k: 'ring' | 'float') =>
      worker.postMessage({ type: 'src', x: s.x, y: s.y, t0: s.t0, amp: s.amp, size: s.size, kind: k });
    hooks.also.add(forward);
    let lastKey = '';
    let wasOff = false;
    const offFrame = onFrame(() => {
      if (document.hidden) return;
      const env = envNow();
      const far = offscreen(env);
      if (far && wasOff) return; // far away and already told so: nothing to say until it comes back
      wasOff = far;
      const key = JSON.stringify(env);
      if (key === lastKey) return;
      lastKey = key;
      worker.postMessage({ type: 'state', env });
    }, { early: true });
    const onVis = () => worker.postMessage({ type: 'vis', hidden: document.hidden });
    document.addEventListener('visibilitychange', onVis);
    const offLong = onLongTasks(() => worker.postMessage({ type: 'down' }));
    function stop() {
      hooks.also.delete(forward);
      offFrame();
      offLong();
      document.removeEventListener('visibilitychange', onVis);
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
        const env = envNow();
        const runner = createIngotRunner(canvas, kind, env, {
          dpr: devicePixelRatio || 1,
          full: full(),
          emit: (x, y, amp, size, t) => addSource(x, y, amp, size, { kind: 'float', t }),
          onDrawn: o.onDrawn,
          onLost: o.onLost,
        });
        const offLong = onLongTasks(() => runner.down());
        const offFrame = onFrame((t) => {
          const n = envNow();
          env.css.w = n.css.w;
          env.css.h = n.css.h;
          env.rect = n.rect;
          env.vw = n.vw;
          env.vh = n.vh;
          env.scrollX = n.scrollX;
          env.scrollY = n.scrollY;
          env.across = n.across;
          runner.frame(t);
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

  return (o.worker ? startWorker() : null) ?? startMain();
}
