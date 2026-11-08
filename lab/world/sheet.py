# python3 lab/world/sheet.py out.png w cols file... : contact sheet (each frame scaled to width w)
import sys
from PIL import Image
out, w, cols, files = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4:]
ims = [Image.open(f).convert('RGB') for f in files]
ims = [i.resize((w, round(i.height * w / i.width))) for i in ims]
h = max(i.height for i in ims)
rows = (len(ims) + cols - 1) // cols
c = Image.new('RGB', (w * cols, h * rows))
for k, i in enumerate(ims):
    c.paste(i, ((k % cols) * w, (k // cols) * h))
c.save(out)
