import { together } from '@/data/home';

/**
 * "Stronger together": replaces the take-apart beats. Placeholder markup by `world`; `mark` owns the moment (its scene
 * lives in lib/world/together.ts and reads this section's pin progress via frame.at('together')).
 */
export function Together() {
  return (
    <section data-place="together" aria-label="Stronger together" className="w-place w-together">
      <div className="w-sticky w-center">
        {together.lines.map((l) => (
          <p key={l} data-together-line className="h-display text-4xl sm:text-6xl">
            {l}
          </p>
        ))}
      </div>
    </section>
  );
}
