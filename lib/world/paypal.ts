// PayPal → six companies (role `paypal`; storyboard and decisions in lab/paypal/NOTES.md).
//
// Seen from high over the night side, PayPal is one hot vent on the molten planet. eBay buys it, the pressure builds and
// it erupts: four molten embers go up on real ballistic throws over the planet's curve (a long exposure of Stromboli's
// lava bombs: a white-gold head, a trail cooling through gold and orange to a red train that widens, drifts and fades),
// each lands with a short flash and lights a new place with soft lava flows, like a city seen from orbit: YouTube,
// LinkedIn, Yelp, Palantir. Then Elon's share goes up in one high throw that clears the atmosphere (SpaceX) and a later,
// short one (Tesla). At the end the six burn while PayPal's own vent cools ("long after PayPal itself was gone").
//
// Everything visible is a pure function of the beat progress p (0..1, from scroll), so it scrubs both ways and every
// frame can be reproduced; the clock t only adds life at rest (head flicker, train drift). Nothing is left sitting:
// every train fades within 3·TAU_TRAIN after its landing; the lit places stay (they are part of the world from then on).
//
// Framework-free and DOM-free (runs in a worker too). Geometry in world units: the planet is a sphere (centre, radius),
// PayPal sits at `planet.up` and the beat is laid out in its tangent frame (`planet.fwd` = toward the horizon).

export type Vec3 = [number, number, number];

/** A pinhole camera. width/height in device px (the ribbon buffer is built in those px). */
export interface PPCamera {
  pos: Vec3;
  f: Vec3; // forward (unit)
  r: Vec3; // right (unit)
  u: Vec3; // up (unit)
  tanHalf: number; // tan(vertical fov / 2)
  width: number;
  height: number;
}
export interface PPPlanet {
  center: Vec3;
  radius: number;
  up: Vec3; // unit direction from the centre to PayPal
  fwd: Vec3; // unit tangent at PayPal, the direction the camera looks along (toward the limb)
}

// ---------------------------------------------------------------- vectors
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: Vec3): Vec3 => mul(a, 1 / (len(a) || 1));
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------------------------------------------------------------- the story
/** Captions: Jacob's text (data/story.ts), shortened; [in, out] in p. Index 3 is the display line. */
export const CAPTIONS: { text: string; at: [number, number]; display?: boolean }[] = [
  { text: 'In 2002, eBay bought PayPal.', at: [0.02, 0.215] },
  { text: 'After the sale, its people went on to found YouTube, LinkedIn, Yelp and Palantir.', at: [0.235, 0.455] },
  { text: 'Elon used much of his share to fund SpaceX, and later to invest in Tesla.', at: [0.475, 0.7] },
  { text: 'So much came out of a single company.', at: [0.715, 0.855], display: true },
  {
    text: 'Not by luck. They found each other early, and kept backing one another long after PayPal itself was gone.',
    at: [0.865, 1.01],
  },
];
/** Caption opacity at p (a short cross-fade at each end). */
export function captionOpacity(i: number, p: number) {
  const [a, b] = CAPTIONS[i].at;
  return smooth(a, a + 0.03, p) * (1 - smooth(b - 0.03, b, p));
}

