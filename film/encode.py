"""Turn raw renders into the web outputs in public/film/. Needs only numpy + Pillow (no Blender).

    python3 film/encode.py <raw-dir> [iron] [ingots] [ring]

<raw-dir> holds the renders: <raw>/iron/NNN.png, <raw>/ingots/<slug>.png, <raw>/ring/NNN.png, <raw>/ring-still/000.png.
Every frame gets the house grade (film/grade.py): warm highlights, blacks lifted to the page colour, a vignette to
exactly #0d0d0b at the edges. Sequences are encoded at the target quality, then the quality steps down until the
whole set fits its byte budget.

iron: only the keyframes listed in film/iron.py (KEYS) are rendered. The frames between them in the solid phase are
synthesised here: the camera only zooms (a pure scale about the centre), so each neighbouring keyframe is rescaled
to the in-between frame's zoom and the two are blended by distance. Nothing moves in that phase but a smooth
temperature step, so the blend is indistinguishable from a render.
"""
import io
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import grade  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, 'public', 'film')
N = 96


def zoom(i):  # must match film/iron.py
    return 1.0 + 0.32 * i / (N - 1)


def scale_about_centre(a, s):
    """Rescale an HxWx3 float image about its centre by s (s > 1 zooms in), keeping its size."""
    h, w = a.shape[:2]
    cx, cy = w / 2, h / 2
    out = np.empty_like(a)
    data = (1 / s, 0, cx - cx / s, 0, 1 / s, cy - cy / s)
    for c in range(3):
        im = Image.fromarray(a[..., c].astype(np.float32), 'F')
        out[..., c] = np.asarray(im.transform((w, h), Image.AFFINE, data, resample=Image.BICUBIC), np.float32)
    # outside the source (only when zooming out): fall back to nothing; the caller blends it away
    if s < 1:
        mx, my = int(np.ceil(cx - cx * s)) + 1, int(np.ceil(cy - cy * s)) + 1
        mask = np.zeros((h, w), bool)
        mask[my:h - my, mx:w - mx] = True
        return out, mask
    return out, np.ones((h, w), bool)


def iron_frames(raw):
    keys = sorted(int(f[:3]) for f in os.listdir(raw) if f.endswith('.png'))
    cache = {}

    def key(k):
        if k not in cache:
            cache[k] = grade.load(os.path.join(raw, f'{k:03d}.png'))
        return cache[k]

    for i in range(N):
        if i in keys:
            yield i, key(i)
            continue
        A = max(k for k in keys if k < i)
        B = min(k for k in keys if k > i)
        t = (i - A) / (B - A)
        a, _ = scale_about_centre(key(A), zoom(i) / zoom(A))
        b, mb = scale_about_centre(key(B), zoom(i) / zoom(B))
        wb = np.where(mb, t, 0.0)[..., None]
        yield i, a * (1 - wb) + b * wb
        for k in [k for k in cache if k < A]:
            del cache[k]


def bloom(a, threshold=0.75, radius=0.02, strength=0.22):
    """A restrained glow around the hottest highlights (a lens would show a little)."""
    lum = a @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    hi = a * grade.smoothstep(threshold, 1.0, lum)[..., None]
    r = max(1, int(radius * a.shape[1]))
    b = hi
    for _ in range(3):  # three box passes ~ a gaussian
        b = box(b, r)
    return 1 - (1 - a) * (1 - np.clip(b * strength * 3, 0, 1))


def box(a, r):
    for ax in (0, 1):
        c = np.cumsum(np.pad(a, [(r + 1, r) if k == ax else (0, 0) for k in range(a.ndim)], mode='edge'), axis=ax)
        hi = np.take(c, np.arange(2 * r + 1, c.shape[ax]), axis=ax)
        lo = np.take(c, np.arange(0, c.shape[ax] - 2 * r - 1), axis=ax)
        a = (hi - lo) / (2 * r + 1)
    return a


def webp(img, q):
    b = io.BytesIO()
    img.save(b, 'WEBP', quality=q, method=6)
    return b.getvalue()


def encode_sequence(name, frames, widths, budgets, qualities, extra=None):
    """frames: iterable of (i, graded float image). Writes public/film/<name>/<w>/NNN.webp within budget."""
    imgs = {}
    for i, a in frames:
        im = grade.to_image(a)
        for w in widths:
            h = round(im.height * w / im.width)
            imgs[(w, i)] = im.resize((w, h), Image.LANCZOS) if im.width != w else im
        if extra:
            extra(i, im)
    for w, budget, q0 in zip(widths, budgets, qualities):
        q = q0
        while True:
            data = {i: webp(imgs[(w, i)], q) for (ww, i) in imgs if ww == w}
            total = sum(len(d) for d in data.values())
            if total <= budget or q <= 40:
                break
            q -= 3
        d = os.path.join(PUBLIC, name, str(w))
        os.makedirs(d, exist_ok=True)
        for i, blob in data.items():
            with open(os.path.join(d, f'{i:03d}.webp'), 'wb') as f:
                f.write(blob)
        print(f'{name}/{w}: {len(data)} frames, q{q}, {total / 1e6:.2f} MB (budget {budget / 1e6:.1f} MB)')


def save_still(path, im, q=82):
    with open(path, 'wb') as f:
        f.write(webp(im, q))
    print(f'{os.path.relpath(path, ROOT)}: {os.path.getsize(path) / 1e3:.0f} KB')


def iron(raw):
    out = os.path.join(PUBLIC, 'iron')
    os.makedirs(out, exist_ok=True)

    def poster(i, im):
        if i == 70:
            save_still(os.path.join(out, 'poster-1600.webp'), im.resize((1600, 900), Image.LANCZOS), 80)
            save_still(os.path.join(out, 'poster-800.webp'), im.resize((800, 450), Image.LANCZOS), 76)

    frames = ((i, grade.grade(a, warm=1.0, vig=(0.62, 0.97))) for i, a in iron_frames(os.path.join(raw, 'iron')))
    encode_sequence('iron', frames, (1600, 800), (3.5e6, 1.2e6), (72, 68), poster)


def ingots(raw):
    out = os.path.join(PUBLIC, 'ingots')
    os.makedirs(out, exist_ok=True)
    for slug in ('sites', 'verge', 'trellis'):
        p = os.path.join(raw, 'ingots', f'{slug}.png')
        if not os.path.exists(p):
            print('missing', p)
            continue
        im = grade.to_image(grade.grade(grade.load(p), warm=1.0, vig=(0.68, 0.97)))
        for w, q in ((2400, 80), (1200, 80), (600, 78)):
            save_still(os.path.join(out, f'{slug}-{w}.webp'), im.resize((w, round(im.height * w / im.width)), Image.LANCZOS), q)


def ring(raw):
    def g(a):
        return grade.grade(bloom(a), warm=1.0, vig=(0.74, 0.97))

    d = os.path.join(raw, 'ring')
    frames = ((i, g(grade.load(os.path.join(d, f'{i:03d}.png')))) for i in range(N))
    encode_sequence('ring', frames, (1200, 600), (3.0e6, 1.0e6), (74, 70))
    still = os.path.join(raw, 'ring-still', '000.png')
    if os.path.exists(still):
        save_still(os.path.join(PUBLIC, 'ring', 'still-2400.webp'), grade.to_image(g(grade.load(still))), 84)


if __name__ == '__main__':
    raw = sys.argv[1]
    jobs = sys.argv[2:] or ['iron', 'ingots', 'ring']
    for j in jobs:
        globals()[j](raw)
