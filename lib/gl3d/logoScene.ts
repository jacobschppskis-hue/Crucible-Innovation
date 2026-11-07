// Main-thread side of the home logo (lib/gl3d/logoRunner.ts draws it). Normally the logo's canvas is handed to a Web
// Worker (sceneWorker.ts, OffscreenCanvas + WebGL2) so a slow or software GL (Lighthouse, PageSpeed) never blocks the
// page. Where OffscreenCanvas WebGL2 is missing, or the worker can't get a context, the same runner draws on the main
// thread from the one clock (and loads its code only then).
//
// Every piece's pose is computed HERE, every frame of the one clock, and posted with the tick (the renderer applies
// exactly it): the scroll story's offsets (cells scatter, arcs leave, everything fuses) plus the floating. Each piece
// floats on the page's liquid on its own, the way the ingots do (ingotPose.ts): the surface under its whole footprint
// (the wave grid + the idle swell; a cell or the core: five points across it, an arc: nine points along it) gives the
// mean height, slope and best-plane tilt, and `buoy3` springs (lib/liquid/buoy.ts, STRONG) turn them into bob, tilt
// and drift. The cursor pushes the pieces through the same springs: the energy of the waves it makes pushes them away
// and tips them (as waves push a float), and the pointer itself is a soft hill they slide off (no clamp, no wall). A
// piece sheds a small ripple only when the visitor's waves rock it hard.
import { activity, addSource, sampleGrid, type Footprint, type HG } from '../liquid/field';
import { swellAt } from '../liquid/swell';
import { buoy3, STRONG, type BuoyOpts } from '../liquid/buoy';
import { clock, onFrame, renderer } from '../liquid/loop';
import { RING, cells } from '../splitRing';
import { onLongTasks } from './watchdog';
import type { LogoEnv, LogoStory } from './logoRunner';

export type { LogoStory } from './logoRunner';
/** The canvas is this many ring boxes wide and tall, so scattered pieces have room (= logoRunner.ts LOGO_SPAN). */
export const LOGO_SPAN = 2.4;
const MARK = 64;
/** = logoRunner.ts POSE_STRIDE: per piece the story's [x, y, z, rx, ry, rz, scale] and the floating [x, y, z, rx, ry, rz]. */
const STRIDE = 13;
/** The stage's camera (logoRunner: fov 28, MARK * LOGO_SPAN units fill the canvas height): eye distance, units. */
const DIST = (MARK * LOGO_SPAN) / 2 / Math.tan((14 * Math.PI) / 180);

const full = () => /[?&]liquid=full\b/.test(location.search);

// ---- the floating ------------------------------------------------------------------------------------------------

/** Per kind: a cell is light and quick, an arc heavy and slow; all on the strongest level of the page (a little
 *  under-damped, so a piece the waves tip rocks back once). Drift is wider than STRONG's so the cursor's push reads. */
const BUOYS: Record<'arc' | 'square' | 'core', BuoyOpts> = {
  square: { ...STRONG, tilt: 0.16, drift: 6.5, f: 1.3, zeta: 0.5 },
  core: { ...STRONG, tilt: 0.12, drift: 6.5, f: 1.0, zeta: 0.55 },
  arc: { ...STRONG, tilt: 0.12, drift: 6.5, f: 0.85, zeta: 0.6 },
};
/** The idle swell's share: its long waves (520-1050 px) run across the ring's width, so at full height they would move
 *  pieces on opposite sides apart by several px; at this share the ring stays one readable lattice at rest. */
const SWELL = 0.25;
/** The visitor's ripples: wavenumber (1/px) of their ringing (input.ts: 8.5 Hz at 420 px/s), so that h² + |∇h|²/k² is
 *  a ripple's squared amplitude (px²) whatever its phase: the waves' energy, smooth in space and time. */
const K_RIP = (2 * Math.PI * 8.5) / 420;
const INV_K2 = 1 / (K_RIP * K_RIP);
/** Waves push a float along their way (radiation pressure, as their energy) and tip it, the side they come from lifted:
 *  energy E0 (px²) gives half the effect; at full effect a push of KE_PUSH and a tip of KE_TIP (as surface slopes, into
 *  the same springs). They come from the pointer (the waves it makes, its scroll wake, its taps). Smoothed over E_TAU s.
 *  An arc is long: it is tipped where along it the waves are (the part they reach lifts), KE_ARC per unit of moment. */
