#!/usr/bin/env python3
"""Square X post from real HERO stills — dither/scanlines only, no gen."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont

ROOT = Path("/Users/yato/PART/PART")
HERO = ROOT / "public/hero"
OUT = ROOT / "public/hero/post4"
OUT.mkdir(parents=True, exist_ok=True)

PHOSPHOR = (198, 255, 26)
DIM = (90, 120, 20)
BLACK = (0, 0, 0)
SIZE = 1080


def font(size: int) -> ImageFont.FreeTypeFont:
    for p in (
        "/System/Library/Fonts/Supplemental/Courier New.ttf",
        "/System/Library/Fonts/Menlo.ttc",
        "/Library/Fonts/Courier New.ttf",
    ):
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            continue
    return ImageFont.load_default()


def to_phosphor(im: Image.Image) -> Image.Image:
    g = ImageOps_grayscale(im)
    rgb = Image.new("RGB", g.size, BLACK)
    px = g.load()
    out = rgb.load()
    w, h = g.size
    for y in range(h):
        for x in range(w):
            v = px[x, y]
            if v < 8:
                continue
            t = v / 255.0
            out[x, y] = (
                int(PHOSPHOR[0] * t),
                int(PHOSPHOR[1] * t),
                int(PHOSPHOR[2] * t),
            )
    return rgb


def ImageOps_grayscale(im: Image.Image) -> Image.Image:
    return im.convert("L")


def scanlines(im: Image.Image, gap: int = 3, dark: float = 0.55) -> Image.Image:
    im = im.convert("RGB")
    px = im.load()
    w, h = im.size
    for y in range(0, h, gap):
        for x in range(w):
            r, g, b = px[x, y]
            px[x, y] = (int(r * dark), int(g * dark), int(b * dark))
    return im


def vignette(im: Image.Image, strength: float = 0.7) -> Image.Image:
    w, h = im.size
    overlay = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(overlay)
    for i in range(80):
        a = int(255 * (i / 80) ** 1.6)
        d.rectangle([i, i, w - 1 - i, h - 1 - i], outline=a)
    overlay = overlay.resize((w, h))
    black = Image.new("RGB", (w, h), BLACK)
    return Image.composite(im, black, ImageEnhance.Brightness(overlay).enhance(1.0 - strength * 0.15))


def square_canvas() -> Image.Image:
    return Image.new("RGB", (SIZE, SIZE), BLACK)


def paste_centered(base: Image.Image, src: Image.Image, max_w: int, max_h: int, cy: int) -> None:
    src = src.convert("RGB")
    src.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
    x = (SIZE - src.width) // 2
    y = cy - src.height // 2
    base.paste(src, (x, y))


def frame(im: Image.Image) -> Image.Image:
    d = ImageDraw.Draw(im)
    d.rectangle([18, 18, SIZE - 19, SIZE - 19], outline=PHOSPHOR, width=2)
    d.rectangle([24, 18, SIZE - 25, 52], outline=PHOSPHOR, width=1)
    f = font(18)
    d.text((36, 26), "C:\\PART\\hero.exe", font=f, fill=PHOSPHOR)
    d.text((SIZE - 96, 26), "LIVE", font=f, fill=PHOSPHOR)
    d.rectangle([SIZE - 112, 30, SIZE - 100, 42], fill=PHOSPHOR)
    return im


def caption(im: Image.Image, line: str, y: int) -> None:
    d = ImageDraw.Draw(im)
    f = font(28)
    bbox = d.textbbox((0, 0), line, font=f)
    tw = bbox[2] - bbox[0]
    d.text(((SIZE - tw) // 2, y), line, font=f, fill=PHOSPHOR)


def finish(im: Image.Image) -> Image.Image:
    im = ImageEnhance.Contrast(im).enhance(1.15)
    im = scanlines(im, gap=3, dark=0.62)
    return im


def variant_logo() -> Image.Image:
    canvas = square_canvas()
    logo = Image.open(HERO / "logo.jpg")
    paste_centered(canvas, logo, 720, 720, 500)
    frame(canvas)
    caption(canvas, "hero blinked.", 940)
    d = ImageDraw.Draw(canvas)
    d.text((36, SIZE - 48), "> _", font=font(22), fill=DIM)
    return finish(canvas)


def variant_hero() -> Image.Image:
    canvas = square_canvas()
    hero = Image.open(HERO / "hero.jpg")
    # crop a tighter square from the figure
    w, h = hero.size
    side = min(w, h)
    left = (w - side) // 2
    top = max(0, (h - side) // 2 - 40)
    hero = hero.crop((left, top, left + side, top + side))
    hero = hero.resize((920, 920), Image.Resampling.LANCZOS)
    canvas.paste(hero, ((SIZE - 920) // 2, 40))
    frame(canvas)
    caption(canvas, "that's a no.", 980)
    return finish(canvas)


def variant_opening() -> Image.Image:
    canvas = square_canvas()
    src = Image.open(HERO / "opening.jpg")
    paste_centered(canvas, src, 880, 820, 490)
    frame(canvas)
    caption(canvas, "not bullish. just sitting.", 940)
    return finish(canvas)


if __name__ == "__main__":
    a = variant_logo()
    b = variant_hero()
    c = variant_opening()
    a.save(OUT / "a-eye.png", optimize=True)
    b.save(OUT / "b-mascot.png", optimize=True)
    c.save(OUT / "c-lotus.png", optimize=True)
    print("wrote", OUT)
