'use client';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { reducedMotion } from '@/lib/scroll';
import './BeforeAfter.css';

type Props = { before: { src: string; alt: string }; after: { src: string; alt: string } };

// The demo the first time it comes into view: from the centre the divider swings to show most of the old site, then
// most of the new one, and settles back in the centre, where both are in view. [ms to get there, position].
const DEMO: [number, number][] = [
  [450, 50], // a beat on screen first
  [1300, 80],
  [180, 80],
  [2000, 20],
  [180, 20],
  [1300, 50],
];
const sine = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2;
const clamp = (v: number) => Math.max(0, Math.min(100, v));

/**
 * Same business, different decade. The divider rests in the centre (also without JS and with reduced motion). The
 * first time it is in view it sweeps to one side, then the other, and comes back to the centre; after that it is
 * the visitor's: drag anywhere on the image (vertical page scroll still works on touch), or use the arrow keys on the
 * range input underneath (its focus ring is drawn on the handle). The divider is the hot front: Ember while it
 * moves, cooling to bone when it stops. Labels fade as the handle covers them.
 */
export function BeforeAfter({ before, after }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const state = useRef({ pos: 50, target: 50, raf: 0, demo: 0, cool: 0, touched: false });

  const paint = (v: number) => {
    const el = root.current!;
    el.style.setProperty('--pos', `${v.toFixed(2)}%`);
    el.style.setProperty('--posn', v.toFixed(2));
    input.current!.value = String(Math.round(v));
  };

  // Hot while it moves; cools a moment after it stops.
  const heat = () => {
    const s = state.current;
    root.current!.dataset.hot = '';
    clearTimeout(s.cool);
    s.cool = window.setTimeout(() => delete root.current?.dataset.hot, 260);
  };

  // The visitor takes over: the demo stops where it is and the handle glides to them.
  const take = () => {
    const s = state.current;
    s.touched = true;
    cancelAnimationFrame(s.demo);
    s.demo = 0;
    delete root.current!.dataset.demo;
  };

  const glideTo = (target: number) => {
    const s = state.current;
    s.target = clamp(target);
    if (reducedMotion()) return paint((s.pos = s.target));
    if (s.raf) return;
    const step = () => {
      s.pos += (s.target - s.pos) * 0.22;
      if (Math.abs(s.target - s.pos) < 0.05) s.pos = s.target;
      paint(s.pos);
      heat();
      s.raf = s.pos === s.target ? 0 : requestAnimationFrame(step);
    };
    s.raf = requestAnimationFrame(step);
  };

  useEffect(() => {
    const el = root.current!;
    const s = state.current;
    paint(s.pos);
    if (reducedMotion()) return;

    const play = () => {
      el.dataset.demo = '';
      let t = 0;
      let last = 0;
      let from = s.pos;
      let i = 0;
      const frame = (now: number) => {
        // Local time, so a hidden tab or a long frame pauses the demo instead of skipping it.
        t += last ? Math.min(250, now - last) : 0;
        last = now;
        while (i < DEMO.length && t >= DEMO[i][0]) {
          t -= DEMO[i][0];
          from = DEMO[i][1];
          i++;
        }
        if (i >= DEMO.length) {
          s.pos = s.target = 50;
          paint(50);
          s.demo = 0;
          delete el.dataset.demo;
          return;
        }
        const [ms, to] = DEMO[i];
        const v = from + (to - from) * sine(t / ms);
        if (Math.abs(v - s.pos) > 0.02) heat();
        s.pos = s.target = v;
        paint(v);
        s.demo = requestAnimationFrame(frame);
      };
      s.demo = requestAnimationFrame(frame);
    };

    // Starts once the comparison is well in view (most of it, or most of a short screen), only once per visit.
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || s.touched) return;
        const seen = e.intersectionRect.height;
        if (seen < Math.min(e.boundingClientRect.height * 0.8, innerHeight * 0.6)) return;
        io.disconnect();
        play();
      },
      { threshold: [0, 0.2, 0.4, 0.6, 0.7, 0.8, 0.9, 1] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(s.demo);
      cancelAnimationFrame(s.raf);
      clearTimeout(s.cool);
    };
  }, []);

  const fromPointer = (e: React.PointerEvent) => {
    const r = root.current!.getBoundingClientRect();
    glideTo(((e.clientX - r.left) / r.width) * 100);
  };

  return (
    <div
      ref={root}
      className="ba group relative aspect-[5/4] touch-pan-y select-none overflow-hidden bg-ground-2 [--pos:50%] sm:aspect-[16/10]"
      onPointerDown={(e) => {
        take();
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

      <div aria-hidden className="ba-line pointer-events-none absolute inset-y-0 left-[var(--pos)] w-px -translate-x-1/2">
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
        onKeyDown={(e) => {
          // Arrow keys move in visible steps (the native step of 1% barely moves it); Home and End go all the way.
          const by = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -20, PageUp: 20 }[e.key];
          const to = e.key === 'Home' ? 0 : e.key === 'End' ? 100 : by === undefined ? null : state.current.target + by;
          if (to === null) return;
          e.preventDefault();
          take();
          glideTo(to);
        }}
        onInput={(e) => {
          take();
          glideTo(Number(e.currentTarget.value));
        }}
        className="sr-only"
      />
    </div>
  );
}
