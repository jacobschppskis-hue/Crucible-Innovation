# python3 lab/paypal/sheet.py <dir> <dev> p1,p2,... out.png   (contact sheet of frames)
import sys
from PIL import Image
d, dev, ps, out = sys.argv[1], sys.argv[2], sys.argv[3].split(','), sys.argv[4]
ims = [Image.open(f'{d}/{dev}-p{p}.png') for p in ps]
w = 390 if dev == 'phone' else 720
ims = [im.resize((w, round(im.height * w / im.width))) for im in ims]
cols = len(ims) if dev == 'phone' else 2
rows = (len(ims) + cols - 1) // cols
h = ims[0].height
S = Image.new('RGB', (cols * (w + 8), rows * (h + 8)), (40, 40, 40))
for i, im in enumerate(ims): S.paste(im, ((i % cols) * (w + 8), (i // cols) * (h + 8)))
S.save(out)
