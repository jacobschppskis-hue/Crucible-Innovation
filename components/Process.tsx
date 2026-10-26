'use client';
import { useEffect, useRef, useState } from 'react';
import { trackScroll } from '@/lib/scroll';

const steps = [
  { name: 'Talk', meta: '15-min call', body: 'Tell us about your business, your customers and what isn’t working today.' },
  { name: 'Design', meta: 'First draft in ~3 days', body: 'You get a real, clickable draft of your site. Not a mood board.' },
  { name: 'Refine', meta: 'Two rounds of edits', body: 'We temper the words, photos and details together until it feels like you.' },
  { name: 'Launch', meta: 'About a week in', body: 'Domain, hosting and help with your Google listing. Then you’re live.' },
];

/**
 * Four steps joined by a rail that heats up (bone → ember) as you scroll. A glowing spark leads the heat,
 * each step brightens as it's reached, and its node sends out a single ripple.
 */
export function Process() {
  const ref = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const el = ref.current!;
    // 0 when the list's top is at 85% of the viewport, 1 when its bottom is at 55%.
    return trackScroll(el, 'view', () => {
      const r = el.getBoundingClientRect();
      const vh = innerHeight;
      const p = Math.max(0, Math.min(1, (vh * 0.85 - r.top) / (r.height + vh * 0.3)));
      el.style.setProperty('--heat', p.toFixed(4));
      setActive(p === 0 ? -1 : Math.min(3, Math.floor(p * 4 + 0.06)));
    });
  }, []);

  return (
    <ol ref={ref} className="process relative grid gap-10 pl-8 md:grid-cols-4 md:gap-8 md:pl-0 md:pt-10">
      <div aria-hidden className="absolute bottom-2 left-[5px] top-2 w-px bg-line-strong md:inset-x-0 md:bottom-auto md:top-[5px] md:h-px md:w-auto" />
      <div aria-hidden className="process-fill absolute bottom-2 left-[5px] top-2 w-px md:inset-x-0 md:bottom-auto md:top-[5px] md:h-px md:w-auto" />
      <div aria-hidden className="process-spark" />
      {steps.map((s, i) => (
        <li key={s.name} className="process-step relative" data-on={i <= active ? '' : undefined} data-current={i === active ? '' : undefined} style={{ '--t': i / 4 } as React.CSSProperties}>
          <span aria-hidden className="process-node absolute -left-8 top-1 size-[11px] rounded-full md:-top-10 md:left-0" />
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
