'use client';
import { useEffect } from 'react';

/**
 * Mounts the world (lib/world) behind the home page after load + idle, or at the visitor's first scroll, pointer move
 * or key, whichever comes first. The headline and nav never wait for it. Reduced motion gets the same world as a still
 * (redrawn only when the scroll moves); no JS / no WebGL keep the CSS still (World.css).
 */
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
    const idle = () => (window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 200)))(go, { timeout: 1500 });
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
