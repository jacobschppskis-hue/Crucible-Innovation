// Raw WebGL2 stage: transparent premultiplied canvas, perspective camera, depth, MSAA, per-object transforms.
import { FS, MATERIALS, VS, type MaterialName } from './materials';
import type { Mesh, Vec3 } from './geometry';

export type ObjectInit = {
  mesh?: Mesh;
  material?: MaterialName;
  position?: Vec3;
  /** Euler angles in radians, applied Z·Y·X. */
  rotation?: Vec3;
  scale?: Vec3 | number;
  /** Hot metal: 1 white-hot, .75 yellow, .5 orange, .25 deep red, 0 cooled bone. */
  temp?: number;
  /** Core: extra emissive, 0..1. */
  glow?: number;
  seed?: number;
  /** Noise cycles per object unit (coarse grain; the fine grain is ~9x that). */
  grain?: number;
  /** Flat artwork (white on black canvas) mapped on the +z face: centre x, y and size w, h in object units. A positive
   * strength raises it, a negative one cuts it in (a recessed stamp). */
  relief?: { canvas: HTMLCanvasElement | OffscreenCanvas; x: number; y: number; w: number; h: number; strength?: number };
  /** Seconds on the page clock, for materials that move (the hot bars' drifting crust). */
  time?: number;
  /** Cast metal: 0 bone (default) .. 1 dark cooled steel. */
  tone?: number;
  /** Cast metal: temper colours past this x, with strength. */
  temper?: [number, number];
  /** World-space clip plane [nx, ny, nz, d]: fragments with dot(world, n) > d are discarded. */
  clip?: [number, number, number, number];
  /** Hot metal: temperature per world unit of height (temp = temp + tgrad * y), for a heat gradient across objects. */
  tgrad?: number;
  /** Hot metal: this much cooler where the surface turns away from the eye (0..1; never below a glowing orange, so no
   * crust), so a stream or a drop reads as white at its heart and orange at its edges. */
  edge?: number;
  parent?: Obj;
  visible?: boolean;
};
export type Obj = Required<Pick<ObjectInit, 'position' | 'rotation' | 'temp' | 'glow' | 'seed' | 'grain' | 'visible'>> &
  Omit<ObjectInit, 'position' | 'rotation' | 'temp' | 'glow' | 'seed' | 'grain' | 'visible'> & { material: MaterialName; scale: Vec3 | number };

/** `css`: the canvas' CSS size when it has no layout of its own (an OffscreenCanvas in a worker); the owner updates it. */
export type StageOptions = { fov?: number; frame?: number; target?: Vec3; quality?: number; dpr?: number; exposure?: number; css?: { w: number; h: number };
  /** Full fidelity even on software GL (MSAA, bump normals): screenshots and stills. Off, software GL gets the cheap path. */
  fidelity?: boolean;
  /** Keep the canvas' drawing buffer at full size and scale an offscreen render target instead (blitted up to the canvas):
   * quality steps then never resize the canvas, which WebKit shows as a blank frame or more. */
  fixed?: boolean };
type Cv = HTMLCanvasElement | OffscreenCanvas;
export type Stage = {
  canvas: Cv;
  /** Software GL (SwiftShader, llvmpipe: no GPU): callers start at a low quality step. */
  soft: boolean;
  /** fov in degrees; `frame` = world units that fill the canvas height at the target depth; `target` = look-at point. */
  camera: { fov: number; frame: number; target: Vec3 };
  /** Render scale 0.3..1 (× devicePixelRatio): lower it on slow frames. */
  quality: number;
  exposure: number;
  add(o: ObjectInit): Obj;
  remove(o: Obj): void;
  /** Re-read the canvas' CSS size (call on resize; also done lazily in render). */
  resize(): void;
  render(): void;
  dispose(): void;
};

type M4 = number[];
const mul = (a: M4, b: M4): M4 => {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
};
function local(o: Obj): M4 {
  const [rx, ry, rz] = o.rotation, [x, y, z] = o.position;
  const s: Vec3 = typeof o.scale === 'number' ? [o.scale, o.scale, o.scale] : o.scale;
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  return [
    cz * cy * s[0], sz * cy * s[0], -sy * s[0], 0,
    (cz * sy * sx - sz * cx) * s[1], (sz * sy * sx + cz * cx) * s[1], cy * sx * s[1], 0,
    (cz * sy * cx + sz * sx) * s[2], (sz * sy * cx - cz * sx) * s[2], cy * cx * s[2], 0,
    x, y, z, 1,
  ];
}
const world = (o: Obj): M4 => (o.parent ? mul(world(o.parent), local(o)) : local(o));

// Software GL (SwiftShader / llvmpipe: no GPU) is told from a throwaway context before the real one is made, so the
// real one can skip MSAA and the shader its bump-normal taps (the dominant cost there); cached per realm.
let softGL: boolean | undefined;
function detectSoft(): boolean {
  if (softGL !== undefined) return softGL;
  softGL = false;
  try {
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1) : document.createElement('canvas');
    const g = c.getContext('webgl2') as WebGL2RenderingContext | null;
    if (g) {
      const ext = g.getExtension('WEBGL_debug_renderer_info');
      softGL = /swiftshader|llvmpipe|software|basic render/i.test(String(g.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : g.RENDERER)));
      g.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch { /* unknown: assume a GPU */ }
  return softGL;
}

