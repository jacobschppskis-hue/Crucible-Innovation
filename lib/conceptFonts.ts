import { Instrument_Serif } from 'next/font/google';

// Faces for the concept client sites (components/LiveSite.tsx), not for Crucible's own type. A café would use a serif;
// Crucible doesn't. Only pages that render a LiveSite apply these variables, so other pages never download them.
const italic = Instrument_Serif({ subsets: ['latin'], weight: '400', style: 'italic', variable: '--font-instrument', display: 'swap', preload: false });
const upright = Instrument_Serif({ subsets: ['latin'], weight: '400', style: 'normal', variable: '--font-instrument-upright', display: 'swap', preload: false });

export const conceptFonts = `${italic.variable} ${upright.variable}`;
