// Look-dev lab harness: renders the atmosphere, planet, sun, stars and the post pipeline in one WebGL2 canvas.
// URL: ?scene=<name>&w=390&h=844&dpr=2&t=0&steps=24 , or ?cam=<json> to override any preset field.
const q = new URLSearchParams(location.search);
const W = +(q.get('w') || innerWidth), H = +(q.get('h') || innerHeight), DPR = +(q.get('dpr') || 1);
const canvas = document.getElementById('c');
canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false });
if (!gl) throw new Error('no webgl2');
const floatOK = !!gl.getExtension('EXT_color_buffer_float');
gl.getExtension('OES_texture_float_linear');

const D2R = Math.PI / 180;

export const AIR = {
  Rg: 2000, Rt: 2040,
  rayS: [8.5e-3, 14e-3, 24e-3], rayH: 2.5,
  mieS: [6e-3, 5e-3, 4e-3], mieA: [0.5e-3, 2e-3, 6e-3], mieH: 0.8, mieG: 0.8,
  ozA: [0.65e-3, 1.881e-3, 0.085e-3], ozC: 18, ozW: 14,
  density: 1.0, // the air is thinner than Earth's: stars show at dusk over the zenith
  groundAlb: [0.03, 0.03, 0.03],
};

export const PRESETS = {
  // low over the sea at sunset, looking at the sun: the hero
  hero: { alt: 0.06, pitch: 6, fov: 48, sunEl: 8, sunAz: 0, sunR: 1.2, exposure: 3.2, steps: 24 },
  heroPhone: { alt: 0.06, pitch: 9, fov: 64, sunEl: 8, sunAz: 0, sunR: 1.2, exposure: 3.2, steps: 24 },
  climb: { alt: 40, pitch: -6, fov: 50, sunEl: 6, sunAz: 25, sunR: 1.2, exposure: 3.0, steps: 24 },
  high: { alt: 400, pitch: -28, fov: 50, sunEl: 5, sunAz: 40, sunR: 1.2, exposure: 2.6, steps: 24 },
  orbit: { alt: 2600, pitch: -64, fov: 46, sunEl: 15, sunAz: 95, sunR: 1.2, exposure: 2.2, steps: 20 },
  night: { alt: 2600, pitch: -64, fov: 46, sunEl: -75, sunAz: 180, sunR: 1.2, exposure: 4.5, steps: 20 },
  sunrise: { alt: 600, pitch: -34, fov: 50, sunEl: -40.0, sunAz: 0, sunR: 1.2, exposure: 2.4, steps: 24 },
};

if (q.get('air')) Object.assign(AIR, JSON.parse(q.get('air')));
const preset = { ...(PRESETS[q.get('scene') || 'hero'] || PRESETS.hero), ...(q.get('cam') ? JSON.parse(q.get('cam')) : {}) };
const SCALE = +(q.get('scale') || 1);

async function src(name) { return (await fetch('glsl/' + name + '?' + Date.now())).text(); }
const [COMMON, ATMO, SKY, SUN, PLANET, POST, LUTS, SCENE, PP] = await Promise.all(
  ['common', 'atmosphere', 'sky', 'sun', 'planet', 'post', 'luts', 'lab_scene', 'post_passes'].map((n) => src(n + '.glsl')));

const VS = `#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0,1);}`;
function prog(defs, ...parts) {
  const fs = `#version 300 es\nprecision highp float;\nprecision highp int;\n${defs.map((d) => '#define ' + d).join('\n')}\n` + parts.join('\n');
  const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(sh); console.error(log); throw new Error(log); } return sh; };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const loc = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); loc[u.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, u.name); }
  return { p, loc };
}
function tex(w, h, hdr = true) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, hdr && floatOK ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, hdr && floatOK ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  return { t, f, w, h };
}

const atmoParts = [COMMON, ATMO];
const pTrans = prog(['PASS_TRANS'], ...atmoParts, LUTS);
const pMS = prog(['PASS_MS'], ...atmoParts, LUTS);
const pSky = prog(['PASS_SKY'], ...atmoParts, LUTS);
const pScene = prog([], COMMON, ATMO, SKY, SUN, PLANET, SCENE);
const pDown = prog(['PASS_DOWN'], POST, PP);
const pUp = prog(['PASS_UP'], POST, PP);
const pFinal = prog(['PASS_FINAL'], POST, PP);

