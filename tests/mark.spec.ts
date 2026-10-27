import { expect, test } from '@playwright/test';
import { RING, pixels } from '../lib/splitRing';

// The Split Ring's geometry (lib/splitRing.ts): the machine half meets the human half edge to edge.

test('pixels are exactly as thick as the line', () => {
  expect(RING.px).toBe(RING.stroke);
});

test('the end pixels start where the line ends, flush, with nothing sticking out', () => {
  for (const { r, n } of RING.rings) {
    const ps = pixels(r, n);
    for (const p of [ps[0], ps[ps.length - 1]]) {
      const a = (p.deg * Math.PI) / 180;
      // Centre of the pixel's near edge (half a pixel back along the ring, towards the line)…
      const ex = p.x - (RING.px / 2) * Math.abs(Math.sin(a));
      // …sits on the line's end, the vertical through the centre, on the ring's radius.
      expect(Math.abs(ex - RING.c)).toBeLessThan(0.01);
      expect(Math.abs(Math.hypot(p.x - RING.c, p.y - RING.c) - r)).toBeLessThan(1e-9);
    }
  }
});
