// The mark in the world (integration by `world` of the mark role's lib/world/mark.ts + glsl/mark.glsl): the whole
// Split Ring hangs around the sun (its core IS the sun) at every distance, facing the camera, world-upright; the
// stronger-together beat runs on the `together` place's pin. Drawn in the `over` hook, depth-tested against the scene.
import type { Frame } from './frame';
import type { Uniforms } from './gl';
import { MARK_GLSL } from './glsl/mark';
import { facing, markFrame } from './mark';
import type { WorldModule } from './modules';
import { lineOpacity } from './together';

const CORE_R = 4.8; // mark units

let lines: HTMLElement[] = [];

export const markModule: WorldModule = {
  id: 'mark',
  hooks: ['over'],
  glsl:
    MARK_GLSL +
    /* glsl */ `
void mark_over(Ray r, Hit h, inout vec3 col){
  float t;
  vec4 m = markTrace(r.ro, r.rd, r.pa, t);
  if (m.a > 0.0 && t < h.t) col = mix(col, m.rgb, m.a);
}`,
  init({ root }) {
    lines = [...root.querySelectorAll<HTMLElement>('[data-together-line]')];
  },
  update(f: Frame, u: Uniforms) {
    const s = f.sun;
    const len = Math.hypot(...s.pos);
    const up: [number, number, number] = [s.pos[0] / len, s.pos[1] / len, s.pos[2] / len];
    const place = facing(s.pos, s.R / CORE_R, f.cam.pos, f.cam.r, up);
    const beat = f.at('together');
    const fr = markFrame({ place, beat, t: f.t, quality: f.quality.q });
    for (const [k, v] of Object.entries(fr.uniforms)) u.set(k, v as number[]);
    lines.forEach((el, i) => {
      const o = f.still ? (i === 2 ? 1 : 0) : lineOpacity(Math.min(i, 2), beat);
      el.style.opacity = o.toFixed(3);
    });
  },
};
