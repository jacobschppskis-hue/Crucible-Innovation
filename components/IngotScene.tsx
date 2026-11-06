'use client';
import { useEffect, useRef } from 'react';
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

  useEffect(() => {
    const el = host.current;
    if (!el || reducedMotion()) return;
    let dead = false;
    let stop: (() => void) | null = null;
    let io: IntersectionObserver | null = null;
    let starting = false;
    let broken = false;
    const across = () => !!el.closest('.vf-track') && matchMedia('(min-width: 1024px) and (min-height: 600px)').matches;
    const release = () => {
      stop?.();
      stop = null;
      el.removeAttribute('data-on');
      starting = false;
    };
    richTier().then(() => {
      if (dead || document.documentElement.dataset.tier !== 'rich') return;
      io = new IntersectionObserver(
        (entries) => {
          const near = entries[entries.length - 1].isIntersecting;
          if (!near) return release();
          if (stop || starting || broken) return;
          starting = true;
          import('@/lib/gl3d/ingotScene')
            .then(async ({ startIngot, loadIngotFont }) => {
              await loadIngotFont(); // the lettering is drawn once, so the site's Archivo has to be in first
              if (dead || !starting) return;
              const canvas = canvasRef.current;
              if (!canvas) return;
              try {
                stop = startIngot(canvas, el, slug as IngotKind, across, () => { broken = true; release(); }, () => el.setAttribute('data-on', ''));
              } catch {
                broken = true; // no WebGL: the still stays
                starting = false;
              }
            })
            .catch(() => { broken = true; starting = false; });
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
        height={750}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : undefined}
        decoding="async"
        className="ing-still"
      />
      <canvas ref={canvasRef} aria-hidden className="ing-canvas" />
    </span>
  );
}
