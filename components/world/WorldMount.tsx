'use client';
import { useEffect } from 'react';

/**
 * Mounts the world (lib/world) behind the home page after load + idle, or at the visitor's first scroll, pointer move
 * or key, whichever comes first. The headline and nav never wait for it. Reduced motion gets the same world as a still
 * (redrawn only when the scroll moves); no JS / no WebGL keep the CSS still (World.css).
 */
/** True on software GL (no GPU). Probed once on a throwaway WebGL2 context, which is released at once. */
function softwareGL() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|software|basic render/i.test(name);
  } catch {
    return false;
  }
}

export function WorldMount() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-world-root]');
    if (!root) return;
    let stop: (() => void) | null = null;
    let dead = false;
    let started = false;
    const de = document.documentElement;
    de.setAttribute('data-world', '');
    window.dispatchEvent(new CustomEvent('crucible:world', { detail: { on: true } }));

    const go = async () => {
      if (started || dead) return;
      started = true;
      for (const e of EVENTS) removeEventListener(e, go);
      const { startWorld } = await import('@/lib/world');
      if (dead) return;
      stop = await startWorld(root);
      if (dead) stop?.();
    };
    const EVENTS = ['scroll', 'wheel', 'pointermove', 'pointerdown', 'touchstart', 'keydown'] as const;
    for (const e of EVENTS) addEventListener(e, go, { passive: true, once: true });
    // 2.5 s after load + idle when nobody has touched the page (a phone's first seconds), at once on first use. Without
    // a GPU (software GL: SwiftShader/llvmpipe, which is what Lighthouse and CI run) every frame is a long main-thread
    // task, so there it waits for real first use; the static still holds until then. Test/screenshot URLs
    // (?world=full, ?t=, ?q=, ?motion, ?still) start by themselves as before.
    const idle = () => {
      if (softwareGL() && !/[?&](world=full|t=|q=|motion|still)/.test(location.search)) return;
      (window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 200)))(() => setTimeout(go, 2500), { timeout: 1500 });
    };
    if (document.readyState === 'complete') idle();
    else addEventListener('load', idle, { once: true });

    return () => {
      dead = true;
      for (const e of EVENTS) removeEventListener(e, go);
      stop?.();
      de.removeAttribute('data-world');
      window.dispatchEvent(new CustomEvent('crucible:world', { detail: { on: false } }));
    };
  }, []);
  return null;
}
