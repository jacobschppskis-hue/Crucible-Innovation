// Tiny motion helpers (instead of a motion library) to keep /sites well under the JS budget.

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** cubic-bezier(0.16, 1, 0.3, 1)-like ease-out. */
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Tween through keyframes over `ms`, calling onUpdate each frame. Returns a cancel function. */
export function tween(frames: number[], ms: number, onUpdate: (v: number) => void, ease = easeOutExpo, delay = 0) {
  let raf = 0;
  let t0 = 0;
  const segs = frames.length - 1;
  const step = (now: number) => {
    if (!t0) t0 = now + delay;
    const p = Math.max(0, Math.min(1, (now - t0) / ms));
    const e = ease(p) * segs;
    const i = Math.min(segs - 1, Math.floor(e));
    onUpdate(frames[i] + (frames[i + 1] - frames[i]) * (e - i));
    if (p < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

/** Calls `cb` once when `el` is at least `amount` visible. Returns a cleanup function. */
export function onceInView(el: Element, cb: () => void, amount = 0.15) {
  const io = new IntersectionObserver(
    ([e]) => {
      if (e.isIntersecting) {
        io.disconnect();
        cb();
      }
    },
    { threshold: amount },
  );
  io.observe(el);
  return () => io.disconnect();
}
