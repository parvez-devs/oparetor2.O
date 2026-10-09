"""Generate UID 2.O Cyber Minimal launcher icons without external image dependencies."""
from pathlib import Path
import math
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1] / "assets"
ROOT.mkdir(parents=True, exist_ok=True)
SIZE = 512

GLYPHS = {
    "U": ["10001","10001","10001","10001","10001","10001","01110"],
    "2": ["01110","10001","00001","00010","00100","01000","11111"],
}

def glyph_mask(x, y, char, x0, y0, scale):
    glyph = GLYPHS[char]
    gx = int((x - x0) / scale)
    gy = int((y - y0) / scale)
    return 0 <= gx < 5 and 0 <= gy < 7 and glyph[gy][gx] == "1"

def png_bytes(mode):
    pixels = bytearray()
    for y in range(SIZE):
        row = bytearray()
        for x in range(SIZE):
            dx, dy = x - 256, y - 256
            d = math.hypot(dx, dy)
            angle = math.atan2(dy, dx)

            if mode in ("foreground", "mono"):
                color = (0, 0, 0, 0)
            else:
                color = (0, 0, 0, 255)
                if d < 216:
                    glow = max(0.0, 1.0 - d / 216.0)
                    color = (int(2 + 5 * glow), int(8 + 18 * glow), int(14 + 30 * glow), 255)

            ring = 178 < d < 186 and not (-0.5 < angle < 0.25)
            arc = 188 < d < 198 and (1.0 < angle < 2.55)
            u = glyph_mask(x, y, "U", 147, 193, 17)
            two = glyph_mask(x, y, "2", 280, 193, 17)
            slash = 238 < x < 250 and 180 < y < 330 and abs((y - 255) + 2.1 * (x - 244)) < 15
            mark = ring or arc or u or two or slash

            if mark:
                if mode == "mono":
                    color = (255, 255, 255, 255)
                else:
                    t = min(1.0, max(0.0, x / 511.0))
                    color = (int(42 - 6*t), int(158 + 70*t), 255, 255)

            if mode == "normal" and 205 < d < 211:
                color = (10, 54, 82, 255)

            row.extend(color)
        pixels.extend(bytes([0]) + row)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)

    header = struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0)
    return bytes([137,80,78,71,13,10,26,10]) + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(bytes(pixels), 6)) + chunk(b"IEND", b"")

(ROOT / "icon.png").write_bytes(png_bytes("normal"))
(ROOT / "adaptive-icon.png").write_bytes(png_bytes("foreground"))
(ROOT / "monochrome-icon.png").write_bytes(png_bytes("mono"))
print("Generated UID 2.O Cyber Minimal Android launcher icons")
