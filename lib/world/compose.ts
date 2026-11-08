// The composer: stitches every module's GLSL into the scene shader and the post shader, and writes the engine's own
// functions (the camera ray, the sea intersection, the trace, the dispatch to each module's hooks). See ARCHITECTURE.md
// for what each hook receives and when it runs.

import type { Source } from './gl';
import type { Hook, WorldModule } from './modules';

/** Hit ids: 0 sky, 1 sea; module k (in registry order, counting modules with a `hit` hook) owns [16 (k + 1), 16 (k + 2)). */
export const ID_SKY = 0;
export const ID_SEA = 1;

export const PRELUDE = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;

// ---- engine uniforms (set by the world engine every frame) ----
uniform vec2 uRes;        // scene render target size (px)
uniform vec2 uView;       // viewport (CSS px)
uniform float uPx;        // CSS px per render px
uniform float uTime;      // seconds on the one clock
uniform float uDt;
uniform vec3 uCamPos;     // camera world position (planet centre = origin)
uniform mat3 uCam;        // columns: right, up, forward
uniform float uFocal;     // focal length in render px
uniform float uR;         // planet radius
uniform float uCamH;      // camera altitude above the sea (exact, from the CPU)
uniform vec3 uCamUp;      // the planet normal under the camera
uniform vec3 uSunDir;     // unit vector from the camera to the sun (the mark's core)
uniform float uSunRad;    // the sun's angular radius as seen from the camera (rad)
uniform vec3 uSunPos;     // the sun's world position (near in the hero: it hangs over the sea; far elsewhere)
uniform float uSunR;      // the sun's physical radius (world units)
uniform float uExposure;  // stops
uniform float uProgress;  // journey progress in this lap (0..1)
uniform float uQ;         // quality 0..1 (1 = best)
uniform int uStep;        // quality step (0 = best)
uniform float uStill;     // 1 under reduced motion
uniform vec4 uPtr;        // pointer: CSS px x, y; active (0/1); down (0/1)

const float PI = 3.14159265359;
const float TAU = 6.28318530718;
// brand colours, linear (sRGB #FF5B1F, #E8E4D8, #8DB6F2)
const vec3 EMBER = vec3(1.0, 0.1046, 0.0137);
const vec3 BONE = vec3(0.807, 0.776, 0.686);
const vec3 QUENCH = vec3(0.266, 0.468, 0.887);

struct Ray { vec3 ro; vec3 rd; float pa; int depth; };
struct Hit { float t; int id; vec3 p; vec3 n; vec4 data; };
struct Sea { vec3 p; vec3 up; vec3 q; vec3 eU; vec3 eV; vec2 w; float t; float fw; float graz; };
struct SeaMod { vec3 g; float heat; vec3 emit; float calm; float rough; vec4 aux; };