export interface Site {
  name: string;
  /** Where the place sits in the frame once the camera has risen (p = END_P): [x, y] viewport fractions, y down. */
  pt: [number, number]; // portrait
  ls: [number, number]; // landscape
  launch: number; // p
  loft: number; // apex multiplier (SpaceX clears the atmosphere)
  // derived by layout()
  dir: Vec3;
  range: number; // radians along the great circle from PayPal
  bearing: number; // radians, 0 = planet.fwd, + = toward camera-right
  apex: number; // in radii
  flight: number; // p
  land: number; // p
  seed: number;
}
const site = (name: string, pt: [number, number], ls: [number, number], launch: number, loft: number, seed: number): Site => ({
  name, pt, ls, launch, loft, seed, dir: [0, 1, 0], range: 0, bearing: 0, apex: 0, flight: 0, land: 1,
});
export const SITES: Site[] = [
  // one eruption: the four its people founded, a split second apart, unequal throws
  site('YouTube', [0.2, 0.555], [0.38, 0.6], 0.23, 1.0, 0.13),
  site('LinkedIn', [0.6, 0.47], [0.56, 0.47], 0.237, 1.25, 0.75),
  site('Yelp', [0.84, 0.575], [0.76, 0.55], 0.243, 0.9, 0.37),
  site('Palantir', [0.74, 0.765], [0.79, 0.76], 0.25, 1.1, 0.99),
  // Elon's share: SpaceX first and highest; Tesla later and short
  site('SpaceX', [0.15, 0.475], [0.9, 0.62], 0.468, 2.6, 0.61),
  site('Tesla', [0.24, 0.8], [0.3, 0.8], 0.61, 0.9, 0.23),
];
export const END_P = 0.78;
export const ERUPT_P = 0.236;
const TAU_HOT = 0.022; // p: the head's white-gold cools to orange
const TAU_TRAIN = 0.05; // p: the red train fades (gone by 3·TAU after landing)

/** PayPal's vent: pressure builds, erupts (twice more for Elon's throws), then cools. heat 0..1, flash ≥ 0. */
export function vent(p: number) {
  const swell = smooth(0.08, 0.228, p);
  const flash =
    0.5 * Math.exp(-(((p - ERUPT_P) / 0.008) ** 2)) +
    0.7 * Math.exp(-(((p - 0.47) / 0.01) ** 2)) +
    0.45 * Math.exp(-(((p - 0.612) / 0.01) ** 2));
  const cool = smooth(0.8, 0.97, p);
  return { heat: mix(0.55 + 0.45 * swell, 0.12, cool), flash };
}

// ---------------------------------------------------------------- the planet frame
function frameOf(pl: PPPlanet) {
  const up = norm(pl.up);
  const fwd = norm(sub(pl.fwd, mul(up, dot(pl.fwd, up))));
  const left = cross(up, fwd); // with the camera behind PayPal looking along fwd, screen-right is -left
  return { up, fwd, right: mul(left, -1) };
}
/** Unit direction at great-circle angle a along bearing b (radians) from PayPal. */
function surfaceDir(pl: PPPlanet, b: number, a: number): Vec3 {
  const F = frameOf(pl);
  const t = add(mul(F.fwd, Math.cos(b)), mul(F.right, Math.sin(b)));
  return add(mul(F.up, Math.cos(a)), mul(t, Math.sin(a)));
}
/** World position on a throw at u (0..1): great circle in angle (constant horizontal speed), parabola in height. */
export function arcPos(pl: PPPlanet, s: Site, u: number): Vec3 {
  const d = surfaceDir(pl, s.bearing, s.range * u);
  const h = 4 * s.apex * u * (1 - u);
  return add(pl.center, mul(d, pl.radius * (1 + h)));
}

/** The camera this beat wants (the journey can use it as its keyframes for this place): it starts low and grazing by
 * the vent and rises as the embers spread, which is the reveal of scale. Returns position/target in world units. */
export function beatCamera(p: number, aspect: number, pl: PPPlanet) {
  const F = frameOf(pl);
  const portrait = aspect < 1;
  const pull = smooth(0.1, 0.4, p);
  const alt = mix(portrait ? 0.075 : 0.06, portrait ? 0.62 : 0.46, pull);
  const back = mix(0.15, 0.3, pull);
  const look = mix(0.3, portrait ? 0.3 : 0.28, pull);
  const R = pl.radius;
  const pos = add(pl.center, add(mul(F.up, R * (1 + alt)), mul(F.fwd, -back * R)));
  const target = add(pl.center, mul(surfaceDir(pl, 0, look), R));
  const fovY = ((portrait ? 64 : 42) * Math.PI) / 180;
  return { pos, target, fovY, up: F.up };
}
/** Build a PPCamera from a position/target/up/fov (helper for the lab and tests). */
export function lookAt(pos: Vec3, target: Vec3, upHint: Vec3, fovY: number, width: number, height: number): PPCamera {
  const f = norm(sub(target, pos));
  const r = norm(cross(f, upHint));
  const u = cross(r, f);
  return { pos, f, r, u, tanHalf: Math.tan(fovY / 2), width, height };
}