const E0 = 12;
const KE_PUSH = 0.1;
const KE_TIP = 0.07;
const KE_ARC = 0.35;
const E_TAU = 0.08;
/** The pointer's soft hill: its height in px (as a fraction of its radius) and radius (mark units, at least px). It
 *  flattens out between HILL_REST s and HILL_GONE s after the pointer last moved, so a resting cursor lets them home. */
const HILL = 0.17;
const HILL_R = 9;
const HILL_MIN = 40;
const HILL_REST = 0.4;
const HILL_GONE = 1.2;

const scatter = (i: number) => {
  const r = (n: number) => ((Math.sin(i * 127.1 + n * 311.7) * 43758.5453) % 1 + 1) % 1;
  return { dx: 16 + r(1) * 44, dy: (r(2) - 0.5) * 64, dr: (r(3) - 0.5) * 220 };
};
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const hash = (i: number) => ((Math.sin(i * 91.7 + 3.1) * 43758.5453) % 1 + 1) % 1;

// The story's pieces stay on screen: on a narrow screen (phones, where the ring fills the width) the arcs' way left
// and the cells' scatter right are shortened so every piece stays EDGE px inside the screen at its farthest, and
// shrinks away there (as on desktop) instead of sitting cut off at the edge. Where there is room (desktop) both
// factors are exactly 1 and nothing changes.
const EDGE = 14;
/** The arcs' story: 34 units left and back, down to 22% (an arc is 33 units wide: half of it at 22%). */
const ARC_DX = 34, ARC_DZ = 34, ARC_SHRINK = 0.78, ARC_HALF = 16.5;
/** The cells' scatter: back 22 units, down to 55%; on a narrow screen it is squeezed toward this x (units right of
 *  the core) so the farthest cell lands at the edge. */
const SQ_DZ = 22, SQ_SHRINK = 0.45, SQ_PIVOT = 8;

type Body = {
  id: string;
  kind: 'arc' | 'square' | 'core';
  ring: 0 | 1;
  /** rest position (mark units, ring centre, y up) */
  bx: number;
  by: number;
  /** footprint: an arc's points (mark units from its centre), or the half size of a cell / the core (units) */
  pts: number[];
  half: number;
  k: number; // square index 0..1 (story stagger)
  sc: { dx: number; dy: number; dr: number };
  b: ReturnType<typeof buoy3>;
  fp: Footprint;
  e: number; // the waves' energy under it (px², smoothed)
  tx: number; // an arc: where along it the waves are (smoothed moment, -1..1)
  ty: number;
  dip: number; // landing dip (px, down) and its velocity
  dv: number;
  hard: number;
  lastRipple: number;
  // last frame's floating offset (units), so the footprint follows the piece
  fx: number;
  fy: number;
  fz: number;
};

/** The pieces in logoPieces() order (lib/gl3d/geometry.ts): the arcs (ring 0, 1), the free cells of cells(), the core. */
function bodies(): Body[] {
  const { c, px, rings, core } = RING;
  const h = px / 2;
  const base = (kind: Body['kind'], id: string, i: number) => ({ id, kind, b: buoy3(BUOYS[kind]), fp: { h: 0, gx: 0, gy: 0, roll: 0, pitch: 0 }, e: 0, tx: 0, ty: 0, dip: 0, dv: 0, hard: 0, lastRipple: -1e9 - i, fx: 0, fy: 0, fz: 0 });
  const out: Body[] = [];
  rings.forEach(({ r }, ri) => {
    // The arc's mesh is centred on its box: x from -(r + 1.5) to the welded cell's far edge (+4.5), y symmetric.
    const cx = (3 * h - r - h) / 2;
    const pts: number[] = [];
    for (let j = 0; j <= 6; j++) {
      const a = Math.PI / 2 + (Math.PI * j) / 6; // top, round the left, bottom
      pts.push(r * Math.cos(a) - cx, r * Math.sin(a));
    }
    pts.push(2 * h - cx, r, 2 * h - cx, -r); // the welded cells at its ends
    out.push({ ...base('arc', `arc${ri}`, ri), ring: ri as 0 | 1, bx: cx, by: 0, pts, half: 0, k: 0, sc: scatter(0) });
  });
  const free = cells().filter((q) => !q.weld);
  free.forEach((q, i) => out.push({ ...base('square', `sq${q.ring}-${i}`, i + 2), ring: q.ring, bx: q.x - c, by: c - q.y, pts: [], half: h, k: i / (free.length - 1), sc: scatter(i) }));
  out.push({ ...base('core', 'core', 99), ring: 0, bx: 0, by: 0, pts: [], half: core, k: 0, sc: scatter(0) });
  return out;
}

