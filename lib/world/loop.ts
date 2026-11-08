// The scroll loop: the home page never ends. The last place (`data-place="loop"`) is a copy of the hero's first screen,
// exactly one viewport tall, so scroll position `loopLen` (= the document's scroll limit) looks exactly like 0; Lenis in
// infinite mode wraps there, on wheel/trackpad, keyboard and touch (syncTouch: Lenis carries the finger's momentum
// itself, because setting the scroll during a native iOS/Android fling kills the fling).
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
      syncTouch: true,
      syncTouchLerp: 0.08,
      touchInertiaExponent: 1.6,
      touchMultiplier: 1.1,
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
