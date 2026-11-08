import './Thesis.css';

/**
 * The Thesis: as you scroll, the planet's sea under the type heats from room temperature (293 K) to iron's melting
 * point (1811 K). Static markup only: the world module `thesis` (lib/world/thesis.ts) draws the metal and writes the
 * readout and the line crossfade every frame (--k, --xa, --xb). Cold, the sea is a dark mirror of the stars; hot, it
 * glows from within and flows. The readout reads Quench while cold and Ember once hot. Nothing behind any of it: the
 * camera keeps the metal low in frame and the type in the sky. Without the world (no JS, no WebGL, reduced motion):
 * the hot end, as the old site did.
 */
export function Thesis() {
  return (
    <section aria-label="Thesis" className="wthesis" data-place="thesis">
      <div className="wthesis-pin">
        <div className="wthesis-in container-x">
          <div className="wthesis-lines">
            <div className="wthesis-a">
              <p className="wthesis-h wide" data-reflect>
                Nothing new happens at 293&nbsp;K
              </p>
              <p className="wthesis-s">293 K is room temperature.</p>
            </div>
            <div className="wthesis-b">
              <p className="wthesis-h wide" data-reflect>
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
