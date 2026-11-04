#!/usr/bin/env python3
"""
Engrave the team portraits: ASCII-art portrait -> intaglio-style line engraving.

    python3 scripts/engrave.py                    # all portraits -> public/team/<name>-engraved.webp
    python3 scripts/engrave.py jacob              # just one
    python3 scripts/engrave.py --preview DIR      # also write previews on the bone card colour to DIR
    python3 scripts/engrave.py --set spacing=6    # override a setting (repeatable), for experiments

Needs only Python 3 with Pillow and numpy. Re-runnable: it always starts from the ASCII originals
(public/team/<name>.webp, dark ink on transparent) and overwrites the -engraved outputs; the
originals are never touched. No photos are involved anywhere (owner's rule: no real photos).

How it works (all settings live in SETTINGS below and are shared by every portrait, so they match
as a set):
  1. Tone. The ink alpha of the ASCII art is blurred until the characters fuse into continuous tone,
     smoothed harder where there is no structure (skin, so stray characters don't speckle it) than
     where there is (eyes, mouth, hair), given a little local contrast, and normalised.
     A silhouette mask and a soft frame fade everything to nothing towards the edges.
  2. Line field. Two families of lines are defined as level sets of a phase field phi. Their
     direction starts from a gentle diagonal bowed over a "dome" (a blurred silhouette, so the
     lines wrap around the head), then bends towards the tone's isophotes (structure tensor at two
     scales) wherever the image has oriented structure: along hair, around eyes, nose, mouth and
     jaw. The bend is capped so lines never fold. phi is recovered from that direction field with
     a least-squares (Poisson, FFT) solve, which keeps the lines continuous and evenly spaced.
  3. Engrave. Line width follows darkness: the first family carries the light and mid tones; a
     cross-hatch family (rotated by `cross` degrees) comes in only in the darkest areas (hair,
     pupils, deep shadows). Highlights get no lines at all. Strokes are rendered analytically at
     `supersample`x with anti-aliased edges, then box-downsampled.
  4. Output: dark ink (#16150f) on transparent, same aspect as the original, OUT_WIDTH px wide,
     WebP with a lossless alpha channel.
"""
from __future__ import annotations

import argparse
import os
import sys
import time

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEAM = os.path.join(ROOT, "public", "team")
NAMES = ["jacob", "charlie"]

INK = (0x16, 0x15, 0x0F)
BONE = (0xE8, 0xE4, 0xD8)
OUT_WIDTH = 1000

SETTINGS = dict(
    # tone
    char_blur=2.5,      # px (source): blur that fuses the ASCII characters into tone
    skin_blur=7.0,      # px: extra smoothing where the image has no structure
    local_contrast=0.5, # unsharp amount (radius 12 px) to bring back features
    gamma=1.0,          # <1 lifts light midtones (darker overall), >1 keeps it high-key
    threshold=0.04,     # tone below this is a highlight: no lines
    max_ink=0.94,       # coverage in the very darkest areas
    edge_fade=0.06,     # fraction of width/height over which lines fade out at the frame
    # line field
    angle=-25.0,        # base direction of the main family, degrees (0 = horizontal)
    dome=0.35,          # how strongly lines bow over the head (max added gradient)
    follow_fine=1.0,    # pull towards fine-scale isophotes (hair, features)
    follow_form=1.0,    # pull towards large-scale isophotes (cheeks, forehead, jaw)
    max_bend=55.0,      # degrees: cap on how far lines may turn from the base direction
    contour=0.5,        # 0 = off; higher draws more of the thin feature lines as strokes
    contour_scale=2.5,  # px (source): width of the features the contour strokes pick up
    # engraving
    spacing=5.5,        # line pitch in output px
    cross=60.0,         # cross-hatch rotation, degrees
    main_cap=0.55,      # max coverage of the main family before cross-hatching starts
    supersample=4,
)


# ---------------------------------------------------------------- helpers

def gblur(img: np.ndarray, sigma: float) -> np.ndarray:
    """Gaussian blur (FFT, reflect-padded)."""
    img = np.asarray(img, np.float64)
    if sigma <= 0:
        return img
    pad = int(3 * sigma) + 2
    p = np.pad(img, pad, mode="reflect")
    fy = np.fft.fftfreq(p.shape[0])[:, None]
    fx = np.fft.rfftfreq(p.shape[1])[None, :]
    g = np.exp(-2 * (np.pi * sigma) ** 2 * (fx * fx + fy * fy))
    out = np.fft.irfft2(np.fft.rfft2(p) * g, s=p.shape)
    return out[pad:-pad, pad:-pad]


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def poisson_neumann(f: np.ndarray) -> np.ndarray:
    """Solve lap(u) = f with zero-flux borders (mirror extension + FFT)."""
    h, w = f.shape
    fe = np.block([[f, f[:, ::-1]], [f[::-1, :], f[::-1, ::-1]]])
    ky = np.fft.fftfreq(2 * h)[:, None]
    kx = np.fft.fftfreq(2 * w)[None, :]
    lap = (2 * np.cos(2 * np.pi * kx) - 2) + (2 * np.cos(2 * np.pi * ky) - 2)
    lap[0, 0] = 1
    u = np.fft.fft2(fe) / lap
    u[0, 0] = 0
    return np.real(np.fft.ifft2(u))[:h, :w]


