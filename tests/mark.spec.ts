import { expect, test } from '@playwright/test';
import { RING, dotsSvg, pixels, splitRingSvg } from '../lib/splitRing';

// The Split Ring's geometry (lib/splitRing.ts): the machine half meets the human half edge to edge, and the
// squares are upright like screen pixels (axis-aligned, never rotated with the circle).

test('pixels are exactly as thick as the line', () => {
  expect(RING.px).toBe(RING.stroke);
});

test('the end pixels start where the line ends, flush, with nothing sticking out', () => {
  for (const { r, n } of RING.rings) {
    const ps = pixels(r, n);
    for (const p of [ps[0], ps[ps.length - 1]]) {
      // The upright square's left edge is half a pixel left of its centre…
      const ex = p.x - RING.px / 2;
      // …and it sits on the line's end, the vertical through the centre (within the line's half width).
      expect(Math.abs(ex - RING.c)).toBeLessThan(RING.stroke);
      expect(Math.abs(Math.hypot(p.x - RING.c, p.y - RING.c) - r)).toBeLessThan(1e-9);
    }
  }
});

test('the squares are never rotated', () => {
  const svg = splitRingSvg();
  expect(svg).toContain('<rect');
  expect(svg).not.toMatch(/<rect[^>]*transform=/);
  expect(dotsSvg()).not.toContain('rotate(');
});