let layoutKey = '';
/** Place the six landings from their screen targets (cast onto the sphere from the beat's end camera). Call when the
 * viewport's aspect or the planet changes; cheap. */
export function layout(pl: PPPlanet, aspect: number) {
  const key = `${aspect.toFixed(3)}|${pl.center.join()}|${pl.radius}|${pl.up.join()}|${pl.fwd.join()}`;
  if (key === layoutKey) return;
  layoutKey = key;
  const c = beatCamera(END_P, aspect, pl);
  const cam = lookAt(c.pos, c.target, c.up, c.fovY, aspect, 1);
  const F = frameOf(pl);
  for (const s of SITES) {
    const k = aspect < 1 ? s.pt : s.ls;
    const rd = norm(add(cam.f, add(mul(cam.r, (k[0] * 2 - 1) * cam.tanHalf * aspect), mul(cam.u, (1 - k[1] * 2) * cam.tanHalf))));
    const hit = raySphere(cam.pos, rd, pl);
    const P = hit > 0 ? add(cam.pos, mul(rd, hit)) : add(cam.pos, mul(rd, -dot(sub(cam.pos, pl.center), rd)));
    s.dir = norm(sub(P, pl.center));
    const d = clamp(dot(s.dir, F.up), -1, 1);
    s.range = Math.acos(d);
    const tg = sub(s.dir, mul(F.up, d));
    s.bearing = Math.atan2(dot(tg, F.right), dot(tg, F.fwd));
    // a throw at a shallow fixed angle: apex ∝ range, flight time ∝ √range (capped so the last train is gone in time)
    s.apex = 0.12 * s.range * s.loft;
    s.flight = Math.min(0.125 * Math.sqrt(s.range / 0.3) * Math.pow(s.loft, 0.3), 0.17);
    s.land = s.launch + s.flight;
  }
}
/** Nearest positive hit distance of a ray with the planet, or -1. */
function raySphere(ro: Vec3, rd: Vec3, pl: PPPlanet) {
  const oc = sub(ro, pl.center);
  const b = dot(oc, rd), c = dot(oc, oc) - pl.radius * pl.radius, disc = b * b - c;
  if (disc <= 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : -1;
}

// ---------------------------------------------------------------- per frame
/** World → device px (y up, origin bottom-left) and view depth. */
function project(P: Vec3, cam: PPCamera): [number, number, number] {
  const d = sub(P, cam.pos);
  const z = dot(d, cam.f);
  const asp = cam.width / cam.height;
  const x = dot(d, cam.r) / (z * cam.tanHalf * asp), y = dot(d, cam.u) / (z * cam.tanHalf);
  return [(x * 0.5 + 0.5) * cam.width, (y * 0.5 + 0.5) * cam.height, z];
}
function hidden(P: Vec3, cam: PPCamera, pl: PPPlanet) {
  const d = sub(P, cam.pos);
  const L = len(d);
  const t = raySphere(cam.pos, mul(d, 1 / L), pl);
  return t > 0 && t < L * (1 - 1e-5);
}

export interface PayPalFrame {
  /** 7 × vec4: xyz unit direction of the place (0 = PayPal), w heat 0..1.2 */
  spots: Float32Array;
  /** 7 × vec4: x age since landing (p), y ripple age (p, < 0 = none), z flash, w seed */
  spotsB: Float32Array;
  /** Additive ribbon triangles (TRIANGLE_STRIP with degenerate joins), 6 floats per vertex: x, y (device px), across
   * (-1..1), K (temperature), I (intensity), w (half-width px). */
  ribbon: Float32Array;
  vertexCount: number;
  /** Label anchors in CSS px (y down) and opacity, PayPal first. */
  labels: { name: string; x: number; y: number; o: number }[];
  captions: number[];
}

const RIB_MAX = 6 * 2 * 96 * 2 + 64;
const ribbon = new Float32Array(RIB_MAX * 6);
const spots = new Float32Array(28);
const spotsB = new Float32Array(28);

/**
 * Everything for one frame. p: beat progress (0..1), t: clock seconds, dpr: device px per CSS px.
 * Call layout() first (once per aspect).
 */
export function paypalFrame(p: number, t: number, cam: PPCamera, pl: PPPlanet, dpr: number): PayPalFrame {
  const R = pl.radius;
  const F = frameOf(pl);
  // the places
  const v = vent(p);
  spots.set([...F.up, v.heat], 0);
  spotsB.set([1, p - ERUPT_P, v.flash, 0.42], 0);
  SITES.forEach((s, i) => {
    const age = p - s.land;
    spots.set([...s.dir, smooth(0, 0.012, age)], (i + 1) * 4);
    spotsB.set([Math.max(age, 0), age, age > 0 ? Math.exp(-age / 0.008) : 0, s.seed], (i + 1) * 4);
  });

  // the throws
  let n = 0;
  type Pt = { x: number; y: number; K: number; I: number; w: number };
  const strip = (pts: Pt[]) => {
    if (pts.length < 2) return;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let tx = b.x - a.x, ty = b.y - a.y;
      const l = Math.hypot(tx, ty) || 1;
      tx /= l; ty /= l;
      const q = pts[i];
      const vtx = (side: number) => {
        if (n + 6 > ribbon.length) return;
        ribbon[n++] = q.x - ty * q.w * side; ribbon[n++] = q.y + tx * q.w * side;
        ribbon[n++] = side; ribbon[n++] = q.K; ribbon[n++] = q.I; ribbon[n++] = q.w;
      };
      if (i === 0 && n > 0) vtx(-1);
      vtx(-1); vtx(1);
      if (i === pts.length - 1) vtx(1);
    }
  };
  const minW = 1.3 * dpr;
  const pxPerWorld = (z: number) => (cam.height * 0.5) / (z * cam.tanHalf);
  for (const s of SITES) {
    const uHead = (p - s.launch) / s.flight;
    if (uHead < 0 || p > s.land + 3 * TAU_TRAIN) continue;
    const pts: Pt[] = [];
    const pHead = Math.min(p, s.land);
    const after = Math.max(0, p - s.land); // after landing there is no head: everything ages on
    const span = Math.min(3 * TAU_TRAIN, pHead - s.launch);
    const N = 90;
    for (let i = 0; i <= N; i++) {
      const a = span * Math.pow(i / N, 1.7); // dense at the head, sparse in the old train
      const u = (pHead - a - s.launch) / s.flight;
      if (u < 0 || u > 1) continue;
      const age = a + after;
      let P = arcPos(pl, s, u);
      // the train drifts: a slow sideways wander that grows with age (wind on a meteor train), alive at rest
      const wob = Math.min(age / 0.06, 1.5) * 0.004 * R;
      const nrm = norm(sub(P, pl.center));
      const side = norm(cross(nrm, sub(arcPos(pl, s, Math.min(u + 0.01, 1)), P)));
      const ph = u * 9 + s.seed * 7 + t * 0.25;
      P = add(P, add(mul(side, wob * Math.sin(ph)), mul(nrm, wob * 0.5 * Math.cos(ph * 1.3))));
      const pr = project(P, cam);
      if (pr[2] <= R * 1e-3) continue;
      const hot = Math.exp(-age / TAU_HOT);
      const K = 900 + 1350 * hot + 200 * Math.exp(-age / 0.03);
      const fade = Math.exp(-age / TAU_TRAIN) * (1 - smooth(2 * TAU_TRAIN, 3 * TAU_TRAIN, age)) * smooth(0, 0.004, a + 0.0005);
      // tumble: a lava bomb has a hot side, so its trail breathes ±15% (cooling swings of ~0.4 s in Stromboli footage)
      const tumble = 1 + 0.15 * Math.sin((s.launch + u * s.flight) * 900 + s.seed * 20);
      const worldW = (0.0007 + 0.006 * (1 - Math.exp(-age / 0.04))) * R;
      const pxW = worldW * pxPerWorld(pr[2]);
      const w = Math.max(pxW, minW); // a hairline never thinner than ~1.3 px; widened lines keep their energy
      const I = (1.2 + 4 * hot) * fade * tumble * (hidden(P, cam, pl) ? 0 : 1) * (pxW / w);
      pts.push({ x: pr[0], y: pr[1], K, I, w: w * 1.6 });
    }
    strip(pts);
    if (uHead <= 1) {
      const P = arcPos(pl, s, uHead);
      const pr = project(P, cam);
      if (pr[2] > R * 1e-3 && !hidden(P, cam, pl)) {
        const flick = 0.85 + 0.15 * Math.sin(t * 37 + s.seed * 9) * Math.sin(t * 23.1 + s.seed * 50);
        const w = minW;
        strip([
          { x: pr[0] - w * 0.5, y: pr[1], K: 2500, I: 2 * flick, w },
          { x: pr[0] + w * 0.5, y: pr[1], K: 2500, I: 2 * flick, w },
        ]);
      }
    }
  }

  // labels (CSS px, y down), anchored to the places
  const cssH = cam.height / dpr;
  const label = (name: string, dir: Vec3, o: number) => {
    const pr = project(add(pl.center, mul(dir, R)), cam);
    return { name, x: pr[0] / dpr, y: cssH - pr[1] / dpr, o: pr[2] > 0 ? o : 0 };
  };
  const labels = [
    label(
      'PayPal',
      F.up,
      smooth(0.03, 0.08, p) * (1 - 0.85 * smooth(0.2, 0.232, p) * (1 - smooth(0.3, 0.34, p))) * (1 - 0.55 * smooth(0.82, 0.97, p)),
    ),
    ...SITES.map((s) => label(s.name, s.dir, smooth(s.land + 0.004, s.land + 0.03, p))),
  ];
  return { spots, spotsB, ribbon, vertexCount: n / 6, labels, captions: CAPTIONS.map((_, i) => captionOpacity(i, p)) };
}

