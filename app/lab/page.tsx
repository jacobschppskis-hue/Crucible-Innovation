import type { Metadata } from 'next';
import { Archivo, Big_Shoulders, Newsreader } from 'next/font/google';
import { SplitRing } from '@/components/SplitRing';
import { ventures } from '@/data/ventures';
import './lab.css';

// The direction board (plan item 3): three type and colour directions on the same two pieces, for Jacob to pick or
// mix. Not linked anywhere and not indexed. Delete once a direction is chosen.
export const metadata: Metadata = { title: 'Direction board', robots: { index: false, follow: false } };

const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--lab-archivo', display: 'swap' });
const shoulders = Big_Shoulders({ subsets: ['latin'], weight: ['800'], variable: '--lab-shoulders', display: 'swap' });
const newsreader = Newsreader({ subsets: ['latin'], weight: ['400'], variable: '--lab-news', display: 'swap' });

const variants = [
  { id: 'a', name: 'A · Archivo, wide', note: 'One family. Archivo Expanded for display, normal width for text. Dark ground, Ember only where hot.' },
  { id: 'b', name: 'B · Industrial', note: 'Big Shoulders for display, Archivo for text. Stamped, foundry-floor feel. Darker ground.' },
  { id: 'c', name: 'C · Editorial, cooled', note: 'Newsreader set upright for statements, Archivo for text. Bone surface: the page has cooled.' },
] as const;

export default function Lab() {
  return (
    <main className={`${archivo.variable} ${shoulders.variable} ${newsreader.variable} lab`}>
      {variants.map((v) => (
        <section key={v.id} id={v.id} data-v={v.id} className="lab-v">
          <p className="lab-note">
            {v.name}. {v.note}
          </p>
          <div className="lab-hero">
            <SplitRing size={120} title="" className="lab-ring" />
            <h1 className="lab-display">Intelligence, alloyed</h1>
            <div className="lab-intro">
              <p>Human judgment and machine range, fused into one material. Crucible is a studio that builds and ships ventures.</p>
              <span className="lab-btn">See Crucible Sites</span>
            </div>
          </div>
          <div className="lab-ventures">
            <h2 className="lab-h2">Everything new was once molten</h2>
            <ul>
              {ventures.map((x) => (
                <li key={x.slug} data-hot={x.status === 'live' ? '' : undefined}>
                  <span className="lab-vname">{x.name}</span>
                  <span className="lab-vblurb">{x.blurb}</span>
                  <span className="lab-vstatus">{x.status === 'live' ? 'Live' : 'Coming soon'}</span>
                </li>
              ))}
            </ul>
            <p className="lab-data">
              <span>1811 K</span> iron melts
            </p>
          </div>
        </section>
      ))}
    </main>
  );
}
