#!/usr/bin/env python3
"""Turn the ASCII portraits (public/team/<name>.webp: dark ink on transparent, i.e. ASCII art made for white paper,
where dense characters mean DARK) into luminance-correct ASCII for the black page: public/team/<name>-bone.webp,
bone characters on transparent where dense characters mean LIGHT. A plain recolour would read as a photo negative
(the hair and eyes would glow); this keeps the face lit the way it actually is.

How (there is no source text for these portraits, only the image):
1. Find the character grid of the source (period and phase of the ink along x and y, ~3.96 x 6.47 px).
2. Ink per cell = how dark the photo was there. Luminance = 1 - ink / (dense ink).
3. Subject mask = where the source has ink at all (closed, holes filled, edge feathered), so the background around
   the head stays empty instead of becoming a block of bright characters.
4. Re-type every cell on the same grid with a monospace bold glyph whose ink coverage matches the luminance
   (glyphs ordered by measured coverage; a seeded pick among near matches keeps the hand-made texture), drawn in
   bone at 4x and box-filtered down to the source size (800 x 956), so the components need no change.
Usage: python3 scripts/bone-portraits.py   (needs Pillow + numpy and DejaVu Sans Mono Bold)"""
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFont

BONE = (0xE8, 0xE4, 0xD8)  # --bone
SS = 4  # supersampling for the glyph pass
GAMMA = 2.1  # display tone -> glyph coverage
TOP = 0.92  # densest coverage used, as a share of the densest glyph (keeps the lit skin a texture, not a slab)
FLOOR = 0.9  # coverage of the darkest subject cells, as a share of the lightest glyph
SHARPEN = 0.6  # local contrast of the reconstructed luminance
KEY_FALLOFF = 0.7  # how much the key light drops towards the outline
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'team')
FONTS = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf',
    '/usr/share/fonts/dejavu/DejaVuSansMono-Bold.ttf',
    '/Library/Fonts/DejaVuSansMono-Bold.ttf',
]
# Printable ASCII the source portraits use (letters, digits, punctuation); space is the empty cell.
CHARS = ".,'`:;-_~\"^!|/\\()[]{}<>?*+=ilrtjfcvxzsunoeaykhdbpqgw17325460JYLTCFISZEPKVXHAUOGDRBNQM%&$#@"


def grid(a, axis, lo, hi):
    """Period and phase (ink centroid of the cells) of the character grid along one axis."""
    p = a.sum(axis=axis)
    p = p - p.mean()
    x = np.arange(len(p))
    best = (0.0, 0.0, 0.0)
    for T in np.arange(lo, hi, 0.0025):
        z = (p * np.exp(-2j * np.pi * x / T)).sum()
        if abs(z) > best[0]:
            best = (abs(z), T, (-np.angle(z) / (2 * np.pi) * T) % T)
    return best[1], best[2]


def blur(m, r, rx=None):
    """Separable box blur, radius r cells (rx across, if given), edges clamped."""
    for ax, rr in ((0, r), (1, r if rx is None else rx)):
        k = 2 * rr + 1
        pad = [(0, 0), (0, 0)]
        pad[ax] = (rr, rr)
        q = np.pad(m.astype(float), pad, mode='edge')
        c = np.cumsum(q, axis=ax)
        c = np.concatenate([np.zeros_like(np.take(c, [0], axis=ax)), c], axis=ax)
        m = (np.take(c, range(k, c.shape[ax]), axis=ax) - np.take(c, range(0, c.shape[ax] - k), axis=ax)) / k
    return m


def fill_holes(m, most=80):
    """Enclosed empty pockets of at most `most` cells (blank highlights inside the face) are subject."""
    h, w = m.shape
    out = np.zeros_like(m, dtype=bool)
    stack = [(y, x) for y in range(h) for x in (0, w - 1)] + [(y, x) for x in range(w) for y in (0, h - 1)]
    while stack:
        y, x = stack.pop()
        if out[y, x] or m[y, x]:
            continue
        out[y, x] = True
        if y > 0: stack.append((y - 1, x))
        if y < h - 1: stack.append((y + 1, x))
        if x > 0: stack.append((y, x - 1))
        if x < w - 1: stack.append((y, x + 1))
    m = m.copy()
    seen = out | m
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0, x0]:
                continue
            comp, stack = [], [(y0, x0)]
            seen[y0, x0] = True
            while stack:
                y, x = stack.pop()
                comp.append((y, x))
                for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if 0 <= yy < h and 0 <= xx < w and not seen[yy, xx]:
                        seen[yy, xx] = True
                        stack.append((yy, xx))
            if len(comp) <= most:
                for y, x in comp:
                    m[y, x] = True
    return m


def font_path():
    for f in FONTS:
        if os.path.exists(f):
            return f
    raise SystemExit('DejaVu Sans Mono Bold not found (fonts-dejavu-core)')


def glyphs(font, cw, ch):
    """Coverage and ink centroid of each glyph inside one cell (at SS scale)."""
    out = []
    for c in CHARS:
        im = Image.new('L', (cw * 3, ch * 3), 0)
        ImageDraw.Draw(im).text((cw, ch), c, font=font, fill=255)
        g = np.asarray(im, dtype=float) / 255
        s = g.sum()
        ys, xs = np.mgrid[0:g.shape[0], 0:g.shape[1]]
        out.append((s / (cw * ch), c, (xs * g).sum() / s - cw, (ys * g).sum() / s - ch))
    out.sort()
    return out


