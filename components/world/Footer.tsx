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
 * The home page's end, two places long. `shore`: the sun rises over the limb from orbit while the contact and links sit
 * still in the shot (pinned), under one line that turns Jacob's goal (finding the people who already build) into an
 * invitation. `dawn`: the giant wordmark holds over the day side as the camera crosses it and turns back to the setting
 * sun; then it lifts away and the hero comes up from below, the exact frame the page opened on, where the journey loops
 * (lib/world/loop.ts). Nothing behind any of it: the world is the background.
 */
export function Footer() {
  return (
    <footer className="wfoot">
      <div className="wfoot-shore" data-place="shore">
      <div className="wfoot-top container-x">
        <p className="wfoot-call wide">Already building something?</p>
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
      </div>

      {/* the wordmark over the day side */}
      <div className="wfoot-dawn" data-place="dawn" aria-hidden>
        <div className="wfoot-giant">
          <div className="wfoot-word">
            <Wordmark />
          </div>
        </div>
      </div>
    </footer>
  );
}
