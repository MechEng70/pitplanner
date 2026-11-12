# Crop screenshots in place: the status bar off the top (CLAUDE.md: never show other apps' notification
# icons) and, with --bottom, everything from that pixel row down (the keyboard: its banners and clipboard
# suggestions are not the app). Usage: python3 -I crop.py <top px> <file.png>... [--bottom <px>]
import sys

from PIL import Image

args = sys.argv[1:]
bottom = None
if "--bottom" in args:
    i = args.index("--bottom")
    bottom = int(args[i + 1])
    del args[i : i + 2]
top, files = int(args[0]), args[1:]
for path in files:
    im = Image.open(path)
    im.crop((0, top, im.width, bottom or im.height)).save(path)