def convert(name, fpath):
    src = Image.open(os.path.join(ROOT, f'{name}.webp')).convert('RGBA')
    W, H = src.size
    a = np.asarray(src, dtype=float)[..., 3] / 255
    pw, px = grid(a, 0, 3.5, 6.0)
    ph, py = grid(a, 1, 5.0, 9.0)
    # Cells centred on the ink centroids; each pixel belongs to the nearest cell centre.
    ncol = int(np.floor((W - px) / pw + 0.5)) + 1
    nrow = int(np.floor((H - py) / ph + 0.5)) + 1
    ci = np.clip(np.floor((np.arange(W) - px) / pw + 0.5).astype(int) + 0, 0, ncol - 1)
    ri = np.clip(np.floor((np.arange(H) - py) / ph + 0.5).astype(int), 0, nrow - 1)
    ink = np.zeros((nrow, ncol))
    np.add.at(ink, (ri[:, None].repeat(W, 1), ci[None, :].repeat(H, 0)), a)
    area = np.zeros((nrow, ncol))
    np.add.at(area, (ri[:, None].repeat(W, 1), ci[None, :].repeat(H, 0)), 1.0)
    ink /= np.maximum(area, 1)

    # Subject mask: neighbourhoods where many cells carry ink, outline smoothed, small blank pockets filled.
    has = ink > 0.004
    m = blur(has, 3, 5) > 0.30
    m = blur(m, 2, 3) > 0.5
    m = fill_holes(m)
    # Soft edge (~3 rows / 5 columns): the edge of a lit face fades into the dark instead of ending in a hard rim.
    feather = np.clip(blur(m, 3, 5) * 2 - 1, 0, 1) * m
    # In that edge band only cells the source inked survive, so the outline keeps its own ragged hair strands.
    feather = np.where((feather < 0.99) & ~has, 0.0, feather)

    # Luminance from ink (lightly smoothed so one odd glyph doesn't punch a hole): 1 = lightest skin, 0 = darkest.
    tone = 0.6 * ink + 0.4 * blur(ink, 1)
    dense = np.percentile(tone[m], 96)
    lum = np.clip(1 - tone / dense, 0, 1)
    # A little local contrast (unsharp) brings back the lids, nostrils and lips the source drew as lines.
    lum = np.clip(lum + SHARPEN * (lum - blur(lum, 2, 3)), 0, 1)
    # The source tool spaced its ramp evenly in display (gamma) values; light on black adds up linearly, so
    # glyph coverage follows lum ** GAMMA to keep the mid-tones (eye sockets, cheek shadow) where they were.
    # A gentle key light on the face: the far edges (shoulders, the top of the hair) fall off into the dark.
    rows, cols = np.nonzero(m)
    cy, cx = rows.mean(), cols.mean()
    ry, rx = (rows.max() - rows.min()) / 2, (cols.max() - cols.min()) / 2
    yy, xx = np.mgrid[0:nrow, 0:ncol]
    dist = np.sqrt(((yy - cy) / ry) ** 2 + ((xx - cx) / rx) ** 2)
    key = 1 - KEY_FALLOFF * np.clip((dist - 0.5) / 0.6, 0, 1) ** 2
    light = feather * key * lum ** GAMMA

    fp = fpath
    size = SS * pw / 0.602  # DejaVu Sans Mono advance = 0.602 em
    font = ImageFont.truetype(fp, round(size))
    cw, chh = round(SS * pw), round(SS * ph)
    gl = glyphs(font, cw, chh)
    covs = np.array([g[0] for g in gl])
    cmax = covs[-1]
    cmin = covs[0]
    # Average glyph centroid, so the new glyphs sit where the old ones did.
    ox = float(np.mean([g[2] for g in gl]))
    oy = float(np.mean([g[3] for g in gl]))

    rng = random.Random(name)
    canvas = Image.new('L', (W * SS, H * SS), 0)
    d = ImageDraw.Draw(canvas)
    lo = cmin * 0.45  # below this a cell stays empty
    for r in range(nrow):
        for k in range(ncol):
            f = feather[r, k]
            if f <= 0:
                continue
            # Dark areas (hair, pupils, shadow) keep a faint dotted texture so the head keeps its shape.
            t = f * cmin * FLOOR + (TOP * cmax - f * cmin * FLOOR) * light[r, k]
            t += rng.uniform(-0.3, 0.3) * cmin  # dither between the sparse levels
            if t < lo:
                continue
            j = int(np.searchsorted(covs, t))
            near_ = [i for i in range(max(0, j - 3), min(len(gl), j + 3)) if abs(covs[i] - t) <= max(0.12 * t, 0.012)]
            i = rng.choice(near_) if near_ else int(np.argmin(abs(covs - t)))
            c = gl[i][1]
            x = SS * (px + k * pw) - ox
            y = SS * (py + r * ph) - oy
            d.text((x, y), c, font=font, fill=255)
    alpha = canvas.resize((W, H), Image.BOX)
    # 16 alpha levels like the source: invisible on screen, roughly halves the lossless file.
    alpha = alpha.point(lambda v: min(255, round(v / 17) * 17))
    out = Image.new('RGBA', (W, H), BONE + (0,))
    out.putalpha(alpha)
    out.save(os.path.join(ROOT, f'{name}-bone.webp'), lossless=True, quality=100, method=6)
    print(f'{name}: grid {pw:.3f} x {ph:.3f} px, {ncol} x {nrow} cells, glyph coverage {cmin:.3f}..{cmax:.3f}')


if __name__ == '__main__':
    fp = font_path()
    for n in ('jacob', 'charlie'):
        convert(n, fp)
