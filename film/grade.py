"""The house grade, applied to every rendered frame on its way to the web (numpy + Pillow, no Blender needed).

1. Warm highlights: AgX renders bright, saturated blackbody reds as salmon-peach. A camera would clip them to
   yellow-white, so warm highlights have their hue pulled toward ~38 degrees (#ffb347 territory) and a little
   saturation restored. Mid-tones (Ember orange) and everything that isn't warm are left alone.
2. Ground: blacks are lifted to the page colour (#0d0d0b) with a screen blend, so nothing is darker than the page.
3. Vignette toward exactly #0d0d0b at the frame edges, so the image sits seamlessly on the page.
"""
import numpy as np
from PIL import Image

GROUND = np.array([13, 13, 11], np.float32) / 255.0


def load(path):
    """16-bit (or 8-bit) PNG -> float32 RGB in 0..1 (display-referred, after AgX)."""
    im = Image.open(path)
    if im.mode in ('I;16', 'I;16B', 'I'):
        a = np.asarray(im, np.float32) / 65535.0
        return np.stack([a] * 3, -1)
    try:
        import imageio.v3 as iio  # keeps 16 bits if available
        a = iio.imread(path).astype(np.float32)
        return a[..., :3] / (65535.0 if a.max() > 255 else 255.0)
    except Exception:
        return np.asarray(im.convert('RGB'), np.float32) / 255.0


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def rgb_to_hsv(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(-1), a.min(-1)
    d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rr = m & (mx == r)
    gg = m & (mx == g) & ~rr
    bb = m & ~rr & ~gg
    h[rr] = ((g - b)[rr] / d[rr]) % 6
    h[gg] = (b - r)[gg] / d[gg] + 2
    h[bb] = (r - g)[bb] / d[bb] + 4
    h = h * 60.0
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0)
    return h, s, mx


def hsv_to_rgb(h, s, v):
    h = (h % 360) / 60.0
    i = np.floor(h).astype(int) % 6
    f = h - np.floor(h)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    out = np.zeros(h.shape + (3,), np.float32)
    for k, (x, y, z) in enumerate([(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]):
        m = i == k
        out[m] = np.stack([x[m], y[m], z[m]], -1)
    return out


def warm_highlights(a, hue_to=38.0, amount=1.0, sat_boost=0.35):
    h, s, v = rgb_to_hsv(a)
    warm = smoothstep(55, 35, h) * smoothstep(-5, 5, h) * smoothstep(0.05, 0.25, s)
    # only bright, desaturated warm pixels (AgX's peach); saturated Ember orange is left alone
    hl = smoothstep(0.72, 1.0, v) * smoothstep(0.8, 0.35, s) * warm * amount
    h2 = h + (hue_to - h) * hl * 0.8
    s2 = np.clip(s * (1 + sat_boost * hl), 0, 1)
    return hsv_to_rgb(h2, s2, v)


def vignette(shape, inner=0.6, outer=1.0, power=1.0, p=4.0):
    """1 in the middle, exactly 0 at every frame edge: a superellipse falloff that hugs the frame's shape."""
    hgt, wid = shape[:2]
    y, x = np.mgrid[0:hgt, 0:wid].astype(np.float32)
    nx = np.abs((x + 0.5) / wid * 2 - 1)
    ny = np.abs((y + 0.5) / hgt * 2 - 1)
    r = (nx ** p + ny ** p) ** (1 / p)
    return (1 - smoothstep(inner, outer, np.maximum(r, np.maximum(nx, ny)))) ** power


def grade(a, warm=1.0, vig=(0.6, 1.0), vig_power=1.0, edge_px=0):
    a = np.clip(a, 0, 1)
    if warm > 0:
        a = warm_highlights(a, amount=warm)
    a = 1 - (1 - GROUND) * (1 - a)  # lift: nothing darker than the page
    v = vignette(a.shape, *vig, power=vig_power)[..., None]
    a = GROUND + (a - GROUND) * v
    if edge_px:  # guarantee the outermost pixels are exactly the page colour
        a[:edge_px], a[-edge_px:], a[:, :edge_px], a[:, -edge_px:] = GROUND, GROUND, GROUND, GROUND
    return a


def to_image(a):
    return Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))
