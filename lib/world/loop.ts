// The scroll loop: the home page never ends. The last place (`data-place="loop"`) is a copy of the hero's first screen,
// exactly one viewport tall, so scroll position `loopLen` (= the document's scroll limit) looks exactly like 0; Lenis in
// infinite mode wraps there, on wheel/trackpad and keyboard. Touch is ours (`touch()` below): a script that sets the
// scroll during a native iOS fling stops the fling dead, so the finger moves the page directly (touchmove is
// prevented) and on release we glide with iOS' own deceleration (0.998 per ms), integrated exactly per frame, so the
// glide is the same length at 30, 60 and 120 Hz (Lenis' syncTouch inertia is per frame: 3x longer at 30 fps).
//
// Off (a normal page that simply ends, the copy hidden): reduced motion, no JS, ?loop=0, or no loop place.
// `scroll` is unwrapped: it keeps growing on the next lap, so springs and the camera never run backwards at the seam.

import { onFrame } from '@/lib/liquid/loop';

type LenisLike = {
  raf(t: number): void;
  scrollTo(target: number | string | HTMLElement, o?: { immediate?: boolean; offset?: number; duration?: number; lerp?: number; force?: boolean }): void;
  readonly animatedScroll: number;
  readonly targetScroll: number;
  readonly limit: number;
  readonly isScrolling: boolean | string;
  resize(): void;
  destroy(): void;
  on(e: 'scroll', cb: () => void): () => void;
};

export type ScrollCtl = {
  /** Unwrapped scroll (CSS px). */
  readonly scroll: number;
  readonly target: number;
  /** Scroll position of the loop seam (= Lenis' limit), 0 when not looping. */
  readonly loopLen: number;
  readonly looping: boolean;
  /** Jump (or glide) to an unwrapped scroll position. */
  to(y: number, immediate?: boolean): void;
  /** Call after layout changes. */
  measure(): void;
  destroy(): void;
};

const KEYS: Record<string, number> = { PageDown: 0.9, PageUp: -0.9, ArrowDown: 0.12, ArrowUp: -0.12, ' ': 0.9 };

export async function createScroll(opts: { still: boolean; spring?: number }): Promise<ScrollCtl> {
  const de = document.documentElement;
  const loopEl = document.querySelector<HTMLElement>('[data-place="loop"]');
  const qs = new URLSearchParams(location.search);
  const want = !opts.still && !!loopEl && qs.get('loop') !== '0';

  // the loop copy is exactly one (small) viewport tall: Lenis' limit is then the copy's top
  const setVh = () => de.style.setProperty('--world-vh', `${window.innerHeight}px`);
  setVh();

  let lenis: LenisLike | null = null;
  if (want) {
    const { default: Lenis } = await import('lenis');
    de.setAttribute('data-loop', '');
    lenis = new Lenis({
      infinite: true,
      syncTouch: false,
      lerp: 0.12,
      anchors: true,
      autoRaf: false,
      overscroll: false,
    } as ConstructorParameters<typeof Lenis>[0]) as unknown as LenisLike;
  }

  // native fallback: a critically damped spring on scrollY (time constant `spring` s)
  const tau = opts.spring ?? 0.035;
  let sy = window.scrollY,
    sv = 0;
  const offs: (() => void)[] = [];
  offs.push(
    onFrame(
      (t, dt) => {
        if (lenis) {
          lenis.raf(t * 1000);
          return;
        }
        const target = window.scrollY;
        if (opts.still || dt <= 0) {
          sy = target;
          sv = 0;
          return;
        }
        const w = 1 / tau,
          x = sy - target,
          e = Math.exp(-w * dt);
        const nx = (x + (sv + w * x) * dt) * e;
        sv = (sv - w * (sv + w * x) * dt) * e;
        sy = target + nx;
        if (Math.abs(nx) < 0.02 && Math.abs(sv) < 0.5) (sy = target), (sv = 0);
      },
      { early: true },
    ),
  );

  const onResize = () => {
    setVh();
    lenis?.resize();
  };
  addEventListener('resize', onResize);
  offs.push(() => removeEventListener('resize', onResize));

  if (lenis) offs.push(touch(lenis));

  if (lenis) {
    // keyboard: wrap like the wheel does (native key scrolling stops dead at the seam)
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName))) return;
      if (e.key === ' ' && el && el.tagName === 'A') return;
      const L = lenis!;
      let d = KEYS[e.key];
      if (e.key === ' ' && e.shiftKey) d = -0.9;
      if (d != null) {
        e.preventDefault();
        L.scrollTo(L.targetScroll + d * window.innerHeight);
      } else if (e.key === 'End') {
        e.preventDefault();
        const foot = document.querySelector<HTMLElement>('[data-place="shore"]');
        const lap = Math.floor(L.targetScroll / L.limit) * L.limit;
        if (foot) L.scrollTo(lap + foot.getBoundingClientRect().top + window.scrollY);
      } else if (e.key === 'Home') {
        e.preventDefault();
        L.scrollTo(Math.floor(L.targetScroll / L.limit) * L.limit);
      }
    };
    addEventListener('keydown', onKey);
    offs.push(() => removeEventListener('keydown', onKey));
  }

  return {
    get scroll() {
      return lenis ? lenis.animatedScroll : sy;
    },
    get target() {
      return lenis ? lenis.targetScroll : window.scrollY;
    },
    get loopLen() {
      return lenis ? lenis.limit : 0;
    },
    looping: !!lenis,
    to(y, immediate = true) {
      if (lenis) lenis.scrollTo(y, { immediate, force: true });
      else {
        window.scrollTo(0, y);
        if (immediate) (sy = y), (sv = 0);
      }
    },
    measure() {
      setVh();
      lenis?.resize();
    },
    destroy() {
      for (const o of offs) o();
      lenis?.destroy();
      de.removeAttribute('data-loop');
    },
  };
}

