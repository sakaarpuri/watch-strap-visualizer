#!/usr/bin/env python3
"""
Split a full-length master strap image into buckle and tail halves.

The preferred workflow is:
1. Start from one full straight strap master image.
2. Ensure the background is transparent or close to transparent.
3. Split it into:
   - part-a: buckle / 12 o'clock side
   - part-b: tail / 6 o'clock side

For local testing, this script also supports building a synthetic full master
from existing buckle + tail parts, then splitting it back.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Optional

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]


def clamp(value: int, low: int, high: int) -> int:
    return max(low, min(high, value))


def remove_checkerboard(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()

    sample_points = [
        (0, 0),
        (width - 1, 0),
        (0, height - 1),
        (width - 1, height - 1),
        (width // 2, 0),
        (width // 2, height - 1),
        (0, height // 2),
        (width - 1, height // 2),
    ]
    samples = [pixels[x, y][:3] for x, y in sample_points]

    def luma(rgb: tuple[int, int, int]) -> float:
        return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]

    samples.sort(key=luma)
    bg_dark = samples[0]
    bg_light = samples[-1]

    def color_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
        return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5

    def is_background(r: int, g: int, b: int, a: int) -> bool:
        if a < 8:
            return True
        max_channel = max(r, g, b)
        min_channel = min(r, g, b)
        if max_channel - min_channel >= 42:
            return False
        rgb = (r, g, b)
        return color_distance(rgb, bg_dark) <= 68 or color_distance(rgb, bg_light) <= 68

    total = width * height
    visited = bytearray(total)
    queue: list[int] = []

    def enqueue(x: int, y: int) -> None:
        if x < 0 or x >= width or y < 0 or y >= height:
            return
        idx = y * width + x
        if visited[idx]:
            return
        r, g, b, a = pixels[x, y]
        if not is_background(r, g, b, a):
            return
        visited[idx] = 1
        queue.append(idx)

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    head = 0
    while head < len(queue):
        idx = queue[head]
        head += 1
        x = idx % width
        y = idx // width
        enqueue(x - 1, y)
        enqueue(x + 1, y)
        enqueue(x, y - 1)
        enqueue(x, y + 1)

    for idx in queue:
        x = idx % width
        y = idx // width
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)

    return rgba


def crop_alpha(image: Image.Image, pad: int = 2) -> Image.Image:
    rgba = image.convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    if not bbox:
        return rgba
    left, top, right, bottom = bbox
    left = clamp(left - pad, 0, rgba.width)
    top = clamp(top - pad, 0, rgba.height)
    right = clamp(right + pad, 0, rgba.width)
    bottom = clamp(bottom + pad, 0, rgba.height)
    return rgba.crop((left, top, right, bottom))


def resize_long_side(image: Image.Image, max_side: int) -> Image.Image:
    width, height = image.size
    longest = max(width, height)
    if longest <= max_side:
        return image
    scale = max_side / float(longest)
    next_size = (
        max(1, int(round(width * scale))),
        max(1, int(round(height * scale))),
    )
    return image.resize(next_size, Image.Resampling.LANCZOS)


def assemble_master(top_path: Path, bottom_path: Path, gap_px: int) -> Image.Image:
    top = crop_alpha(remove_checkerboard(Image.open(top_path)))
    bottom = crop_alpha(remove_checkerboard(Image.open(bottom_path)))
    width = max(top.width, bottom.width)
    height = top.height + bottom.height + gap_px
    canvas = Image.new("RGBA", (width, height), (255, 255, 255, 0))
    top_x = (width - top.width) // 2
    bottom_x = (width - bottom.width) // 2
    canvas.alpha_composite(top, (top_x, 0))
    canvas.alpha_composite(bottom, (bottom_x, top.height + gap_px))
    return crop_alpha(canvas)


def split_master(master: Image.Image, gap_px: int) -> tuple[Image.Image, Image.Image]:
    cleaned = crop_alpha(remove_checkerboard(master))
    alpha = cleaned.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        raise ValueError("No visible strap pixels found in master image")

    left, top, right, bottom = bbox
    center_y = (top + bottom) // 2
    split_top = clamp(center_y - gap_px // 2, top, bottom)
    split_bottom = clamp(center_y + gap_px // 2, top, bottom)

    top_part = cleaned.crop((0, top, cleaned.width, split_top))
    bottom_part = cleaned.crop((0, split_bottom, cleaned.width, bottom))

    return crop_alpha(top_part), crop_alpha(bottom_part)


def save_png(image: Image.Image, path: Path, max_side: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    resized = resize_long_side(image, max_side=max_side)
    resized.save(path, format="PNG", optimize=True, compress_level=9)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--master", type=Path, help="Full straight master strap image")
    parser.add_argument("--top", type=Path, help="Optional buckle source for synthetic master test")
    parser.add_argument("--bottom", type=Path, help="Optional tail source for synthetic master test")
    parser.add_argument("--gap", type=int, default=110, help="Gap reserved for watch head / split")
    parser.add_argument("--max-side", type=int, default=1024)
    parser.add_argument("--output-stem", type=Path, required=True)
    parser.add_argument("--write-master", action="store_true", help="Save synthetic master beside outputs")
    args = parser.parse_args()

    if args.master:
        master = Image.open(args.master).convert("RGBA")
    elif args.top and args.bottom:
        master = assemble_master(args.top, args.bottom, gap_px=args.gap)
        if args.write_master:
            save_png(master, args.output_stem.parent / f"{args.output_stem.name}-master.png", args.max_side)
    else:
        raise SystemExit("Provide either --master or both --top and --bottom.")

    buckle, tail = split_master(master, gap_px=args.gap)
    save_png(buckle, args.output_stem.parent / f"{args.output_stem.name}-buckle.png", args.max_side)
    save_png(tail, args.output_stem.parent / f"{args.output_stem.name}-tail.png", args.max_side)
    print(f"wrote: {args.output_stem.parent / (args.output_stem.name + '-buckle.png')}")
    print(f"wrote: {args.output_stem.parent / (args.output_stem.name + '-tail.png')}")


if __name__ == "__main__":
    main()
