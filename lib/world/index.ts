// startWorld(root, opts): mounts the world behind the page. Framework-free: the Next.js page (components/world/
// WorldMount.tsx) and the single-file preview (world/preview-entry.ts) call the same thing.
//
// Query params (tests, screenshots): ?t=<s> fixed scene clock, ?q=<step> fixed quality step, ?world=full top quality,
// ?still reduced motion, ?loop=0 no loop. Test hooks on window.__world (see ARCHITECTURE.md).

import { createEngine, type Engine, type EngineOpts } from './engine';
import { MODULES } from './modules';

export type WorldOpts = EngineOpts & { canvas?: HTMLCanvasElement };

export type WorldApi = {
  v: 1;
  /** A snapshot: progress, place, camera, channels, quality, scroll, modules. */
  state(): Record<string, unknown>;
  /** Scroll so the journey is at `progress` (0..1 of the lap), immediately. Resolves after two frames. */
  go(progress: number): Promise<void>;
  /** Scroll to a place's pin fraction (0..1), immediately. */
  goPlace(name: string, f?: number): Promise<void>;
  /** Freeze the one clock (window.__clock.pause). */
  hold(): void;
  /** Advance the one clock by ms and draw exactly that frame. */
  step(ms?: number): Promise<void>;
  resume(): void;
  engine: Engine;
};

declare global {
  interface Window {
    __world?: WorldApi;
  }
}

const frames = (n = 2) =>
  new Promise<void>((res) => {
    const go = (k: number) => (k <= 0 ? res() : requestAnimationFrame(() => go(k - 1)));
    go(n);
  });

export async function startWorld(root: HTMLElement, opts: WorldOpts = {}): Promise<(() => void) | null> {
  const qs = new URLSearchParams(location.search);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const o: EngineOpts = {
    fixedT: qs.has('t') ? +qs.get('t')! : opts.fixedT,
    q: qs.has('q') ? +qs.get('q')! : opts.q,
    full: qs.get('world') === 'full' || opts.full,
    still: qs.has('still') || (reduce && !qs.has('motion')) || opts.still,
    ...opts,
  };
  // ?off=mark,paypal: run without those modules (their stand-ins come back): bisecting cost or a fault
  const off = (qs.get('off') ?? '').split(',').filter(Boolean);
  if (off.length) o.modules = (opts.modules ?? MODULES).filter((m) => !off.includes(m.id));
  const de = document.documentElement;
  const canvas = opts.canvas ?? Object.assign(document.createElement('canvas'), { className: 'world' });
  canvas.setAttribute('aria-hidden', 'true');
  if (!canvas.isConnected) document.body.prepend(canvas);

  const engine = await createEngine(canvas, root, {
    ...o,
    onFail: (why) => {
      de.setAttribute('data-world-fail', why);
      de.removeAttribute('data-world-on');
      de.removeAttribute('data-world-shown');
      opts.onFail?.(why);
    },
    // the canvas fades in over the still once a real frame is on it (engine.ts): never a black or mismatched cut
    onShown: () => de.setAttribute('data-world-shown', ''),
  });
  if (!engine) {
    if (!opts.canvas) canvas.remove();
    return null;
  }
  de.setAttribute('data-world-on', '');
  canvas.setAttribute('data-path', 'main');

  const clockApi = () => (window as unknown as { __clock: { pause(): void; step(ms?: number): Promise<void>; resume(): void } }).__clock;
  const api: WorldApi = {
    v: 1,
    state() {
      const f = engine.frame;
      return {
        t: f.t,
        progress: f.progress,
        y: f.y,
        laps: f.laps,
        scroll: f.scroll,
        loopLen: f.loopLen,
        looping: engine.scroll.looping,
        place: { ...f.place },
        ch: { ...f.ch },
        cam: { pos: f.cam.pos, h: f.cam.h, s: f.cam.s, theta: f.cam.theta, fov: f.cam.fov },
        sun: f.sun,
        quality: { step: f.quality.step, scale: f.quality.scale, q: f.quality.q, software: f.quality.software },
        modules: engine.modules.map((m) => m.id),
        places: Object.fromEntries(Object.values(f.places).map((p) => [p.name, { top: p.top, h: p.h }])),
        narrow: f.narrow,
        still: f.still,
        // a progress where the camera is low over the sea (cursor/finger wakes): the story place's swoop (h ~6)
        seaP: f.loopLen && f.places.story ? (f.places.story.top + 0.3 * Math.max(f.places.story.h - innerHeight, 0.8 * f.places.story.h)) / f.loopLen : 0.16,
      };
    },
    async go(p) {
      const L = engine.frame.loopLen || document.documentElement.scrollHeight - innerHeight;
      engine.scroll.to(p * L, true);
      await frames(2);
    },
    async goPlace(name, fr = 0) {
      const p = engine.frame.places[name];
      if (!p) throw new Error(`no place ${name}`);
      const pin = p.h - innerHeight;
      engine.scroll.to(p.top + fr * (pin >= 0.5 * innerHeight ? pin : Math.max(pin, 0.8 * p.h)), true);
      await frames(2);
    },
    hold: () => clockApi().pause(),
    step: (ms) => clockApi().step(ms),
    resume: () => clockApi().resume(),
    engine,
  };
  window.__world = api;

  return () => {
    engine.stop();
    if (!opts.canvas) canvas.remove();
    de.removeAttribute('data-world-on');
    de.removeAttribute('data-world-shown');
    if (window.__world === api) delete window.__world;
  };
}
