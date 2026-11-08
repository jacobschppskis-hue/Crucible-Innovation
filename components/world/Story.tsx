import { stories } from '@/data/story';
import { Chapter } from './Chapter';
import './Story.css';

/**
 * "Why Crucible": both co-founders in their own words, Jacob first. Read on the night side of the planet, low over a
 * calm stretch of sea. `paypal` is the PayPal scene: it plays inside Jacob's account, right after the paragraph that
 * tells it, and his account resumes with the sentence it leads to.
 */
export function Story({ paypal }: { paypal?: React.ReactNode }) {
  const [jacob, charlie] = stories;
  return (
    <section id="story" aria-labelledby="story-h" className="wstory">
      <Chapter
        s={jacob}
        intro={
          <div className="wstory-head">
            <h2 id="story-h" className="h-section">
              Why Crucible
            </h2>
            <p className="wstory-sub">Jacob Schopp and Charles Rochford, co-founders, each in their own words.</p>
          </div>
        }
        interlude={paypal}
        after={1}
        place={['story', 'story-2']}
      />
      <Chapter s={charlie} place={['story-3']} />
    </section>
  );
}
