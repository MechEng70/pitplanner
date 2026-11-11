import sys
from PIL import Image, ImageDraw
out, *pairs = sys.argv[1:]
W = 600
ims = []
for p in pairs:
    label, path = p.split('=', 1)
    i = Image.open(path).convert('RGB')
    i = i.resize((W, round(i.height * W / i.width)), Image.LANCZOS)
    ims.append((label, i))
H = max(i.height for _, i in ims) + 44
c = Image.new('RGB', (len(ims) * (W + 16), H), (255, 0, 255))
d = ImageDraw.Draw(c)
for n, (label, i) in enumerate(ims):
    x = n * (W + 16)
    d.rectangle([x, 0, x + W, 43], fill=(0, 0, 0))
    d.text((x + 10, 12), label, fill=(255, 255, 255), font_size=24)
    c.paste(i, (x, 44))
c.save(out)
