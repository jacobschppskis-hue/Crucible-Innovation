'use client';
import { useEffect, useRef } from 'react';
import { gallery, type Saying } from '@/data/sayings';
import { reducedMotion, trackScroll } from '@/lib/scroll';
import { SplitRing } from './SplitRing';

const tones: Record<Saying['tone'], string> = {
  dark: 'bg-ground-2 text-bone border-line',
  ember: 'bg-ember text-ground border-transparent',
  bone: 'bg-bone text-ground border-transparent',
};

function Card({ s, n }: { s: Saying; n: number }) {
  const dark = s.tone === 'dark';
  return (
    <li className={`saying flex aspect-square w-[min(78vw,23rem)] shrink-0 flex-col rounded-2xl border p-7 sm:p-8 ${tones[s.tone]}`}>
      <p className={`font-mono text-xs uppercase tracking-[0.16em] ${dark ? 'text-ember' : 'text-ground/80'}`}>
        {String(n).padStart(2, '0')} · {s.cat}
      </p>
      <p className="mt-auto font-serif-upright text-[2.125rem] leading-[1.05] tracking-[-0.01em] text-balance sm:text-[2.5rem]">
        {s.line.map((l, i) => (
          <span key={i} className={l.i ? 'accent' : undefined}>
            {l.t}
          </span>
        ))}
      </p>
      <div className="mt-auto flex items-end justify-between gap-4 pt-6">
        <p className={`whitespace-pre-line font-mono text-xs leading-relaxed ${dark ? 'text-bone-dim' : 'text-ground/75'}`}>{s.note}</p>
        <SplitRing size={22} title="" className={`shrink-0 ${dark ? '' : 'ring-dark'}`} />
      </div>
    </li>
  );
}

/** Pinned horizontal gallery: scrolling down slides the sayings sideways. Falls back to a swipeable row. */
export function SayingsGallery() {
  const ref = useRef<HTMLElement>(null);
  const track = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (reducedMotion()) return;
    const el = ref.current!;
    const measure = () => {
      const overflow = Math.max(0, track.current!.scrollWidth - innerWidth + 32);
      el.style.setProperty('--ov', `${overflow}px`);
      el.style.height = `${innerHeight + overflow}px`;
      el.dataset.pinned = '';
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track.current!);
    addEventListener('resize', measure);
    const off = trackScroll(el, 'pin');
    return () => {
      off();
      ro.disconnect();
      removeEventListener('resize', measure);
    };
  }, []);

  return (
    <section ref={ref} aria-labelledby="sayings" className="gallery relative">
      <div className="gallery-sticky flex flex-col justify-center overflow-hidden py-20">
        <div className="container-x flex items-end justify-between gap-6">
          <div>
            <p className="label">Sayings</p>
            <h2 id="sayings" className="h-section mt-4">
              Things we <span className="accent">believe.</span>
            </h2>
          </div>
          <div aria-hidden className="gallery-progress mb-3 hidden h-px w-40 bg-line-strong sm:block">
            <div className="h-full origin-left bg-bone" />
          </div>
        </div>
        <ul ref={track} className="gallery-track mt-12 flex gap-5 px-4 sm:px-6 lg:px-[max(2rem,calc((100vw-76rem)/2+2rem))]">
          {gallery.map((s, i) => (
            <Card key={i} s={s} n={i + 1} />
          ))}
        </ul>
      </div>
    </section>
  );
}
