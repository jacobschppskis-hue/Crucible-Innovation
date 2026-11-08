// How display type sits in the world: it is reflected in the sea.
//
// The DOM draws every word (it is never drawn twice). Display lines that stand over the sea (`[data-reflect]`: the
// story's heading and break-out, Charlie's statement, the Thesis lines, the shore's wordmark) are rasterised ONCE into a
// small atlas from their own glyph boxes (same font, size, width, weight, tracking, line breaks). Every frame their live
// screen rects and opacity go to the shader as uniforms, and the sea's reflection path looks them up as if each line
// hung in the sky at its screen position: a sea pixel whose reflected ray points at a line's screen position shows that
// line, mirrored about the horizon, broken by the waves (the ray already carries the wave normal), blurred with
// distance (mip LOD from the caller). Nothing sits behind the type; the type simply exists in the world's light.
//
// Two halves, so the GL side can live in a worker:
// - main thread: `typeAtlas()` finds the lines, rasterises the atlas (an OffscreenCanvas/HTMLCanvasElement you can
//   upload or transfer as an ImageBitmap) and `frame()` returns the per-line uniforms (Float32Array, no allocation);
// - GL side: `TYPE_GLSL` (declarations + `vec4 typeAt(vec2 px, float lod)` + `vec2 typeProject(...)`), and
//   `typeUpload(gl, prog, ...)` which binds the atlas and sets the uniforms.
// Framework-free (no React). Fonts: call `refresh()` after `document.fonts.ready` and on resize.

export const TYPE_MAX = 6;

export type TypeFrame = {
  /** number of active lines (≤ TYPE_MAX) */
  n: number;
  /** per line: x, y, w, h in viewport CSS px (top-left origin) */
  rect: Float32Array;
  /** per line: u, v, w, h in the atlas (0..1, v down) */
  uv: Float32Array;
  /** per line: linear r, g, b, opacity */
  col: Float32Array;
  /** viewport in CSS px */
  view: [number, number];
  /** bumps whenever the atlas pixels change (re-upload then) */
  version: number;
};