// ---------------------------------------------------------------- GLSL
/** Blackbody, prefixed so it never collides with another module's. Linear sRGB chroma (unit luminance) × a compressed
 * power curve relative to 1500 K. */
export const PP_BB_GLSL = /* glsl */ `
vec3 pp_bbChroma(float K){
  float t = K/100.;
  float r = t<=66. ? 1. : clamp(1.292936*pow(t-60., -0.1332047), 0., 1.);
  float g = t<=66. ? clamp(0.390082*log(t)-0.631841, 0., 1.) : clamp(1.129891*pow(t-60., -0.0755148), 0., 1.);
  float b = t>=66. ? 1. : (t<=19. ? 0. : clamp(0.543207*log(t-10.)-1.196254, 0., 1.));
  vec3 c = pow(vec3(r,g,b), vec3(2.2));
  return c / max(dot(c, vec3(.2126,.7152,.0722)), 1e-4);
}
vec3 pp_bb(float K){ return pp_bbChroma(max(K, 700.)) * pow(K/1500., 4.5); }
`;

/** The places on the lava: `vec3 paypalEmit(vec3 n)`, n = unit surface normal (direction from the planet centre).
 * Linear HDR emission to add with the lava's own (under its Fresnel). Uniforms: uPPSpot[7], uPPSpotB[7]. */
