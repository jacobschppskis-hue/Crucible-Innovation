'use client';
import { useEffect, useRef, useState } from 'react';
import { reducedMotion } from '@/lib/scroll';
import { richTier } from '@/lib/tier';
import type { IngotKind } from '@/lib/gl3d';

/**
 * A venture's ingot: a real-time 3D object floating on the page's liquid (lib/gl3d/ingotScene.ts). Its still (the same
 * 3D ingot captured from our renderer, transparent, scripts/ingot-stills.mjs) is what shows with reduced motion, without
 * JS or WebGL, and holds the layout. The canvas is created when the ingot is near the viewport and released when far.
 * gl3d is imported after load + idle, never in the first-load JS.
 */
export function IngotScene({ slug, sizes, eager }: { slug: string; sizes: string; eager?: boolean }) {
  const host = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // A canvas handed to a worker (transferControlToOffscreen) is spent: after a release the next start needs a fresh one.
  const [gen, setGen] = useState(0);

  useEffect(() => {
    const el = host.current;
    if (!el || reducedMotion()) return;
    let dead = false;
    let stop: (() => void) | null = null;
    let io: IntersectionObserver | null = null;
    let starting = false;
    let broken = false;
    let near = false;
    let worker = true; // false once the worker could not draw: the main thread then does
    const onTrack = !!el.closest('.vf-track');
    const wide = matchMedia('(min-width: 1024px) and (min-height: 600px)');
    const across = () => onTrack && wide.matches; // read every frame: one MediaQueryList, not a new one each time
    const release = () => {
      const was = stop || starting;
      stop?.();
      stop = null;
      el.removeAttribute('data-on');
      starting = false;
      if (was && !dead) setGen((g) => g + 1);
    };
    const start = () => {
      if (dead || !near || stop || starting || broken) return;
      starting = true;
      import('@/lib/gl3d/ingotScene')
        // each bar starts in a task of its own, so several coming near at once never add up to one long task
        .then((m) => new Promise<typeof m>((res) => setTimeout(() => res(m), 0)))
        .then(({ startIngot }) => {
          if (dead || !starting || stop) return;
          const canvas = canvasRef.current;
          if (!canvas) return;
          try {
            stop = startIngot(canvas, el, slug as IngotKind, {
              across,
              worker,
              onDrawn: () => el.setAttribute('data-on', ''),
              onLost: () => { broken = true; release(); },
              onFail: () => { broken = true; release(); }, // no WebGL: the still stays
              onWorkerFail: () => {
                worker = false;
                release();
                requestAnimationFrame(() => requestAnimationFrame(start)); // after the fresh canvas has mounted
              },
            });
          } catch {
            broken = true;
            starting = false;
          }
        })
        .catch(() => { broken = true; starting = false; });
    };
    richTier().then(() => {
      if (dead || document.documentElement.dataset.tier !== 'rich') return;
      io = new IntersectionObserver(
        (entries) => {
          near = entries[entries.length - 1].isIntersecting;
          if (!near) return release();
          start();
        },
        { rootMargin: '100% 100% 100% 100%' },
      );
      io.observe(el);
    });
    return () => {
      dead = true;
      io?.disconnect();
      release();
    };
  }, [slug]);

  return (
    <span ref={host} className="ing">
      <img
        src={`/film/ingots/${slug}-1200.webp`}
        srcSet={`/film/ingots/${slug}-600.webp 600w, /film/ingots/${slug}-1200.webp 1200w, /film/ingots/${slug}-2400.webp 2400w`}
        sizes={sizes}
        width={1200}
        height={960}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : undefined}
        decoding="async"
        draggable={false}
        className="ing-still"
      />
      <canvas key={gen} ref={canvasRef} aria-hidden className="ing-canvas" />
    </span>
  );
}