type Box = { left: number; top: number; width: number; height: number };

/**
 * The logo's poses on the liquid. `step(t, dt, rect, story, ptr, fl)` -> POSE_STRIDE numbers per piece. `rect` = the
 * canvas' client box, `ptr` = the pointer (client px; far away when there is none), `fl` = how much of the floating
 * the renderer shows (the pour's release fades it in): ripples are shed only once it fully shows.
 */
function createLogoFloat() {
  const B = bodies();
  const out = new Float32Array(B.length * STRIDE);
  const arc0 = B.find((b) => b.kind === 'arc')!; // the outer arc goes farthest left
  const sqFar = Math.max(...B.filter((b) => b.kind === 'square').map((b) => b.bx + b.sc.dx)); // the farthest scattered cell
  const g: HG = { h: 0, gx: 0, gy: 0 };
  const s: HG = { h: 0, gx: 0, gy: 0 };
  const P = new Float64Array(2 * 16); // this piece's sample points, client px
  // For the motion harness: this frame's floating per piece, in page px / rad (read-only; no DOM writes).
  // [x, y (page, down), bob, roll, pitch, drift x, drift y] per piece.
  const probe = { t: 0, fl: 0, ids: B.map((b) => b.id), pose: new Float32Array(B.length * 7) };
  const from = { x: NaN, y: NaN }; // where the visitor's waves come from: the pointer's last place (client px)
  let lastAny = -1e9;
  let kick = false;

  const step = (t: number, dt: number, rect: Box, story: LogoStory, ptr: { x: number; y: number; t: number }, fl: number, sx: number, sy: number, vw = Infinity) => {
    dt = Math.min(Math.max(dt, 0), 0.1);
    const ppu = rect.height / (MARK * LOGO_SPAN); // client px per mark unit (in the mark's plane)
    if (!(ppu > 0)) return out;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const R = Math.max(HILL_MIN, HILL_R * ppu);
    const rest = clamp((t - ptr.t - HILL_REST) / (HILL_GONE - HILL_REST), 0, 1);
    const hillH = HILL * R * (1 - rest * rest * (3 - 2 * rest));
    const quiet = t - activity.last > 1.0; // nobody has made a wave for a while: nothing sheds a ripple
    if (ptr.x > -9000) {
      from.x = ptr.x;
      from.y = ptr.y;
    }
    const ae = 1 - Math.exp(-dt / E_TAU);
    // How much of the arcs' way left and of the cells' scatter right fits on this screen (1 = all of it).
    const kzA = (ppu * DIST) / (DIST + ARC_DZ), kzS = (ppu * DIST) / (DIST + SQ_DZ);
    const fitA = clamp(((cx - EDGE) / kzA - ARC_HALF * (1 - ARC_SHRINK) + arc0.bx) / ARC_DX, 0, 1);
    const fitS = clamp(((vw - cx - EDGE) / kzS - (RING.px / 2) * (1 - SQ_SHRINK) - SQ_PIVOT) / (sqFar - SQ_PIVOT), 0, 1);
    probe.t = t;
    probe.fl = fl;
    for (let i = 0; i < B.length; i++) {
      const b = B[i];
      // The story (mark units, y up): same beats as the SVG version in Ignition.tsx.
      let ox = 0, oy = 0, oz = 0, rx = 0, ry = 0, rz = 0, sc = 1;
      if (b.kind === 'square') {
        const q = clamp(story.sm * 1.6 - b.k * 0.6, 0, 1);
        // = dx * q where there is room; squeezed toward SQ_PIVOT where there isn't
        ox = (b.sc.dx * fitS + (b.bx - SQ_PIVOT) * (fitS - 1)) * q;
        oy = -b.sc.dy * q;
        oz = -SQ_DZ * q;
        // Scattered squares only tilt a little (never a 45-degree diamond).
        rz = (-b.sc.dr / 110) * q * 0.2;
        rx = (b.sc.dr / 110) * q * 0.35;
        ry = (b.sc.dy / 32) * q * 0.3;
        sc = 1 - q * SQ_SHRINK;
      } else if (b.kind === 'arc') {
        const h = story.sh;
        ox = -ARC_DX * fitA * h;
        oz = -ARC_DZ * h;
        ry = (b.ring === 0 ? 1 : -1) * 0.9 * h;
        sc = 1 - h * ARC_SHRINK;
      } else {
        sc = 1 + story.flare * 0.3; // same size in every beat, so the same halo
      }

      // Where the piece is on the page now (perspective: deeper pieces are drawn smaller).
      const X = b.bx + ox + b.fx, Y = b.by + oy + b.fy, Z = oz + b.fz;
      const kz = (ppu * DIST) / (DIST - Z);
      const pcx = cx + X * kz, pcy = cy - Y * kz;
      let n = 0;
      if (b.kind === 'arc') {
        // its points along the arc, turned and scaled with it (rotation as core.ts: Rz Ry Rx)
        const cxr = Math.cos(rx), sxr = Math.sin(rx), cyr = Math.cos(ry), syr = Math.sin(ry), czr = Math.cos(rz), szr = Math.sin(rz);
        for (let j = 0; j < b.pts.length; j += 2) {
          const u = b.pts[j] * sc, v = b.pts[j + 1] * sc;
          const wx = czr * cyr * u + (czr * syr * sxr - szr * cxr) * v;
          const wy = szr * cyr * u + (szr * syr * sxr + czr * cxr) * v;
          const wz = -syr * u + cyr * sxr * v;
          const kp = (ppu * DIST) / (DIST - (Z + wz));
          P[n++] = cx + (X + wx) * kp;
          P[n++] = cy - (Y + wy) * kp;
        }
      } else {
        // the centre and four points across it
        const q = Math.max(4, b.half * sc * kz * 0.8);
        P[0] = pcx; P[1] = pcy;
        P[2] = pcx - q; P[3] = pcy;
        P[4] = pcx + q; P[5] = pcy;
        P[6] = pcx; P[7] = pcy - q;
        P[8] = pcx; P[9] = pcy + q;
        n = 10;
      }

      // The surface under it: mean height and slope, best plane (tilt), and the energy of the visitor's waves (its mean
      // and, for an arc, where along it it is).
      const m = n / 2;
      let mx = 0, my = 0;
      for (let j = 0; j < n; j += 2) { mx += P[j]; my += P[j + 1]; }
      mx /= m; my /= m;
      let sh = 0, sgx = 0, sgy = 0, sxx = 0, sxy = 0, syy = 0, sxh = 0, syh = 0, se = 0, peak = 0, mxe = 0, mye = 0;
      for (let j = 0; j < n; j += 2) {
        const x = P[j] + sx, y = P[j + 1] + sy; // page px
        sampleGrid(x, y, g);
        swellAt(x, y, t, s);
        const H = g.h + SWELL * s.h;
        sh += H;
        sgx += g.gx + SWELL * s.gx;
        sgy += g.gy + SWELL * s.gy;
        const dx = P[j] - mx, dy = P[j + 1] - my;
        sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
        sxh += dx * H; syh += dy * H;
        const e = g.h * g.h + (g.gx * g.gx + g.gy * g.gy) * INV_K2;
        se += e;
        const dl = Math.hypot(dx, dy) || 1;
        mxe += ((e / (e + E0)) * dx) / dl;
        mye += ((e / (e + E0)) * dy) / dl;
        peak = Math.max(peak, Math.abs(g.h) / 2.5, Math.hypot(g.gx, g.gy) / 0.04);
      }
      const det = sxx * syy - sxy * sxy;
      const inv = det > 1e-6 ? 1 / det : 0;
      const roll = (syy * sxh - sxy * syh) * inv;
      const pitch = (sxx * syh - sxy * sxh) * inv;
      // The waves' push and tip, away from where they come from.
      b.e += (se / m - b.e) * ae;
      const w = b.e / (b.e + E0);
      let ux = pcx - from.x, uy = pcy - from.y;
      const ul = Math.hypot(ux, uy);
      if (ul > 1e-3) { ux /= ul; uy /= ul; } else ux = uy = 0;
      // The pointer's soft hill (page slope toward the pointer; the piece drifts down it, away from the pointer).
      const hx = pcx - ptr.x, hy = pcy - ptr.y;
      const u = (hillH * Math.exp(-(hx * hx + hy * hy) / (2 * R * R))) / (R * R);
      const fp = b.fp;
      fp.h = sh / m;
      fp.gx = sgx / m - KE_PUSH * w * ux - u * hx;
      fp.gy = sgy / m - KE_PUSH * w * uy - u * hy;
      if (b.kind === 'arc') {
        b.tx += (mxe / m - b.tx) * ae;
        b.ty += (mye / m - b.ty) * ae;
        fp.roll = roll + KE_ARC * b.tx;
        fp.pitch = pitch + KE_ARC * b.ty;
      } else {
        fp.roll = roll - KE_TIP * w * ux;
        fp.pitch = pitch - KE_TIP * w * uy;
      }
      const p = b.b.step(fp, dt);

      // The landing (the pour lets go): a soft dip, sprung back.
      if (kick) b.dv -= 26 + hash(i * 7.3) * 12;
      const wd = 2 * Math.PI * 1.1;
      const ns = Math.max(1, Math.ceil(dt / 0.008)), hs = dt / ns;
      for (let k = 0; k < ns; k++) {
        b.dv += (-wd * wd * b.dip - 2 * 0.6 * wd * b.dv) * hs;
        b.dip += b.dv * hs;
      }

      // Page px -> the piece's units: up on the page is +y; a crest also lifts it a little toward the viewer.
      const rise = p.bob + b.dip;
      b.fx = p.dx / kz;
      b.fy = (rise - p.dy) / kz;
      b.fz = (0.5 * rise) / kz;
      const o = i * STRIDE;
      out[o] = ox; out[o + 1] = oy; out[o + 2] = oz; out[o + 3] = rx; out[o + 4] = ry; out[o + 5] = rz; out[o + 6] = sc;
      // The surface's tilt: rising toward +x turns the right edge toward the viewer (-ry); toward the page's bottom, the
      // bottom edge (-rx).
      out[o + 7] = b.fx; out[o + 8] = b.fy; out[o + 9] = b.fz; out[o + 10] = -p.pitch; out[o + 11] = -p.roll; out[o + 12] = 0;
      const q7 = i * 7;
      probe.pose[q7] = p.dx * fl; probe.pose[q7 + 1] = -(rise - p.dy) * fl; probe.pose[q7 + 2] = rise * fl;
      probe.pose[q7 + 3] = p.roll * fl; probe.pose[q7 + 4] = p.pitch * fl; probe.pose[q7 + 5] = p.dx; probe.pose[q7 + 6] = p.dy;

      // Its own ripple: only when a wave someone made rocks it hard (never on a timer, never from the swell), at most
      // one per 4 s per piece and one per 0.8 s for the whole logo, just beyond its far side from where they come.
      b.hard = peak > 1 ? b.hard + dt : 0;
      if (b.hard > 0.12 && !quiet && fl > 0.98 && t - b.lastRipple > 4 && t - lastAny > 0.8) {
        b.hard = 0;
        b.lastRipple = lastAny = t;
        const d = (b.kind === 'arc' ? 2 : b.half) * sc * kz + 8;
        addSource(pcx + sx + ux * d, pcy + sy + uy * d, 0.15, 8, { kind: 'float' });
      }
    }
    kick = false;
    return out;
  };
  return {
    step,
    probe,
    /** The pour released the logo onto the liquid: each piece dips in on the next step. */
    release() {
      kick = true;
    },
  };
}

