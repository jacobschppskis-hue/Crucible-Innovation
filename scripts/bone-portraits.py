#!/usr/bin/env python3
"""Recolour the ASCII portraits (public/team/<name>.webp, dark ink on transparent) to bone characters on
transparent, for sitting straight on the black. Writes public/team/<name>-bone.webp (lossless, so the
characters stay crisp when scaled). Usage: python3 scripts/bone-portraits.py"""
import os
from PIL import Image

BONE = (0xE8, 0xE4, 0xD8)  # --bone
root = os.path.join(os.path.dirname(__file__), '..', 'public', 'team')
for name in ('jacob', 'charlie'):
    src = Image.open(os.path.join(root, f'{name}.webp')).convert('RGBA')
    a = src.getchannel('A')
    out = Image.new('RGBA', src.size, BONE + (0,))
    out.putalpha(a)
    out.save(os.path.join(root, f'{name}-bone.webp'), lossless=True, quality=100, method=6)
