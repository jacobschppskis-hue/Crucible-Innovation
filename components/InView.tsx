'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { releaseConceptFonts } from '@/lib/tier';

/**
 * Reveals ([data-reveal] / [data-words] / [data-cast]) are an enhancement, never a gate on content.
 *
 * Nothing is hidden by default. An element is only hidden (`data-arm`) once JS has measured it and found it below the
 * viewport; anything in view or above, on every path (load, scroll restoration, jump, resize, late layout), is shown at
 * once and never armed. Armed elements get `data-in` (and animate) as they enter. If they enter in one big step (a jump,
 * a restore, an overloaded frame) or were passed, they also get `data-snap`: no transition, so the first frame that
 * paints the new position already shows them. No JS, and reduced motion: nothing is ever armed.
 *
 * Elements inside content-visibility:auto sections that are not laid out have no box (rect all zero): they are left
 * alone (visible) until the section renders, then measured. Scroll, scrollend, resize, body size changes, the cv-auto
 * state event and a slow timer all run the same measurement.
 *
 * Also: content-visibility:auto sections are rendered once after load + idle so their real sizes are remembered (below).
 *
 * A second observer keeps data-live on [data-heat] elements while they're on screen (their loops pause off it).
 */
export function InView() {
  const pathname = usePathname();
  useEffect(() => {
    releaseConceptFonts();
    const SEL = '[data-reveal]:not([data-in]), [data-words]:not([data-in]), [data-cast]:not([data-in])';
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pending = new Set<Element>(); // not yet shown
    const armed = new Set<Element>(); // hidden, waiting to enter
    let lastY = scrollY;
    const show = (el: Element, snap: boolean) => {
      if (snap) el.setAttribute('data-snap', '');
      el.setAttribute('data-in', '');
      pending.delete(el);
      armed.delete(el);
      io.unobserve(el);
    };
    // Normal scrolling: reveal at 15% of the element, or 15% of the viewport's height of it (tall elements).
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting || !armed.has(e.target)) continue;
          const vh = e.rootBounds?.height ?? innerHeight;
          if (e.intersectionRatio >= 0.15 || e.intersectionRect.height >= vh * 0.15) show(e.target, Math.abs(scrollY - lastY) > vh * 0.5);
        }
      },
      { threshold: [0, 0.01, 0.05, 0.15, 0.3] },
    );
    // The measurement. `edge`: how far up the viewport an armed element must have come to be shown. 0.85 while
    // scrolling (the observer's 15% usually gets there first), the whole viewport once at rest.
    const sweep = (edge = 1) => {
      const vh = innerHeight;
      const jumped = Math.abs(scrollY - lastY) > vh * 0.5;
      const moved = scrollY !== lastY;
      lastY = scrollY;
      for (const el of [...pending]) {
        if (!el.isConnected) {
          pending.delete(el);
          armed.delete(el);
          continue;
        }
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue; // not laid out (skipped section, display:none): stays visible
        const wasArmed = armed.has(el);
        if (calm || r.top < vh * (wasArmed ? edge : 1)) {
          // In view or above: shown. Never hidden, passed, jumped to, restored or at rest: no animation.
          show(el, calm || !wasArmed || jumped || r.bottom <= 0 || !moved);
        } else if (!wasArmed) {
          el.setAttribute('data-arm', '');
          armed.add(el);
          io.observe(el);
        }
      }
    };
    let raf = 0;
    const soon = () => {
      if (!pending.size || raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        sweep(0.85);
      });
    };
    const atRest = () => sweep();
    document.querySelectorAll(SEL).forEach((el) => pending.add(el));
    sweep(); // arms what is below the fold and shows the rest
    addEventListener('scroll', soon, { passive: true });
    addEventListener('scrollend', atRest);
    addEventListener('resize', soon);
    const cv = [...document.querySelectorAll('.cv-auto')];
    cv.forEach((c) => c.addEventListener('contentvisibilityautostatechange', soon));
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(soon);
    ro?.observe(document.body);
    const tick = setInterval(() => {
      if (pending.size) sweep();
    }, 400);
    const live = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.toggleAttribute('data-live', e.isIntersecting);
    });
    document.querySelectorAll('[data-heat]').forEach((el) => live.observe(el));

    // A content-visibility:auto section takes its real height only when it first renders, so until then everything
    // below it sits at estimated offsets: a jump, a hash link or a restore lands, then the page shifts by the error
    // (and scroll anchoring moves scrollY under the visitor). From 3 s after load, each section renders once (one per idle
    // slice, so no long task) and `contain-intrinsic-size: auto` remembers its real size. Then a hash target is
    // re-aligned, unless the visitor has already scrolled or clicked.
    let stop = false;
    let touched = false;
    let cur: HTMLElement | undefined;
    const INPUT = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
    const touch = () => (touched = true);
    INPUT.forEach((n) => addEventListener(n, touch, { passive: true, capture: true }));
    const realign = () => {
      if (touched || location.hash.length < 2) return;
      let t: HTMLElement | null = null;
      try {
        t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      } catch {}
      t?.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
    };
    const todo = [...document.querySelectorAll<HTMLElement>('.cv-auto')];
    const idle = (f: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(f, { timeout: 1500 }) : setTimeout(f, 100));
    const step = () => {
      if (stop) return;
      if (cur) cur.style.contentVisibility = '';
      // Sections wholly above the viewport are left alone: rendering one would move scrollY under the visitor (scroll
      // anchoring), and it renders by itself when scrolled back to.
      do cur = todo.shift();
      while (cur && cur.getBoundingClientRect().bottom <= 0);
      if (!cur) return realign();
      cur.style.contentVisibility = 'visible';
      requestAnimationFrame(() => requestAnimationFrame(() => idle(step)));
    };
    let wait = 0;
    const sizeUp = () => (wait = window.setTimeout(() => idle(step), 3000)); // after the load-time work, never inside it
    if (document.readyState === 'complete') sizeUp();
    else addEventListener('load', sizeUp, { once: true });

    return () => {
      stop = true;
      clearTimeout(wait);
      if (cur) cur.style.contentVisibility = '';
      INPUT.forEach((n) => removeEventListener(n, touch, { capture: true }));
      removeEventListener('load', sizeUp);
      io.disconnect();
      live.disconnect();
      ro?.disconnect();
      clearInterval(tick);
      cancelAnimationFrame(raf);
      cv.forEach((c) => c.removeEventListener('contentvisibilityautostatechange', soon));
      removeEventListener('scroll', soon);
      removeEventListener('scrollend', atRest);
      removeEventListener('resize', soon);
    };
  }, [pathname]);
  return null;
}
