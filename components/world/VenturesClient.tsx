'use client';
import { useEffect } from 'react';
import { onFrame } from '@/lib/liquid/loop';
import { reducedMotion, trackScroll } from '@/lib/scroll';
import { haptic } from '@/lib/haptic';
import { pressVenture, setVentureHover, setVenturesProgress, ventureBoxes } from '@/lib/world/ventures';

/**
 * Feeds the ventures section into the world (lib/world/ventures.ts) and lays each link's hit area over its monolith.
 * Hover, focus and a finger's touch heat the monolith; a press sinks it with a ripple. Without the world (no JS,
 * reduced motion, no WebGL) nothing here runs and the section stays a plain list.
 */
export function VenturesClient() {
  useEffect(() => {
    const sec = document.querySelector<HTMLElement>('[data-ventures]');
    if (!sec || reducedMotion()) return;
    const links = [...sec.querySelectorAll<HTMLAnchorElement>('.wv-link')];
    const hits = links.map((a) => a.querySelector<HTMLElement>('.wv-hit')!);
    const items = links.map((a) => a.closest<HTMLElement>('.wv-item')!);
    const offs: (() => void)[] = [];
    const on = (el: EventTarget, ev: string, fn: (e: Event) => void) => {
      el.addEventListener(ev, fn, { passive: true });
      offs.push(() => el.removeEventListener(ev, fn));
    };
    links.forEach((a, i) => {
      const hot = (v: boolean) => () => {
        setVentureHover(i, v);
        a.toggleAttribute('data-hot', v);
      };
      on(a, 'pointerenter', hot(true));
      on(a, 'pointerleave', hot(false));
      on(a, 'focus', hot(true));
      on(a, 'blur', hot(false));
      on(a, 'touchstart', hot(true));
      on(a, 'touchend', () => setTimeout(hot(false), 500));
      on(a, 'touchcancel', hot(false));
      on(a, 'pointerdown', () => {
        pressVenture(i);
        haptic(8);
      });
    });
    offs.push(trackScroll(sec, 'pin', (p) => setVenturesProgress(p, true)));

    // the world projects each monolith every tick; lay the hit areas over them (layout reads first, then writes)
    let parents: DOMRect[] = [];
    let armed = false;
    offs.push(
      onFrame(
        () => {
          parents = hits.map((h) => (h.offsetParent as HTMLElement | null)?.getBoundingClientRect() ?? new DOMRect());
        },
        { early: true },
      ),
    );
    offs.push(
      onFrame(() => {
        const any = ventureBoxes.some((b) => b.vis || b.rise > 0);
        if (any !== armed) {
          armed = any;
          sec.toggleAttribute('data-armed', any);
        }
        ventureBoxes.forEach((b, i) => {
          const h = hits[i], r = parents[i];
          if (!r) return;
          items[i].style.setProperty('--r', b.rise.toFixed(3));
          items[i].style.pointerEvents = b.rise > 0.6 ? '' : 'none';
          if (!b.vis) {
            h.style.display = 'none';
            return;
          }
          h.style.display = '';
          h.style.transform = `translate(${(b.x - r.left).toFixed(1)}px, ${(b.y - r.top).toFixed(1)}px)`;
          h.style.width = `${b.w.toFixed(1)}px`;
          h.style.height = `${b.h.toFixed(1)}px`;
          // wide screens: the words stand under their monolith
          items[i].style.setProperty('--cx', `${(b.x + b.w / 2).toFixed(1)}px`);
        });
      }),
    );
    return () => offs.forEach((f) => f());
  }, []);
  return null;
}
