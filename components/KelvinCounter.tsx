'use client';
import { useEffect, useRef } from 'react';
import { onceInView, prefersReducedMotion, tween } from '@/lib/motion';

const TARGET = 1811; // iron melts at 1811 K
const fmt = (n: number) => String(Math.round(n)).padStart(4, '0');

/** Mono readout that counts 0 K → 1811 K once, ease-out, when it scrolls into view. Renders 1811 without JS. */
export function KelvinCounter() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = ref.current!;
    el.textContent = fmt(0);
    let cancel = () => {};
    const stop = onceInView(el, () => (cancel = tween([0, TARGET], 2400, (v) => (el.textContent = fmt(v)))), 0.6);
    return () => {
      stop();
      cancel();
    };
  }, []);

  return (
    <span className="inline-flex items-baseline gap-2 font-mono tabular-nums">
      <span className="sr-only">1811 kelvin, the melting point of iron</span>
      <span aria-hidden ref={ref}>
        {TARGET}
      </span>
      <span aria-hidden className="text-bone-dim">K</span>
    </span>
  );
}
