// Main-thread side of the home logo (lib/gl3d/logoRunner.ts draws it). Normally the logo's canvas is handed to a Web
// Worker (sceneWorker.ts, OffscreenCanvas + WebGL2) so a slow or software GL (Lighthouse, PageSpeed) never blocks the
// page: this side posts only what changes (scroll progress, pointer, the canvas' box, new wave sources) and gets the
// ripples the logo sheds back. Where OffscreenCanvas WebGL2 is missing, or the worker can't get a context, the same
// runner draws on the main thread from the shared frame loop (and loads its code only then).
import { addSource, hooks } from '../liquid/field';
import { onFrame, renderer } from '../liquid/loop';
import { onLongTasks } from './watchdog';
import type { LogoEnv, LogoStory } from './logoRunner';

export type { LogoStory } from './logoRunner';
/** The canvas is this many ring boxes wide and tall, so scattered pieces have room. */
export const LOGO_SPAN = 2.4;

const full = () => /[?&]liquid=full\b/.test(location.search);

/**
 * Mounts a canvas into `host` (which spans the ring's box; the canvas is LOGO_SPAN times larger, centred) and runs the
 * logo. Returns the function that removes everything again.
 */
export function mountLogo(opts: {
  host: HTMLElement;
  story: () => LogoStory;
  onReady?: () => void;
  onFail?: () => void;
  /** The logo is finished and floating (the pour is over or was skipped). */
  onSettled?: () => void;
  /** First visit of the page: play the pour. `start()` is called once the first frame is up. */
  pour?: { tempo: number; start: () => void };
}): () => void {
  let stopped = false;
  let stopCur: (() => void) | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ready = false;
  const first = () => {
    if (ready || stopped) return;
    ready = true;
    opts.onReady?.();
    opts.pour?.start();
  };
  const fail = () => {
    stopCur?.();
    stopCur = null;
    canvas?.remove();
    opts.onFail?.();
  };
  const fresh = () => {
    canvas?.remove();
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.className = 'ig-3d';
    opts.host.appendChild(canvas);
    return canvas;
  };
  const dbgPour = location.search.includes('pourdebug');
  // Layout reads (boxes, nav bottom) are cached: re-read only after a scroll/resize, or every 0.7 s as a safety net.
  // Reading them every frame forced a style + layout pass after the floaters' writes (costly on phones).
  let lay: { css: { w: number; h: number }; rect: { left: number; top: number; width: number; height: number }; top: number } | null = null;
  let layDirty = true;
  let layAt = 0;
  const dirty = () => (layDirty = true);
  addEventListener('scroll', dirty, { passive: true });
  addEventListener('resize', dirty);
  const layout = (cv: HTMLCanvasElement) => {
    const now = performance.now();
    if (!lay || layDirty || now - layAt > 700) {
      const r = cv.getBoundingClientRect();
      lay = {
        css: { w: cv.clientWidth, h: cv.clientHeight },
        rect: { left: r.left, top: r.top, width: r.width, height: r.height },
        top: document.querySelector('header, nav')?.getBoundingClientRect().bottom ?? 64,
      };
      layDirty = false;
      layAt = now;
    }
    return lay;
  };
  const envNow = (cv: HTMLCanvasElement, ptr: { x: number; y: number }) => {
    const l = layout(cv);
    return {
      css: l.css,
      rect: l.rect,
      scrollY,
      top: l.top,
      ptr: { x: ptr.x, y: ptr.y },
      story: { ...opts.story() },
      pourT: dbgPour ? (window as unknown as { __pourT?: number }).__pourT : undefined,
    };
  };
  const ptr = { x: -9999, y: -9999 };
  const onMove = (e: PointerEvent) => {
    ptr.x = e.clientX;
    ptr.y = e.clientY;
  };
  const onLeave = () => {
    ptr.x = ptr.y = -9999;
  };
  addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);

  const startWorker = (cv: HTMLCanvasElement): (() => void) | null => {
    if (typeof Worker === 'undefined' || typeof cv.transferControlToOffscreen !== 'function') return null;
    let worker: Worker;
    let off: OffscreenCanvas;
    try {
      worker = new Worker(new URL('./sceneWorker.ts', import.meta.url));
      off = cv.transferControlToOffscreen();
    } catch {
      return null;
    }
    const post = (m: unknown, tr?: Transferable[]) => worker.postMessage(m, tr ?? []);
    post(
      { type: 'init', canvas: off, origin: performance.timeOrigin, full: full(), dpr: devicePixelRatio || 1, pour: opts.pour ? { tempo: opts.pour.tempo } : undefined, env: envNow(cv, ptr) },
      [off],
    );
    let dead = false;
    // one clock: a tick per main frame, never two in flight (the newest waits for the last 'tock')
    const reg = renderer('logo', 'worker');
    let busy = false;
    let pending = -1;
    const tick = (t: number) => {
      if (busy) {
        pending = t;
        return;
      }
      busy = true;
      post({ type: 'tick', t });
    };
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === 'tock') {
        busy = false;
        reg.done(m.t);
        if (pending >= 0) {
          const p = pending;
          pending = -1;
          tick(p);
        }
      } else if (m.type === 'ready') first();
      else if (m.type === 'settled') opts.onSettled?.();
      else if (m.type === 'emit') addSource(m.x, m.y, m.amp, m.size, { kind: 'float', t: m.t });
      else if (m.type === 'fail' && !dead) {
        dead = true;
        stop();
        // A canvas that went to the worker can't get a context again: swap in a fresh one for the main-thread path.
        const next = startMain(fresh());
        if (!next) fail();
        else stopCur = next;
      }
    };
    worker.onerror = () => {
      if (!dead) {
        dead = true;
        stop();
        fail();
      }
    };
    const forward = (s: { x: number; y: number; t0: number; amp: number; size: number }, kind: 'ring' | 'float') =>
      post({ type: 'src', x: s.x, y: s.y, t0: s.t0, amp: s.amp, size: s.size, kind });
    hooks.also.add(forward);
    let lastKey = '';
    const offFrame = onFrame((t) => {
      if (document.hidden) return;
      const env = envNow(cv, ptr);
      const key = JSON.stringify(env);
      if (key !== lastKey) {
        lastKey = key;
        post({ type: 'state', env });
      }
      tick(t);
    }, { early: true });
    const onVis = () => post({ type: 'vis', hidden: document.hidden });
    document.addEventListener('visibilitychange', onVis);
    const offLong = onLongTasks(() => post({ type: 'down' }));
    function stop() {
      hooks.also.delete(forward);
      reg.off();
      offFrame();
      offLong();
      document.removeEventListener('visibilitychange', onVis);
      worker.terminate();
    }
    return stop;
  };

  const startMain = (cv: HTMLCanvasElement): (() => void) | null => {
    let stopFn: (() => void) | null = null;
    let dead = false;
    import('./logoRunner')
      .then(({ createLogoRunner }) => {
        if (dead) return;
        const env: LogoEnv = { ...envNow(cv, ptr), ptr };
        const runner = createLogoRunner(cv, env, {
          dpr: devicePixelRatio || 1,
          full: full(),
          pour: opts.pour,
          emit: (x, y, amp, size, t) => addSource(x, y, amp, size, { kind: 'float', t }),
          onFirst: first,
          onSettled: opts.onSettled,
        });
        const offLong = onLongTasks(() => runner.down());
        const reg = renderer('logo', 'main');
        const offFrame = onFrame((t) => {
          const n = envNow(cv, ptr);
          env.css.w = n.css.w;
          env.css.h = n.css.h;
          env.rect = n.rect;
          env.scrollY = n.scrollY;
        env.top = n.top;
          env.story = n.story;
          env.pourT = n.pourT;
          runner.frame(t);
          reg.done(t);
        });
        stopFn = () => {
          reg.off();
          offFrame();
          offLong();
          runner.dispose();
        };
        if (dead) stopFn();
      })
      .catch(() => {
        if (!dead) fail();
      });
    return () => {
      dead = true;
      stopFn?.();
    };
  };

  const cv0 = fresh();
  stopCur = startWorker(cv0);
  if (!stopCur) stopCur = startMain(cv0);

  return () => {
    stopped = true;
    stopCur?.();
    removeEventListener('pointermove', onMove);
    removeEventListener('scroll', dirty);
    removeEventListener('resize', dirty);
    document.removeEventListener('pointerleave', onLeave);
    canvas?.remove();
  };
}
