"""Generate UID 2.O launcher icons without external image dependencies."""
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
    "O": ["01110","10001","10001","10001","10001","10001","01110"],
}
def glyph_mask(x,y,char,x0,y0,scale):
    glyph=GLYPHS[char]
    gx=int((x-x0)/scale); gy=int((y-y0)/scale)
    return 0<=gx<5 and 0<=gy<7 and glyph[gy][gx]=="1"

def render(foreground):
    pixels=bytearray()
    for y in range(SIZE):
        row=bytearray()
        for x in range(SIZE):
            d=math.hypot(x-256,y-256)
            if foreground:
                color=(0,0,0,0)
            else:
                t=y/511
                color=(int(9+5*t),int(20+12*t),int(39+24*t),255)
                if d<205:
                    color=(12,38,75,255)
                if 192<d<199:
                    color=(37,131,246,255)
            # Pixel letter mark "U2O" centered in a circular emblem
            on=(glyph_mask(x,y,"U",112,194,15) or
                glyph_mask(x,y,"2",222,194,15) or
                glyph_mask(x,y,"O",332,194,15))
            if on:
                color=(237,247,255,255) if x<222 else (60,170,255,255)
            row.extend(color)
        pixels.extend(bytes([0])+row)
    def chunk(tag,data):
        return struct.pack(">I",len(data))+tag+data+struct.pack(">I",zlib.crc32(tag+data)&0xffffffff)
    header=struct.pack(">IIBBBBB",SIZE,SIZE,8,6,0,0,0)
    return bytes([137,80,78,71,13,10,26,10])+chunk(b"IHDR",header)+chunk(b"IDAT",zlib.compress(bytes(pixels),6))+chunk(b"IEND",b"")

(ROOT/"icon.png").write_bytes(render(False))
(ROOT/"adaptive-icon.png").write_bytes(render(True))
print("Generated UID 2.O Android launcher icons")
