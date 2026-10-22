#!/usr/bin/env python3
"""Build the local eye loop from the four supplied poses using motion interpolation.

Requires Pillow and FFmpeg with minterpolate, libvpx-vp9 and libx264.
Usage: python3 scripts/build-eye-loop.py --ffmpeg /absolute/path/to/ffmpeg
Source PNGs remain unchanged under assets/eye-blink/.
"""

import argparse
from pathlib import Path
import shutil
import subprocess
import tempfile

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/eye-blink"
OUTPUT = ROOT / "public/hero/signal"


def run(*args):
    subprocess.run([str(arg) for arg in args], check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ffmpeg", default=shutil.which("ffmpeg"))
    args = parser.parse_args()
    if not args.ffmpeg:
        parser.error("Provide --ffmpeg or install FFmpeg on PATH.")
    OUTPUT.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="part-eye-") as temp:
        work = Path(temp)
        for filename in ["01-open.png", "02-half.png", "03-closed.png", "04-opening.png"]:
            with Image.open(SOURCE / filename) as image:
                rgba = image.convert("RGBA")
                flattened = Image.alpha_composite(Image.new("RGBA", rgba.size, "black"), rgba)
                flattened.convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS).save(work / filename)
        shutil.copyfile(work / "01-open.png", work / "eye-blink-poster.png")

        # The closed pose holds briefly; the opening reverses the same poses.
        # Identical open frames on both sides make the ten-second loop seamless.
        poses = [
            ("01-open.png", 0.30),
            ("04-opening.png", 0.30),
            ("02-half.png", 0.25),
            ("03-closed.png", 0.15),
            ("03-closed.png", 0.25),
            ("02-half.png", 0.30),
            ("04-opening.png", 0.25),
            ("01-open.png", 0.50),
            ("01-open.png", 0.50),
        ]
        sequence = work / "sequence.ffconcat"
        sequence.write_text("ffconcat version 1.0\n" + "".join(
            f"file '{filename}'\nduration {duration}\n" for filename, duration in poses
        ) + "file '01-open.png'\n")
        intermediate = work / "blink.mkv"
        interpolation = (
            "minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bilat:"
            "me=epzs:mb_size=8:search_param=32:vsbmc=1:scd=none,"
            "trim=duration=2,setpts=PTS-STARTPTS,format=yuv420p"
        )
        run(args.ffmpeg, "-hide_banner", "-loglevel", "warning", "-y",
            "-f", "concat", "-safe", "0", "-i", sequence,
            "-vf", interpolation, "-an", "-c:v", "ffv1", intermediate)
        common = [args.ffmpeg, "-hide_banner", "-loglevel", "warning", "-y", "-i", intermediate,
                  "-vf", "tpad=start_mode=clone:start_duration=8:stop_mode=clone:stop_duration=1",
                  "-r", "30", "-frames:v", "300", "-an", "-pix_fmt", "yuv420p"]
        run(*common, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "18", "-cpu-used", "3",
            "-row-mt", "1", "-threads", "4", "-g", "300", work / "eye-blink.webm")
        run(*common, "-c:v", "libx264", "-preset", "slow", "-crf", "16",
            "-g", "300", "-movflags", "+faststart", work / "eye-blink.mp4")
        for filename in ["eye-blink-poster.png", "eye-blink.webm", "eye-blink.mp4"]:
            staged = OUTPUT / f".{filename}.tmp"
            shutil.copyfile(work / filename, staged)
            staged.replace(OUTPUT / filename)
    for filename in ["eye-blink-poster.png", "eye-blink.webm", "eye-blink.mp4"]:
        path = OUTPUT / filename
        print(f"{path.relative_to(ROOT)}: {path.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