def structure(d: np.ndarray, pre: float, rho: float):
    """Orientation (double angle) of the tone gradient, plus a 0..1 confidence weight."""
    gy, gx = np.gradient(gblur(d, pre))
    jxx, jyy, jxy = gblur(gx * gx, rho), gblur(gy * gy, rho), gblur(gx * gy, rho)
    tr = jxx + jyy + 1e-12
    ex, ey = jxx - jyy, 2 * jxy
    coherence = np.hypot(ex, ey) / tr
    strength = smoothstep(0.0, np.percentile(tr, 90), tr)
    return np.arctan2(ey, ex), coherence * strength


# ---------------------------------------------------------------- pipeline

def tone(alpha: np.ndarray, s: dict) -> np.ndarray:
    h, w = alpha.shape
    sharp = gblur(alpha, s["char_blur"])
    soft = gblur(alpha, s["skin_blur"])
    gy, gx = np.gradient(gblur(alpha, 4.0))
    e = gblur(np.hypot(gx, gy), 6)
    detail = smoothstep(np.percentile(e, 55), np.percentile(e, 85), e)
    base = detail * sharp + (1 - detail) * soft
    d = base + s["local_contrast"] * (base - gblur(alpha, 12))
    d = np.clip(d / np.percentile(d, 99.6), 0, 1)
    # silhouette: anywhere the ASCII art put ink nearby
    sil = smoothstep(0.03, 0.15, gblur((alpha > 0.05).astype(float), 10))
    yy, xx = np.mgrid[0:h, 0:w]
    frame = np.minimum.reduce([xx / w, (w - 1 - xx) / w, yy / h, (h - 1 - yy) / h])
    fade = sil * smoothstep(0, s["edge_fade"], frame)
    # contour strokes: thin dark ridges (lid lines, lips, nostrils) narrower than the line pitch
    rs = s["contour_scale"]
    gy, gx = np.gradient(gblur(alpha, rs))
    hxy, hxx = np.gradient(gx)
    hyy = np.gradient(gy, axis=0)
    lam = (hxx + hyy) / 2 - np.sqrt(((hxx - hyy) / 2) ** 2 + hxy ** 2)
    ridge = np.maximum(0, -lam) * rs * rs
    ridge = ridge / np.percentile(ridge, 99.7) * fade
    return d * fade, sil, ridge


def phase(d: np.ndarray, sil: np.ndarray, s: dict, rotate: float, scale: float) -> tuple:
    """Phase field (output px) whose level sets are the lines, and its gradient magnitude."""
    h, w = d.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    th = np.deg2rad(s["angle"])
    nx, ny = -np.sin(th), np.cos(th)                # normal of the base lines
    dome = gblur(sil, 45)
    dome /= np.hypot(*np.gradient(dome)).max()
    gy, gx = np.gradient(xx * nx + yy * ny + s["dome"] * dome)
    a0 = np.arctan2(gy, gx)                         # base normal angle, bowed over the head
    vx, vy = np.cos(2 * a0), np.sin(2 * a0)         # orientations blend as double angles
    for key, pre, rho in (("follow_fine", 2.0, 10.0), ("follow_form", 6.0, 25.0)):
        ang, wt = structure(d, pre, rho)
        vx = vx + 3 * s[key] * wt * np.cos(ang)
        vy = vy + 3 * s[key] * wt * np.sin(ang)
    vx, vy = gblur(vx, 6), gblur(vy, 6)
    al = 0.5 * np.arctan2(vy, vx)
    dev = (al - a0 + np.pi / 2) % np.pi - np.pi / 2  # signed turn from the base, never flips
    cap = np.deg2rad(s["max_bend"])
    al = a0 + cap * np.tanh(dev / cap) + np.deg2rad(rotate)
    # phi = straight ramp + least-squares correction towards the bent normals
    tr = th + np.deg2rad(rotate)
    lx, ly = -np.sin(tr), np.cos(tr)
    rx, ry = np.cos(al) - lx, np.sin(al) - ly
    corr = poisson_neumann(np.gradient(rx, axis=1) + np.gradient(ry, axis=0))
    phi = (xx * lx + yy * ly + corr) * scale
    gy, gx = np.gradient(phi)
    return phi, np.hypot(gx, gy) / scale


