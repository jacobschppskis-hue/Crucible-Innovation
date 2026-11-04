'use client';
import { useEffect, useRef } from 'react';

/**
 * The heat wake. The page behaves like a pool of molten metal under the cursor: moving through it heats a trail that
 * glows Ember and cools away, and pushes ripples outward that spread and dissipate. The surface is attached to the
 * page, so scrolling drags it past a resting cursor and leaves a wake too. On touch screens a tap sends out a ring.
 *
 * A 2D wave equation on a coarse grid (one cell per 8–10 CSS px, a few thousand cells), drawn into a tiny canvas that
 * the browser scales up smoothly. It sits behind the content (z-index -1), so it only shows on open ground, never over
 * text or images, and only runs while something is moving: it starts on the first pointer or touch, so a page that
 * is only loaded (Lighthouse, a background tab) never pays for it. Off with prefers-reduced-motion.
 */
export function Wake() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const CELL = coarse ? 10 : 8;
    const DAMP = 0.982; // ripples fade over a second or so
    const COOL = 0.955; // the heated trail cools a little faster

    let cols = 0;
    let rows = 0;
    let cur = new Float32Array(0);
    let prev = new Float32Array(0);
    let heat = new Float32Array(0);
    let img: ImageData;

    const resize = () => {
      cols = Math.ceil(innerWidth / CELL) + 2;
      rows = Math.ceil(innerHeight / CELL) + 2;
      cur = new Float32Array(cols * rows);
      prev = new Float32Array(cols * rows);
      heat = new Float32Array(cols * rows);
      canvas.width = cols;
      canvas.height = rows;
      canvas.style.width = `${cols * CELL}px`;
      canvas.style.height = `${rows * CELL}px`;
      img = ctx.createImageData(cols, rows);
    };

    // Temperature → colour: dark red, Ember, then the hot core colour. Alpha rises with it.
    const RAMP = [
      [0, 70, 14, 2, 0],
      [0.3, 150, 34, 6, 0.18],
      [0.62, 255, 91, 31, 0.42],
      [1, 255, 179, 71, 0.62],
    ];
    const LUT = new Uint8ClampedArray(256 * 4);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      let k = 0;
      while (k < RAMP.length - 2 && t > RAMP[k + 1][0]) k++;
      const [t0, r0, g0, b0, a0] = RAMP[k];
      const [t1, r1, g1, b1, a1] = RAMP[k + 1];
      const f = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
      LUT.set([r0 + (r1 - r0) * f, g0 + (g1 - g0) * f, b0 + (b1 - b0) * f, (a0 + (a1 - a0) * f) * 255], i * 4);
    }

    /** Drop energy (a ripple) and heat (the glowing trail) at viewport point x, y. */
    const disturb = (x: number, y: number, amp: number, warm: number, r = 1) => {
      const cx = Math.round(x / CELL) + 1;
      const cy = Math.round(y / CELL) + 1;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const gx = cx + dx;
          const gy = cy + dy;
          if (gx < 1 || gy < 1 || gx >= cols - 1 || gy >= rows - 1) continue;
          const fall = Math.exp(-(dx * dx + dy * dy) / (r * r * 0.9 + 0.4));
          const i = gy * cols + gx;
          cur[i] += amp * fall;
          heat[i] = Math.min(1.2, heat[i] + warm * fall);
        }
    };

    // The surface moves with the page: shift every field by whole cells as the page scrolls.
    const shift = (n: number) => {
      const s = n * cols;
      for (const f of [cur, prev, heat]) {
        if (n > 0) {
          f.copyWithin(0, s);
          f.fill(0, f.length - s);
        } else {
          f.copyWithin(-s, 0, f.length + s);
          f.fill(0, 0, -s);
        }
      }
    };

    let raf = 0;
    let quietFrames = 0;
    const frame = () => {
      raf = 0;
      // One wave step: next = (sum of neighbours) / 2 - previous, damped. `prev` becomes the next state.
      let energy = 0;
      for (let y = 1; y < rows - 1; y++) {
        const row = y * cols;
        for (let x = 1; x < cols - 1; x++) {
          const i = row + x;
          const v = ((cur[i - 1] + cur[i + 1] + cur[i - cols] + cur[i + cols]) * 0.5 - prev[i]) * DAMP;
          prev[i] = v;
          heat[i] *= COOL;
          energy += Math.abs(v) + heat[i];
        }
      }
      [cur, prev] = [prev, cur];

      // Light: the trail's heat plus the slope of the surface (ripple crests catch the light).
      const d = img.data;
      for (let y = 1; y < rows - 1; y++) {
        const row = y * cols;
        for (let x = 1; x < cols - 1; x++) {
          const i = row + x;
          const gx = cur[i + 1] - cur[i - 1];
          const gy = cur[i + cols] - cur[i - cols];
          const t = Math.min(1, heat[i] * 1.05 + Math.sqrt(gx * gx + gy * gy) * 0.7);
          const l = ((t * 255) | 0) * 4;
          const j = i * 4;
          d[j] = LUT[l];
          d[j + 1] = LUT[l + 1];
          d[j + 2] = LUT[l + 2];
          d[j + 3] = LUT[l + 3];
        }
      }
      ctx.putImageData(img, 0, 0);

      quietFrames = energy < 0.02 * (cols * rows) / 1000 ? quietFrames + 1 : 0;
      if (quietFrames < 20) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, cols, rows);
    };
    const wake = () => {
      quietFrames = 0;
      if (!raf) raf = requestAnimationFrame(frame);
    };

    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      canvas.dataset.on = '';
      resize();
      lastScroll = scrollY;
    };

    // Pointer: the wake follows the path, stronger the faster it moves.
    let px = -1;
    let py = -1;
    let pt = 0;
    const onMove = (e: PointerEvent) => {
      start();
      const now = performance.now();
      if (px >= 0 && e.pointerType !== 'touch') {
        const dx = e.clientX - px;
        const dy = e.clientY - py;
        const dist = Math.hypot(dx, dy);
        const speed = dist / Math.max(8, now - pt); // px per ms
        const steps = Math.min(24, Math.ceil(dist / CELL));
        for (let s = 1; s <= steps; s++) {
          const f = s / steps;
          disturb(px + dx * f, py + dy * f, Math.min(1.6, 0.25 + speed * 0.9), Math.min(0.32, 0.04 + speed * 0.16));
        }
        wake();
      }
      px = e.clientX;
      py = e.clientY;
      pt = now;
    };
    const onLeave = () => {
      px = py = -1;
    };
    // Touch: a tap sends out a ring.
    const onDown = (e: PointerEvent) => {
      start();
      disturb(e.clientX, e.clientY, e.pointerType === 'touch' ? 7 : 4, 0.6, 2);
      wake();
    };
    // Scroll: the surface moves with the page, under a cursor that stays put, so the cursor cuts a wake through it.
    let lastScroll = 0;
    let acc = 0;
    const onScroll = () => {
      if (!started) return;
      const dy = scrollY - lastScroll;
      lastScroll = scrollY;
      acc += dy / CELL;
      const n = Math.trunc(acc);
      if (n) {
        acc -= n;
        if (Math.abs(n) >= rows) {
          cur.fill(0);
          prev.fill(0);
          heat.fill(0);
        } else shift(n);
      }
      if (px >= 0 && Math.abs(dy) > 0.5) disturb(px, py, Math.min(1.4, Math.abs(dy) * 0.03), Math.min(0.25, Math.abs(dy) * 0.006));
      wake();
    };
    const onResize = () => started && resize();

    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerleave', onLeave);
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="wake" />;
}
