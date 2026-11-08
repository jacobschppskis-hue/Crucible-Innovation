import { together } from '@/data/home';
import './Together.css';

/**
 * "Stronger together" (role: mark): replaces the take-apart beats. Two runs of metal fill Jacob's mark round the sun,
 * one down the arcs, one square by square; they meet at the bottom and the ring blazes (lib/world/together.ts, drawn by
 * lib/world/glsl/mark.glsl). The captions name each half as its run arrives, then the payoff. The mark module
 * (lib/world/mark.ts) writes each line's opacity and the mark's screen box (--mx, --my, --mr, CSS px) on the section, so
 * "The human half" sits beside the arcs and "The machine half" beside the squares (stacked above the mark on phones).
 * Without the world (no JS, reduced motion) the three lines stand as a plain centred stack.
 */
export function Together() {
  const [human, machine, payoff] = together.lines;
  return (
    <section data-place="together" aria-label="Stronger together" className="w-place w-together">
      <div className="w-sticky tg-stage">
        <p data-together-line className="tg-line tg-human h-display">
          {human}
        </p>
        <p data-together-line className="tg-line tg-machine h-display">
          {machine}
        </p>
        <h2 data-together-line className="tg-line tg-payoff h-display">
          {payoff}
        </h2>
      </div>
    </section>
  );
}