def engrave(alpha: np.ndarray, s: dict) -> np.ndarray:
    h0, w0 = alpha.shape
    ow = OUT_WIDTH
    oh = round(ow * h0 / w0)
    k = ow / w0
    ss = int(s["supersample"])
    d, sil, ridge = tone(alpha, s)
    phi_a, g_a = phase(d, sil, s, 0.0, k)
    phi_b, g_b = phase(d, sil, s, s["cross"], k)
    rgy, rgx = np.gradient(ridge)
    ridge_g = np.hypot(rgx, rgy) / k                     # per output px
    fields = [Image.fromarray(x.astype(np.float32), "F") for x in (d, phi_a, g_a, phi_b, g_b, ridge, ridge_g)]
    sp, t0, cap = s["spacing"], s["threshold"], s["main_cap"]

    def lines(phi, g, cov):
        f = phi / sp
        off = np.abs(f - np.round(f))                       # 0 on a line centre, 0.5 between
        sd = (cov / 2 - off) * sp / np.maximum(g, 0.2) * ss  # signed distance, render px
        return np.clip(sd + 0.5, 0, 1) * (cov > 0.003)

    out = np.zeros((oh, ow))
    rw, rh = ow * ss, oh * ss
    ky = h0 / rh
    strip = 64
    for o0 in range(0, oh, strip):
        o1 = min(oh, o0 + strip)
        r0, r1 = o0 * ss, o1 * ss
        D, FA, GA, FB, GB, R, RG = (
            np.asarray(im.resize((rw, r1 - r0), Image.BICUBIC, box=(0, r0 * ky, w0, r1 * ky)), np.float64)
            for im in fields
        )
        T = np.clip((D - t0) / (1 - t0), 0, 1) ** s["gamma"] * s["max_ink"]
        cov_a = np.minimum(T, cap)
        cov_b = np.clip(1 - (1 - T) / (1 - cap), 0, 0.8)    # cross-hatch only past `cap`
        ink = 1 - (1 - lines(FA, GA, cov_a)) * (1 - lines(FB, GB, cov_b))
        if s["contour"] > 0:
            # the ridge field above a threshold, as a stroke with an anti-aliased edge
            sd = (R - (1 - s["contour"])) / np.maximum(RG, 1e-3) * ss
            ink = np.maximum(ink, np.clip(sd + 0.5, 0, 1))
        out[o0:o1] = ink.reshape(o1 - o0, ss, ow, ss).mean(axis=(1, 3))
    return out


def save(cov: np.ndarray, path: str) -> Image.Image:
    rgba = np.zeros(cov.shape + (4,), np.uint8)
    rgba[..., :3] = INK
    rgba[..., 3] = np.round(np.clip(cov, 0, 1) * 255)
    im = Image.fromarray(rgba, "RGBA")
    im.save(path, "WEBP", quality=90, alpha_quality=100, method=6)
    return im


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("names", nargs="*", default=NAMES)
    ap.add_argument("--out-dir", default=TEAM)
    ap.add_argument("--preview", metavar="DIR", help="also write bone-card PNG previews here")
    ap.add_argument("--set", action="append", default=[], metavar="KEY=VALUE")
    args = ap.parse_args()
    s = dict(SETTINGS)
    for kv in args.set:
        key, val = kv.split("=", 1)
        if key not in s:
            sys.exit(f"unknown setting {key!r}; known: {', '.join(s)}")
        s[key] = type(s[key])(float(val)) if isinstance(s[key], int) else float(val)
    for name in args.names:
        t = time.time()
        src = os.path.join(TEAM, f"{name}.webp")
        alpha = np.asarray(Image.open(src).convert("RGBA"))[..., 3].astype(np.float64) / 255
        cov = engrave(alpha, s)
        dst = os.path.join(args.out_dir, f"{name}-engraved.webp")
        im = save(cov, dst)
        print(f"{name}: {dst} {im.size[0]}x{im.size[1]} {os.path.getsize(dst) // 1024} KB ({time.time() - t:.1f}s)")
        if args.preview:
            os.makedirs(args.preview, exist_ok=True)
            card = Image.new("RGBA", im.size, BONE + (255,))
            card.alpha_composite(im)
            card = card.convert("RGB")
            card.save(os.path.join(args.preview, f"{name}-bone.png"))
            card.resize((384, round(384 * im.size[1] / im.size[0])), Image.LANCZOS).save(
                os.path.join(args.preview, f"{name}-bone-384.png"))


if __name__ == "__main__":
    main()
