// Tiny WebGL2 helpers for the world: programs (with errors mapped back to the module that wrote the line), a uniform
// sink modules write into by name, textures and render targets.

export type Source = { text: string; /** [first line, module id] in the composed source */ map: [number, string][] };

export class ShaderError extends Error {}

function where(map: [number, string][], line: number) {
  let id = '?',
    first = 1;
  for (const [l, m] of map) if (l <= line) (id = m), (first = l);
  return `${id}:${line - first + 1}`;
}

function compile(gl: WebGL2RenderingContext, type: number, src: Source) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src.text);
  gl.compileShader(sh);
  return sh;
}

/** Compiles and links. On failure throws with each error line labelled `module:line`. */
export function program(gl: WebGL2RenderingContext, vs: Source, fs: Source): WebGLProgram {
  const v = compile(gl, gl.VERTEX_SHADER, vs),
    f = compile(gl, gl.FRAGMENT_SHADER, fs);
  const p = gl.createProgram()!;
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const msgs: string[] = [];
    for (const [sh, src] of [
      [v, vs],
      [f, fs],
    ] as const) {
      const log = gl.getShaderInfoLog(sh) || '';
      for (const ln of log.split('\n')) {
        const m = /ERROR:\s*\d+:(\d+):(.*)/.exec(ln);
        if (m) msgs.push(`${where(src.map, +m[1])}:${m[2]}  | ${src.text.split('\n')[+m[1] - 1]?.trim()}`);
        else if (ln.trim()) msgs.push(ln);
      }
    }
    msgs.push(gl.getProgramInfoLog(p) || '');
    throw new ShaderError(msgs.filter(Boolean).join('\n'));
  }
  gl.deleteShader(v);
  gl.deleteShader(f);
  return p;
}

export type UValue = number | boolean | ArrayLike<number>;

type TexEntry = { tex: WebGLTexture; unit: number; ver: unknown };

/** Uniform values by name, applied to a program each frame. Unknown names are ignored (a module's uniform the
 * compiler optimised away is fine). */
export class Uniforms {
  private vals = new Map<string, UValue>();
  private locs = new Map<WebGLProgram, Map<string, { loc: WebGLUniformLocation; type: number; size: number }>>();
  private texs = new Map<string, TexEntry>();
  private nextUnit = 4; // units 0..3 are the engine's own
  constructor(private gl: WebGL2RenderingContext) {}

  /** Set a uniform: number, boolean, vecN/matN/array as an array (flattened, column-major for matrices). */
  set(name: string, v: UValue) {
    this.vals.set(name, v);
  }

  get(name: string) {
    return this.vals.get(name);
  }