type Item = { el: HTMLElement; u: number; v: number; w: number; h: number; col: [number, number, number] };

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
function parseColor(s: string): [number, number, number] {
  const m = s.match(/[\d.]+/g)?.map(Number) ?? [232, 228, 216];
  return [srgbToLinear(m[0] / 255), srgbToLinear(m[1] / 255), srgbToLinear(m[2] / 255)];
}
// 'wdth' from font-variation-settings / font-stretch → the canvas fontStretch keyword
function stretchKeyword(cs: CSSStyleDeclaration): CanvasFontStretch {
  const m = cs.fontVariationSettings?.match(/['"]wdth['"]\s+([\d.]+)/);
  const pct = m ? +m[1] : parseFloat(cs.fontStretch) || 100;
  const k: [number, CanvasFontStretch][] = [
    [100, 'normal'],
    [112.5, 'semi-expanded'],
    [125, 'expanded'],
    [150, 'extra-expanded'],
  ];
  let best = k[0];
  for (const e of k) if (Math.abs(e[0] - pct) < Math.abs(best[0] - pct)) best = e;
  return best[1];
}
/** The visible opacity of an element: its own times its ancestors' (crossfades are on parents). */
function opacityOf(el: HTMLElement, stop: Element | null): number {
  let a = 1;
  for (let e: Element | null = el; e && e !== stop; e = e.parentElement) {
    const o = parseFloat(getComputedStyle(e).opacity);
    if (o < 1) a *= o;
    if (a <= 0.001) return 0;
  }
  return a;
}

export function typeAtlas(opts: { root?: ParentNode; scale?: number; maxWidth?: number } = {}) {
  const root = opts.root ?? document;
  const scale = opts.scale ?? 0.5; // atlas px per CSS px: reflections are soft, half resolution is plenty
  const maxW = opts.maxWidth ?? 2048;
  const canvas: HTMLCanvasElement | OffscreenCanvas =
    typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(4, 4) : Object.assign(document.createElement('canvas'), { width: 4, height: 4 });
  let items: Item[] = [];
  let version = 0;
  const out: TypeFrame = {
    n: 0,
    rect: new Float32Array(TYPE_MAX * 4),
    uv: new Float32Array(TYPE_MAX * 4),
    col: new Float32Array(TYPE_MAX * 4),
    view: [1, 1],
    version: 0,
  };

  /** Rasterise every [data-reflect] line into the atlas (once; again after fonts load or a resize). */
  function refresh() {
    const els = Array.from(root.querySelectorAll<HTMLElement>('[data-reflect]'));
    // layout pass: each element's box at atlas scale, packed in rows
    const boxes = els.map((el) => {
      const r = el.getBoundingClientRect();
      return { el, w: Math.ceil(r.width * scale) + 4, h: Math.ceil(r.height * scale) + 4 };
    });
    let x = 0,
      y = 0,
      rowH = 0,
      W = 4;
    const placed: { el: HTMLElement; x: number; y: number; w: number; h: number }[] = [];
    for (const b of boxes) {
      if (b.w > maxW) b.w = maxW;
      if (x + b.w > maxW) {
        x = 0;
        y += rowH;
        rowH = 0;
      }
      placed.push({ el: b.el, x, y, w: b.w, h: b.h });
      x += b.w;
      rowH = Math.max(rowH, b.h);
      W = Math.max(W, x);
    }
    const H = Math.max(4, y + rowH);
    canvas.width = Math.min(maxW, Math.pow(2, Math.ceil(Math.log2(W))));
    canvas.height = Math.pow(2, Math.ceil(Math.log2(H)));
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff'; // coverage only; the line's colour is a uniform
    items = [];
    for (const p of placed) {
      const el = p.el;
      const cs = getComputedStyle(el);
      const er = el.getBoundingClientRect();
      const c2 = ctx as CanvasRenderingContext2D;
      c2.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize) * scale}px ${cs.fontFamily}`;
      if ('fontStretch' in c2) c2.fontStretch = stretchKeyword(cs);
      if ('letterSpacing' in c2) c2.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : `${parseFloat(cs.letterSpacing) * scale}px`;
      ctx.textBaseline = 'alphabetic';
      const fm = ctx.measureText('Hg');
      const asc = fm.fontBoundingBoxAscent ?? parseFloat(cs.fontSize) * scale * 0.9;
      const desc = fm.fontBoundingBoxDescent ?? parseFloat(cs.fontSize) * scale * 0.25;
      // every word where the DOM put it (so the line breaks, balance and tracking match)
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      for (let t = walker.nextNode() as Text | null; t; t = walker.nextNode() as Text | null) {
        const s = t.data;
        const re = /\S+/g;
        for (let m = re.exec(s); m; m = re.exec(s)) {
          range.setStart(t, m.index);
          range.setEnd(t, m.index + m[0].length);
          const rr = range.getClientRects()[0];
          if (!rr || rr.width === 0) continue;
          const gx = p.x + 2 + (rr.left - er.left) * scale;
          const gy = p.y + 2 + (rr.top - er.top) * scale + (rr.height * scale - (asc + desc)) / 2 + asc;
          ctx.fillText(m[0], gx, gy);
        }
      }
      items.push({ el, u: p.x / canvas.width, v: p.y / canvas.height, w: p.w / canvas.width, h: p.h / canvas.height, col: parseColor(cs.color) });
    }
    version++;
  }

  /** Per-frame uniforms: the lines on or near the screen, nearest first. */
  function frame(): TypeFrame {
    const vw = innerWidth,
      vh = innerHeight;
    out.view[0] = vw;
    out.view[1] = vh;
    let n = 0;
    for (const it of items) {
      if (n >= TYPE_MAX) break;
      const r = it.el.getBoundingClientRect();
      // a line can be reflected from just off screen (its reflection lies lower), so keep a screen of margin
      if (r.bottom < -vh * 0.25 || r.top > vh * 1.6 || r.width === 0) continue;
      const a = opacityOf(it.el, null);
      if (a <= 0.001) continue;
      const k = n * 4;
      // the atlas box has a 2 px (atlas) margin round the element's box
      const m = 2 / scale;
      out.rect[k] = r.left - m;
      out.rect[k + 1] = r.top - m;
      out.rect[k + 2] = r.width + 2 * m;
      out.rect[k + 3] = r.height + 2 * m;
      out.uv[k] = it.u;
      out.uv[k + 1] = it.v;
      out.uv[k + 2] = it.w;
      out.uv[k + 3] = it.h;
      out.col[k] = it.col[0];
      out.col[k + 1] = it.col[1];
      out.col[k + 2] = it.col[2];
      out.col[k + 3] = a;
      n++;
    }
    out.n = n;
    out.version = version;
    return out;
  }

  return { canvas, refresh, frame, get count() { return items.length; } };
}

/**
 * GLSL ES 3.00. Declares the uniforms and:
 * - `vec4 typeAt(vec2 px, float lod)`: premultiplied linear colour of display type at viewport CSS px (top-left
 *   origin), blurred by `lod` (atlas mip level; 0 sharp);
 * - `vec2 typeProject(vec3 d, vec3 camR, vec3 camU, vec3 camF, float focalPx, vec2 view)`: the viewport px a world
 *   direction points at (x < -1e4 when behind the camera). For a sea pixel, pass the reflected ray: the reflection of
 *   a line is `typeAt(typeProject(R, ...), lod) * fresnel`.
 */
export const TYPE_GLSL = /* glsl */ `
uniform sampler2D uTypeTex;
uniform vec4 uTypeRect[${TYPE_MAX}];
uniform vec4 uTypeUV[${TYPE_MAX}];
uniform vec4 uTypeCol[${TYPE_MAX}];
uniform int uTypeN;
vec4 typeAt(vec2 px, float lod){
  vec4 acc = vec4(0.0);
  for (int i = 0; i < ${TYPE_MAX}; i++){
    if (i >= uTypeN) break;
    vec4 r = uTypeRect[i];
    vec2 f = (px - r.xy) / r.zw;
    if (any(lessThan(f, vec2(0.0))) || any(greaterThan(f, vec2(1.0)))) continue;
    vec4 uv = uTypeUV[i];
    float a = textureLod(uTypeTex, uv.xy + f * uv.zw, lod).a * uTypeCol[i].a;
    acc += vec4(uTypeCol[i].rgb * a, a) * (1.0 - acc.a);
  }
  return acc;
}
vec2 typeProject(vec3 d, vec3 camR, vec3 camU, vec3 camF, float focalPx, vec2 view){
  float z = dot(d, camF);
  if (z <= 1e-4) return vec2(-1e5);
  return view * 0.5 + vec2(dot(d, camR), -dot(d, camU)) / z * focalPx;
}
`;

/** GL side: upload the atlas when its version changed, bind it to `unit`, set the per-line uniforms. */
export function typeUpload(
  gl: WebGL2RenderingContext,
  prog: WebGLProgram,
  state: { tex?: WebGLTexture; version?: number },
  atlas: TexImageSource | null,
  f: TypeFrame,
  unit = 7,
) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  if (!state.tex) {
    state.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, state.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  } else gl.bindTexture(gl.TEXTURE_2D, state.tex);
  if (atlas && state.version !== f.version) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.generateMipmap(gl.TEXTURE_2D);
    state.version = f.version;
  }
  const U = (n: string) => gl.getUniformLocation(prog, n);
  gl.uniform1i(U('uTypeTex'), unit);
  gl.uniform1i(U('uTypeN'), f.n);
  gl.uniform4fv(U('uTypeRect'), f.rect);
  gl.uniform4fv(U('uTypeUV'), f.uv);
  gl.uniform4fv(U('uTypeCol'), f.col);
}
