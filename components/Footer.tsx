import Link from 'next/link';
import { site } from '@/data/site';
import { ventures, ventureHref, type Venture } from '@/data/ventures';
import { Furnace } from './Furnace';
import { Wordmark } from './Wordmark';

const pages = [
  { href: '/', label: 'Studio' },
  { href: '/sites', label: 'Crucible Sites' },
  { href: '/work', label: 'Work' },
  { href: '/ventures', label: 'Ventures' },
];

/**
 * The end of every page: dark, with molten metal glowing under the giant wordmark. No background of its own, so the
 * page liquid shows through; the furnace is transparent where there is no heat.
 */
export function Footer() {
  return (
    <footer className="foot relative">
      <div data-scroll="reveal" className="foot-top container-x pt-24 pb-10 sm:pt-32">
        <p className="text-bone-dim">Write to us</p>
        <a href={`mailto:${site.email}`} className="foot-mail wide mt-3 inline-block font-display font-semibold">
          {site.email}
        </a>

        <div className="mt-20 grid gap-12 text-[0.9375rem] sm:grid-cols-3">
          <nav id="pages" aria-label="Pages">
            <h2 className="text-bone-dim">Pages</h2>
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
            <h2 className="text-bone-dim">Ventures</h2>
            <ul className="mt-4 space-y-2">
              {(ventures as readonly Venture[]).map((v) => (
                <li key={v.slug} className="flex items-baseline justify-between gap-4 sm:justify-start">
                  <Link href={ventureHref(v)} className="foot-link">
                    {v.name}
                  </Link>
                  <span className={v.status === 'live' ? 'text-ember' : 'text-bone-dim'}>{v.status === 'live' ? 'Live' : 'Coming soon'}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-bone-dim">Founders</h2>
            <p className="mt-4 leading-relaxed">{site.founders.map((f) => f.name).join(' and ')}, co-founders</p>
          </div>
        </div>
        <p className="mt-16 text-sm text-bone-dim">© {new Date().getFullYear()} Crucible</p>
      </div>

      <div aria-hidden data-scroll="reveal" className="foot-giant relative isolate">
        <Furnace heat={1} reach="100%" molten={0.8} className="foot-furnace" />
        <div className="foot-giant-clip overflow-hidden">
          <div className="foot-giant-inner flex justify-center text-[24vw] leading-[0.8]">
            <Wordmark />
          </div>
        </div>
      </div>
    </footer>
  );
}
