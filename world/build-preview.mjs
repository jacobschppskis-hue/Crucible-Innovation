// npm run world:preview: the built home page (out/index.html, after `npm run build`) as ONE self-contained HTML file,
// world/dist/crucible.html: the static markup, every stylesheet and font inline, images inline, and one esbuild bundle
// of world/preview-entry.ts (the world + its modules). Next's own scripts are dropped (React behaviour on the home page
// is not part of the contract: modules own the behaviour). It renders standalone and inside the claude.ai artifact
// frame (plan/final/artifact-frame-head.html sets body{background:#fff}; we override it).
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'out');
const DIST = path.join(ROOT, 'world/dist');
fs.mkdirSync(DIST, { recursive: true });
let html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');

const mime = { '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.avif': 'image/avif' };
const dataUri = (p) => {
  const f = path.join(OUT, decodeURIComponent(p.split('?')[0]));
  if (!fs.existsSync(f)) return null;
  return `data:${mime[path.extname(f)] || 'application/octet-stream'};base64,${fs.readFileSync(f).toString('base64')}`;
};

// stylesheets inline (with their fonts and images)
html = html.replace(/<link rel="stylesheet" href="([^"]+)"[^>]*\/?>/g, (_, href) => {
  let css = fs.readFileSync(path.join(OUT, href), 'utf8');
  css = css.replace(/url\((['"]?)(\/[^)'"]+)\1\)/g, (m, q, u) => {
    const d = dataUri(u);
    return d ? `url(${d})` : m;
  });
  return `<style>${css}</style>`;
});
// drop preloads, Next's scripts (keep JSON-LD and the tiny inline head script that sets html.js/data-tier)
html = html.replace(/<link rel="preload"[^>]*\/?>/g, '');
html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g, (m, attrs, body) => {
  if (/application\/ld\+json/.test(attrs)) return m;
  if (/src=/.test(attrs)) return '';
  if (/__next_f|__NEXT|self\.__next/.test(body)) return '';
  return m;
});
// images inline (srcset dropped: one source)
html = html.replace(/<img\b[^>]*>/g, (tag) => {
  tag = tag.replace(/\s(srcSet|srcset|sizes)="[^"]*"/g, '');
  return tag.replace(/src="(\/[^"]+)"/, (m, u) => {
    const d = dataUri(u);
    return d ? `src="${d}"` : m;
  });
});
// internal links point at the live site (the preview is one page)
html = html.replace(/href="\/#([^"]*)"/g, 'href="#$1"'); // the home page's own sections stay in the preview
html = html.replace(/href="\/(?!\/)([^"]*)"/g, (m, p) => (p === '' ? 'href="#top"' : `href="https://crucibleinnovation.com/${p}"`));

const js = await build({
  entryPoints: [path.join(ROOT, 'world/preview-entry.ts')],
  bundle: true,
  format: 'iife',
  minify: true,
  target: ['es2020', 'safari15'],
  write: false,
  loader: { '.glsl': 'text' },
  alias: { '@': ROOT },
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
});
const bundle = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
// the artifact frame serves its own <html>: carry ours over (the font variable class, lang)
const htmlCls = (html.match(/<html[^>]*class="([^"]*)"/) || [])[1] || '';
const carry = `<script>document.documentElement.lang='en';document.documentElement.classList.add(${JSON.stringify(htmlCls.split(/\s+/).filter(Boolean)).slice(1, -1)})</script>`;
const frameFix = carry + `<style>html,body{background:transparent!important;color:#E8E4D8!important}html{background:#050403!important}body{font:inherit;margin:0}</style>`;
// (replacer functions: the bundle contains `$'`-like sequences that string replacements would expand)
html = html.replace('</head>', () => `${frameFix}</head>`).replace('</body>', () => `<script>${bundle}</script></body>`);
fs.writeFileSync(path.join(DIST, 'crucible.html'), html);
// the same file wrapped the way the artifact frame serves it, for tests
const head = fs.readFileSync(path.join(ROOT, 'plan/final/artifact-frame-head.html'), 'utf8');
const body = html.replace(/^[\s\S]*?<body[^>]*>/, '').replace(/<\/body>[\s\S]*$/, '');
const headInner = (html.match(/<head>([\s\S]*?)<\/head>/) || [])[1] || '';
fs.writeFileSync(path.join(DIST, 'crucible-framed.html'), head + headInner + body + '</body></html>');
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`world/dist/crucible.html ${kb(Buffer.byteLength(html))} (script ${kb(Buffer.byteLength(bundle))})`);