// ---- mounting ----------------------------------------------------------------------------------------------------

/**
 * Mounts a canvas into `host` (which spans the ring's box; the canvas is LOGO_SPAN times larger, centred) and runs the
 * logo. Returns the function that removes everything again.
 */
export function mountLogo(opts: {
  host: HTMLElement;
  story: () => LogoStory;
  onReady?: () => void;
  onFail?: () => void;
  /** The logo is finished and floating (the pour is over or was skipped). */
  onSettled?: () => void;
  /** First visit of the page: play the pour. `start()` is called once the first frame is up. */
  pour?: { tempo: number; start: () => void };
}): () => void {
  let stopped = false;
  let stopCur: (() => void) | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ready = false;
  const first = () => {
    if (ready || stopped) return;
    ready = true;
    opts.onReady?.();
    opts.pour?.start();
  };
  const fail = () => {
    stopCur?.();
    stopCur = null;
    canvas?.remove();
    opts.onFail?.();
  };
  const fresh = () => {
    canvas?.remove();
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.className = 'ig-3d';
    opts.host.appendChild(canvas);
    return canvas;
  };
  const dbgPour = location.search.includes('pourdebug');
  // Layout reads (boxes, nav bottom) are cached: re-read only after a scroll/resize, or every 0.7 s as a safety net.
  // Reading them every frame forced a style + layout pass after the floaters' writes (costly on phones).
  let lay: { css: { w: number; h: number }; rect: Box; top: number; vw: number } | null = null;
  let layDirty = true;
  let layAt = 0;
  const dirty = () => (layDirty = true);
  addEventListener('scroll', dirty, { passive: true });
  addEventListener('resize', dirty);
  const layout = (cv: HTMLCanvasElement) => {
    const now = performance.now();
    if (!lay || layDirty || now - layAt > 700) {
      const r = cv.getBoundingClientRect();
      lay = {
        css: { w: cv.clientWidth, h: cv.clientHeight },
        rect: { left: r.left, top: r.top, width: r.width, height: r.height },
        top: document.querySelector('header, nav')?.getBoundingClientRect().bottom ?? 64,
        vw: document.documentElement.clientWidth,
      };
      layDirty = false;
      layAt = now;
    }
    return lay;
  };
  const envNow = (cv: HTMLCanvasElement): LogoEnv => {
    const l = layout(cv);
    return {
      css: l.css,
      rect: l.rect,
      scrollY,
      top: l.top,
      story: { ...opts.story() },
      pourT: dbgPour ? (window as unknown as { __pourT?: number }).__pourT : undefined,
    };
  };
  // The pointer (client px). A finger only pushes while it is on the glass.
  const ptr = { x: -9999, y: -9999, t: -9 };
  const onMove = (e: PointerEvent) => {
    ptr.x = e.clientX;
    ptr.y = e.clientY;
    ptr.t = clock.t;
  };
  const onLeave = () => {
    ptr.x = ptr.y = -9999;
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') onLeave();
  };
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onMove, { passive: true });
  addEventListener('pointerup', onUp, { passive: true });
  addEventListener('pointercancel', onUp, { passive: true });
  document.addEventListener('pointerleave', onLeave);

  const float = createLogoFloat();
  const w = window as unknown as { __logo?: typeof float.probe };
  w.__logo = float.probe;
  let fl = opts.pour ? 0 : 1; // how much of the floating the renderer shows (it tells us)
  const poses = (cv: HTMLCanvasElement, t: number, dt: number) => {
    const l = layout(cv);
    return float.step(t, dt, l.rect, opts.story(), ptr, fl, scrollX, scrollY, l.vw);
  };

  const startWorker = (cv: HTMLCanvasElement): (() => void) | null => {
    if (typeof Worker === 'undefined' || typeof cv.transferControlToOffscreen !== 'function') return null;
    let worker: Worker;
    let off: OffscreenCanvas;
    try {
      worker = new Worker(new URL('./sceneWorker.ts', import.meta.url));
      off = cv.transferControlToOffscreen();
    } catch {
      return null;
    }
    const post = (m: unknown, tr?: Transferable[]) => worker.postMessage(m, tr ?? []);
    post({ type: 'init', canvas: off, full: full(), dpr: devicePixelRatio || 1, pour: opts.pour ? { tempo: opts.pour.tempo } : undefined, env: envNow(cv) }, [off]);
    let dead = false;
    // one clock: a tick per main frame with its poses, never two in flight (the newest waits for the last 'tock')
    const reg = renderer('logo', 'worker');
    let busy = false;
    let pending: { t: number; p: Float32Array } | null = null;
    const tick = (t: number, p: Float32Array) => {
      busy = true;
      post({ type: 'tick', t, p });
    };
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === 'tock') {
        busy = false;
        fl = m.fl;
        reg.done(m.t);
        if (pending) {
          const q = pending;
          pending = null;
          tick(q.t, q.p);
        }
      } else if (m.type === 'ready') first();
      else if (m.type === 'settled') opts.onSettled?.();
      else if (m.type === 'release') float.release();
      else if (m.type === 'emit') addSource(m.x, m.y, m.amp, m.size, { kind: 'float', t: m.t });
      else if (m.type === 'fail' && !dead) {
        dead = true;
        stop();
        // A canvas that went to the worker can't get a context again: swap in a fresh one for the main-thread path.
        const next = startMain(fresh());
        if (!next) fail();
        else stopCur = next;
      }
    };
    worker.onerror = () => {
      if (!dead) {
        dead = true;
        stop();
        fail();
      }
    };
    let lastKey = '';
    // layout first (clean reads), the poses after the liquid has stepped this frame
    const offEarly = onFrame(() => {
      if (document.hidden) return;
      const env = envNow(cv);
      const key = JSON.stringify(env);
      if (key !== lastKey) {
        lastKey = key;
        post({ type: 'state', env });
      }
    }, { early: true });
    const offFrame = onFrame((t, dt) => {
      if (document.hidden) return;
      const p = poses(cv, t, dt);
      if (busy) pending = { t, p: p.slice() };
      else tick(t, p);
    });
    const onVis = () => post({ type: 'vis', hidden: document.hidden });
    document.addEventListener('visibilitychange', onVis);
    const offLong = onLongTasks(() => post({ type: 'down' }));
    function stop() {
      reg.off();
      offEarly();
      offFrame();
      offLong();
      document.removeEventListener('visibilitychange', onVis);
      worker.terminate();
    }
    return stop;
  };

  const startMain = (cv: HTMLCanvasElement): (() => void) | null => {
    let stopFn: (() => void) | null = null;
    let dead = false;
    import('./logoRunner')
      .then(({ createLogoRunner }) => {
        if (dead) return;
        const env = envNow(cv);
        const runner = createLogoRunner(cv, env, {
          dpr: devicePixelRatio || 1,
          full: full(),
          pour: opts.pour,
          emit: (x, y, amp, size, t) => addSource(x, y, amp, size, { kind: 'float', t }),
          onRelease: () => float.release(),
          onFirst: first,
          onSettled: opts.onSettled,
        });
        const offLong = onLongTasks(() => runner.down());
        const reg = renderer('logo', 'main');
        const offEarly = onFrame(() => {
          const n = envNow(cv);
          env.css.w = n.css.w;
          env.css.h = n.css.h;
          env.rect = n.rect;
          env.scrollY = n.scrollY;
          env.top = n.top;
          env.story = n.story;
          env.pourT = n.pourT;
        }, { early: true });
        const offFrame = onFrame((t, dt) => {
          runner.frame(t, poses(cv, t, dt));
          fl = runner.fl();
          reg.done(t);
        });
        stopFn = () => {
          reg.off();
          offEarly();
          offFrame();
          offLong();
          runner.dispose();
        };
        if (dead) stopFn();
      })
      .catch(() => {
        if (!dead) fail();
      });
    return () => {
      dead = true;
      stopFn?.();
    };
  };

  const cv0 = fresh();
  stopCur = startWorker(cv0);
  if (!stopCur) stopCur = startMain(cv0);

  return () => {
    stopped = true;
    stopCur?.();
    removeEventListener('pointermove', onMove);
    removeEventListener('pointerdown', onMove);
    removeEventListener('pointerup', onUp);
    removeEventListener('pointercancel', onUp);
    removeEventListener('scroll', dirty);
    removeEventListener('resize', dirty);
    document.removeEventListener('pointerleave', onLeave);
    if (w.__logo === float.probe) delete w.__logo;
    canvas?.remove();
  };
}
