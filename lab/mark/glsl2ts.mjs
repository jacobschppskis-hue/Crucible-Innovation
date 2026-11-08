// Regenerates lib/world/glsl/mark.ts (the shader as a string for the world's composer) from mark.glsl, the source of
// truth. Run after every edit: node lab/mark/glsl2ts.mjs
import fs from 'node:fs';
const src = new URL('../../lib/world/glsl/mark.glsl', import.meta.url);
const out = new URL('../../lib/world/glsl/mark.ts', import.meta.url);
const g = fs.readFileSync(src, 'utf8');
if (g.includes('`') || g.includes('${')) throw new Error('backtick or ${ in GLSL');
fs.writeFileSync(out, `// GENERATED from mark.glsl by lab/mark/glsl2ts.mjs: edit the .glsl, then regenerate.\n/** The hero's mark and the stronger-together beat: markTrace / markCorePos / markCoreRadiance and their uniforms (see the .glsl header). */\nexport const MARK_GLSL = /* glsl */ \`\n${g}\`;\n`);
console.log('wrote', out.pathname);
