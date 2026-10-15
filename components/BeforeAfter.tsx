'use client';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { easeInOut, onceInView, prefersReducedMotion, tween } from '@/lib/motion';

type Props = { before: { src: string; alt: string }; after: { src: string; alt: string } };

/**
 * Drag to compare. Pointer drag anywhere on the image (vertical page scroll still works on touch);
 * a real range input underneath gives keyboard and screen reader control.
 */
export function BeforeAfter({ before, after }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const touched = useRef(false);

  const set = (pct: number) => {
    const v = Math.max(0, Math.min(100, pct));
    root.current!.style.setProperty('--pos', `${v}%`);
    input.current!.value = String(Math.round(v));
  };

  // One gentle sweep on first view, so it's obvious the handle moves.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let cancel = () => {};
    const stopObserving = onceInView(
      root.current!,
      () => (cancel = tween([50, 28, 70, 50], 2200, (v) => !touched.current && set(v), easeInOut, 300)),
      0.5,
    );
    return () => {
      stopObserving();
      cancel();
    };
  }, []);

  const fromPointer = (e: React.PointerEvent) => {
    const r = root.current!.getBoundingClientRect();
    set(((e.clientX - r.left) / r.width) * 100);
  };

  return (
    <div
      ref={root}
      className="group relative aspect-[5/4] touch-pan-y sm:aspect-[16/10] select-none overflow-hidden rounded-2xl border border-line-strong bg-ground-2 [--pos:50%]"
      onPointerDown={(e) => {
        touched.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        fromPointer(e);
      }}
      onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && fromPointer(e)}
    >
      <Image src={after.src} alt={after.alt} fill sizes="(min-width: 1280px) 1152px, 94vw" className="pointer-events-none object-cover object-top" draggable={false} />
      <div className="absolute inset-0 [clip-path:inset(0_calc(100%-var(--pos))_0_0)]">
        <Image src={before.src} alt={before.alt} fill sizes="(min-width: 1280px) 1152px, 94vw" className="pointer-events-none object-cover object-top" draggable={false} />
      </div>

      <span className="label pointer-events-none absolute left-3 top-3 rounded-full bg-ground/80 px-3 py-1.5 text-bone backdrop-blur sm:left-4 sm:top-4">Before</span>
      <span className="label pointer-events-none absolute right-3 top-3 rounded-full bg-ground/80 px-3 py-1.5 text-bone backdrop-blur sm:right-4 sm:top-4">After</span>

      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[var(--pos)] w-px -translate-x-1/2 bg-bone shadow-[0_0_12px_rgba(0,0,0,0.6)]">
        <div className="absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-bone/30 bg-ground/90 text-bone shadow-lg backdrop-blur transition-transform duration-200 group-active:scale-95 group-has-[input:focus-visible]:outline-2 group-has-[input:focus-visible]:outline-offset-2 group-has-[input:focus-visible]:outline-ember">
          <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.5 6 3.5 10l4 4M12.5 6l4 4-4 4" />
          </svg>
        </div>
      </div>

      <input
        ref={input}
        type="range"
        min={0}
        max={100}
        defaultValue={50}
        aria-label="Before and after comparison. Higher values show more of the old site."
        onInput={(e) => {
          touched.current = true;
          set(Number(e.currentTarget.value));
        }}
        className="sr-only"
      />
    </div>
  );
}
