import { faq } from '@/data/faq';
import { Plus } from './Icons';

/** Native <details> accordion: keyboard and screen reader friendly, works without JS. */
export function Faq() {
  return (
    <div className="divide-y divide-line border-y border-line">
      {faq.map(({ q, a }) => (
        <details key={q} className="faq group">
          <summary className="flex items-center justify-between gap-6 rounded-md py-6 text-left font-display text-lg font-medium tracking-[-0.01em] transition-colors hover:text-bone sm:text-xl">
            {q}
            <Plus className="faq-icon size-5 shrink-0 text-bone-dim" />
          </summary>
          <p className="max-w-2xl pb-6 leading-relaxed text-bone-dim">{a}</p>
        </details>
      ))}
    </div>
  );
}