const tTrans = tex(256, 64), tMS = tex(32, 32), tSky = tex(200, 120);
const RW = Math.round(canvas.width * SCALE), RH = Math.round(canvas.height * SCALE);
const tHDR = tex(RW, RH);
const mips = [];
{ let w = RW, h = RH; for (let i = 0; i < 6; i++) { w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); mips.push(tex(w, h)); if (w < 8 || h < 8) break; } }

function setAir(P) {
  const L = P.loc, d = AIR.density, s = (v, k) => v.map((x) => x * k);
  const set3 = (n, v) => L[n] && gl.uniform3fv(L[n], v);
  const set1 = (n, v) => L[n] && gl.uniform1f(L[n], v);
  set1('uRg', AIR.Rg); set1('uRt', AIR.Rt);
  set3('uRayS', s(AIR.rayS, d)); set1('uRayH', AIR.rayH);
  set3('uMieS', s(AIR.mieS, d)); set3('uMieA', s(AIR.mieA, d)); set1('uMieH', AIR.mieH); set1('uMieG', AIR.mieG);
  set3('uOzA', s(AIR.ozA, d)); set1('uOzC', AIR.ozC); set1('uOzW', AIR.ozW);
  set3('uGroundAlb', AIR.groundAlb);
}

function camera(P) {
  const R = AIR.Rg, lat = (P.lat || 0) * D2R, lon = (P.lon || 0) * D2R;
  const up = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
  const pos = up.map((x) => x * (R + P.alt));
  const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const east = norm(cross([0, 1, 0], up)), north = cross(up, east);
  const hd = (P.heading || 0) * D2R;
  const horiz = (h) => north.map((x, i) => x * Math.cos(h) + east[i] * Math.sin(h));
  const hf = horiz(hd), pt = P.pitch * D2R;
  const fwd = norm(hf.map((x, i) => x * Math.cos(pt) + up[i] * Math.sin(pt)));
  const right = norm(cross(fwd, up)), cu = cross(right, fwd);
  const sh = horiz(hd + P.sunAz * D2R), se = P.sunEl * D2R;
  const sun = norm(sh.map((x, i) => x * Math.cos(se) + up[i] * Math.sin(se)));
  return { pos, fwd, right, cu, sun };
}

const quad = (P, fb, w, h) => { gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, w, h); gl.useProgram(P.p); };
const bindTex = (P, name, unit, t) => { if (!P.loc[name]) return; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(P.loc[name], unit); };

function common(P, cam, t) {
  setAir(P);
  const L = P.loc;
  L.uSunDir && gl.uniform3fv(L.uSunDir, cam.sun);
  L.uSunR && gl.uniform1f(L.uSunR, preset.sunR * D2R);
  L.uSunE && gl.uniform3fv(L.uSunE, bbColor(preset.sunT ?? 5200));
  L.uCamPos && gl.uniform3fv(L.uCamPos, cam.pos);
  L.uGroundGlow && gl.uniform3fv(L.uGroundGlow, preset.glow || [0.004, 0.0012, 0.0003]);
  L.uAirglow && gl.uniform3fv(L.uAirglow, preset.airglow || [0.00006, 0.00011, 0.00018]);
  L.uAirglowH && gl.uniform1f(L.uAirglowH, AIR.agH ?? 9);
  bindTex(P, 'uTransLUT', 0, tTrans.t); bindTex(P, 'uMSLUT', 1, tMS.t); bindTex(P, 'uSkyLUT', 2, tSky.t);
  L.uTime && gl.uniform1f(L.uTime, t);
}