float world_hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 world_hash33(vec3 p3){ p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }
float world_noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(world_hash12(i), world_hash12(i + vec2(1, 0)), u.x), mix(world_hash12(i + vec2(0, 1)), world_hash12(i + vec2(1, 1)), u.x), u.y); }
`;

const SIG: Record<Hook, (id: string) => string> = {
  sky: (id) => `void ${id}_sky(Ray r, inout vec3 col);`,
  hit: (id) => `void ${id}_hit(Ray r, inout Hit h);`,
  shade: (id) => `vec3 ${id}_shade(Ray r, Hit h);`,
  env: (id) => `vec3 ${id}_env(Ray r, Hit h);`,
  sea: (id) => `void ${id}_sea(Ray r, Sea s, inout SeaMod m);`,
  over: (id) => `void ${id}_over(Ray r, Hit h, inout vec3 col);`,
};

const PROTOS = `
vec3 look_sky(Ray r);
vec3 look_atmo(vec3 col, Ray r, Hit h);
vec3 lava_shade(Ray r, Sea s, SeaMod m);
vec3 lava_env(Ray r, Sea s);
vec3 world_sky(Ray r);
vec3 world_env(Ray r);
float world_seaT(Ray r);
Sea world_seaAt(Ray r, float t);
SeaMod world_seaMod();
Ray world_ray(vec2 fc);
`;

export type Composed = { scene: Source; post: Source; ids: Record<string, number> };

export function compose(mods: WorldModule[], opts: { defines?: Record<string, string | number> } = {}): Composed {
  const lines: string[] = [];
  const map: [number, string][] = [];
  const push = (id: string, text: string) => {
    map.push([lines.length + 1, id]);
    lines.push(...text.split('\n'));
  };
  const has = (m: WorldModule, h: Hook) => m.hooks?.includes(h);
  const ids: Record<string, number> = {};
  let k = 0;
  for (const m of mods) if (has(m, 'hit')) ids[m.id] = 16 * ++k;

  const defs = Object.entries(opts.defines ?? {})
    .map(([n, v]) => `#define ${n} ${v}`)
    .join('\n');
  push('prelude', `#version 300 es\n${defs}\n${PRELUDE}`);
  push(
    'ids',
    `const int ID_SKY = ${ID_SKY};\nconst int ID_SEA = ${ID_SEA};\n` +
      Object.entries(ids)
        .map(([id, v]) => `const int ${id.toUpperCase()}_ID = ${v};`)
        .join('\n'),
  );
  push('protos', PROTOS + mods.flatMap((m) => (m.hooks ?? []).map((h) => SIG[h](m.id))).join('\n'));
  for (const m of mods) if (m.glsl) push(m.id, m.glsl);

  const each = (h: Hook, call: (id: string) => string) =>
    mods
      .filter((m) => has(m, h))
      .map((m) => '  ' + call(m.id))
      .join('\n');
  const dispatch = (h: 'shade' | 'env') =>
    mods
      .filter((m) => has(m, 'hit'))
      .map((m) => `  if (h.id >= ${ids[m.id]} && h.id < ${ids[m.id] + 16}) return ${has(m, h) ? `${m.id}_${h}(r, h)` : 'vec3(0.0)'};`)
      .join('\n');

  push(
    'world',
    /* glsl */ `
Ray world_ray(vec2 fc){
  vec2 sp = (fc - 0.5 * uRes) / uFocal;
  Ray r; r.ro = uCamPos; r.rd = normalize(uCam * vec3(sp, 1.0)); r.pa = 1.0 / uFocal; r.depth = 0;
  return r;
}
// near hit of the sea sphere; stable for grazing rays (c is exact from the CPU when the ray starts at the camera)
float world_seaT(Ray r){
  float b = dot(r.ro, r.rd);
  float c = r.depth == 0 ? uCamH * (2.0 * uR + uCamH) : dot(r.ro, r.ro) - uR * uR;
  float d = b * b - c;
  if (d < 0.0 || b > 0.0 || c < 0.0) return -1.0;
  return c / (-b + sqrt(d));
}
Sea world_seaAt(Ray r, float t){
  Sea s; s.t = t; s.p = r.ro + r.rd * t; s.up = normalize(s.p); s.q = s.up;
  s.w = vec2(uR * asin(clamp(-s.q.x, -1.0, 1.0)), uR * atan(s.q.z, s.q.y));
  s.eV = normalize(vec3(0.0, -s.q.z, s.q.y) + 1e-9);
  s.eU = cross(s.eV, s.up);
  s.graz = max(-dot(r.rd, s.up), 1e-3);
  s.fw = r.pa * t / s.graz;
  return s;
}
SeaMod world_seaMod(){ SeaMod m; m.g = vec3(0.0); m.heat = 0.0; m.emit = vec3(0.0); m.calm = 0.0; m.rough = 0.0; m.aux = vec4(0.0); return m; }
vec3 world_sky(Ray r){
  vec3 col = look_sky(r);
${each('sky', (id) => `${id}_sky(r, col);`)}
  return col;
}
// reflections and other secondary rays: sky, objects (their cheap _env shading) and the sea (lava_env). No recursion.
vec3 world_env(Ray r){
  r.depth = max(r.depth, 1);
  Hit h; h.t = 1e30; h.id = ID_SKY; h.p = vec3(0.0); h.n = vec3(0.0); h.data = vec4(0.0);
  float ts = world_seaT(r);
  if (ts > 0.0) { h.t = ts; h.id = ID_SEA; }
${each('hit', (id) => `${id}_hit(r, h);`)}
  if (h.id == ID_SKY) return world_sky(r);
  if (h.id == ID_SEA) return lava_env(r, world_seaAt(r, h.t));
${dispatch('env')}
  return vec3(0.0);
}
Hit world_trace(Ray r){
  Hit h; h.t = 1e30; h.id = ID_SKY; h.p = vec3(0.0); h.n = vec3(0.0); h.data = vec4(0.0);
  float ts = world_seaT(r);
  if (ts > 0.0) { h.t = ts; h.id = ID_SEA; h.p = r.ro + r.rd * ts; h.n = normalize(h.p); }
${each('hit', (id) => `${id}_hit(r, h);`)}
  return h;
}
vec3 world_shadeHit(Ray r, Hit h){
  if (h.id == ID_SKY) return world_sky(r);
  if (h.id == ID_SEA) {
    Sea s = world_seaAt(r, h.t);
    SeaMod m = world_seaMod();
${each('sea', (id) => `${id}_sea(r, s, m);`)}
    return lava_shade(r, s, m);
  }
${dispatch('shade')}
  return vec3(1.0, 0.0, 1.0);
}
out vec4 fragColor;
void main(){
  Ray r = world_ray(gl_FragCoord.xy);
  Hit h = world_trace(r);
  vec3 col = world_shadeHit(r, h);
${each('over', (id) => `${id}_over(r, h, col);`)}
  col = look_atmo(col, r, h);
  col = max(col, vec3(0.0)) * exp2(uExposure);
#ifdef WORLD_LDR
  col = col / (1.0 + col); // no float targets: the post pass undoes this in world_scene()
#endif
  fragColor = vec4(col, 1.0);
}
`,
  );

  const post = composePost(mods.find((m) => m.provides?.includes('look_post'))?.post ?? '', defs);
  return { scene: { text: lines.join('\n'), map }, post, ids };
}

