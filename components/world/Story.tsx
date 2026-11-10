import { WordReveal } from '@/components/WordReveal';
import { storyIntro } from '@/data/home';
import { stories } from '@/data/story';
import { Chapter } from './Chapter';
import './Story.css';

/**
 * "Why Crucible": both co-founders in their own words, Jacob first, set like the titles of a film over the planet.
 * `paypal` is the PayPal scene: it plays inside Jacob's account, right after the paragraph that tells it, and his
 * account resumes with the sentence it leads to.
 */
export function Story({ paypal }: { paypal?: React.ReactNode }) {
  const [jacob, charlie] = stories;
  return (
    <section id="story" aria-labelledby="story-h" className="wstory">
      <Chapter
        s={jacob}
        lifts={storyIntro.lifts[0]}
        intro={
          <div className="wstory-head">
            <WordReveal as="h2" id="story-h" className="wstory-h h-display" segments={[{ t: storyIntro.heading }]} />
            <p className="wstory-sub" data-reveal="">
              {storyIntro.lede}
            </p>
          </div>
        }
        interlude={paypal}
        after={1}
        place={['story', 'story-2']}
      />
      <Chapter s={charlie} lifts={storyIntro.lifts[1]} place={['story-3']} />
    </section>
  );
}