// chromaticity of a blackbody (unit luminance), same as bbColor in common.glsl
function bbColor(T) {
  const lam = [600e-9, 550e-9, 460e-9], c2 = 1.4388e-2;
  let v = lam.map((l) => 1 / (l ** 5 * (Math.exp(c2 / (l * T)) - 1)));
  const m = (v[0] + v[1] + v[2]) / 3; v = v.map((x) => x + (m - x) * 0.12);
  const Y = 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  return v.map((x) => x / Y);
}
let frame = 0;
function luts(cam) {
  quad(pTrans, tTrans.f, 256, 64); common(pTrans, cam, 0); gl.uniform2f(pTrans.loc.uLutRes, 256, 64); gl.drawArrays(gl.TRIANGLES, 0, 3);
  quad(pMS, tMS.f, 32, 32); common(pMS, cam, 0); gl.uniform2f(pMS.loc.uLutRes, 32, 32); gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function render(t) {
  const cam = camera(preset);
  if (frame === 0) luts(cam);
  // sky-view LUT at the camera
  quad(pSky, tSky.f, 200, 120); common(pSky, cam, t); gl.uniform2f(pSky.loc.uLutRes, 200, 120); gl.uniform1i(pSky.loc.uSkySteps, 40);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  // scene
  const S = pScene, L = S.loc;
  quad(S, tHDR.f, RW, RH); common(S, cam, t);
  gl.uniform3fv(L.uCamR, cam.right); gl.uniform3fv(L.uCamU, cam.cu); gl.uniform3fv(L.uCamF, cam.fwd);
  gl.uniform1f(L.uTanHalf, Math.tan(preset.fov * D2R / 2)); gl.uniform2f(L.uRes, RW, RH);
  gl.uniform1i(L.uSteps, preset.steps); L.uFrame && gl.uniform1f(L.uFrame, frame);
  L.uUseSkyLUT && gl.uniform1f(L.uUseSkyLUT, preset.alt < 60 ? 1 : 0);
  L.uPixAng && gl.uniform1f(L.uPixAng, 2 * Math.tan(preset.fov * D2R / 2) / RH);
  L.uStarGain && gl.uniform1f(L.uStarGain, preset.stars ?? 1);
  L.uSkyRot && gl.uniformMatrix3fv(L.uSkyRot, false, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  L.uSunTemp && gl.uniform1f(L.uSunTemp, preset.discT ?? 5200); L.uSunLimbT && gl.uniform1f(L.uSunLimbT, preset.limbT ?? 2300); L.uSunBoost && gl.uniform1f(L.uSunBoost, preset.sunBoost ?? 0.03);
  L.uLavaGain && gl.uniform1f(L.uLavaGain, preset.lava ?? 1.0); L.uHeat && gl.uniform1f(L.uHeat, preset.heat ?? 0);
  L.uLandAmt && gl.uniform1f(L.uLandAmt, preset.land ?? 0.6);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  // bloom chain
  let src = tHDR;
  gl.disable(gl.BLEND);
  mips.forEach((m, i) => {
    quad(pDown, m.f, m.w, m.h); bindTex(pDown, 'uSrc', 0, src.t);
    gl.uniform2f(pDown.loc.uSrcTexel, 1 / src.w, 1 / src.h); gl.uniform2f(pDown.loc.uDstRes, m.w, m.h); gl.uniform1f(pDown.loc.uFirst, i === 0 ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3); src = m;
  });
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  for (let i = mips.length - 1; i > 0; i--) {
    const s = mips[i], d = mips[i - 1];
    quad(pUp, d.f, d.w, d.h); bindTex(pUp, 'uSrc', 0, s.t);
    gl.uniform2f(pUp.loc.uSrcTexel, 1 / s.w, 1 / s.h); gl.uniform2f(pUp.loc.uDstRes, d.w, d.h); gl.uniform1f(pUp.loc.uRadius, 1.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  gl.disable(gl.BLEND);
  // final
  const F = pFinal;
  quad(F, null, canvas.width, canvas.height);
  bindTex(F, 'uSrc', 0, tHDR.t); bindTex(F, 'uBloom', 1, mips[0].t);
  gl.uniform2f(F.loc.uDstRes, canvas.width, canvas.height);
  gl.uniform1f(F.loc.uExposure, preset.exposure); gl.uniform1f(F.loc.uBloomAmt, preset.bloom ?? 0.05);
  gl.uniform1f(F.loc.uPunch, preset.punch ?? 1); gl.uniform1f(F.loc.uGrain, preset.grain ?? 0.025);
  gl.uniform1f(F.loc.uVignette, 1.0); gl.uniform1f(F.loc.uFrameN, frame);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  frame++;
}

const T0 = +(q.get('t') || 0);
render(T0);
const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
window.__look = { render, preset, floatOK, ready: true };
document.title = 'ready';
