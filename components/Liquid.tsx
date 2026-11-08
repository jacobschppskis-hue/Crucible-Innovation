'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { reducedMotion } from '@/lib/scroll';
import { firstUse, richTier } from '@/lib/tier';

/** Seconds after load + idle at which the liquid starts if nobody has scrolled, moved or pressed a key yet. */
const UNTOUCHED = 2.5;

/** Where a selection may start under the pointer: on words, or in a block of them (a line's end, between lines). */
const WORDS = 'p,li,h1,h2,h3,h4,h5,h6,blockquote,figcaption,dt,dd,td,th,label,pre,code,input,textarea,select,[contenteditable]';

/**
 * Dragging across the page is how a visitor makes waves, so a mouse drag that starts on the liquid itself (empty page,
 * a picture, an effect) selects nothing; one that starts on text selects it as usual, and so do the keyboard, shift-
 * click and touch. (The browser would otherwise anchor a selection at the nearest words and paint it over everything
 * the drag crosses.) The opening is a scene and selects nothing at all (app/globals.css .ig).
 */
function keepDragsForWaves() {
  let down = false;
  const press = (e: PointerEvent) => (down = e.pointerType === 'mouse' && e.button === 0 && !e.shiftKey);
  const release = () => (down = false);
  const start = (e: Event) => {
    if (!down) return;
    const t = e.target as Node;
    if (t.nodeType === Node.TEXT_NODE) return;
    const el = t as Element;
    if (el.closest?.(WORDS)) return;
    for (const n of el.childNodes) if (n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) return;
    e.preventDefault();
  };
  addEventListener('pointerdown', press, true);
  addEventListener('pointerup', release, true);
  addEventListener('pointercancel', release, true);
  document.addEventListener('selectstart', start, true);
  return () => {
    removeEventListener('pointerdown', press, true);
    removeEventListener('pointerup', release, true);
    removeEventListener('pointercancel', release, true);
    document.removeEventListener('selectstart', start, true);
  };
}

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
  const pathname = usePathname();
  // A page that paints its own world (the home page: lib/world, mounted under an element with data-world) gets no
  // page liquid: two full-screen canvases would double the GPU work and paint over each other. Checked on every route
  // change, since this layout component survives client-side navigation.
  // A canvas handed to the worker is spent: every (re)start renders a fresh node (key), never a second transfer.
  const [{ off, run }, setState] = useState({ off: false, run: 0 });
  useEffect(() => {
    const world = !!document.querySelector('[data-world]');
    setState((s) => (s.off === world ? s : { off: world, run: world ? s.run : s.run + 1 }));
  }, [pathname]);

  useEffect(() => {
    if (off || reducedMotion()) return;
    let stop: (() => void) | null = null;
    let stopFloat: (() => void) | null = null;
    let stopGuard: (() => void) | null = null;
    let dead = false;
    let idleId = 0;
    let timer = 0;
    const touched = firstUse();
    // The home page's world (lib/world) paints its own ground: wait until it is gone (a client navigation away).
    const worldGone = () =>
      new Promise<void>((res) => {
        if (!document.querySelector('[data-world-root]')) return res();
        const on = (e: Event) => {
          if (!(e as CustomEvent<{ on: boolean }>).detail.on) {
            removeEventListener('crucible:world', on);
            res();
          }
        };
        addEventListener('crucible:world', on);
      });
    richTier().then(async (ok) => {
      if (!ok || dead) return;
      await worldGone();
      if (dead) return;
      await Promise.race([touched, new Promise<void>((r) => (timer = window.setTimeout(r, UNTOUCHED * 1000)))]);
      clearTimeout(timer);
      if (dead) return;
      const { startLiquid } = await import('@/lib/liquid/render');
      if (dead) return;
      stop = startLiquid(ref.current!);
      if (!stop || dead) return;
      stopGuard = keepDragsForWaves();
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
      stopGuard?.();
      stop?.();
    };
  }, [off, run]);

  if (off) return null;
  return <canvas key={run} ref={ref} aria-hidden className="liquid" />;
}
