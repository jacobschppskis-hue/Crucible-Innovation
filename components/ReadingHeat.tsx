'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** Wraps each .heat-text block's words in spans (with --i, and --n on the block) for the reading-heat effect. */
export function ReadingHeat() {
  const pathname = usePathname();
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // The text is below the fold, so the wrapping waits for an idle moment instead of competing with hydration.
    const id = (window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 400)))(wrap, { timeout: 2000 });
    return () => (window.cancelIdleCallback ?? clearTimeout)(id);
  }, [pathname]);
  return null;
}

function wrapOne(el: HTMLElement) {
  const words = (el.textContent ?? '').split(' ');
  el.style.setProperty('--n', String(words.length));
  el.replaceChildren(
    ...words.flatMap((w, i) => {
      const s = document.createElement('span');
      s.textContent = w;
      s.style.setProperty('--i', String(i));
      return i < words.length - 1 ? [s, ' '] : [s];
    }),
  );
  el.dataset.heat = '';
}

// Blocks are wrapped as they come within a screen or two of the viewport (all ~850 spans at once was a long task on
// phones, and most of this text is far below the fold), a few per animation frame.
function wrap() {
  const queue: HTMLElement[] = [];
  let busy = false;
  const drain = () => {
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < 4) {
      const el = queue.shift()!;
      if (el.isConnected && !el.dataset.heat) wrapOne(el);
    }
    busy = queue.length > 0;
    if (busy) requestAnimationFrame(drain);
  };
  const io = new IntersectionObserver(
    (es) => {
      for (const e of es) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        queue.push(e.target as HTMLElement);
      }
      if (queue.length && !busy) {
        busy = true;
        requestAnimationFrame(drain);
      }
    },
    { rootMargin: '150% 0px 150% 0px' },
  );
  document.querySelectorAll<HTMLElement>('.heat-text:not([data-heat])').forEach((el) => io.observe(el));
}
