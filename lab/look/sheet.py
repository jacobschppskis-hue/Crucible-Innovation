# python3 lab/look/sheet.py out.png cols img1 img2 ...  (labels = file names)
import sys
from PIL import Image, ImageDraw
out, cols, *ims = sys.argv[1:]
cols = int(cols)
imgs = [Image.open(p).convert('RGB') for p in ims]
w = max(i.width for i in imgs); h = max(i.height for i in imgs)
rows = (len(imgs) + cols - 1) // cols
S = Image.new('RGB', (cols * w + (cols - 1) * 6, rows * h + (rows - 1) * 6), (40, 40, 40))
for k, im in enumerate(imgs):
    x, y = (k % cols) * (w + 6), (k // cols) * (h + 6)
    S.paste(im, (x, y))
    ImageDraw.Draw(S).text((x + 6, y + 4), ims[k].split('/')[-1], fill=(0, 255, 0))
S.save(out)
