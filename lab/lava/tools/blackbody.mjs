// Planck x CIE 1931 (Wyman, Sloan & Shirley 2013 multi-lobe fit) -> linear sRGB (D65), for the lava's emission.
// Prints a GLSL table: chroma (rgb / Y, gamut-clamped) and ln(Y) per temperature, relative to TREF.
const g = (x, m, s1, s2) => { const t = (x - m) / (x < m ? s1 : s2); return Math.exp(-0.5 * t * t); };
const xb = l => 1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2);
const yb = l => 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1);
const zb = l => 1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8);
const c2 = 1.4388e7; // nm K
const planck = (l, T) => 1 / (Math.pow(l, 5) * (Math.exp(c2 / (l * T)) - 1));
function xyz(T) { let X = 0, Y = 0, Z = 0; for (let l = 380; l <= 780; l += 1) { const p = planck(l, T); X += p * xb(l); Y += p * yb(l); Z += p * zb(l); } return [X, Y, Z]; }
const toRGB = ([X, Y, Z]) => [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.2040 * Y + 1.0570 * Z];
const T0 = +process.argv[2] || 700, T1 = +process.argv[3] || 2700, N = +process.argv[4] || 41, TREF = 1300;
const Yref = xyz(TREF)[1];
const rows = [];
for (let i = 0; i < N; i++) {
  const T = T0 + (T1 - T0) * i / (N - 1);
  const c = xyz(T); let rgb = toRGB(c).map(v => v / c[1]);
  // out of gamut at low T (redder than sRGB red): clamp negatives, keep luminance by renormalising
  rgb = rgb.map(v => Math.max(v, 0));
  const Y = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  rgb = rgb.map(v => v / Y);
  rows.push([rgb, Math.log(c[1] / Yref), T]);
}
console.log(`// blackbody, ${T0}..${T1} K in ${N} steps: linear sRGB chroma (unit luminance) and ln(Y / Y(${TREF} K))`);
console.log(`const vec4 LV_BB[${N}] = vec4[${N}](`);
console.log(rows.map(([c, ly]) => `  vec4(${c.map(v => v.toFixed(4)).join(', ')}, ${ly.toFixed(4)})`).join(',\n') + ');');
