'use client';
import { useEffect, useRef } from 'react';
import { reducedMotion } from '@/lib/scroll';
import { firstUse, richTier } from '@/lib/tier';

/** Seconds after load + idle at which the liquid starts if nobody has scrolled, moved or pressed a key yet. */
const UNTOUCHED = 2.5;

/**
 * The liquid: one fixed canvas behind the whole page that paints the dark liquid (lib/liquid/render.ts), and the
 * floating of the page's text and blocks on it (lib/liquid/float.ts). Both load after load + idle, never in the
 * first-load JS. The liquid starts at the visitor's first scroll, pointer move or key press (or a moment later if there
 * is none): until something moves it is the same dark ground the page already shows, so a page that is only loaded
 * (a slow phone's first seconds, Lighthouse) doesn't pay for it. The floating starts on the next idle period after it.
 * With reduced motion, no JS or no WebGL the page keeps its plain dark ground (the html background), nothing floats and
 * nothing is hidden.
 */
export function Liquid() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (reducedMotion()) return;
    let stop: (() => void) | null = null;
    let stopFloat: (() => void) | null = null;
    let dead = false;
    let idleId = 0;
    let timer = 0;
    const touched = firstUse();
    richTier().then(async (ok) => {
      if (!ok || dead) return;
      await Promise.race([touched, new Promise<void>((r) => (timer = window.setTimeout(r, UNTOUCHED * 1000)))]);
      clearTimeout(timer);
      if (dead) return;
      const { startLiquid } = await import('@/lib/liquid/render');
      if (dead) return;
      stop = startLiquid(ref.current!);
      if (!stop || dead) return;
      const { startFloat } = await import('@/lib/liquid/float');
      if (dead) return;
      const ric = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      const go = () => {
        if (!dead) stopFloat = startFloat();
      };
      idleId = ric ? ric(go, { timeout: 1500 }) : window.setTimeout(go, 300);
    });
    return () => {
      dead = true;
      clearTimeout(timer);
      const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (cic) cic(idleId);
      else clearTimeout(idleId);
      stopFloat?.();
      stop?.();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="liquid" />;
}
