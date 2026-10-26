'use client';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { ease, reducedMotion } from '@/lib/scroll';

type Props = { before: { src: string; alt: string }; after: { src: string; alt: string } };

/**
 * Drag to compare. The handle follows the pointer on a spring (it glides rather than snapping), drag works
 * anywhere on the image while vertical page scroll still works on touch, and a real range input underneath
 * gives keyboard and screen reader control. Labels fade as the handle covers them.
 */
export function BeforeAfter({ before, after }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const state = useRef({ pos: 50, target: 50, raf: 0, touched: false });

  const paint = (v: number) => {
    root.current!.style.setProperty('--pos', `${v.toFixed(2)}%`);
    root.current!.style.setProperty('--posn', v.toFixed(2));
    input.current!.value = String(Math.round(v));
  };

  const glideTo = (target: number) => {
    const s = state.current;
    s.target = Math.max(0, Math.min(100, target));
    if (reducedMotion()) return paint((s.pos = s.target));
    if (s.raf) return;
    const step = () => {
      s.pos += (s.target - s.pos) * 0.22;
      if (Math.abs(s.target - s.pos) < 0.05) s.pos = s.target;
      paint(s.pos);
      s.raf = s.pos === s.target ? 0 : requestAnimationFrame(step);
    };
    s.raf = requestAnimationFrame(step);
  };

  // One gentle sweep the first time it's half in view, so it's obvious the handle moves.
  useEffect(() => {
    const el = root.current!;
    if (reducedMotion()) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const frames = [50, 26, 72, 50];
        const t0 = performance.now() + 350;
        const tick = (now: number) => {
          if (state.current.touched) return;
          const p = Math.max(0, Math.min(1, (now - t0) / 2600));
          const e2 = ease.inOut(p) * (frames.length - 1);
          const i = Math.min(frames.length - 2, Math.floor(e2));
          const v = frames[i] + (frames[i + 1] - frames[i]) * (e2 - i);
          state.current.pos = state.current.target = v;
          paint(v);
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  const fromPointer = (e: React.PointerEvent) => {
    const r = root.current!.getBoundingClientRect();
    glideTo(((e.clientX - r.left) / r.width) * 100);
  };

  return (
    <div
      ref={root}
      className="ba group relative aspect-[5/4] touch-pan-y select-none overflow-hidden rounded-2xl border border-line-strong bg-ground-2 [--pos:50%] sm:aspect-[16/10]"
      onPointerDown={(e) => {
        state.current.touched = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        root.current!.dataset.dragging = '';
        fromPointer(e);
      }}
      onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && fromPointer(e)}
      onPointerUp={() => delete root.current!.dataset.dragging}
      onPointerCancel={() => delete root.current!.dataset.dragging}
    >
      <Image src={after.src} alt={after.alt} fill sizes="(min-width: 1280px) 1152px, 94vw" className="pointer-events-none object-cover object-top" draggable={false} />
      <div className="absolute inset-0 [clip-path:inset(0_calc(100%-var(--pos))_0_0)]">
        <Image src={before.src} alt={before.alt} fill sizes="(min-width: 1280px) 1152px, 94vw" className="pointer-events-none object-cover object-top" draggable={false} />
      </div>

      <span className="ba-label-before label pointer-events-none absolute left-3 top-3 rounded-full bg-ground/80 px-3 py-1.5 text-bone backdrop-blur sm:left-4 sm:top-4">
        Before
      </span>
      <span className="ba-label-after label pointer-events-none absolute right-3 top-3 rounded-full bg-ground/80 px-3 py-1.5 text-bone backdrop-blur sm:right-4 sm:top-4">
        After
      </span>

      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[var(--pos)] w-px -translate-x-1/2 bg-bone shadow-[0_0_14px_rgba(0,0,0,0.6)]">
        <div className="ba-knob absolute left-1/2 top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-bone/30 bg-ground/85 text-bone shadow-[0_8px_30px_-6px_rgba(0,0,0,0.8)] backdrop-blur-md group-has-[input:focus-visible]:outline-2 group-has-[input:focus-visible]:outline-offset-2 group-has-[input:focus-visible]:outline-ember">
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
          state.current.touched = true;
          glideTo(Number(e.currentTarget.value));
        }}
        className="sr-only"
      />
    </div>
  );
}
