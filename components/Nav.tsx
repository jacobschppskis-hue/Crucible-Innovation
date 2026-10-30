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
      { href: '#pricing', label: 'Packages' },
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
    <header ref={ref} className={`nav fixed inset-x-0 top-0 z-50 ${variant === 'home' ? 'nav-intro' : ''}`}>
      <div aria-hidden className="nav-progress" />
      <nav aria-label="Main" className="container-x flex h-[var(--nav-h)] items-center justify-between gap-4">
        {/* The ring and "crucible" always go to the Crucible home page; "sites" goes to the Crucible Sites home. */}
        <div className="flex items-baseline gap-[0.4em] text-[1.375rem]">
          <Link href="/" aria-label="Crucible home" className="flex items-baseline gap-2.5 rounded-md">
            <SplitRing size={26} title="" className="self-center" />
            <Wordmark />
          </Link>
          {variant === 'sites' && (
            <Link
              href="/sites"
              aria-label="Crucible Sites home"
              className="rounded-md font-mono text-[0.62em] uppercase leading-none tracking-[0.14em] text-bone-dim transition-colors duration-200 hover:text-bone"
            >
              sites
            </Link>
          )}
        </div>
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
