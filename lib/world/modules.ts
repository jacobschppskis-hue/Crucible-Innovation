// The module registry: every feature of the world is one module, registered here with one line.
// Order matters only for GLSL (a module may call functions of modules above it) and for hooks (called in this order).
// See ARCHITECTURE.md for the contract. Defaults (lib/world/defaults) stand in for `look` and `lava` until they land:
// a default is dropped as soon as a module below it provides the same function.

import type { Channels, Frame } from './frame';
import type { Uniforms } from './gl';
import { defaultLook } from './defaults/look';
import { defaultLava } from './defaults/lava';

/** GLSL hooks a module can implement (named `<id>_<hook>`; signatures in ARCHITECTURE.md). */
export type Hook = 'sky' | 'hit' | 'shade' | 'env' | 'sea' | 'over';
/** Single-provider functions (one module defines each; defaults otherwise). */
export type Provide = 'look_sky' | 'look_atmo' | 'look_post' | 'lava_shade' | 'lava_env';

export type InitCtx = {
  gl: WebGL2RenderingContext;
  u: Uniforms;
  /** The page root startWorld() was given (sections with data-place are inside it). */
  root: HTMLElement;
  /** Software GL (no GPU): keep init cheap. */
  software: boolean;
};

export type WorldModule = {
  /** Lowercase id; every GLSL function and uniform of the module starts with `<id>_`. */
  id: string;
  /** Fragment GLSL for the scene pass: uniforms + functions (no `#version`, no `precision`, no `main`). */
  glsl?: string;
  hooks?: Hook[];
  provides?: Provide[];
  /** GLSL for the post pass (only the module providing look_post): defines `vec3 look_post(vec2 uv, vec2 fc)`. */
  post?: string;
  /** Journey channels this module reads, with defaults (`'<id>.<name>': value`). Keys may set them. */
  channels?: Channels;
  /** Once, after the GL context exists (textures, atlases). May be async (fonts). */
  init?(ctx: InitCtx): void | Promise<void>;
  /** Every frame, before drawing: write uniforms (`u.set('<id>_uName', v)`), and DOM if the module owns some. */
  update?(f: Frame, u: Uniforms): void;
  /** After the frame is drawn (DOM writes that must follow the frame's layout reads). */
  after?(f: Frame): void;
  dispose?(): void;
  /** Internal: a stand-in, dropped when a later module provides the same functions. */
  isDefault?: boolean;
};

// ---- the registry: one line per module ------------------------------------------------------------------------------
export const MODULES: WorldModule[] = [
  ...defaultLook, // world: stand-ins for look_sky, look_atmo, look_post
  ...defaultLava, // world: stand-ins for lava_shade, lava_env
  // look:     import { look } from './look';         look,
  // lava:     import { lava } from './lava';         lava,
  // mark:     import { mark } from './mark';         mark,
  // together: import { together } from './together'; together,
  // paypal:   import { paypal } from './paypal';     paypal,
  // ventures: import { ventures } from './ventures'; ventures,
  // thesis:   import { thesis } from './thesis';     thesis,
];

/** The registry with stand-ins replaced (a stand-in goes when another module provides its function). */
export function activeModules(list: WorldModule[] = MODULES): WorldModule[] {
  const provided = new Set<string>();
  for (const m of list) if (!m.isDefault) for (const p of m.provides ?? []) provided.add(p);
  // each stand-in provides exactly one function
  return list.filter((m) => !m.isDefault || !(m.provides ?? []).some((p) => provided.has(p)));
}
