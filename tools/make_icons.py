"""Draws the Just Ski app icons into icons/ (a penguin skiing down a snowy slope).

Usage: python3 tools/make_icons.py   (needs Pillow)
Everything important sits inside the central 80% so the icon also works as a
maskable icon on Android.
"""
import math
import os
from PIL import Image, ImageDraw

S = 1024  # draw large, then downscale for smooth edges
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")

SLOPE = 0.24  # the snow drops this much per pixel to the right


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def snow_y(x):
    return 600 + x * SLOPE


def penguin():
    """The skier upright on its own layer; (512, 900) is where the boots meet the skis."""
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    black, white, orange = (0x23, 0x26, 0x2e), (0xf7, 0xf7, 0xf2), (0xff, 0x9a, 0x2e)
    red, grey = (0xe8, 0x4a, 0x3a), (0x55, 0x5c, 0x68)

    # poles behind, planted back down the hill
    d.line([(610, 640), (330, 905)], fill=grey, width=16)
    d.line([(560, 640), (290, 880)], fill=grey, width=16)
    d.ellipse([300, 880, 360, 920], outline=grey, width=10)

    d.ellipse([400, 540, 640, 880], fill=black)  # body, crouched
    d.ellipse([470, 610, 635, 870], fill=white)  # belly
    d.ellipse([430, 870, 530, 915], fill=orange)  # boots
    d.ellipse([500, 870, 600, 915], fill=orange)
    d.ellipse([440, 380, 650, 580], fill=black)  # head
    d.ellipse([500, 420, 650, 560], fill=white)  # face
    d.polygon([(600, 500), (690, 512), (602, 535)], fill=orange)  # beak
    # goggles
    d.rounded_rectangle([505, 445, 655, 495], radius=24, fill=(0x1f, 0xb5, 0xb5), outline=black, width=8)
    d.line([(525, 462), (560, 462)], fill=(0xc8, 0xf4, 0xf4), width=8)
    # red bobble hat
    d.chord([440, 330, 650, 520], 180, 360, fill=red)
    d.rounded_rectangle([432, 405, 658, 440], radius=16, fill=white)
    d.ellipse([505, 280, 585, 360], fill=white)
    # scarf streaming behind
    d.rounded_rectangle([440, 560, 650, 595], radius=16, fill=red)
    d.polygon([(450, 570), (300, 520), (290, 560), (450, 595)], fill=red)
    d.polygon([(300, 520), (250, 540), (290, 560)], fill=red)
    # flipper holding the pole
    d.ellipse([560, 610, 660, 690], fill=black)
    return layer


def draw():
    img = Image.new("RGB", (S, S))
    d = ImageDraw.Draw(img)
    top, bottom = (0x4f, 0xa3, 0xe3), (0xd4, 0xec, 0xff)
    for y in range(S):
        d.line([(0, y), (S, y)], fill=lerp(top, bottom, y / S))

    # mountains and a cloud behind
    d.polygon([(40, 600), (260, 270), (500, 600)], fill=(0xa9, 0xbf, 0xd6))
    d.polygon([(195, 365), (260, 270), (322, 360), (290, 385), (260, 355), (225, 385)], fill="white")
    d.polygon([(460, 640), (770, 230), (1060, 640)], fill=(0x93, 0xab, 0xc6))
    d.polygon([(690, 335), (770, 230), (848, 335), (808, 360), (770, 330), (730, 365)], fill="white")
    for cx, cy, r in [(700, 170, 55), (765, 150, 72), (835, 172, 52)]:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill="white")

    # snow slope falling to the right, with spray behind the skier
    d.polygon([(0, snow_y(0)), (S, snow_y(S)), (S, S), (0, S)], fill=(0xf7, 0xfb, 0xff))
    d.polygon([(0, snow_y(0) + 70), (S, snow_y(S) + 70), (S, snow_y(S) + 92), (0, snow_y(0) + 92)],
              fill=(0xe4, 0xed, 0xf6))
    for cx, cy, r in [(215, 640, 34), (170, 610, 26), (135, 640, 20), (250, 600, 18), (110, 600, 12)]:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(0xf7, 0xfb, 0xff))

    # skis along the slope, tips curled up at the front
    angle = math.degrees(math.atan(SLOPE))
    ski = (0x2f, 0x7f, 0xd4)
    x0, x1 = 290, 760
    for off in (0, 18):
        d.line([(x0, snow_y(x0) - 8 + off), (x1, snow_y(x1) - 8 + off)], fill=ski, width=18)
        tip = (x1 + 45, snow_y(x1) - 40 + off)
        d.line([(x1, snow_y(x1) - 8 + off), tip], fill=ski, width=18)

    # the penguin, leaning down the hill and standing on the skis
    p = penguin().rotate(-angle * 0.8, resample=Image.BICUBIC, center=(512, 900))
    feet_x = 520
    img.paste(p, (feet_x - 512, round(snow_y(feet_x) - 5) - 900), p)
    return img


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    big = draw()
    for name, size in [("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180), ("favicon-32.png", 32)]:
        big.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name))
    print("wrote", OUT)
