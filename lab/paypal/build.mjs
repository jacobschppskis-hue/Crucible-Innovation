// node lab/paypal/build.mjs -> lab/paypal/paypal.js (the module with its types stripped, for the lab page)
import { stripTypeScriptTypes } from 'node:module'; import fs from 'node:fs';
const src = fs.readFileSync(new URL('../../lib/world/paypal.ts', import.meta.url), 'utf8');
fs.writeFileSync(new URL('./paypal.js', import.meta.url), stripTypeScriptTypes(src, { mode: 'strip' }));