  /**
   * Bind a texture to a sampler uniform. `ver` is anything that changes when the source changes (re-uploaded then);
   * `src` is a canvas/image/ImageBitmap or {w, h, data, format} (data: Uint8Array RGBA8 or Float32Array RGBA32F /
   * Uint16Array RGBA16F). Options: linear filter (default), repeat wrap, mipmaps.
   */
  tex(
    name: string,
    src: TexImageSource | { w: number; h: number; data: ArrayBufferView; format?: 'rgba8' | 'rgba16f' | 'rgba32f' | 'r8' | 'rg16f' },
    ver: unknown = 0,
    opt: { linear?: boolean; repeat?: boolean; mips?: boolean } = {},
  ) {
    const gl = this.gl;
    let e = this.texs.get(name);
    if (!e) {
      e = { tex: gl.createTexture()!, unit: this.nextUnit++, ver: Symbol('new') };
      this.texs.set(name, e);
    }
    if (e.ver !== ver) {
      e.ver = ver;
      gl.activeTexture(gl.TEXTURE0 + e.unit);
      gl.bindTexture(gl.TEXTURE_2D, e.tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      if ('data' in src && 'w' in src) {
        const f = src.format ?? 'rgba8';
        const [ifmt, fmt, type] =
          f === 'rgba32f'
            ? [gl.RGBA32F, gl.RGBA, gl.FLOAT]
            : f === 'rgba16f'
              ? [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT]
              : f === 'rg16f'
                ? [gl.RG16F, gl.RG, gl.HALF_FLOAT]
                : f === 'r8'
                  ? [gl.R8, gl.RED, gl.UNSIGNED_BYTE]
                  : [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE];
        gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, src.w, src.h, 0, fmt, type, src.data);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src as TexImageSource);
      }
      const lin = opt.linear !== false;
      if (opt.mips) gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opt.mips ? gl.LINEAR_MIPMAP_LINEAR : lin ? gl.LINEAR : gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, lin ? gl.LINEAR : gl.NEAREST);
      const wrap = opt.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    }
    this.vals.set(name, e.unit);
  }

  /** Raw texture handle bound to a unit under a sampler name (render targets the engine owns). */
  bindTex(name: string, tex: WebGLTexture, unit: number) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    this.vals.set(name, unit);
  }

  /** Re-binds every module texture to its unit (call before a draw that samples them). */
  bindAll() {
    const gl = this.gl;
    for (const e of this.texs.values()) {
      gl.activeTexture(gl.TEXTURE0 + e.unit);
      gl.bindTexture(gl.TEXTURE_2D, e.tex);
    }
  }

  apply(p: WebGLProgram) {
    const gl = this.gl;
    let m = this.locs.get(p);
    if (!m) {
      m = new Map();
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i)!;
        const nm = info.name.replace(/\[0\]$/, '');
        const loc = gl.getUniformLocation(p, info.name);
        if (loc) m.set(nm, { loc, type: info.type, size: info.size });
      }
      this.locs.set(p, m);
    }
    for (const [name, { loc, type }] of m) {
      const v = this.vals.get(name);
      if (v === undefined) continue;
      const a = typeof v === 'number' ? [v] : typeof v === 'boolean' ? [v ? 1 : 0] : (v as ArrayLike<number>);
      const f = a instanceof Float32Array ? a : new Float32Array(a as ArrayLike<number>);
      switch (type) {
        case gl.FLOAT: gl.uniform1fv(loc, f); break;
        case gl.FLOAT_VEC2: gl.uniform2fv(loc, f); break;
        case gl.FLOAT_VEC3: gl.uniform3fv(loc, f); break;
        case gl.FLOAT_VEC4: gl.uniform4fv(loc, f); break;
        case gl.FLOAT_MAT2: gl.uniformMatrix2fv(loc, false, f); break;
        case gl.FLOAT_MAT3: gl.uniformMatrix3fv(loc, false, f); break;
        case gl.FLOAT_MAT4: gl.uniformMatrix4fv(loc, false, f); break;
        case gl.INT: case gl.BOOL: case gl.SAMPLER_2D: case gl.SAMPLER_3D: case gl.SAMPLER_2D_ARRAY:
          gl.uniform1iv(loc, Int32Array.from(a as ArrayLike<number>, (x) => Math.round(x))); break;
        case gl.INT_VEC2: gl.uniform2iv(loc, Int32Array.from(a as ArrayLike<number>)); break;
        case gl.INT_VEC3: gl.uniform3iv(loc, Int32Array.from(a as ArrayLike<number>)); break;
        case gl.INT_VEC4: gl.uniform4iv(loc, Int32Array.from(a as ArrayLike<number>)); break;
        default: break;
      }
    }
  }

  dispose() {
    for (const e of this.texs.values()) this.gl.deleteTexture(e.tex);
    this.texs.clear();
  }
}

export type Target = { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number };

/** A colour render target (RGBA16F when float rendering is available, else RGBA8). */
export function target(gl: WebGL2RenderingContext, w: number, h: number, float: boolean, old?: Target): Target {
  if (old && old.w === w && old.h === h) return old;
  if (old) {
    gl.deleteFramebuffer(old.fb);
    gl.deleteTexture(old.tex);
  }
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, float ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fb, tex, w, h };
}

export const FULLSCREEN_VS: Source = {
  text: `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`,
  map: [[1, 'vs']],
};
