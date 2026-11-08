// Regenerates lib/world/glsl/monolith.ts (the shader as a string for the world's composer) from monolith.glsl, the
// source of truth (the lab fetches the .glsl). Run after every edit: node lab/ventures/glsl2ts.mjs
import fs from 'node:fs';
const src = new URL('../../lib/world/glsl/monolith.glsl', import.meta.url);
const out = new URL('../../lib/world/glsl/monolith.ts', import.meta.url);
const g = fs.readFileSync(src, 'utf8');
if (g.includes('`') || g.includes('${')) throw new Error('backtick or ${ in GLSL');
fs.writeFileSync(out, `// GENERATED from monolith.glsl by lab/ventures/glsl2ts.mjs: edit the .glsl, then regenerate.\n/** The ventures' monoliths: monoTrace / monoShade / monoSeaGlow and their uniforms (see the .glsl header). */\nexport const MONOLITH_GLSL = /* glsl */ \`\n${g}\`;\n`);
console.log('wrote', out.pathname);
