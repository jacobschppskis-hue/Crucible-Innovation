// look: the world's look development. Provides look_sky (stars, the thin atmosphere, the sun's disc), look_atmo
// (aerial perspective over every primary pixel) and look_post (bloom mix, AgX, grain, dither), plus functions other
// modules call: look_sunLight(p) (the sun's light at a point, after the air), look_seaTemp / look_land /
// look_planetFar / look_farMix (the planet seen from far out; the lava module blends its near sea into it).
//
// The atmosphere is physically based (lib/world/glsl/atmosphere.glsl): its transmittance and multiple-scattering LUTs
// are rendered once in init, the sky-view LUT every frame the camera is low. All three are rendered by look's own
// small programs into textures the engine's Uniforms own (so they bind with every other module texture).
//
// Journey channels (keys may set them): look.sunDisc (0..1, the sky's own sun disc; the mark's core may replace it),
// look.gain (linear, the base exposure on top of the journey's `exposure` stops), look.stars, look.lava (the sea's
// emitted radiance scale), look.heat (0..1, the planet heats: the thesis), look.land (0..1 how much land).

import type { WorldModule } from './modules';
import type { Frame } from './frame';
import type { Uniforms } from './gl';
import atmoGlsl from './glsl/atmosphere.glsl';
import lutGlsl from './glsl/atmosphere-luts.glsl';
import sunGlsl from './glsl/sun.glsl';
import skyGlsl from './glsl/sky.glsl';
import planetGlsl from './glsl/planet.glsl';
import postGlsl from './glsl/post.glsl';

/** The air, in air km (the planet is 2000 air km in radius whatever the world's R; look_uK scales). */
export const AIR = {
  Rg: 2000,
  Rt: 2040,
  // Rayleigh less steep than Earth's: the dusk band reads steel blue (Quench), not saturated blue; dense at the bottom
  // (scale height 2.5 km): a dark zenith with stars at dusk, a deep orange horizon
  rayS: [8.5e-3, 14e-3, 24e-3],
  rayH: 2.5,
  // aerosol that absorbs blue: the horizon turns orange
  mieS: [6e-3, 5e-3, 4e-3],
  mieA: [0.6e-3, 3e-3, 9e-3],
  mieH: 0.8,
  mieG: 0.8,
  ozA: [0.65e-3, 1.881e-3, 0.085e-3],
  ozC: 18,
  ozW: 14,
  groundAlb: [0.03, 0.03, 0.03],
  glow: [0.004, 0.0012, 0.0003],
  airglow: [6e-5, 1.1e-4, 1.8e-4],
  airglowH: 9,
};

export const SUN = { light: 5200, disc: 5200, limb: 2300, boost: 0.02 };

/** Blackbody chromaticity at unit luminance (same as look_bbColor in GLSL). */
export function bbColor(T: number): [number, number, number] {
  const lam = [600e-9, 550e-9, 460e-9],
    c2 = 1.4388e-2;
  let v = lam.map((l) => 1 / (l ** 5 * (Math.exp(c2 / (l * T)) - 1)));
  const m = (v[0] + v[1] + v[2]) / 3;
  v = v.map((x) => x + (m - x) * 0.12);
  const Y = 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  return [v[0] / Y, v[1] / Y, v[2] / Y];
}

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The direction the air is lit from. The sun is the mark's core: while it hangs near over the sea (the hero), it is a
 * hot object ~10 deg up, and a physical sky lit from 10 deg up is a washed, beige day sky. So while the core is near
 * ('look.dusk', default: from its distance) the sky's light keeps the core's azimuth but sits on the horizon: the air
 * glows as at sunset (orange band, steel-blue band, stars above), under the core. Far away the core is the star and
 * lights the air from where it is.
 */
function skyLight(f: Frame): number[] {
  const d = f.sun.dir,
    up = f.cam.up;
  let dusk = f.ch['look.dusk'] ?? -1;
  if (dusk < 0) dusk = 1 - sstep(Math.log(3e3), Math.log(3e5), Math.log(Math.max(f.sun.dist, 1)));
  if (dusk <= 0) return [...d];
  const e = d[0] * up[0] + d[1] * up[1] + d[2] * up[2];
  const h = [d[0] - up[0] * e, d[1] - up[1] * e, d[2] - up[2] * e];
  const hl = Math.hypot(h[0], h[1], h[2]) || 1;
  const el = Math.asin(Math.max(-1, Math.min(1, e)));
  // the horizon from the camera's height dips a little; put the light just above the geometric horizon
  const el1 = el + (DUSK_EL - el) * dusk;
  const c = Math.cos(el1), sn = Math.sin(el1);
  return [(h[0] / hl) * c + up[0] * sn, (h[1] / hl) * c + up[1] * sn, (h[2] / hl) * c + up[2] * sn];
}
const DUSK_EL = -0.5 * (Math.PI / 180);