/** The post pass: the module providing look_post samples uScene (linear HDR) and uBloom (its blurred bright part). */
function composePost(chunk: string, defs: string): Source {
  const head = `#version 300 es\n${defs}\nprecision highp float;\nuniform sampler2D uScene;\nuniform sampler2D uBloom;\nuniform vec2 uRes;\nuniform vec2 uCanvas;\nuniform float uTime;\nuniform float uBloomOn;\nuniform float uQ;\nuniform float uStill;\nvec3 world_scene(vec2 uv){ vec3 c = texture(uScene, uv).rgb;\n#ifdef WORLD_LDR\n  c = c / (1.0 - min(c, vec3(0.996)));\n#endif\n  return c; }\n`;
  const tail = `\nout vec4 fragColor;\nvoid main(){ vec2 uv = gl_FragCoord.xy / uCanvas; fragColor = vec4(look_post(uv, gl_FragCoord.xy), 1.0); }\n`;
  const nHead = head.split('\n').length;
  return { text: head + chunk + tail, map: [[1, 'post-head'], [nHead, 'post']] };
}

/** Bloom: a bright-pass downsample chain (13-tap) and a tent upsample, each at half the size of the previous. */
export const BLOOM_DOWN: Source = {
  text: `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uFirst; uniform float uThresh;
out vec4 o;
vec3 tap(vec2 uv){ return texture(uSrc, uv).rgb; }
void main(){
  vec2 uv = gl_FragCoord.xy * 2.0 * uTexel; // the destination is half the source
  vec2 t = uTexel;
  vec3 a = tap(uv + t * vec2(-2, 2)), b = tap(uv + t * vec2(0, 2)), c = tap(uv + t * vec2(2, 2));
  vec3 d = tap(uv + t * vec2(-2, 0)), e = tap(uv), f = tap(uv + t * vec2(2, 0));
  vec3 g = tap(uv + t * vec2(-2, -2)), h = tap(uv + t * vec2(0, -2)), i = tap(uv + t * vec2(2, -2));
  vec3 j = tap(uv + t * vec2(-1, 1)), k = tap(uv + t * vec2(1, 1)), l = tap(uv + t * vec2(-1, -1)), m = tap(uv + t * vec2(1, -1));
  vec3 s = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  if (uFirst > 0.5) { float br = max(s.r, max(s.g, s.b)); s *= max(br - uThresh, 0.0) / max(br, 1e-4); }
  o = vec4(s, 1.0);
}`,
  map: [[1, 'bloom-down']],
};

export const BLOOM_UP: Source = {
  text: `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform vec2 uTexel;
out vec4 o;
void main(){
  vec2 uv = gl_FragCoord.xy * uTexel * 0.5; // the destination is twice the source
  vec2 t = uTexel;
  vec3 s = texture(uSrc, uv).rgb * 4.0;
  s += (texture(uSrc, uv + t * vec2(1, 0)).rgb + texture(uSrc, uv - t * vec2(1, 0)).rgb + texture(uSrc, uv + t * vec2(0, 1)).rgb + texture(uSrc, uv - t * vec2(0, 1)).rgb) * 2.0;
  s += texture(uSrc, uv + t).rgb + texture(uSrc, uv - t).rgb + texture(uSrc, uv + t * vec2(1, -1)).rgb + texture(uSrc, uv - t * vec2(1, -1)).rgb;
  o = vec4(s / 16.0, 1.0);
}`,
  map: [[1, 'bloom-up']],
};
