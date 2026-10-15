'use client';
import { useEffect, useRef, useState } from 'react';

const steps = [
  { name: 'Talk', meta: '15-min call', body: 'Tell us about your business, your customers and what isn’t working today.' },
  { name: 'Design', meta: 'First draft in ~3 days', body: 'You get a real, clickable draft of your site. Not a mood board.' },
  { name: 'Refine', meta: 'Two rounds of edits', body: 'We tune the words, photos and details together until it feels like you.' },
  { name: 'Launch', meta: 'About a week in', body: 'Domain, hosting and help with your Google listing. Then you’re live.' },
];

/** Four steps joined by a line that heats up (bone → ember) as you scroll through it. */
export function Process() {
  const ref = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(-1);

  // Scroll-linked progress: 0 when the list's top hits 85% of the viewport, 1 when its bottom hits 55%.
  useEffect(() => {
    const el = ref.current!;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = innerHeight;
      const p = Math.max(0, Math.min(1, (vh * 0.85 - r.top) / (r.height + vh * 0.3)));
      el.style.setProperty('--p', p.toFixed(4));
      setActive(Math.min(3, Math.floor(p * 4 + 0.06)) - (p === 0 ? 1 : 0));
    };
    const onScroll = () => (raf ||= requestAnimationFrame(update));
    update();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <ol ref={ref} className="relative grid gap-10 pl-8 md:grid-cols-4 md:gap-8 md:pl-0 md:pt-10">
      {/* rail: vertical on mobile, horizontal on desktop */}
      <div aria-hidden className="absolute bottom-2 left-[5px] top-2 w-px bg-line-strong md:inset-x-0 md:bottom-auto md:top-[5px] md:h-px md:w-auto" />
      <div
        aria-hidden
        className="absolute bottom-2 left-[5px] top-2 w-px origin-top bg-gradient-to-b from-bone/70 to-ember [transform:scaleY(var(--p,1))] md:inset-x-0 md:bottom-auto md:top-[5px] md:h-px md:w-auto md:origin-left md:bg-gradient-to-r md:[transform:scaleX(var(--p,1))]"
      />
      {steps.map((s, i) => (
        <li key={s.name} className="relative">
          <span
            aria-hidden
            className={`absolute -left-8 top-1 size-[11px] rounded-full border transition-colors duration-500 md:-top-10 md:left-0 ${
              i <= active ? 'border-ember bg-ember' : 'border-bone/30 bg-ground'
            }`}
          />
          <p className="label">
            <span className="text-bone">0{i + 1}</span> · {s.meta}
          </p>
          <h3 className="mt-3 font-display text-2xl font-semibold tracking-[-0.02em]">{s.name}</h3>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-bone-dim">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}
