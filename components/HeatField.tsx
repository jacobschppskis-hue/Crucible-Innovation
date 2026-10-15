'use client';
import { useEffect, useRef } from 'react';

type Props = {
  /** Center of the isotherms as fractions of the canvas, per breakpoint. */
  origin?: [number, number];
  originMobile?: [number, number];
  className?: string;
};

const SPEED = 5; // px per second, outward drift
const MAX_RINGS = 60;
// The drift is slow, so a low frame rate is invisible and keeps the main thread free for scrolling.
const FRAME_MS = 1000 / 30;
const FRAME_MS_TOUCH = 1000 / 20;

/**
 * Faint concentric isotherms: left halves are lines (human), right halves are pixel dots (machine),
 * drifting slowly outward. Canvas 2D; paused off-screen, in background tabs, and static with reduced motion.
 */
export function HeatField({ origin = [0.5, 0.5], originMobile, className = '' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const touch = matchMedia('(hover: none)').matches; // phones: fewer pixels, fewer dots, fewer frames
    const frameMs = touch ? FRAME_MS_TOUCH : FRAME_MS;
    const dotStep = touch ? 16 : 11;
    let w = 0, h = 0, cx = 0, cy = 0, maxR = 0, gap = 34, raf = 0, last = 0, t = 0;
    let visible = false, ready = false;

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, touch ? 1.5 : 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const [ox, oy] = w < 1024 && originMobile ? originMobile : origin;
      cx = w * ox;
      cy = h * oy;
      maxR = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
      gap = Math.max(touch ? 44 : 36, maxR / MAX_RINGS);
      draw();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const offset = (t * SPEED) % gap;
      for (let r = offset + gap * 0.5; r < maxR; r += gap) {
        const k = r / maxR;
        // fade in near the core, fade out toward the edge
        const a = 0.11 * Math.min(1, r / 140) * Math.pow(1 - k, 1.4);
        if (a < 0.004) continue;
        ctx.strokeStyle = ctx.fillStyle = `rgba(232,228,216,${a.toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI / 2, (Math.PI * 3) / 2);
        ctx.stroke();
        const n = Math.max(6, Math.round((Math.PI * r) / dotStep));
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const ang = -Math.PI / 2 + (Math.PI * i) / n;
          ctx.rect(cx + r * Math.cos(ang) - 1, cy + r * Math.sin(ang) - 1, 2, 2);
        }
        ctx.fill();
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < frameMs) return;
      t += Math.min(now - last, 100) / 1000;
      last = now;
      draw();
    };
    const start = () => {
      if (reduced || !ready || raf || !visible || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      visible ? start() : stop();
    });
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);

    // One static frame right away; the drift only starts once the page has loaded and gone idle.
    let idle = 0;
    const begin = () => {
      const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
      idle = ric(() => {
        ready = true;
        start();
      });
    };
    if (document.readyState === 'complete') begin();
    else addEventListener('load', begin, { once: true });

    return () => {
      removeEventListener('load', begin);
      (window.cancelIdleCallback ?? clearTimeout)(idle);
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [origin, originMobile]);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}