export const PAYPAL_GLSL = /* glsl */ `
uniform vec4 uPPSpot[7];
uniform vec4 uPPSpotB[7];
${PP_BB_GLSL}
float pp_hash(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float pp_noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(pp_hash(i),pp_hash(i+vec3(1,0,0)),f.x),mix(pp_hash(i+vec3(0,1,0)),pp_hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(pp_hash(i+vec3(0,0,1)),pp_hash(i+vec3(1,0,1)),f.x),mix(pp_hash(i+vec3(0,1,1)),pp_hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
vec3 paypalEmit(vec3 n){
  vec3 emit = vec3(0);
  float ripple = 0.;
  for (int i=0;i<7;i++){
    float heat = uPPSpot[i].w; float flash = uPPSpotB[i].z;
    if (heat <= 0.001 && flash <= 0.001) continue;
    vec3 sd = uPPSpot[i].xyz;
    float cs = dot(n, sd);
    if (cs < 0.99) continue; // beyond ~8°: nothing of this place reaches here
    float ang = acos(clamp(cs, -1., 1.));
    vec3 tx = normalize(cross(sd, abs(sd.y) < .9 ? vec3(0,1,0) : vec3(1,0,0)));
    vec3 ty = cross(sd, tx);
    vec3 q = n - sd*cs;
    float phi = atan(dot(q, ty), dot(q, tx));
    float age = uPPSpotB[i].x, seed = uPPSpotB[i].w;
    float grow = 1. - exp(-age*14.);
    // flows: a few soft lobes that meander outward from the new vent, like lava running out (no spikes, no crust)
    float lobes = 0.;
    for (int k=0;k<4;k++){
      float fk = float(k);
      float L = (0.03 + 0.05*fract(seed*7.3+fk*.37)) * grow;
      if (L < 1e-4) continue;
      float along = ang / L;
      float a0 = seed*6.283 + fk*1.9 + 0.5*sin(seed*31.+fk) + 0.9*(fract(seed*3.1+fk*.71)-.5)*along;
      float dphi = atan(sin(phi-a0), cos(phi-a0));
      float wdt = (0.42 - 0.22*clamp(along, 0., 1.)) * (0.8 + 0.4*pp_noise(n*90. + fk*7.));
      lobes += exp(-dphi*dphi/(wdt*wdt)) * smoothstep(1.05, 0.2, along) * smoothstep(0.0, 0.25, along)
             * (0.6 + 0.4*pp_noise(n*160. + fk*3.));
    }
    float core = exp(-pow(ang/0.005, 2.));
    float mid = exp(-pow(ang/0.016, 2.));
    float halo = exp(-ang/0.05);
    float Ks = mix(900., 1650., core) + 250.*mid;
    emit += pp_bb(Ks) * heat * (2.2*core + 0.45*mid + 0.08*halo + 0.30*lobes);
    emit += vec3(1.,.93,.82) * flash * 1.5 * exp(-pow(ang/0.005, 2.));
    float ra = uPPSpotB[i].y; // a faint heat ripple running out from a landing, gone fast
    if (ra > 0. && ra < 0.12) ripple += exp(-pow((ang - ra*0.55)/(0.004 + ra*0.05), 2.)) * exp(-ra*60.) * 0.12;
  }
  return emit + pp_bb(1250.) * ripple * 0.9;
}
`;

/** Ribbon program: draw paypalFrame().ribbon as a TRIANGLE_STRIP, additive (ONE, ONE), into the linear HDR scene
 * target before bloom and the tone curve. Attributes: aPos (vec2, location 0), aAttr (vec4, location 1). */
export const PP_RIBBON_VS = /* glsl */ `#version 300 es
layout(location=0) in vec2 aPos;
layout(location=1) in vec4 aAttr;
uniform vec2 uPPRes;
out vec4 vA;
void main(){ vA = aAttr; gl_Position = vec4(aPos/uPPRes*2.-1., 0., 1.); }`;
export const PP_RIBBON_FS = /* glsl */ `#version 300 es
precision highp float;
in vec4 vA; out vec4 o;
${PP_BB_GLSL}
void main(){
  float x = vA.x;
  o = vec4(pp_bb(vA.y) * vA.z * exp(-x*x*4.), 1.); // gaussian cross-section: no edge, no outline
}`;
