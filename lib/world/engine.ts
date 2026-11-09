// The world engine: one full-screen WebGL2 canvas behind the page, drawn on the site's one clock.
// Each frame: scroll -> journey channels -> camera and sun -> every module's update() -> the scene pass (the composed
// shader, into an offscreen HDR target at the quality step's scale) -> bloom -> the post pass into the canvas -> every
// module's after(). The canvas only resizes with the viewport, never for a quality step (WebKit blanks a resized canvas).

import { clock, clockHeld, onFrame, renderer } from '@/lib/liquid/loop';
import { cameraFrom, hitSea, project, rayAt, sunFrom, surf, surfOf } from './camera';
import { BLOOM_DOWN, BLOOM_UP, compose, type Composed } from './compose';
import { clamp, type Channels, type Frame, type PlaceInfo, type V3 } from './frame';
import { FULLSCREEN_VS, program, target, Uniforms, type Target } from './gl';
import { evaluate, keys as defaultKeys, LAP, lastSeg, mergeKeys, R, resolve, type Anchor, type Key } from './journey';
import { createScroll, type ScrollCtl } from './loop';
import { activeModules, MODULES, type WorldModule } from './modules';
import { createQuality, isSoftware, type QualityCtl } from './quality';

export type EngineOpts = {
  modules?: WorldModule[];
  keys?: () => Key[];
  /** Fixed clock (s) for the scene's time (?t=). */
  fixedT?: number | null;
  /** Pinned quality step (?q=). */
  q?: number | null;
  /** Top quality, full fidelity (?world=full). */
  full?: boolean;
  /** Reduced motion / ?still. */
  still?: boolean;
  /** Called if the world can't run (no WebGL2, shader error, context lost): the page keeps its still look. */
  onFail?: (why: string) => void;
};

export type Engine = {
  frame: Frame;
  scroll: ScrollCtl;
  composed: Composed;
  modules: WorldModule[];
  uniforms: Uniforms;
  /** Re-measure places and resolve the keys (after layout changes). */
  measure(): void;
  stop(): void;
};

const MAX_BLOOM = 5;

