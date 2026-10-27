import Link from 'next/link';
import { site } from '@/data/site';
import { ventures, ventureHref } from '@/data/ventures';
import { Furnace } from './Furnace';
import { SplitRing } from './SplitRing';
import { Wordmark } from './Wordmark';

export function Footer() {
  const live = ventures.filter((v) => v.status === 'live');
  const forging = ventures.length - live.length;
  return (
    <footer className="border-t border-line">
      <div className="container-x grid gap-12 py-16 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2.5 rounded-md text-2xl">
            <SplitRing size={30} title="" />
            <Wordmark />
          </Link>
        </div>
        <div>
          <h2 className="label">Ventures</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {live.map((v) => (
              <li key={v.slug}>
                <Link href={ventureHref(v)} className="text-bone transition-colors hover:text-ember">
                  {v.name}
                </Link>
              </li>
            ))}
            {forging > 0 && <li className="text-bone-dim">{forging} more in the furnace</li>}
          </ul>
        </div>
        <div>
          <h2 className="label">Contact</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <a href={`mailto:${site.email}`} className="text-bone transition-colors hover:text-ember">
                {site.email}
              </a>
            </li>
            <li className="text-bone-dim">Founded by {site.founder.name}</li>
          </ul>
        </div>
      </div>
      <div className="container-x">
        <p className="border-t border-line py-6 font-mono text-xs text-bone-dim">© {new Date().getFullYear()} Crucible</p>
      </div>
      {/* The wordmark rises out of the bottom edge, off a furnace floor, as you reach the end of the page. */}
      <div aria-hidden data-scroll="reveal" className="footer-giant relative isolate overflow-hidden">
        <Furnace heat={0.75} reach="95%" molten={0.38} />
        <div className="footer-giant-inner flex justify-center text-[24vw] leading-[0.8]">
          <Wordmark />
        </div>
      </div>
    </footer>
  );
}
