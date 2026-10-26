'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { SplitRing } from './SplitRing';
import { Wordmark } from './Wordmark';

type Variant = 'home' | 'sites';

const config = {
  home: {
    home: '/',
    links: [
      { href: '/#story', label: 'Story' },
      { href: '/#ventures', label: 'Ventures' },
      { href: '/sites', label: 'Sites' },
    ],
    cta: { href: '/sites#start', label: 'Start a project' },
  },
  sites: {
    home: '/sites',
    links: [
      { href: '#work', label: 'Work' },
      { href: '#process', label: 'Process' },
      { href: '#pricing', label: 'Pricing' },
      { href: '#faq', label: 'FAQ' },
    ],
    cta: { href: '#start', label: 'Get a quote' },
  },
} as const;

/** Sticky; transparent until 24px of scroll, then blurred ground with a hairline. */
export function Nav({ variant = 'home' }: { variant?: Variant }) {
  const ref = useRef<HTMLElement>(null);
  const c = config[variant];

  useEffect(() => {
    const el = ref.current!;
    const onScroll = () => {
      el.toggleAttribute('data-scrolled', scrollY > 24);
      const max = document.documentElement.scrollHeight - innerHeight;
      el.style.setProperty('--sp', (max > 0 ? scrollY / max : 0).toFixed(4));
    };
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header ref={ref} className="nav fixed inset-x-0 top-0 z-50">
      <div aria-hidden className="nav-progress" />
      <nav aria-label="Main" className="container-x flex h-[var(--nav-h)] items-center justify-between gap-4">
        <Link href={c.home} className="flex items-center gap-2.5 rounded-md text-[1.375rem]">
          <SplitRing size={26} title="" />
          <Wordmark sites={variant === 'sites'} />
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <ul className="hidden items-center gap-1 md:flex">
            {c.links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="rounded-full px-3 py-2 text-sm text-bone-dim transition-colors duration-200 hover:text-bone">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link href={c.cta.href} className="btn btn-primary btn-sm">
            {c.cta.label}
          </Link>
        </div>
      </nav>
    </header>
  );
}
