// The PayPal beat's one timeline (components/Story.tsx SplitBeat, Story.css, lib/gl/splitPour.ts). Everything is a
// pure function of the pour time `tau` (0..1), which the figure's scroll progress drives (data-scroll="view": --p), so
// the beat scrubs both ways and every scroll position has exactly one picture. The CSS (the names, as real text) and
// the GL (the stream, the runs, the glow) read the same numbers, so the metal reaches a name exactly when it starts
// to fill.
//
// The story, in tau:
//   0    - 0.10  PayPal melts: a heat front rises through the letters, bone -> molten.
//   0.05 - 0.12  a drop swells at the tip of the y's descender (the spout).
//   0.12         the stream leaves the y and runs down; it forks at each row (FORK) and each run reaches its name REACH
//                later, then the name fills from the end the metal enters (FILL).
//   0.46 (STOP)  the pour stops: the stream lets go of the y and its tail follows the same way down, beading as it
//                thins, so every run drains into its name and nothing is left lying on the page. A bead falls off at
//                each fork and sinks into the page's liquid.
//   then         each name cools once its run has drained (red, then a bone front sweeps in from its far end); PayPal
//                cools (its bone front sweeps left to right). By ~0.92 everything is set, and the names keep a slow, faint warmth.

/** tau = clamp((p - MAP[0]) / MAP[1]) */
export const MAP = [0.16, 0.56] as const;

export const MELT = [0, 0.1] as const; // PayPal's heat front (start, length)
export const SWELL = [0.05, 0.12] as const; // the drop at the spout grows over this window
export const RUN = 0.12; // the stream leaves the spout
export const FORK = [0.17, 0.245, 0.32] as const; // the front reaches row k's fork (the last fork ends the trunk)
export const REACH = 0.06; // fork -> name
export const FILL = 0.075; // a name fills
export const STOP = 0.46; // the tail leaves the spout; it then runs the front's timeline shifted by LAG
export const LAG = STOP - RUN;
export const COOL = 0.15; // a drained name: hot -> red
export const SET = [0.1, 0.07] as const; // after its run has drained: the bone front starts after [0], sweeps over [1]
export const PP_COOL = [0.46, 0.24] as const; // PayPal: hot -> red
export const PP_SET = [0.62, 0.07] as const; // PayPal: the bone front, left to right
export const DRIP = 0.05; // a bead that falls off a fork sinks over this long

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const tauOf = (p: number) => clamp01((p - MAP[0]) / MAP[1]);

/** The windows of the name in row `row`: fill start/length, cooling start/length, set start/length. */
export function nameTimes(row: number) {
  const a = FORK[row] + REACH;
  const fed = a + LAG; // its run has drained into it
  return { a, d: FILL, c: fed, cd: COOL, ks: fed + SET[0], kd: SET[1] };
}

export const PAYPAL = { a: MELT[0], d: MELT[1], c: PP_COOL[0], cd: PP_COOL[1], ks: PP_SET[0], kd: PP_SET[1] };
