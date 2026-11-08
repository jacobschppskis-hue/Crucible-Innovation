import Link from 'next/link';
import { site } from '@/data/site';
import { ventures, ventureHref, type Venture } from '@/data/ventures';
import { Wordmark } from '@/components/Wordmark';
import './Footer.css';

const pages = [
  { href: '/', label: 'Studio' },
  { href: '/sites', label: 'Crucible Sites' },
  { href: '/work', label: 'Work' },
  { href: '/ventures', label: 'Ventures' },
];

/**
 * The home page's end: the shore. Contact and links read over the dark sky while the camera climbs toward the planet's
 * limb; the giant wordmark stands over the horizon as the first dawn light comes up behind it (its reflection lies in
 * the sea); then it lifts away and the sun and the mark rise into the exact frame the page opened on, where the journey
 * loops (lib/world, the `world` lead's loop). Nothing behind any of it: the world is the background.
 */
export function Footer() {
  return (
    <footer className="wfoot" data-place="shore">
      <div className="wfoot-top container-x">
        <p className="wfoot-k">Write to us</p>
        <a href={`mailto:${site.email}`} className="wfoot-mail wide">
          {site.email}
        </a>

        <div className="wfoot-cols">
          <nav id="pages" aria-label="Pages">
            <h2 className="wfoot-k">Pages</h2>
            <ul>
              {pages.map((p) => (
                <li key={p.href}>
                  <Link href={p.href} className="wfoot-link">
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <h2 className="wfoot-k">Ventures</h2>
            <ul>
              {(ventures as readonly Venture[]).map((v) => (
                <li key={v.slug} className="wfoot-v">
                  <Link href={ventureHref(v)} className="wfoot-link">
                    {v.name}
                  </Link>
                  <span className={v.status === 'live' ? 'wfoot-live' : 'wfoot-soon'}>{v.status === 'live' ? 'Live' : 'Coming soon'}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="wfoot-k">Founders</h2>
            <p className="wfoot-f">{site.founders.map((f) => f.name).join(' and ')}, co-founders</p>
          </div>
        </div>
        <p className="wfoot-c">© {new Date().getFullYear()} Crucible</p>
      </div>

      {/* the wordmark over the horizon at first light; the world reflects it in the sea (data-reflect) */}
      <div className="wfoot-giant" data-place="dawn" aria-hidden>
        <div className="wfoot-word" data-reflect>
          <Wordmark />
        </div>
      </div>
    </footer>
  );
}
