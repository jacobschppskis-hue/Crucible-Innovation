// The lava module (role: lava): the molten sea's CPU side. lava.glsl shades it (lava_shade, lava_env); this file owns
// its swell spectrum, the visitor's hand (input.ts -> wake.ts), the uniforms, and the same surface on the CPU for
// anything that sits on the sea (`lavaSample`, `window.__lava`).
//
// Channels (journey extras): 'lava.heat' (added to look's sea temperature, +850 K per unit), 'lava.swell' (gain), 'lava.calm'
// (0..1 stills it), 'lava.interact' (the visitor's waves: -1 = automatic from altitude, else 0..1).

import type { Frame } from './frame';
import type { Uniforms } from './gl';
import type { WorldModule } from './modules';
import LAVA_GLSL from './glsl/lava.glsl';
import { createWake, WAKE } from './wake';
import { createInput, HAND, type Input } from './input';
import { ventureRipples } from './ventures';

/** Tunables (`window.__lava.LAVA`; call `__lava.retune()` after changing the swell's). */
export const LAVA = {
  g: 9.81,
  /** the swell: heading (rad in (u, v); 0 = +u), spread, wavelengths (units), steepness a*k long -> short */
  heading: 1.25,
  spread: 0.55,
  lamMin: 0.9,
  lamMax: 320,
  steepLong: 0.034,
  steepShort: 0.045,
  /** the glow: the skin's cooling (K) and depth (the eye sees through ~depth / cos of it) */
  skin: 30,
  skinDepth: 0.3,
  /** look: base roughness (alpha^2), F0 (molten silicate, n ~ 1.6), sun glint gain, reflection gain */
  rough: 0.0045,
  F0: 0.053,
  glint: 1,
  env: 1,
  /** the visitor's waves read from this low (full) to this high (none), in units of altitude */
  nearH: 14,
  /** the swell fades out between these altitudes (orbit shows the planet's currents, not its waves) */
  swellFadeH: [150, 900] as [number, number],
  farH: 70,
};

export const LAVA_NW = 24;
type Wave = { dir: number; lam: number; a: number; ph: number };

function spectrum(R: number): Wave[] {
  const out: Wave[] = [];
  let s = 0x2f6b1d;
  const rnd = () => ((s = (Math.imul(s ^ (s >>> 15), 2246822519) ^ Math.imul(s ^ (s >>> 13), 3266489917)) >>> 0) / 4294967296);
  for (let i = 0; i < LAVA_NW; i++) {
    const f = i / (LAVA_NW - 1);
    const lam = LAVA.lamMax * Math.pow(LAVA.lamMin / LAVA.lamMax, f) * (0.92 + 0.16 * rnd());
    const steep = LAVA.steepLong + (LAVA.steepShort - LAVA.steepLong) * f;
    const k = (Math.PI * 2) / lam;
    // a Gaussian-ish spread about the heading, wider for short waves (as wind seas are); never mirrored pairs, which
    // make a lattice
    const gs = rnd() + rnd() - 1;
    // (at most ~+-70 deg: near-orthogonal trains of similar k cross into a lattice in the glint)
    const dir = LAVA.heading + gs * LAVA.spread * 2 * (0.25 + 0.85 * f * f);
    // seamless round the lap: v wraps every 2 PI R, so the wave's v component must be a whole number of cycles
    let ku = Math.cos(dir) * k;
    let kv = Math.sin(dir) * k;
    kv = Math.round(kv * R) / R;
    const kk = Math.hypot(ku, kv);
    ku = Math.cos(Math.atan2(kv, ku)) * kk;
    out.push({ dir: Math.atan2(kv, ku), lam: (Math.PI * 2) / kk, a: (steep / kk) * (0.85 + 0.3 * rnd()), ph: rnd() * Math.PI * 2 });
  }
  return out;
}

const wrap = (x: number) => x - Math.PI * 2 * Math.floor((x + Math.PI) / (Math.PI * 2));
const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const wake = createWake();
let input: Input | null = null;
let waves: Wave[] = [];
let R = 6000;
let tNow = 0;
let tLast = -1;
let swellGain = 1;
let interact = 0;
const SW = new Float32Array(LAVA_NW * 4);

/** The swell + the visitor's waves at surface coords (u, v): [height, d/du, d/dv]. fp: footprint to filter to. */
export function lavaSample(u: number, v: number, fp = 0): [number, number, number] {
  let h = 0;
  let gu = 0;
  let gv = 0;
  for (const w of waves) {
    const k = (Math.PI * 2) / w.lam;
    const ku = Math.cos(w.dir) * k;
    const kv = Math.sin(w.dir) * k;
    const at = Math.exp(-0.7 * k * k * fp * fp);
    const ph = ku * u + kv * v - Math.sqrt(LAVA.g * k) * tNow + w.ph;
    const a = w.a * swellGain * at;
    h += a * Math.sin(ph);
    gu += a * Math.cos(ph) * ku;
    gv += a * Math.cos(ph) * kv;
  }
  const o = wake.sampleAt(u, v);
  return [h + o[0] * interact, gu + o[1] * interact, gv + o[2] * interact];
}

