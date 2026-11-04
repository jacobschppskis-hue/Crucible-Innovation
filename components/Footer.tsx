import Link from 'next/link';
import { site } from '@/data/site';
import { ventures, ventureHref, type Venture } from '@/data/ventures';
import { Wordmark } from './Wordmark';

const pages = [
  { href: '/', label: 'Studio' },
  { href: '/sites', label: 'Crucible Sites' },
  { href: '/work', label: 'Work' },
  { href: '/ventures', label: 'Ventures' },
];

/**
 * The end of every page: the metal has cooled. The page flips to bone behind a hot front that cools as it comes into
 * view, and the giant wordmark sets in ink; its Ember dot lights last.
 */
export function Footer() {
  return (
    <footer data-scroll="enter" className="foot relative isolate">
      <div className="container-x pt-24 pb-10 sm:pt-32">
        <p className="text-ink-dim">Write to us</p>
        <a href={`mailto:${site.email}`} className="foot-mail wide mt-3 inline-block font-display font-semibold">
          {site.email}
        </a>

        <div className="mt-20 grid gap-12 text-[0.9375rem] sm:grid-cols-3">
          <nav id="pages" aria-label="Pages">
            <h2 className="text-ink-dim">Pages</h2>
            <ul className="mt-4 space-y-2">
              {pages.map((p) => (
                <li key={p.href}>
                  <Link href={p.href} className="foot-link">
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <h2 className="text-ink-dim">Ventures</h2>
            <ul className="mt-4 space-y-2">
              {(ventures as readonly Venture[]).map((v) => (
                <li key={v.slug} className="flex items-baseline justify-between gap-4 sm:justify-start">
                  <Link href={ventureHref(v)} className="foot-link">
                    {v.name}
                  </Link>
                  <span className={v.status === 'live' ? 'text-ember-deep' : 'text-ink-dim'}>{v.status === 'live' ? 'Live' : 'Coming soon'}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-ink-dim">Founders</h2>
            <p className="mt-4 leading-relaxed">{site.founders.map((f) => f.name).join(' and ')}, co-founders</p>
          </div>
        </div>
        <p className="mt-16 text-sm text-ink-dim">© {new Date().getFullYear()} Crucible</p>
      </div>

      <div aria-hidden data-scroll="reveal" className="foot-giant relative overflow-hidden">
        <div className="foot-giant-inner flex justify-center text-[24vw] leading-[0.8]">
          <Wordmark />
        </div>
      </div>
    </footer>
  );
}
