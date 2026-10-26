import type { Package } from '@/data/pricing';
import { SpotlightCard } from './SpotlightCard';
import { Check } from './Icons';
import { QuoteLink } from './QuoteLink';

export function PricingCard({ pkg }: { pkg: Package }) {
  return (
    <SpotlightCard as="article" tilt className={`flex h-full flex-col p-7 sm:p-8 ${pkg.featured ? 'bg-[#1a1913]' : ''}`}>
      {pkg.featured && <span aria-hidden className="beam" />}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-2xl font-semibold tracking-[-0.02em]">{pkg.name}</h3>
        {pkg.featured && <span className="label rounded-full border border-line-strong px-2.5 py-1 text-bone">Most popular</span>}
      </div>
      <p className="mt-3 min-h-12 text-[0.9375rem] leading-relaxed text-bone-dim">{pkg.summary}</p>
      <p className="mt-6 flex items-baseline gap-2 font-mono">
        <span className="text-xs uppercase tracking-[0.14em] text-bone-dim">From</span>
        <span className="text-4xl tracking-tight text-bone">{pkg.price}</span>
      </p>
      <p className="mt-1.5 min-h-5 font-mono text-sm text-bone-dim">{pkg.care ?? 'One-time'}</p>
      <ul className="mt-5 space-y-3 border-t border-line pt-6 text-[0.9375rem]">
        {pkg.features.map((f) => (
          <li key={f} className="flex gap-3">
            <Check className="mt-1 size-4 shrink-0 text-bone-dim" />
            {f}
          </li>
        ))}
      </ul>
      <QuoteLink pkg={pkg.id} className={`btn mt-8 w-full ${pkg.featured ? 'btn-primary' : 'btn-ghost'}`}>
        Get a quote
      </QuoteLink>
    </SpotlightCard>
  );
}