export function createStage(canvas: Cv, opts: StageOptions = {}): Stage {
  const preSoft = !opts.fidelity && detectSoft();
  const fixed = !!opts.fixed;
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: !preSoft && !fixed, depth: !fixed, stencil: false, powerPreference: 'high-performance' }) as WebGL2RenderingContext | null;
  if (!gl) throw new Error('webgl2 unavailable');
  const sh = (t: number, src: string) => {
    const s = gl.createShader(t)!;
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    return s;
  };
  const prog = gl.createProgram()!;
  const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, preSoft ? FS.replace('precision highp float;', '#define SOFT\nprecision highp float;') : FS);
  gl.attachShader(prog, vs); gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, 'aP'); gl.bindAttribLocation(prog, 1, 'aN');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link');
  gl.useProgram(prog);
  const U: Record<string, WebGLUniformLocation | null> = {};
  for (const n of ['uM', 'uVP', 'uMat', 'uTone', 'uTemp', 'uGlow', 'uSeed', 'uGrain', 'uExp', 'uRel', 'uTemper', 'uEye', 'uTime', 'uRelP', 'uNM', 'uRelT', 'uClip', 'uTy', 'uEdge']) U[n] = gl.getUniformLocation(prog, n);

  const meshes = new WeakMap<Mesh, { vao: WebGLVertexArrayObject; bufs: WebGLBuffer[]; n: number; type: number }>();
  const texes = new WeakMap<object, WebGLTexture>();
  const owned: (WebGLBuffer | WebGLVertexArrayObject | WebGLTexture)[] = [];
  const upload = (m: Mesh) => {
    let g = meshes.get(m);
    if (g) return g;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const bufs: WebGLBuffer[] = [];
    [[m.p, 0], [m.n, 1]].forEach(([d, loc]) => {
      const b = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, d as Float32Array, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc as number); gl.vertexAttribPointer(loc as number, 3, gl.FLOAT, false, 0, 0);
      bufs.push(b);
    });
    const ib = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.i, gl.STATIC_DRAW);
    bufs.push(ib);
    owned.push(vao, ...bufs);
    g = { vao, bufs, n: m.i.length, type: m.i instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
    meshes.set(m, g);
    return g;
  };
  const tex = (c?: HTMLCanvasElement | OffscreenCanvas) => {
    let t = c && texes.get(c);
    if (t) return t;
    t = gl.createTexture()!;
    owned.push(t);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    if (c) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); gl.generateMipmap(gl.TEXTURE_2D); } // mips: small canvases would alias the lettering
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, c ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    if (c) texes.set(c, t);
    return t;
  };
  const blank = tex();
  // `fixed`: the render target (multisampled unless software GL) and, with MSAA, its single-sample resolve.
  const samples = fixed && !preSoft ? Math.min(4, Number(gl.getParameter(gl.MAX_SAMPLES)) || 0) : 0;
  const rt = { w: 0, h: 0, fbo: null as WebGLFramebuffer | null, rbs: [] as WebGLRenderbuffer[], res: null as WebGLFramebuffer | null };
  const dropTarget = () => {
    for (const r of rt.rbs) gl.deleteRenderbuffer(r);
    if (rt.fbo) gl.deleteFramebuffer(rt.fbo);
    if (rt.res) gl.deleteFramebuffer(rt.res);
    rt.rbs = []; rt.fbo = rt.res = null; rt.w = rt.h = 0;
  };
  const ensureTarget = (w: number, h: number) => {
    if (rt.fbo && rt.w === w && rt.h === h) return;
    dropTarget();
    const rb = (fmt: number, n: number) => {
      const r = gl.createRenderbuffer()!;
      gl.bindRenderbuffer(gl.RENDERBUFFER, r);
      if (n) gl.renderbufferStorageMultisample(gl.RENDERBUFFER, n, fmt, w, h);
      else gl.renderbufferStorage(gl.RENDERBUFFER, fmt, w, h);
      rt.rbs.push(r);
      return r;
    };
    rt.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb(gl.RGBA8, samples));
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb(gl.DEPTH_COMPONENT24, samples));
    if (samples) {
      rt.res = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, rt.res);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb(gl.RGBA8, 0));
    }
    rt.w = w; rt.h = h;
  };
  let objs: Obj[] = [];
  let disposed = false;
  const dprBase = () => opts.dpr ?? Math.min((typeof window === 'undefined' ? 1 : window.devicePixelRatio) || 1, 2);
  let soft = false;
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    soft = /swiftshader|llvmpipe|software|basic render/i.test(String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)));
  } catch { /* unknown: assume a GPU */ }
  const st: Stage = {
    canvas,
    soft,
    camera: { fov: opts.fov ?? 28, frame: opts.frame ?? 72, target: opts.target ?? [0, 0, 0] },
    quality: opts.quality ?? 1,
    exposure: opts.exposure ?? 1,
    add(init) {
      const o: Obj = { material: 'cast', scale: 1, ...init, position: init.position ?? [0, 0, 0], rotation: init.rotation ?? [0, 0, 0], temp: init.temp ?? 0, glow: init.glow ?? 1, seed: init.seed ?? 0, grain: init.grain ?? 0.35, visible: init.visible ?? true };
      objs.push(o);
      return o;
    },
    remove(o) { objs = objs.filter((x) => x !== o && x.parent !== o); },
    resize() {
      const s = dprBase() * (fixed ? 1 : Math.max(0.25, Math.min(1, st.quality)));
      const w = Math.max(1, Math.round((opts.css ? opts.css.w : (canvas as HTMLCanvasElement).clientWidth) * s)), h = Math.max(1, Math.round((opts.css ? opts.css.h : (canvas as HTMLCanvasElement).clientHeight) * s));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    },
    render() {
      if (disposed || gl.isContextLost()) return;
      st.resize();
      const W = canvas.width, H = canvas.height;
      const q = Math.max(0.25, Math.min(1, st.quality)), tw = fixed ? Math.max(1, Math.round(W * q)) : W, th = fixed ? Math.max(1, Math.round(H * q)) : H;
      if (fixed) ensureTarget(tw, th);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fixed ? rt.fbo : null);
      gl.viewport(0, 0, tw, th);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      const { fov, frame, target } = st.camera;
      const f = 1 / Math.tan((fov * Math.PI) / 360), dist = frame / 2 * f, asp = W / H;
      const eye: Vec3 = [target[0], target[1], target[2] + dist];
      const zn = dist * 0.2, zf = dist * 6;
      const P = [f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (zf + zn) / (zn - zf), -1, 0, 0, (2 * zf * zn) / (zn - zf), 0];
      const V = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -eye[0], -eye[1], -eye[2], 1];
      gl.uniformMatrix4fv(U.uVP, false, mul(P, V));
      gl.uniform3f(U.uEye, eye[0], eye[1], eye[2]);
      gl.uniform1f(U.uExp, st.exposure);
      gl.uniform1i(U.uRelT, 0);
      for (const o of objs) {
        if (!o.mesh || !o.visible) continue;
        let hidden = false;
        for (let p = o.parent; p; p = p.parent) if (!p.visible) hidden = true;
        if (hidden) continue;
        const M = world(o);
        const g = upload(o.mesh);
        gl.uniformMatrix4fv(U.uM, false, M);
        const nm: number[] = [];
        for (let c = 0; c < 3; c++) { const l = Math.hypot(M[c * 4], M[c * 4 + 1], M[c * 4 + 2]) || 1; nm.push(M[c * 4] / l, M[c * 4 + 1] / l, M[c * 4 + 2] / l); }
        gl.uniformMatrix3fv(U.uNM, false, nm);
        gl.uniform1i(U.uMat, MATERIALS[o.material]);
        gl.uniform4f(U.uClip, o.clip?.[0] ?? 0, o.clip?.[1] ?? 1, o.clip?.[2] ?? 0, o.clip?.[3] ?? 1e6); gl.uniform1f(U.uTy, o.tgrad ?? 0); gl.uniform1f(U.uEdge, o.edge ?? 0);
        gl.uniform1f(U.uTone, o.tone ?? 0); gl.uniform1f(U.uTemp, o.temp); gl.uniform1f(U.uGlow, o.glow); gl.uniform1f(U.uSeed, o.seed); gl.uniform1f(U.uGrain, o.grain);
        const r = o.relief, t = o.temper;
        gl.uniform1f(U.uRel, r ? r.strength ?? 1.2 : 0);
        gl.uniform4f(U.uRelP, r?.x ?? 0, r?.y ?? 0, r?.w ?? 1, r?.h ?? 1);
        gl.uniform1f(U.uTime, o.time ?? 0);
        gl.uniform2f(U.uTemper, t?.[0] ?? 1e4, t?.[1] ?? 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, r ? tex(r.canvas) : blank);
        gl.bindVertexArray(g.vao);
        gl.drawElements(gl.TRIANGLES, g.n, g.type, 0);
      }
      if (fixed) {
        // resolve the samples at the target's size, then scale it up onto the canvas
        let src = rt.fbo;
        if (rt.res) {
          gl.bindFramebuffer(gl.READ_FRAMEBUFFER, rt.fbo);
          gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, rt.res);
          gl.blitFramebuffer(0, 0, tw, th, 0, 0, tw, th, gl.COLOR_BUFFER_BIT, gl.NEAREST);
          src = rt.res;
        }
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
        gl.blitFramebuffer(0, 0, tw, th, 0, 0, W, H, gl.COLOR_BUFFER_BIT, tw === W && th === H ? gl.NEAREST : gl.LINEAR);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const x of owned) {
        if (x instanceof WebGLTexture) gl.deleteTexture(x);
        else if (x instanceof WebGLBuffer) gl.deleteBuffer(x);
        else gl.deleteVertexArray(x);
      }
      dropTarget();
      gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      objs = [];
    },
  };
  return st;
}
