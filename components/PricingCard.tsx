import type { Package } from '@/data/pricing';
import { Check } from './Icons';
import { QuoteLink } from './QuoteLink';

/** One package, in an open column. The featured (monthly) package runs hot: an Ember edge and the Ember button. */
export function PricingCard({ pkg }: { pkg: Package }) {
  return (
    <article className={`pkg flex h-full flex-col ${pkg.featured ? 'pkg-hot' : ''}`}>
      <h3 className="wide font-display text-3xl font-semibold tracking-[-0.015em]">{pkg.name}</h3>
      <p className="mt-3 min-h-12 leading-relaxed text-bone-dim">{pkg.summary}</p>
      <p className="wide mt-8 font-display text-[1.625rem] leading-tight font-semibold tracking-[-0.01em] text-bone">{pkg.goal}</p>
      <p className={`mt-1.5 text-sm ${pkg.featured ? 'text-ember' : 'text-bone-dim'}`}>{pkg.care ?? 'One-time build'}</p>
      <ul className="mt-8 space-y-3 text-[0.9375rem]">
        {pkg.features.map((f) => (
          <li key={f} className="flex gap-3">
            <Check className="mt-1 size-4 shrink-0 text-bone-dim" />
            {f}
          </li>
        ))}
      </ul>
      <QuoteLink pkg={pkg.id} className={`btn mt-10 w-full sm:w-auto sm:self-start ${pkg.featured ? 'btn-primary' : 'btn-ghost'}`}>
        Get a quote
      </QuoteLink>
    </article>
  );
}
