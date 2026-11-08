// node lab/paypal/stage-build.mjs -> lab/paypal/stage.js and stage.css (PayPal.css + World.css)
import { build } from 'esbuild';
import fs from 'node:fs';
const here = new URL('.', import.meta.url).pathname;
await build({ entryPoints: [here + 'stage-entry.ts'], bundle: true, format: 'esm', outfile: here + 'stage.js', loader: { '.glsl': 'text' },
  alias: { '@': new URL('../..', import.meta.url).pathname.replace(/\/$/, '') }, logLevel: 'warning', target: 'es2022' });
fs.writeFileSync(here + 'stage.css', ['../../components/world/World.css', '../../components/world/PayPal.css'].map((f) => fs.readFileSync(here + f, 'utf8')).join('\n'));
