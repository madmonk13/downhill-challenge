"""Draws the Just Ski app icons into icons/: a penguin skier jumping a chasm under a deep blue sky.

Usage: python3 tools/make_icons.py   (needs Pillow)
Everything important sits inside the central 80% so the icon also works as a
maskable icon on Android.
"""
import os
from PIL import Image, ImageDraw

S = 1024  # draw large, then downscale for smooth edges
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")

BLACK, WHITE, ORANGE = (0x23, 0x26, 0x2e), (0xf7, 0xf7, 0xf2), (0xff, 0x9a, 0x2e)
RED, SKI, GREY = (0xe8, 0x4a, 0x3a), (0x2f, 0x7f, 0xd4), (0x55, 0x5c, 0x68)
SNOW, SNOW_SHADE = (0xf7, 0xfb, 0xff), (0xc9, 0xdc, 0xee)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def skier():
    """The penguin in the air, side-on and leaning into the jump; skis under its boots."""
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    # poles trailing behind
    d.line([(560, 600), (200, 560)], fill=GREY, width=18)
    d.line([(600, 620), (240, 610)], fill=GREY, width=18)
    # skis, tips curled up at the front
    for y in (850, 878):
        d.line([(250, y), (760, y)], fill=SKI, width=22)
        d.line([(760, y), (812, y - 44)], fill=SKI, width=22)
    d.ellipse([400, 520, 640, 860], fill=BLACK)  # body
    d.ellipse([470, 590, 635, 850], fill=WHITE)  # belly
    d.ellipse([420, 815, 540, 870], fill=ORANGE)  # boots
    d.ellipse([500, 815, 620, 870], fill=ORANGE)
    d.ellipse([440, 360, 650, 560], fill=BLACK)  # head
    d.ellipse([500, 400, 650, 540], fill=WHITE)  # face
    d.polygon([(600, 480), (700, 492), (602, 515)], fill=ORANGE)  # beak
    d.rounded_rectangle([505, 425, 655, 475], radius=24, fill=(0x1f, 0xb5, 0xb5), outline=BLACK, width=8)  # goggles
    d.line([(525, 442), (560, 442)], fill=(0xc8, 0xf4, 0xf4), width=8)
    d.chord([440, 310, 650, 500], 180, 360, fill=RED)  # bobble hat
    d.rounded_rectangle([432, 385, 658, 420], radius=16, fill=WHITE)
    d.ellipse([505, 260, 585, 340], fill=WHITE)
    d.rounded_rectangle([440, 540, 650, 575], radius=16, fill=RED)  # scarf, streaming back
    d.polygon([(450, 550), (280, 470), (262, 515), (450, 575)], fill=RED)
    d.ellipse([540, 580, 650, 660], fill=BLACK)  # flipper
    return layer


def draw():
    img = Image.new("RGB", (S, S))
    d = ImageDraw.Draw(img)
    top, bottom = (0x0f, 0x2a, 0x5c), (0x5f, 0xb8, 0xe8)
    for y in range(S):
        d.line([(0, y), (S, y)], fill=lerp(top, bottom, min(1, y / 760)))

    # a low winter sun and far peaks
    d.ellipse([110, 150, 290, 330], fill=(0xff, 0xf1, 0xc4))
    d.polygon([(560, 760), (840, 430), (1100, 760)], fill=(0x3c, 0x6e, 0xa8))
    d.polygon([(785, 495), (840, 430), (893, 492), (862, 512), (840, 490), (815, 514)], fill=WHITE)

    # the chasm: the run-in rises into a kicker at the near lip, the landing is lower on the right
    gap_l, gap_r = 330, 680
    d.rectangle([gap_l - 20, 780, gap_r + 20, S], fill=(0x0b, 0x1c, 0x3a))
    d.polygon([(gap_l, 760), (gap_l + 60, 830), (gap_l + 30, S), (gap_l, S)], fill=(0x1e, 0x4c, 0x7e))  # walls
    d.polygon([(gap_r, 860), (gap_r - 50, 920), (gap_r - 25, S), (gap_r, S)], fill=(0x16, 0x3a, 0x66))
    run_in = [(0, 730), (200, 800), (gap_l, 745)]
    d.polygon(run_in + [(gap_l, S), (0, S)], fill=SNOW)
    d.line(run_in, fill=SNOW_SHADE, width=10, joint="curve")
    d.polygon([(gap_r, 850), (S, 920), (S, S), (gap_r, S)], fill=SNOW)  # landing
    # red warning posts on the far lip
    for x, y in [(gap_r + 50, 864), (gap_r + 140, 884)]:
        d.rectangle([x - 9, y - 90, x + 9, y], fill=(0xd4, 0x2f, 0x2f))
        d.rectangle([x - 9, y - 60, x + 9, y - 42], fill=WHITE)

    # speed lines behind the skier
    for x0, y0, length in [(80, 430, 150), (60, 500, 190), (100, 570, 120)]:
        d.rounded_rectangle([x0, y0, x0 + length, y0 + 14], radius=7, fill=(0xd8, 0xee, 0xff))

    # the skier high over the gap, nose up
    p = skier().rotate(12, resample=Image.BICUBIC, center=(512, 600)).resize((660, 660), Image.LANCZOS)
    img.paste(p, (200, 70), p)
    return img


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    big = draw()
    for name, size in [("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180), ("favicon-32.png", 32)]:
        big.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name))
    print("wrote", OUT)
