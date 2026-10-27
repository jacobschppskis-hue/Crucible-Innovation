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

function wrap() {
  document.querySelectorAll<HTMLElement>('.heat-text:not([data-heat])').forEach((el) => {
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
  });
}