/** iOS' scroll deceleration: velocity x 0.998 per ms (UIScrollView's normal rate), i.e. a time constant of ~0.5 s. */
const TAU = -1 / (1000 * Math.log(0.998));

/** Touch scrolling for the looping page: the finger drives the page 1:1, release glides with a time-based decay. */
function touch(L: LenisLike): () => void {
  let id: number | null = null;
  let x0 = 0,
    y0 = 0,
    lastY = 0,
    axis: 'y' | 'x' | null = null;
  let samples: { t: number; y: number }[] = [];
  let v = 0; // px/s of scroll (positive = down the page)
  let gliding = false;
  const now = () => performance.now();
  const move = (dy: number) => L.scrollTo(L.targetScroll + dy, { immediate: true, force: true });

  const onStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) {
      id = null;
      return;
    }
    const t = e.touches[0];
    id = t.identifier;
    x0 = t.clientX;
    y0 = lastY = t.clientY;
    axis = null;
    gliding = false; // a finger catches the glide, as on iOS
    v = 0;
    samples = [{ t: e.timeStamp || now(), y: t.clientY }];
  };
  const onMove = (e: TouchEvent) => {
    if (id == null) return;
    const t = [...e.touches].find((k) => k.identifier === id);
    if (!t) return;
    if (!axis) {
      const dx = Math.abs(t.clientX - x0),
        dy = Math.abs(t.clientY - y0);
      if (dx < 6 && dy < 6) return;
      axis = dy >= dx ? 'y' : 'x';
    }
    if (axis !== 'y') return; // horizontal: leave it to the browser (back swipe)
    if (e.cancelable) e.preventDefault();
    const dy = lastY - t.clientY;
    lastY = t.clientY;
    if (dy) move(dy);
    // event time, not handler time: after a slow frame the handler runs late but the timestamp stays true
    const tm = e.timeStamp || now();
    samples.push({ t: tm, y: t.clientY });
    while (samples.length > 2 && tm - samples[0].t > 100) samples.shift();
  };
  const onEnd = (e: TouchEvent) => {
    if (id == null || [...e.touches].some((k) => k.identifier === id)) return;
    id = null;
    if (axis !== 'y') return;
    const tm = e.timeStamp || now();
    // release velocity: the last ~100 ms of the stroke (a finger that stopped before lifting does not glide)
    const a = samples[0],
      b = samples[samples.length - 1];
    const dt = (b.t - a.t) / 1000;
    v = dt > 0.008 && tm - b.t < 80 ? -(b.y - a.y) / dt : 0;
    gliding = Math.abs(v) > 30;
  };
  const off = onFrame((_t, dt) => {
    if (!gliding || dt <= 0) return;
    const k = Math.exp(-dt / TAU);
    const d = v * TAU * (1 - k);
    v *= k;
    move(d);
    if (Math.abs(v) < 8) gliding = false;
  });
  // a wheel or key takes over from a glide
  const stop = () => (gliding = false);
  const opt = { passive: false } as AddEventListenerOptions;
  addEventListener('touchstart', onStart, { passive: true });
  addEventListener('touchmove', onMove, opt);
  addEventListener('touchend', onEnd, { passive: true });
  addEventListener('touchcancel', onEnd, { passive: true });
  addEventListener('wheel', stop, { passive: true });
  addEventListener('keydown', stop);
  return () => {
    off();
    removeEventListener('touchstart', onStart);
    removeEventListener('touchmove', onMove, opt);
    removeEventListener('touchend', onEnd);
    removeEventListener('touchcancel', onEnd);
    removeEventListener('wheel', stop);
    removeEventListener('keydown', stop);
  };
}
