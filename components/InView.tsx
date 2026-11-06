'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { releaseConceptFonts } from '@/lib/tier';

/**
 * One shared IntersectionObserver for every [data-reveal] / [data-words] / [data-cast] element: sets data-in at 15%
 * visibility (of the element or of the viewport height, so tall elements work), plus a sweep that reveals anything in view or passed after jumps. A second one keeps data-live on [data-heat] elements while they're on screen (their loops pause off it).
 */
export function InView() {
  const pathname = usePathname();
  useEffect(() => {
    releaseConceptFonts();
    const SEL = '[data-reveal]:not([data-in]), [data-words]:not([data-in]), [data-cast]:not([data-in])';
    const pending = new Set<Element>();
    const show = (el: Element) => {
      el.setAttribute('data-in', '');
      pending.delete(el);
      io.unobserve(el);
    };
    // 0.15 of the element, or 15% of the viewport's height of it: an element taller than the viewport / 0.15 can never reach a ratio of 0.15.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const vh = e.rootBounds?.height ?? innerHeight;
          if (e.intersectionRatio >= 0.15 || e.intersectionRect.height >= vh * 0.15) show(e.target);
        }
      },
      { threshold: [0, 0.01, 0.05, 0.15, 0.3] },
    );
    // Safety net: a fast or programmatic scroll can jump past an element without an intersection callback, and
    // content-visibility sections lay out a frame or more after the jump. Anything laid out that is in view or above the
    // fold (or already passed) is revealed here: on scroll, scroll end, resize, and on a slow timer while any are pending.
    const sweep = () => {
      const vh = innerHeight;
      for (const el of [...pending]) {
        if (!el.isConnected) {
          pending.delete(el);
          continue;
        }
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.top < vh * 0.85) show(el);
      }
    };
    let raf = 0;
    const soon = () => {
      if (!pending.size || raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        sweep();
      });
    };
    document.querySelectorAll(SEL).forEach((el) => {
      pending.add(el);
      io.observe(el);
    });
    addEventListener('scroll', soon, { passive: true });
    addEventListener('scrollend', soon);
    addEventListener('resize', soon);
    const tick = setInterval(sweep, 400);
    const live = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.toggleAttribute('data-live', e.isIntersecting);
    });
    document.querySelectorAll('[data-heat]').forEach((el) => live.observe(el));
    return () => {
      io.disconnect();
      live.disconnect();
      clearInterval(tick);
      cancelAnimationFrame(raf);
      removeEventListener('scroll', soon);
      removeEventListener('scrollend', soon);
      removeEventListener('resize', soon);
    };
  }, [pathname]);
  return null;
}
