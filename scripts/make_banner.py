#!/usr/bin/env python3
"""Native 1500x500 PART banner — crisp Win95 chrome + pixel PART, no JPEG upscale."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path("/Users/yato/PART/PART")
OUT = ROOT / "public/hero/banner-1500x500.png"

W, H = 1500, 500
PHOS = (198, 255, 26)
PHOS_DIM = (120, 170, 18)
PHOS_DARK = (40, 70, 8)
BLACK = (0, 0, 0)

# 5x7 glyphs
GLYPHS = {
    "P": [
        "#####",
        "#   #",
        "#   #",
        "#####",
        "#    ",
        "#    ",
        "#    ",
    ],
    "A": [
        " ### ",
        "#   #",
        "#   #",
        "#####",
        "#   #",
        "#   #",
        "#   #",
    ],
    "R": [
        "#####",
        "#   #",
        "#   #",
        "#####",
        "#  # ",
        "#   #",
        "#   #",
    ],
    "T": [
        "#####",
        "  #  ",
        "  #  ",
        "  #  ",
        "  #  ",
        "  #  ",
        "  #  ",
    ],
}


def font(size: int) -> ImageFont.FreeTypeFont:
    for p in (
        "/System/Library/Fonts/Supplemental/Courier New.ttf",
        "/System/Library/Fonts/Menlo.ttc",
    ):
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            continue
    return ImageFont.load_default()


def phosphorize(im: Image.Image) -> Image.Image:
    g = im.convert("L")
    out = Image.new("RGB", g.size, BLACK)
    gp, op = g.load(), out.load()
    w, h = g.size
    for y in range(h):
        for x in range(w):
            v = gp[x, y]
            if v < 10:
                continue
            t = (v / 255.0) ** 0.9
            op[x, y] = (int(PHOS[0] * t), int(PHOS[1] * t), int(PHOS[2] * t))
    return out


def draw_win95(canvas: Image.Image) -> None:
    d = ImageDraw.Draw(canvas)
    # outer edge
    d.rectangle([0, 0, W - 1, H - 1], outline=PHOS, width=3)
    # SOLID title bar like the original
    title_h = 34
    d.rectangle([3, 3, W - 4, title_h], fill=PHOS)
    # status bar
    status_y = H - 32
    d.rectangle([3, status_y, W - 4, H - 4], fill=BLACK)
    d.line([(3, status_y), (W - 4, status_y)], fill=PHOS, width=2)
    # inner content double-line
    d.rectangle([8, title_h + 6, W - 9, status_y - 6], outline=PHOS_DIM, width=1)
    d.rectangle([10, title_h + 8, W - 11, status_y - 8], outline=PHOS, width=1)

    f = font(16)
    d.text((14, 10), r"C:\PART\checker.exe", font=f, fill=BLACK)

    # window buttons
    bx = W - 92
    by = 8
    for i, label in enumerate(("_", "O", "X")):
        x0 = bx + i * 26
        d.rectangle([x0, by, x0 + 22, by + 18], outline=BLACK, width=1)
        d.text((x0 + 6, by + 1), label, font=font(13), fill=BLACK)

    f12 = font(14)
    d.text((16, status_y + 8), "> part --twitter _", font=f12, fill=PHOS)
    right = "LIVE"
    tw = d.textlength(right, font=f12)
    d.text((W - 20 - tw, status_y + 8), right, font=f12, fill=PHOS)


def original_part() -> Image.Image:
    """Crop the real PART lettering from the source banner. Do not redraw it."""
    src = Image.open(ROOT / "public/hero/banner.jpg").convert("RGB")
    # letters only — left of this is HERO, top/bottom are chrome
    crop = src.crop((268, 84, 990, 252))
    return phosphorize(crop)


def paste_part(canvas: Image.Image) -> None:
    part = original_part()
    # fit into content to the right of HERO, leave room for LIVE
    max_w, max_h = 1040, 300
    scale = min(max_w / part.width, max_h / part.height)
    nw, nh = int(part.width * scale), int(part.height * scale)
    part = part.resize((nw, nh), Image.Resampling.NEAREST)
    x = 400
    y = 34 + (H - 32 - 34 - nh) // 2
    # keep black transparent so we don't stamp a rectangle
    mask = part.convert("L").point(lambda v: 255 if v > 12 else 0)
    canvas.paste(part, (x, y), mask)


def place_hero(canvas: Image.Image) -> None:
    src = phosphorize(Image.open(ROOT / "public/hero/hero.jpg"))
    # drop empty black margins a bit
    title_h, status_y = 34, H - 32
    inner_top, inner_bot = title_h + 12, status_y - 12
    max_h = inner_bot - inner_top
    max_w = 390
    scale = min(max_h / src.height, max_w / src.width)
    nw, nh = int(src.width * scale), int(src.height * scale)
    hero = src.resize((nw, nh), Image.Resampling.NEAREST)
    x = 18
    y = inner_top + (max_h - nh) // 2
    canvas.paste(hero, (x, y))


def main() -> None:
    canvas = Image.new("RGB", (W, H), BLACK)
    place_hero(canvas)
    paste_part(canvas)

    d = ImageDraw.Draw(canvas)
    d.text((W - 78, 48), "■ LIVE", font=font(14), fill=PHOS)

    draw_win95(canvas)  # chrome on top so bars stay crisp
    canvas.save(OUT, "PNG", optimize=False, compress_level=1)
    print("wrote", OUT, canvas.size)


if __name__ == "__main__":
    main()