const SKY_W = 192,
  SKY_H = 108;

type Lut = { name: string; w: number; h: number; tex: WebGLTexture; fb: WebGLFramebuffer };

function airUniforms(set: (n: string, v: number | number[]) => void, K: number) {
  set('look_uK', K);
  set('look_uRg', AIR.Rg);
  set('look_uRt', AIR.Rt);
  set('look_uRayS', AIR.rayS);
  set('look_uRayH', AIR.rayH);
  set('look_uMieS', AIR.mieS);
  set('look_uMieA', AIR.mieA);
  set('look_uMieH', AIR.mieH);
  set('look_uMieG', AIR.mieG);
  set('look_uOzA', AIR.ozA);
  set('look_uOzC', AIR.ozC);
  set('look_uOzW', AIR.ozW);
  set('look_uGroundAlb', AIR.groundAlb);
  set('look_uGroundGlow', AIR.glow);
  set('look_uAirglow', AIR.airglow);
  set('look_uAirglowH', AIR.airglowH);
  set('look_uSunE', bbColor(SUN.light));
}

function makeLook(): WorldModule {
  let gl: WebGL2RenderingContext;
  let progs: Record<'trans' | 'ms' | 'sky', WebGLProgram> | null = null;
  const luts: Record<string, Lut> = {};
  let ldr = false;
  let skyVer = 0;

  function compile(def: string) {
    const fs = `#version 300 es\nprecision highp float;\nprecision highp int;\nprecision highp sampler2D;\n#define ${def}\n${ldr ? '#define LOOK_LDR\n' : ''}${atmoGlsl}\n${lutGlsl}`;
    const vs = `#version 300 es\nvoid main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
    const mk = (t: number, s: string) => {
      const sh = gl.createShader(t)!;
      gl.shaderSource(sh, s);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(`look ${def}: ${gl.getShaderInfoLog(sh)}`);
      return sh;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`look ${def}: ${gl.getProgramInfoLog(p)}`);
    return p;
  }

  // A texture owned by the engine's Uniforms (so it binds with every module texture), rendered into by look.
  function lut(u: Uniforms, name: string, w: number, h: number): Lut {
    u.tex(name, { w, h, data: ldr ? new Uint8Array(w * h * 4) : new Uint16Array(w * h * 4), format: ldr ? 'rgba8' : 'rgba16f' }, 'look-lut', {
      linear: true,
    });
    // Uniforms.tex leaves the texture bound on its unit: take its handle and give it a framebuffer
    const tex = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture;
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return (luts[name] = { name, w, h, tex, fb });
  }

  function run(p: WebGLProgram, L: Lut, u: Uniforms, vals: Record<string, number | number[]>) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, L.fb);
    gl.viewport(0, 0, L.w, L.h);
    gl.disable(gl.BLEND);
    gl.useProgram(p);
    gl.bindVertexArray(null);
    u.bindAll();
    const set = (n: string, v: number | number[]) => {
      const loc = gl.getUniformLocation(p, n);
      if (!loc) return;
      if (typeof v === 'number') gl.uniform1f(loc, v);
      else if (v.length === 2) gl.uniform2fv(loc, v);
      else gl.uniform3fv(loc, v);
    };
    for (const [n, v] of Object.entries(vals)) set(n, v);
    const si = gl.getUniformLocation(p, 'look_uSkySteps');
    if (si) gl.uniform1i(si, 32);
    for (const s of ['look_uTrans', 'look_uMS']) {
      const loc = gl.getUniformLocation(p, s);
      if (loc) gl.uniform1i(loc, u.get(s) as number);
    }
    gl.uniform2f(gl.getUniformLocation(p, 'look_uLutRes'), L.w, L.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  const shared: Record<string, number | number[]> = {};
  const sharedSet = (n: string, v: number | number[]) => (shared[n] = v);

  return {
    id: 'look',
    provides: ['look_sky', 'look_atmo', 'look_post'],
    glsl: [atmoGlsl, sunGlsl, skyGlsl, planetGlsl].join('\n'),
    post: postGlsl,
    channels: { 'look.sunDisc': 0, 'look.dusk': -1, 'look.gain': 3, 'look.stars': 1, 'look.lava': 1, 'look.heat': 0, 'look.land': 0.6 },
    init({ gl: g, u }) {
      gl = g;
      ldr = !(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
      progs = { trans: compile('PASS_TRANS'), ms: compile('PASS_MS'), sky: compile('PASS_SKY') };
      const tr = lut(u, 'look_uTrans', 256, 64),
        ms = lut(u, 'look_uMS', 32, 32);
      lut(u, 'look_uSkyLUT', SKY_W, SKY_H);
      airUniforms(sharedSet, 1);
      shared.look_uSun = [0, 1, 0];
      shared.look_uSunR = 0.02;
      shared.look_uCam = [0, AIR.Rg + 1, 0];
      run(progs.trans, tr, u, shared);
      run(progs.ms, ms, u, shared);
    },
    update(f: Frame, u: Uniforms) {
      const K = f.R / AIR.Rg;
      const cam = [f.cam.pos[0] / K, f.cam.pos[1] / K, f.cam.pos[2] / K];
      const hAir = f.cam.h / K;
      const w = sstep(12, 30, hAir);
      const ch = f.ch;
      airUniforms((n, v) => u.set(n, v), K);
      const sun = skyLight(f);
      u.set('look_uSun', sun);
      u.set('look_uSunR', f.sun.rad);
      u.set('look_uCam', cam);
      u.set('look_uHighW', w);
      u.set('look_uSteps', Math.round(10 + 14 * f.quality.q));
      u.set('look_uStarGain', ch['look.stars'] ?? 1);
      u.set('look_uSunDisc', ch['look.sunDisc'] ?? 1);
      u.set('look_uSunBoost', SUN.boost);
      u.set('look_uSunTemp', SUN.disc);
      u.set('look_uSunLimbT', SUN.limb);
      u.set('look_uLavaGain', ch['look.lava'] ?? 1);
      u.set('look_uHeat', ch['look.heat'] ?? 0);
      u.set('look_uLandAmt', ch['look.land'] ?? 0.6);
      u.set('look_uLimb', 0);
      // post
      u.set('look_uGain', ch['look.gain'] ?? 3);
      u.set('look_uBloomAmt', 0.05);
      u.set('look_uPunch', 1);
      u.set('look_uGrain', f.quality.software ? 0.012 : 0.02);
      u.set('look_uVignette', 1);
      u.set('look_uBloomThresh', 0);
      // the sky-view LUT at the camera, while it is low enough to use it
      if (progs && w < 1) {
        airUniforms(sharedSet, K);
        shared.look_uSun = sun;
        shared.look_uSunR = f.sun.rad;
        shared.look_uCam = cam;
        run(progs.sky, luts.look_uSkyLUT, u, shared);
        skyVer++;
      }
    },
    dispose() {
      if (!gl) return;
      for (const p of Object.values(progs ?? {})) gl.deleteProgram(p);
      for (const L of Object.values(luts)) gl.deleteFramebuffer(L.fb);
    },
  };
}

export const look: WorldModule = makeLook();

// ?lookfar: look's own stand-in for the sea (lava_shade/lava_env), to judge the planet's far field and the near/far
// hand-off in the real engine before lava lands. Never on by default.
const LOOKFAR = /* glsl */ `
vec3 lava_env(Ray r, Sea s) { return look_planetFar(r, s); }
vec3 lava_shade(Ray r, Sea s, SeaMod m) {
  vec3 far = look_planetFar(r, s);
  float k = look_farMix(s);
  if (k >= 1.0) return far;
  // near: a smooth glossy molten skin at the same temperature, a few long swells, the sky in it
  vec2 w = s.w; vec3 g = m.g;
  for (int i = 0; i < 5; i++) {
    float fi = float(i), kk = 0.3 * pow(1.6, fi), a = 0.12 / pow(1.8, fi);
    vec2 d = vec2(cos(fi * 1.9 + 0.3), sin(fi * 1.9 + 0.3));
    float att = 1.0 - smoothstep(0.3, 1.0, kk * s.fw);
    float x = dot(w, d) * kk - uTime * sqrt(9.8 * kk) * 0.3 + fi;
    g += vec3(a * sin(x), a * kk * cos(x) * d) * att;
  }
  vec3 n = normalize(s.up - g.y * s.eU - g.z * s.eV);
  float T = look_seaTemp(s.q, s.fw / look_uK, 1.0) + m.heat * 400.0;
  float F = 0.04 + 0.96 * pow(1.0 - max(dot(-r.rd, n), 0.0), 5.0);
  vec3 rd = reflect(r.rd, n); if (dot(rd, s.up) < 0.0) rd = reflect(rd, s.up);
  Ray rr; rr.ro = s.p + s.up * 0.01; rr.rd = rd; rr.pa = r.pa * 2.0 + 0.02; rr.depth = 1;
  vec3 near = look_planck(T) * look_uLavaGain * (1.0 - F) + world_env(rr) * F + m.emit;
  return mix(near, far, k);
}`;
if (typeof location !== 'undefined' && /[?&]lookfar/.test(location.search)) {
  look.provides = [...(look.provides ?? []), 'lava_shade', 'lava_env'];
  look.glsl += LOOKFAR;
}
