#!/usr/bin/env python3
"""The founders' portraits as CRT stills: an image shown on a cathode-ray tube at night, in the site's bone.

  python3 scripts/crt-portraits.py                 every person in PEOPLE
  python3 scripts/crt-portraits.py jacob           one person

Source photos stay OUT of git: put them in public/team/src/<name>.jpg (or .png/.webp; any size, roughly head and
shoulders, the face near the middle; they are cropped to 5:6 around the centre). public/team/src/ is gitignored.
Without a source photo the person gets the placeholder (// TODO(jakob)): the same tube showing "No signal" and their
name over faint snow, through the same pipeline, so nothing fake ever stands in for a face.
Writes public/team/<name>-crt.webp (800 x 960, transparent around the tube). Needs Pillow + numpy; the placeholder's
lettering uses the site's own Archivo (fontTools + brotli to read the woff2), else DejaVu Sans.

Why monochrome bone and not an RGB shadow mask: on this site colour means temperature and Ember is the only accent, so
a full-colour mask (green and blue triads) would bring in colours the site never uses and read as a filter. A
monochrome tube is truer anyway (terminals and monitors were white-phosphor tubes): bone phosphor on dark glass, the
same bone as the type, with a warm bloom (light comes from the heat) and a trace of misconvergence at the edges.

The pipeline (all in numpy, no randomness except the seeded snow):
1. signal: the photo, cropped to 5:6, to luminance, levels stretched (1st..99.5th percentile), gamma for the tube.
2. raster: LINES scanlines. Each line is the signal sampled along it (blurred along the line: the beam is continuous);
   the beam's vertical profile is a gaussian that grows with brightness (bright lines bloom fatter, dark ones are thin
   threads with black between: the look of a real tube).
3. mask: a fine aperture grille (vertical phosphor stripes) modulates the light a little.
4. geometry: the picture is barrel-distorted onto the curved face, which has rounded corners and darker edges.
5. bloom: two blurs of the light added back, warm; edge chroma: red and blue a fraction of a pixel apart, radially.
6. glass: the tube face is dark glass (partly transparent, so the page's liquid still shows a little), with one soft
   reflection; outside the face everything is transparent.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
TEAM = os.path.join(ROOT, 'public', 'team')
SRC = os.path.join(TEAM, 'src')
PEOPLE = {'jacob': 'Jacob Schopp', 'charlie': 'Charles Rochford'}

W, H = 800, 960  # output, 5:6
LINES = 168  # scanlines over the face
BONE = np.array([0xE8, 0xE4, 0xD8]) / 255  # --bone: the phosphor
WARM = np.array([0xFF, 0xB3, 0x47]) / 255  # --ember-hot: the bloom's warmth
GLASS = np.array([0x0B, 0x0B, 0x09]) / 255
CURVE = 0.07  # barrel distortion
INSET = 0.035  # the face's margin inside the image
RADIUS = 0.085  # corner radius, of the width


def blur(a, r):
    """Separable gaussian (sigma r px), edges clamped."""
    if r <= 0:
        return a
    n = int(r * 3)
    k = np.exp(-0.5 * (np.arange(-n, n + 1) / r) ** 2)
    k /= k.sum()
    p = np.pad(a, n, mode='edge')
    p = np.apply_along_axis(lambda m: np.convolve(m, k, mode='valid'), 1, p)
    return np.apply_along_axis(lambda m: np.convolve(m, k, mode='valid'), 0, p)


def archivo(size, weight=640, width=112):
    try:
        import io
        from fontTools.ttLib import TTFont
        from fontTools.varLib import instancer

        f = TTFont(os.path.join(ROOT, 'app', 'fonts', 'Archivo-latin-wght400-800-wdth100-125.woff2'))
        f = instancer.instantiateVariableFont(f, {'wght': weight, 'wdth': width})
        f.flavor = None
        buf = io.BytesIO()
        f.save(buf)
        buf.seek(0)
        return ImageFont.truetype(buf, size)
    except Exception as e:  # noqa: BLE001
        print('  (Archivo unavailable, using DejaVu Sans:', e, ')')
        for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/Library/Fonts/Arial Bold.ttf']:
            if os.path.exists(p):
                return ImageFont.truetype(p, size)
        return ImageFont.load_default()


def photo_signal(path):
    im = Image.open(path).convert('L')
    w, h = im.size
    if w / h > W / H:
        nw = int(h * W / H)
        im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = int(w * H / W)
        im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    a = np.asarray(im.resize((W, H), Image.LANCZOS), dtype=np.float64) / 255
    lo, hi = np.percentile(a, 1), np.percentile(a, 99.5)
    a = np.clip((a - lo) / max(hi - lo, 1e-3), 0, 1)
    return a ** 1.15


def placeholder_signal(name, seed):
    """No signal yet: the raster lit just above black, faint snow, and the person's name. // TODO(jakob): photos."""
    rng = np.random.default_rng(seed)
    a = np.full((H, W), 0.018)
    # snow: per-line noise, stretched a little along the line like a real tube's
    snow = rng.random((LINES * 2, W // 2))
    snow = np.asarray(Image.fromarray((snow * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR), dtype=np.float64) / 255
    a += (snow ** 5) * 0.2
    img = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(img)
    big = archivo(64, 680, 118)
    small = archivo(30, 520, 100)
    for text, font, y, v in [(name, big, H * 0.47, 235), ('No signal', small, H * 0.57, 150)]:
        bb = d.textbbox((0, 0), text, font=font)
        d.text(((W - (bb[2] - bb[0])) / 2 - bb[0], y - (bb[3] - bb[1]) / 2 - bb[1]), text, fill=v, font=font)
    t = np.asarray(img, dtype=np.float64) / 255
    return np.clip(np.maximum(a, t), 0, 1)


def tube(signal):
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float64)
    # normalised face coordinates (-1..1) inside the margin
    u = (xs / (W - 1) * 2 - 1) / (1 - 2 * INSET)
    v = (ys / (H - 1) * 2 - 1) / (1 - 2 * INSET)
    # barrel: the picture bulges out to the face's edges
    r2 = u * u * 0.8 + v * v
    su = u * (1 + CURVE * r2) / (1 + CURVE)
    sv = v * (1 + CURVE * r2) / (1 + CURVE)
    # the face: a rounded rectangle with a soft edge
    ax, ay = np.abs(u), np.abs(v)
    rr = RADIUS * 2
    qx, qy = np.maximum(ax - (1 - rr), 0), np.maximum(ay - (1 - rr * W / H), 0)
    corner = np.sqrt((qx / rr) ** 2 + (qy / (rr * W / H)) ** 2)
    edge = np.maximum(np.maximum(ax, ay), corner)
    face = np.clip((1 - edge) / 0.012, 0, 1)

    # the signal along each scanline: sample at the line centres, blurred along the line
    line_y = (np.arange(LINES) + 0.5) / LINES
    sig = blur(signal, 1.6)
    out = np.zeros((H, W))
    py = (sv * 0.5 + 0.5) * LINES - 0.5  # position in line units
    px = np.clip((su * 0.5 + 0.5) * (W - 1), 0, W - 1)
    base = np.floor(py).astype(int)
    xi = px.astype(int)
    for off in (-1, 0, 1, 2):
        li = np.clip(base + off, 0, LINES - 1)
        sy = np.clip((line_y[li] * (H - 1)).astype(int), 0, H - 1)
        lum = sig[sy, xi]
        sigma = 0.2 + 0.24 * np.sqrt(lum)  # line units: bright lines are fatter
        dist = py - li
        out += lum * np.exp(-0.5 * (dist / sigma) ** 2) * (0.62 / (0.2 + 0.24 * np.sqrt(np.maximum(lum, 0.05))))
    out = np.clip(out, 0, 1.6)
    # aperture grille: vertical stripes, 3 px
    grille = 0.82 + 0.18 * (0.5 + 0.5 * np.cos(xs * 2 * np.pi / 3.0))
    light = out * grille
    # vignette towards the face's edges (the beam is weaker at the corners)
    light *= 1 - 0.32 * np.clip(r2 / 2, 0, 1) ** 1.4
    light *= face
    bloom = blur(light, 5) * 0.34 + blur(light, 22) * 0.2
    # colour: bone phosphor, a warm bloom, a fraction of a pixel of chroma at the edges
    rgb = light[..., None] * BONE + bloom[..., None] * (0.55 * BONE + 0.45 * WARM)
    shift = np.clip(r2, 0, 2) * 0.9
    for ch, sgn in ((0, 1), (2, -1)):
        sx = np.clip(xs + sgn * shift * u, 0, W - 1)
        sy2 = np.clip(ys + sgn * shift * v, 0, H - 1)
        rgb[..., ch] = rgb[..., ch][sy2.astype(int), sx.astype(int)]
    # glass: dark, partly see-through, one soft reflection at the upper left
    refl = np.exp(-(((u + 0.45) / 0.55) ** 2 + ((v + 0.62) / 0.3) ** 2)) * 0.05
    glass_a = 0.72 * face
    emit = np.clip(rgb + refl[..., None] * face[..., None], 0, 1)
    e = np.clip(emit.max(axis=2), 0, 1)
    alpha = glass_a + e * (1 - glass_a)
    col = (GLASS * (glass_a * (1 - e))[..., None] + emit) / np.maximum(alpha, 1e-4)[..., None]
    # the bloom reaches a little past the face onto the page
    halo = blur(light, 18) * 0.22 * (1 - face)
    alpha = np.clip(alpha + halo, 0, 1)
    col = np.where((face < 1e-3)[..., None], (0.5 * BONE + 0.5 * WARM), col)
    rgba = np.dstack([np.clip(col, 0, 1), alpha])
    return Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), 'RGBA')


def main():
    who = sys.argv[1:] or list(PEOPLE)
    for i, key in enumerate(who):
        src = next((os.path.join(SRC, key + e) for e in ('.jpg', '.jpeg', '.png', '.webp') if os.path.exists(os.path.join(SRC, key + e))), None)
        signal = photo_signal(src) if src else placeholder_signal(PEOPLE[key], seed=7 + i)
        out = os.path.join(TEAM, f'{key}-crt.webp')
        tube(signal).save(out, 'WEBP', quality=76, method=6)
        print(f'{out}: {"photo " + os.path.basename(src) if src else "placeholder (no signal)"}')


if __name__ == '__main__':
    main()
