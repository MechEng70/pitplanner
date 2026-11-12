# Crop the status bar off screenshots in place (CLAUDE.md: never show other apps' notification icons).
# Usage: python3 -I crop.py <pixels> <file.png>...
import sys
from PIL import Image

px = int(sys.argv[1])
for path in sys.argv[2:]:
    im = Image.open(path)
    im.crop((0, px, im.width, im.height)).save(path)
