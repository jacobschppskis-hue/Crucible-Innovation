'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { Work } from '@/data/work';

const INTERVAL = 4500;
const MAX_TILT = 6; // degrees

/** Floating browser window that crossfades through the showcase and tilts toward the cursor. */
export function BrowserFrame({ items }: { items: Work[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [loadRest, setLoadRest] = useState(false);
  const [auto, setAuto] = useState(true);
  const [hovered, setHovered] = useState(false);
  const loaded = useRef(new Set<number>());
  const current = items[index];

  // Cycle (not with reduced motion, not while hovered, not after the visitor picks one).
  useEffect(() => {
    if (!auto || hovered || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const next = (i: number) => {
      const n = (i + 1) % items.length;
      return loaded.current.has(n) ? n : i; // never fade to a screenshot that hasn't arrived
    };
    const id = setInterval(() => !document.hidden && setIndex(next), INTERVAL);
    return () => clearInterval(id);
  }, [auto, hovered, items.length]);

  // Fetch the other screenshots only after the first one (the likely LCP) is done.
  useEffect(() => {
    const id = setTimeout(() => setLoadRest(true), 1200);
    return () => clearTimeout(id);
  }, []);

  // Cursor tilt, max 6°. Mouse-only and motion-safe.
  useEffect(() => {
    if (!matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches) return;
    const el = ref.current!;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        const dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (innerWidth / 2)));
        const dy = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (innerHeight / 2)));
        el.style.setProperty('--ry', `${(dx * MAX_TILT).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${(-dy * MAX_TILT).toFixed(2)}deg`);
      });
    };
    addEventListener('pointermove', onMove, { passive: true });
    return () => {
      removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="[perspective:1400px]" onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
      <div
        ref={ref}
        className="relative transition-transform duration-700 ease-out [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))] [transform-style:preserve-3d]"
      >
        <div aria-hidden className="absolute -inset-x-8 -bottom-10 top-1/3 -z-10 rounded-[50%] bg-ember/15 blur-3xl" />
        <figure className="overflow-hidden rounded-2xl border border-line-strong bg-ground-2 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9),0_0_0_1px_rgba(0,0,0,0.4)]">
          <div className="flex h-9 items-center gap-3 border-b border-line px-3.5">
            <div className="flex gap-1.5" aria-hidden>
              <span className="size-2.5 rounded-full bg-bone/15" />
              <span className="size-2.5 rounded-full bg-bone/15" />
              <span className="size-2.5 rounded-full bg-bone/15" />
            </div>
            <div className="mx-auto flex h-5.5 min-w-0 max-w-[60%] flex-1 items-center justify-center rounded-md bg-bone/[0.05] px-3 font-mono text-[0.6875rem] text-bone-dim">
              <span className="truncate">yourbusiness.com</span>
            </div>
            <div className="w-[2.625rem]" aria-hidden />
          </div>
          <div className="relative aspect-[16/10]">
            {items.map((it, i) =>
              i === 0 || loadRest ? (
                <Image
                  key={it.slug}
                  src={it.image}
                  alt={it.alt}
                  fill
                  priority={i === 0}
                  onLoad={() => loaded.current.add(i)}
                  sizes="(min-width: 1024px) 600px, 92vw"
                  aria-hidden={i !== index}
                  className={`object-cover object-top transition-opacity duration-1000 ease-out ${i === index ? 'opacity-100' : 'opacity-0'}`}
                />
              ) : null,
            )}
          </div>
        </figure>
      </div>
      <div className="mt-5 flex items-center justify-between gap-4">
        <p className="label" aria-live="polite">
          Concept · {current.type}
        </p>
        <div className="flex gap-1" role="group" aria-label="Choose a concept site">
          {items.map((it, i) => (
            <button
              key={it.slug}
              type="button"
              aria-label={`Show ${it.type.toLowerCase()} concept`}
              aria-pressed={i === index}
              onClick={() => {
                setIndex(i);
                setAuto(false);
              }}
              className="group grid size-8 place-items-center rounded-full"
            >
              <span className={`h-1 rounded-full transition-all duration-500 ${i === index ? 'w-6 bg-bone' : 'w-3 bg-bone/25 group-hover:bg-bone/50'}`} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