export async function createEngine(canvas: HTMLCanvasElement, root: HTMLElement, opts: EngineOpts = {}): Promise<Engine | null> {
  const fail = (why: string) => {
    console.warn('[world]', why);
    opts.onFail?.(why);
    return null;
  };
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  if (!gl) return fail('no WebGL2');
  const floatOk = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
  gl.getExtension('OES_texture_float_linear');
  const software = isSoftware(gl);
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const quality: QualityCtl = createQuality({ dpr, software, pinned: opts.q ?? null, full: opts.full, w: window.innerWidth, h: window.innerHeight, phone: Math.min(window.innerWidth, window.innerHeight) < 600 });

  const defines: Record<string, string | number> = { WORLD_R: R.toFixed(1) };
  if (!floatOk) defines.WORLD_LDR = 1;
  if (software) defines.WORLD_SOFTWARE = 1;
  if (opts.full) defines.WORLD_FULL = 1;
  let composed!: Composed;
  let sceneP!: WebGLProgram, postP!: WebGLProgram, downP: WebGLProgram, upP: WebGLProgram;

  // One module must never take the world down: if the composed shaders fail, drop the module(s) the errors point at
  // (their stand-ins come back), or, if the log names none, try without each module in turn; log what was dropped.
  const registry = opts.modules ?? MODULES;
  const dropped = new Set<string>();
  let mods = activeModules(registry);
  const build = () => {
    composed = compose(mods, { defines });
    sceneP = program(gl, FULLSCREEN_VS, composed.scene);
    postP = program(gl, FULLSCREEN_VS, composed.post);
  };
  for (let attempt = 0; ; attempt++) {
    try {
      build();
      break;
    } catch (e) {
      const msg = (e as Error).message;
      const ids = new Set(mods.map((m) => m.id));
      const blamed = [...new Set([...msg.matchAll(/^([a-z][\w-]*):\d+:/gm)].map((m) => m[1]).filter((id) => ids.has(id)))];
      let next: string[] = blamed.filter((id) => !mods.find((m) => m.id === id)?.isDefault);
      if (!next.length) {
        // nothing attributable (a link error): find the one module whose removal fixes it
        const cands = mods.filter((m) => !m.isDefault).map((m) => m.id);
        const fix = cands.find((id) => {
          try {
            const trial = activeModules(registry.filter((m) => !dropped.has(m.id) && m.id !== id));
            const c = compose(trial, { defines });
            program(gl, FULLSCREEN_VS, c.scene);
            program(gl, FULLSCREEN_VS, c.post);
            return true;
          } catch {
            return false;
          }
        });
        if (!fix) return fail(`shader: ${msg}`);
        next = [fix];
      }
      console.error(`[world] dropping module(s) ${next.join(', ')}: their shader does not compile\n${msg}`);
      for (const id of next) dropped.add(id);
      document.documentElement.setAttribute('data-world-dropped', [...dropped].join(' '));
      mods = activeModules(registry.filter((m) => !dropped.has(m.id)));
      if (attempt > 8) return fail(`shader: ${msg}`);
    }
  }
  // the crisp pass (small sharp things at the canvas's full resolution); if it can't compile, modules draw in the scene
  // pass as before (they see uCrispOn = 0 there)
  let crispP: WebGLProgram | null = null;
  if (composed.crisp) {
    try {
      crispP = program(gl, FULLSCREEN_VS, composed.crisp);
    } catch (e) {
      console.error('[world] crisp pass off: its shader does not compile\n' + (e as Error).message);
      document.documentElement.setAttribute('data-world-crisp-fail', '');
    }
  }
  try {
    downP = program(gl, FULLSCREEN_VS, BLOOM_DOWN);
    upP = program(gl, FULLSCREEN_VS, BLOOM_UP);
  } catch (e) {
    return fail(`shader: ${(e as Error).message}`);
  }
  const extras: Channels = {};
  for (const m of mods) Object.assign(extras, m.channels ?? {});
  const vao = gl.createVertexArray();
  const u = new Uniforms(gl);

  for (const m of mods) {
    try {
      await m.init?.({ gl, u, root, software });
    } catch (e) {
      console.warn(`[world] ${m.id}.init failed`, e);
    }
  }

  const still = !!opts.still;
  const scroll = await createScroll({ still });

  // ---- places and keys ----
  const places: Record<string, PlaceInfo> = {};
  let anchors: Anchor[] = [];
  let W = window.innerWidth,
    H = window.innerHeight,
    narrow = false;
  // a place's pin length: from its top at the viewport top to its bottom at the viewport bottom; a place barely taller
  // than the viewport (or shorter) runs over 80% of its own height instead, so its keys never collapse into a cut
  const span = (p: PlaceInfo) => {
    const pin = p.h - H;
    return Math.max(pin >= 0.5 * H ? pin : Math.max(pin, 0.8 * p.h), 1);
  };
  const pinY = (name: string, f: number) => {
    const p = places[name];
    return p ? p.top + f * span(p) : null;
  };
  function measure() {
    W = window.innerWidth;
    H = window.innerHeight;
    narrow = W < 761 || (W < 900 && H > W);
    scroll.measure();
    const sy = window.scrollY;
    for (const k of Object.keys(places)) delete places[k];
    for (const el of root.querySelectorAll<HTMLElement>('[data-place]')) {
      const r = el.getBoundingClientRect();
      const name = el.dataset.place!,
        top = r.top + sy,
        old = places[name];
      // a place may be marked on several elements (a heading and its text): it spans all of them
      if (old) {
        const bot = Math.max(old.top + old.h, top + r.height);
        old.top = Math.min(old.top, top);
        old.h = bot - old.top;
      } else places[name] = { name, top, h: r.height, el };
    }
    anchors = resolve(mergeKeys((opts.keys ?? defaultKeys)(), mods), pinY, H, narrow, extras);
    resizeCanvas();
  }

  // ---- render targets ----
  let sceneT: Target | null = null;
  let crispT: Target | null = null;
  let bloom: Target[] = [];
  let cw = 0,
    ch = 0;
  function resizeCanvas() {
    // the canvas holds the crisp pass, so it goes to the screen's real resolution: phones up to dpr 3, others 2
    const s = Math.min(dpr, narrow ? 3 : 2);
    const w = Math.max(2, Math.round(W * s)),
      h = Math.max(2, Math.round(H * s));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    cw = w;
    ch = h;
    if (crispP) crispT = target(gl!, w, h, floatOk, crispT ?? undefined);
    resizeTargets();
  }
  function resizeTargets() {
    const [w, h] = quality.size(W, H);
    sceneT = target(gl!, w, h, floatOk, sceneT ?? undefined);
    const nb = quality.q < 0.3 ? 0 : MAX_BLOOM;
    const next: Target[] = [];
    let bw = w,
      bh = h;
    for (let i = 0; i < nb; i++) {
      bw = Math.max(1, bw >> 1);
      bh = Math.max(1, bh >> 1);
      next.push(target(gl!, bw, bh, floatOk, bloom[i]));
    }
    for (let i = nb; i < bloom.length; i++) {
      gl!.deleteFramebuffer(bloom[i].fb);
      gl!.deleteTexture(bloom[i].tex);
    }
    bloom = next;
  }

  // ---- pointer (raw; lava's input.ts keeps its own richer trails) ----
  const pointer = { x: -1, y: -1, active: false, down: false, touch: false, lastMove: -10 };
  const onPtr = (e: PointerEvent) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.touch = e.pointerType === 'touch';
    pointer.active = true;
    pointer.lastMove = clock.t;
    if (e.type === 'pointerdown') pointer.down = true;
    if (e.type === 'pointerup' || e.type === 'pointercancel') {
      pointer.down = false;
      if (pointer.touch) pointer.active = false;
    }
  };
  const onLeave = () => ((pointer.active = false), (pointer.down = false));
  for (const t of ['pointermove', 'pointerdown', 'pointerup', 'pointercancel'] as const) addEventListener(t, onPtr, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);

  // ---- the frame every module sees ----
  const chv: Channels = {};
  const f: Frame = {
    t: 0,
    dt: 0,
    frame: 0,
    w: W,
    h: H,
    dpr,
    narrow,
    still,
    scroll: 0,
    scrollTarget: 0,
    loopLen: 0,
    laps: 0,
    y: 0,
    progress: 0,
    place: { name: 'hero', f: 0 },
    at: (name) => {
      const p = places[name];
      if (!p) return 0;
      return clamp((f.y - p.top) / span(p));
    },
    places,
    ch: chv,
    cam: cameraFrom(R, { s: 0, h: 2 }, W, H),
    R,
    sun: { pos: [0, 0, 0], dir: [0, 0, -1], dist: 1, R: 1, rad: 0.02 },
    quality,
    pointer,
    rayAt: (x, y) => rayAt(f.cam, f.w, f.h, x, y),
    hitSea: (x, y) => hitSea(R, f.cam, f.w, f.h, x, y),
    project: (p: V3) => project(f.cam, f.w, f.h, p),
    surf: (uu, v, y = 0) => surf(R, uu, v, y),
    surfOf: (p) => surfOf(R, p),
  };

  const fixedT = opts.fixedT ?? (still ? 6 : null);
  const rend = renderer('world', 'main');
  let lastKey = '';
  let dead = false;

  function update(t: number, dt: number) {
    f.t = fixedT ?? t;
    f.dt = fixedT != null ? 0 : dt;
    f.frame++;
    f.w = W;
    f.h = H;
    f.narrow = narrow;
    const L = scroll.loopLen;
    f.loopLen = L;
    f.scroll = scroll.scroll;
    f.scrollTarget = scroll.target;
    f.laps = L > 0 ? Math.floor(f.scroll / L) : 0;
    f.y = L > 0 ? f.scroll - f.laps * L : f.scroll;
    f.progress = L > 0 ? f.y / L : clamp(f.y / Math.max(document.documentElement.scrollHeight - H, 1));
    // the place under the viewport's middle (or the last one passed, between places)
    let pl = 'hero',
      pf = 0,
      best = -Infinity;
    const mid = f.y + H * 0.5;
    for (const p of Object.values(places))
      if (mid >= p.top && p.top > best) {
        best = p.top;
        pl = p.name;
        pf = clamp((f.y - p.top) / span(p));
      }
    f.place.name = pl;
    f.place.f = pf;
    evaluate(anchors, f.y, chv);
    chv.s += f.laps * LAP;
    cameraFrom(R, chv, W, H, f.cam);
    Object.assign(f.sun, sunFrom(R, lastSeg.a, lastSeg.b, lastSeg.e, f.cam, f.laps * LAP));
  }

  function engineUniforms() {
    const c = f.cam;
    const sc = sceneT!;
    u.set('uRes', [sc.w, sc.h]);
    u.set('uView', [W, H]);
    u.set('uPx', W / sc.w);
    u.set('uTime', f.t);
    u.set('uDt', f.dt);
    u.set('uCamPos', c.pos);
    u.set('uCam', [...c.r, ...c.u, ...c.f]);
    u.set('uFocal', c.focal * (sc.h / H));
    u.set('uR', R);
    u.set('uCamH', c.h);
    u.set('uCamUp', c.up);
    u.set('uSunDir', f.sun.dir);
    u.set('uSunRad', f.sun.rad);
    u.set('uSunPos', f.sun.pos);
    u.set('uSunR', f.sun.R);
    u.set('uExposure', chv.exposure ?? 0);
    u.set('uQuiet', chv.quiet ?? 0);
    u.set('uProgress', f.progress);
    u.set('uQ', quality.q);
    u.set('uStep', quality.step);
    u.set('uStill', still ? 1 : 0);
    u.set('uPtr', [pointer.x, pointer.y, pointer.active ? 1 : 0, pointer.down ? 1 : 0]);
  }

  const crispMods = mods.filter((m) => m.hooks?.includes('crisp'));
  function crispBox(): [number, number, number, number] | null {
    if (!crispP || !crispT) return null;
    let b: [number, number, number, number] | null = null;
    for (const m of crispMods) {
      let r: [number, number, number, number] | null = null;
      try {
        r = m.crispBox ? m.crispBox(f) : [0, 0, W, H];
      } catch (e) {
        console.warn(`[world] ${m.id}.crispBox`, e);
      }
      if (!r || r[2] <= r[0] || r[3] <= r[1]) continue;
      b = b ? [Math.min(b[0], r[0]), Math.min(b[1], r[1]), Math.max(b[2], r[2]), Math.max(b[3], r[3])] : [...r];
    }
    if (!b) return null;
    b = [Math.max(0, b[0]), Math.max(0, b[1]), Math.min(W, b[2]), Math.min(H, b[3])];
    return b[2] > b[0] && b[3] > b[1] ? b : null;
  }
  function drawCrisp() {
    const g = gl!;
    const b = crispBox();
    if (!b || !crispP || !crispT) return false;
    const k = cw / W;
    const x0 = Math.floor(b[0] * k),
      x1 = Math.ceil(b[2] * k),
      y0 = Math.floor((H - b[3]) * k),
      y1 = Math.ceil((H - b[1]) * k);
    g.bindFramebuffer(g.FRAMEBUFFER, crispT.fb);
    g.viewport(0, 0, cw, ch);
    g.clearColor(0, 0, 0, 0);
    g.clear(g.COLOR_BUFFER_BIT);
    g.enable(g.SCISSOR_TEST);
    g.scissor(x0, y0, x1 - x0, y1 - y0);
    g.useProgram(crispP);
    u.bindAll();
    u.bindTex('uSceneT', sceneT!.tex, 3);
    // the camera at the canvas's resolution
    const sc = sceneT!;
    u.set('uRes', [cw, ch]);
    u.set('uPx', W / cw);
    u.set('uFocal', f.cam.focal * (ch / H));
    u.set('uCrispOn', 1);
    u.apply(crispP);
    g.drawArrays(g.TRIANGLES, 0, 3);
    g.disable(g.SCISSOR_TEST);
    // back to the scene's for everything after
    u.set('uRes', [sc.w, sc.h]);
    u.set('uPx', W / sc.w);
    u.set('uFocal', f.cam.focal * (sc.h / H));
    return true;
  }

  function draw() {
    const g = gl!;
    g.bindVertexArray(vao);
    g.disable(g.BLEND);
    // scene (modules that also draw crisp skip their primary view here when uCrispOn is 1)
    u.set('uCrispOn', crispBox() ? 1 : 0);
    g.bindFramebuffer(g.FRAMEBUFFER, sceneT!.fb);
    g.viewport(0, 0, sceneT!.w, sceneT!.h);
    g.useProgram(sceneP);
    u.bindAll();
    u.apply(sceneP);
    g.drawArrays(g.TRIANGLES, 0, 3);
    // bloom: down chain from the scene, then up, adding into each larger level
    if (bloom.length) {
      g.useProgram(downP);
      let src = sceneT!;
      for (let i = 0; i < bloom.length; i++) {
        const dst = bloom[i];
        g.bindFramebuffer(g.FRAMEBUFFER, dst.fb);
        g.viewport(0, 0, dst.w, dst.h);
        u.bindTex('uSrc', src.tex, 0);
        u.set('uTexel', [1 / src.w, 1 / src.h]);
        u.set('uFirst', i === 0 ? 1 : 0);
        u.set('uThresh', (u.get('look_uBloomThresh') as number | undefined) ?? 1.0);
        u.apply(downP);
        g.drawArrays(g.TRIANGLES, 0, 3);
        src = dst;
      }
      g.useProgram(upP);
      g.enable(g.BLEND);
      g.blendFunc(g.ONE, g.ONE);
      for (let i = bloom.length - 1; i > 0; i--) {
        const s = bloom[i],
          dst = bloom[i - 1];
        g.bindFramebuffer(g.FRAMEBUFFER, dst.fb);
        g.viewport(0, 0, dst.w, dst.h);
        u.bindTex('uSrc', s.tex, 0);
        u.set('uTexel', [1 / s.w, 1 / s.h]);
        u.apply(upP);
        g.drawArrays(g.TRIANGLES, 0, 3);
      }
      g.disable(g.BLEND);
    }
    // the crisp pass: over the union of the modules' boxes, at the canvas's resolution
    const crispOn = drawCrisp();
    // post into the canvas
    g.bindFramebuffer(g.FRAMEBUFFER, null);
    g.viewport(0, 0, cw, ch);
    g.useProgram(postP);
    u.bindAll();
    u.bindTex('uScene', sceneT!.tex, 0);
    u.bindTex('uBloom', (bloom[0] ?? sceneT!).tex, 1);
    u.set('uCanvas', [cw, ch]);
    u.set('uBloomOn', bloom.length ? 1 : 0);
    if (crispOn) u.bindTex('uCrisp', crispT!.tex, 2);
    u.set('uCrispOn', crispOn ? 1 : 0);
    u.apply(postP);
    g.drawArrays(g.TRIANGLES, 0, 3);
  }

  // software GL (no GPU: CI, Lighthouse): draw at most ~12 fps so the main thread keeps breathing
  let lastDraw = -1;
  let lastScroll = 0;
  function tick(t: number, dt: number) {
    if (dead) return;
    if (software && !opts.full && fixedT == null && !clockHeld() && t - lastDraw < 1 / 12 && lastDraw >= 0) {
      rend.done(t);
      return;
    }
    lastDraw = t;
    update(t, dt);
    // a still page draws only when something changed
    if (still) {
      const key = `${Math.round(f.scroll)}|${W}|${H}|${quality.step}`;
      if (key === lastKey) {
        rend.done(t);
        return;
      }
      lastKey = key;
    }
    for (const m of mods) {
      try {
        m.update?.(f, u);
      } catch (e) {
        console.warn(`[world] ${m.id}.update`, e);
      }
    }
    engineUniforms();
    draw();
    for (const m of mods) m.after?.(f);
    rend.done(t);
    const moving = Math.abs(f.scroll - lastScroll) > 0.5;
    lastScroll = f.scroll;
    if (quality.feed(dt, moving)) resizeTargets();
  }

  measure();
  const ro = new ResizeObserver(() => measure());
  ro.observe(root);
  addEventListener('resize', measure);
  const offFrame = onFrame(tick);

  const lost = (e: Event) => {
    e.preventDefault();
    dead = true;
    fail('context lost');
  };
  canvas.addEventListener('webglcontextlost', lost);

  const engine: Engine = {
    frame: f,
    scroll,
    composed,
    modules: mods,
    uniforms: u,
    measure,
    stop() {
      dead = true;
      offFrame();
      rend.off();
      ro.disconnect();
      removeEventListener('resize', measure);
      for (const t of ['pointermove', 'pointerdown', 'pointerup', 'pointercancel'] as const) removeEventListener(t, onPtr);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('webglcontextlost', lost);
      for (const m of mods) m.dispose?.();
      scroll.destroy();
      u.dispose();
    },
  };
  return engine;
}
