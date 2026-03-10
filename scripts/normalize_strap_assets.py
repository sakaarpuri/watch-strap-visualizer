#!/usr/bin/env python3
"""
Normalize strap assets for preview performance and consistency.

Actions:
- Remove checkerboard backgrounds by edge-connected flood fill.
- Crop to non-transparent bounds.
- Resize large images (default max side: 1024).
- Apply targeted orientation fixes.
"""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path
from typing import Dict, Iterable, Tuple

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
STRAP_DIR = ROOT / "public" / "strap-selection-kie"
PUBLIC_DIR = ROOT / "public"

TARGET_ROTATIONS: Dict[str, int] = {
    "rubber-orange-tropic-buckle.png": 180,
    "metal-gunmetal-milanese-tail.png": 180,
    "metal-strap-b.png": 180,
}

TARGET_OUTPUT_WIDTH: Dict[str, int] = {
    "metal-gunmetal-milanese-tail.png": 205,
    "steel-bracelet-tail.png": 329,
    "steel-link-bracelet-tail.png": 328,
    "fabric-navy-sailcloth-tail.png": 205,
}

TARGET_MAX_SIDE: Dict[str, int] = {
    "fabric-navy-sailcloth-buckle.png": 768,
    "fabric-navy-sailcloth-tail.png": 768,
}

STEEL_LINK_EXPORTS = {
    "steel-link-bracelet-buckle.png": "metal-strap-a.png",
    "steel-link-bracelet-tail.png": "metal-strap-b.png",
}


def color_distance(a: Tuple[int, int, int], b: Tuple[int, int, int]) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def luma(rgb: Tuple[int, int, int]) -> float:
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]


def saturation(rgb: Tuple[int, int, int]) -> int:
    return max(rgb) - min(rgb)


def remove_checkerboard(image: Image.Image, max_distance: float = 70.0) -> Image.Image:
    rgba = image.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()

    sample_points = [
        (0, 0),
        (w - 1, 0),
        (0, h - 1),
        (w - 1, h - 1),
        (w // 2, 0),
        (w // 2, h - 1),
        (0, h // 2),
        (w - 1, h // 2),
    ]
    samples = [tuple(px[x, y][:3]) for (x, y) in sample_points]
    sorted_samples = sorted(samples, key=luma)
    bg_dark = sorted_samples[0]
    bg_light = sorted_samples[-1]

    def is_bg(pixel: Tuple[int, int, int, int]) -> bool:
        r, g, b, a = pixel
        if a < 8:
            return True
        rgb = (r, g, b)
        if saturation(rgb) >= 44:
            return False
        return (
            color_distance(rgb, bg_dark) <= max_distance
            or color_distance(rgb, bg_light) <= max_distance
        )

    visited = bytearray(w * h)
    q: deque[Tuple[int, int]] = deque()

    def enqueue(x: int, y: int) -> None:
        if x < 0 or x >= w or y < 0 or y >= h:
            return
        idx = y * w + x
        if visited[idx]:
            return
        if not is_bg(px[x, y]):
            return
        visited[idx] = 1
        q.append((x, y))

    for x in range(w):
        enqueue(x, 0)
        enqueue(x, h - 1)
    for y in range(h):
        enqueue(0, y)
        enqueue(w - 1, y)

    while q:
        x, y = q.popleft()
        enqueue(x - 1, y)
        enqueue(x + 1, y)
        enqueue(x, y - 1)
        enqueue(x, y + 1)

    for idx, seen in enumerate(visited):
        if not seen:
            continue
        x = idx % w
        y = idx // w
        r, g, b, _ = px[x, y]
        px[x, y] = (r, g, b, 0)

    return rgba


def crop_to_alpha(image: Image.Image, pad: int = 2) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return rgba

    left, top, right, bottom = bbox
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(rgba.width, right + pad)
    bottom = min(rgba.height, bottom + pad)
    return rgba.crop((left, top, right, bottom))


def resize_max_side(image: Image.Image, max_side: int) -> Image.Image:
    w, h = image.size
    longest = max(w, h)
    if longest <= max_side:
        return image
    ratio = max_side / float(longest)
    new_size = (max(1, int(round(w * ratio))), max(1, int(round(h * ratio))))
    return image.resize(new_size, Image.Resampling.LANCZOS)


def fit_width(image: Image.Image, target_width: int | None) -> Image.Image:
    if not target_width or target_width <= 0:
        return image
    w, h = image.size
    if w == target_width:
        return image
    return image.resize((target_width, h), Image.Resampling.LANCZOS)


def process_path(path: Path, max_side: int) -> None:
    image = Image.open(path).convert("RGBA")
    if path.name in TARGET_ROTATIONS:
        image = image.rotate(TARGET_ROTATIONS[path.name], expand=True)
    image = remove_checkerboard(image)
    image = crop_to_alpha(image, pad=2)
    image = fit_width(image, TARGET_OUTPUT_WIDTH.get(path.name))
    image = crop_to_alpha(image, pad=2)
    local_max_side = TARGET_MAX_SIDE.get(path.name, max_side)
    image = resize_max_side(image, max_side=local_max_side)
    image.save(path, format="PNG", optimize=True, compress_level=9)


def iter_targets(include_public_metals: bool) -> Iterable[Path]:
    for p in STRAP_DIR.glob("*.png"):
        yield p
    if include_public_metals:
        for name in ("metal-strap-a.png", "metal-strap-b.png"):
            yield PUBLIC_DIR / name


def export_steel_link_variants(max_side: int) -> None:
    for output_name, source_name in STEEL_LINK_EXPORTS.items():
        source_path = PUBLIC_DIR / source_name
        target_path = STRAP_DIR / output_name
        image = Image.open(source_path).convert("RGBA")
        image = crop_to_alpha(image, pad=2)
        image = fit_width(image, TARGET_OUTPUT_WIDTH.get(output_name))
        image = crop_to_alpha(image, pad=2)
        local_max_side = TARGET_MAX_SIDE.get(output_name, max_side)
        image = resize_max_side(image, max_side=local_max_side)
        image.save(target_path, format="PNG", optimize=True, compress_level=9)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-side", type=int, default=1024)
    parser.add_argument("--skip-public-metal", action="store_true")
    parser.add_argument("--skip-steel-link-export", action="store_true")
    args = parser.parse_args()

    for path in iter_targets(include_public_metals=not args.skip_public_metal):
        process_path(path, max_side=args.max_side)
        print(f"normalized: {path.relative_to(ROOT)}")

    if not args.skip_steel_link_export:
        export_steel_link_variants(max_side=args.max_side)
        print("exported: public/strap-selection-kie/steel-link-bracelet-{buckle,tail}.png")


if __name__ == "__main__":
    main()