export const lava: WorldModule = {
  id: 'lava',
  glsl: LAVA_GLSL,
  provides: ['lava_shade', 'lava_env'],
  channels: { 'lava.heat': 0, 'lava.swell': 1, 'lava.calm': 0, 'lava.interact': -1 },
  init({ u }) {
    // the sea mirrors everything until another module says otherwise (ventures sets 0 while it draws the monoliths'
    // reflections itself); set once here, never per frame, so their value holds
    u.set('lava_uMirror', 1);
    waves = spectrum(R);
    if (typeof window !== 'undefined') {
      input = createInput(wake);
      (window as unknown as { __lava: unknown }).__lava = {
        LAVA,
        WAKE,
        HAND,
        wake,
        sample: lavaSample,
        retune: () => (waves = spectrum(R)),
        get waves() {
          return waves;
        },
        get count() {
          return wake.count;
        },
        get live() {
          return input?.live ?? 0;
        },
      };
    }
  },
  update(f: Frame, u: Uniforms) {
    if (f.R !== R || !waves.length) {
      R = f.R;
      waves = spectrum(R);
    }
    const t = f.t;
    tNow = t;
    // from high up the swell is far below a pixel and only adds stripes; the planet reads by its currents instead
    swellGain = (f.ch['lava.swell'] ?? 1) * (1 - (f.ch['lava.calm'] ?? 0)) * (1 - sstep(LAVA.swellFadeH[0], LAVA.swellFadeH[1], f.cam.h));
    const ic = f.ch['lava.interact'] ?? -1;
    interact = f.still ? 0 : ic >= 0 ? ic : 1 - sstep(LAVA.nearH, LAVA.farH, f.cam.h);
    // the hand: only where the waves can be seen
    if (input) {
      input.enabled = interact > 0.01;
      const t0 = tLast < 0 || t < tLast || t - tLast > 0.25 ? t - 1 / 60 : tLast;
      input.step(t0, t, (x, y) => {
        const hit = f.hitSea(x, y);
        if (!hit) return null;
        const d = f.rayAt(x, y);
        const n = Math.hypot(hit.p[0], hit.p[1], hit.p[2]);
        const graz = -(d[0] * hit.p[0] + d[1] * hit.p[1] + d[2] * hit.p[2]) / n;
        if (graz < 0.02) return null;
        return { u: hit.w[0], v: hit.w[1], sc: hit.t / f.cam.focal / Math.sqrt(graz) };
      });
    }
    tLast = t;
    // a press on a monolith rings the sea at its foot (ventures fills the queue, lava drains it)
    while (ventureRipples.length) {
      const r = ventureRipples.shift()!;
      const [ru, rv] = f.surfOf(r.p);
      wake.ring(ru, rv, t, { speed: 2.2, W0: 0.16, slope: 0.3 * r.k, tau: 1.6, life: 4.5 });
    }
    wake.pack(t, input ? input.heads() : []);

    for (let i = 0; i < LAVA_NW; i++) {
      const w = waves[i];
      const k = (Math.PI * 2) / w.lam;
      SW[i * 4] = Math.cos(w.dir) * k;
      SW[i * 4 + 1] = Math.sin(w.dir) * k;
      SW[i * 4 + 2] = w.a;
      SW[i * 4 + 3] = wrap(w.ph - Math.sqrt(LAVA.g * k) * t);
    }
    u.set('lava_uSw', SW);
    u.set('lava_uA', [swellGain, 0, interact, t % 3600]);
    u.set('lava_uTone', [850 * (f.ch['lava.heat'] ?? 0), 0, LAVA.skin, LAVA.skinDepth]);
    u.set('lava_uLook', [LAVA.rough, LAVA.F0, LAVA.glint, LAVA.env]);
    const W = wake.U;
    u.tex('lava_uWake', { w: 128 * 3, h: 1, data: W.tex, format: 'rgba32f' }, W.ver, { linear: false });
    u.set('lava_uWN', W.n);
    u.set('lava_uWB', W.box);
    u.set('lava_uRing', W.ring);
    u.set('lava_uRingW', W.ringW);
    u.set('lava_uRingN', W.ringN);
    // five reflection taps while the monoliths stand in the sea (a smooth streak under each), three elsewhere
    const va = f.places.ventures ? f.at('ventures') : -1;
    u.set('lava_uReflN', va > 0 && va < 1 ? 5 : 3);
    // phones: a narrower sunset glint column, so the hero's headline sits on dark sea
    // while the hero is on screen (phones and desktop: the big headline sits over the column on both): the sun's (and the mark's) mirror image lands right behind the headline, so the
    // glint and the mirrored image are quieter there (1 -> 0 as the hero scrolls away)
    // (a function of the journey that is the same at progress 0 and 1, so the loop seam never shows: on in the hero, off
    // once it has scrolled away, back on over the last 3% as the camera comes round to the hero again)
    // (mark: held through the hero's whole pin and released over the screen after it, while the headline slides away;
    // back on over the middle of the last screen before the seam, before the loop copy's headline reaches the sea)
    const hp = f.places.hero, lp = f.places.loop;
    const gone = hp ? (f.y - (hp.top + hp.h - f.h)) / f.h : 1;
    const back = f.loopLen > 0 && lp ? sstep(0.2, 0.62, (f.y - (lp.top - f.h)) / f.h) : 0;
    u.set('lava_uTight', Math.max(1 - sstep(0.25, 0.95, gone), back));
  },
  dispose() {
    input?.destroy();
    input = null;
  },
};
