// The opening's machine half is physical: the cursor knocks the ring's pixels out of their slots, they tumble, bump
// into each other, and spring back into place. A few dozen springs, simulated only while something is moving.
// Each pixel gets --kx/--ky (SVG user units) and --kr (deg), added to its transform in app/globals.css (.ig-px).

type Body = { el: SVGGElement; cx: number; cy: number; x: number; y: number; vx: number; vy: number; r: number; vr: number };

const REACH = 70; // px: how close the cursor must come
const SPRING = 0.06;
const DAMP = 0.86;
const SIZE = 3.2; // user units: pixels closer than this push each other apart

export function startKnock(svg: SVGSVGElement) {
  const bodies: Body[] = [...svg.querySelectorAll<SVGGElement>('.ig-px')].map((el) => {
    const b = el.getBBox();
    return { el, cx: b.x + b.width / 2, cy: b.y + b.height / 2, x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0 };
  });
  let raf = 0;
  let mx = -1e4;
  let my = -1e4;
  let pmx = -1e4;
  let pmy = -1e4;
  let rect = svg.getBoundingClientRect();
  let still = 0;

  const step = () => {
    raf = 0;
    const k = rect.width / 64; // px per user unit
    const speed = Math.min(40, Math.hypot(mx - pmx, my - pmy));
    const cvx = (mx - pmx) / k;
    const cvy = (my - pmy) / k;
    pmx = mx;
    pmy = my;
    // The cursor in user units.
    const ux = (mx - rect.left) / k;
    const uy = (my - rect.top) / k;
    const reach = REACH / k;
    let moving = 0;
    for (const b of bodies) {
      const px = b.cx + b.x;
      const py = b.cy + b.y;
      const dx = px - ux;
      const dy = py - uy;
      const d = Math.hypot(dx, dy) || 1;
      if (d < reach && speed > 0.5) {
        // Pushed away from the cursor and along its motion, harder the faster it moves.
        const f = (1 - d / reach) * (0.08 + speed * 0.025);
        b.vx += (dx / d) * f * 3 + cvx * f * 0.35;
        b.vy += (dy / d) * f * 3 + cvy * f * 0.35;
        b.vr += (dx * cvy - dy * cvx) * f * 0.6;
      }
      // Spring home.
      b.vx += -b.x * SPRING;
      b.vy += -b.y * SPRING;
      b.vr += -b.r * SPRING;
    }
    // Pixels knock into each other.
    for (let i = 0; i < bodies.length; i++)
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        const dx = b.cx + b.x - (a.cx + a.x);
        const dy = b.cy + b.y - (a.cy + a.y);
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < SIZE) {
          const push = ((SIZE - d) / d) * 0.25;
          a.vx -= dx * push;
          a.vy -= dy * push;
          b.vx += dx * push;
          b.vy += dy * push;
        }
      }
    for (const b of bodies) {
      b.vx *= DAMP;
      b.vy *= DAMP;
      b.vr *= DAMP;
      b.x += b.vx;
      b.y += b.vy;
      b.r += b.vr;
      moving += Math.abs(b.vx) + Math.abs(b.vy) + Math.abs(b.x) + Math.abs(b.y);
      b.el.style.setProperty('--kx', b.x.toFixed(2));
      b.el.style.setProperty('--ky', b.y.toFixed(2));
      b.el.style.setProperty('--kr', b.r.toFixed(1));
    }
    still = moving < 0.05 ? still + 1 : 0;
    if (still < 10) raf = requestAnimationFrame(step);
  };

  const onMove = (e: PointerEvent) => {
    if (pmx < -1e3) {
      pmx = e.clientX;
      pmy = e.clientY;
    }
    mx = e.clientX;
    my = e.clientY;
    rect = svg.getBoundingClientRect();
    // Only bother when the cursor is near the ring.
    if (mx > rect.left - REACH && mx < rect.right + REACH && my > rect.top - REACH && my < rect.bottom + REACH) {
      still = 0;
      if (!raf) raf = requestAnimationFrame(step);
    } else {
      pmx = mx;
      pmy = my;
    }
  };
  addEventListener('pointermove', onMove, { passive: true });
  return () => {
    removeEventListener('pointermove', onMove);
    cancelAnimationFrame(raf);
  };
}
