import './Thesis.css';

/**
 * The Thesis: as you scroll, the planet under the type heats from room temperature (293 K) to iron's melting point
 * (1811 K), filmed from orbit. Static markup only: the world module `thesis` (lib/world/thesis.ts) writes the readout
 * and the line crossfade every frame (--k, --xa, --xb); look's planet (lib/world/glsl/planet.glsl) draws the metal.
 * Cold, the world is dark, its rivers faint veins under the limb's glow and the stars; heating, the rivers blaze first,
 * heat spreads from their banks across the basins, and the whole sea turns yellow-white. The readout reads Quench
 * while cold and Ember once hot. Nothing behind any of it: the camera keeps the limb ~60% down the frame, the planet
 * large under the type and the type in the black sky. Without the world (no JS, no WebGL, reduced motion): the hot
 * end, as the old site did.
 */
export function Thesis() {
  return (
    <section aria-label="Thesis" className="wthesis" data-place="thesis">
      <div className="wthesis-pin">
        <div className="wthesis-in container-x">
          <div className="wthesis-lines">
            <div className="wthesis-a">
              <p className="wthesis-h wide">
                Nothing new happens at 293&nbsp;K
              </p>
              <p className="wthesis-s">293 K is room temperature.</p>
            </div>
            <div className="wthesis-b">
              <p className="wthesis-h wide">
                An alloy is stronger than its metals
              </p>
              <p className="wthesis-s">Steel is harder than iron. Bronze is harder than copper.</p>
            </div>
          </div>
          <div className="wthesis-ro">
            <p className="label">Temperature</p>
            <p className="wthesis-num wide">
              <span className="sr-only">Heating from 293 kelvin, room temperature, to 1811 kelvin, the melting point of iron.</span>
              <span aria-hidden data-thesis-num>
                1811
              </span>
              <span aria-hidden> K</span>
            </p>
            <p aria-hidden className="label wthesis-cap">
              <span data-thesis-cap>Iron melts</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
