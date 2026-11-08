import { together } from '@/data/home';
import './Together.css';

/**
 * "Stronger together" (role: mark): a confluence on the molten sea. Two rivers of metal run toward each other and join
 * into one river that runs hotter, brighter and more yellow (colour is temperature), drawn by the world in lava's own
 * material (lib/world/together.ts, the `sea` hook in lib/world/glsl/mark.glsl). One line arrives when they meet; the
 * mark module (lib/world/mark.ts) writes its opacity. Without the world (no JS, reduced motion) the line stands alone.
 */
export function Together() {
  return (
    <section data-place="together" aria-label="Stronger together" className="w-place w-together">
      <div className="w-sticky tg-stage">
        <h2 data-together-line className="tg-line h-display">
          {together.lines[0]}
        </h2>
      </div>
    </section>
  );
}
