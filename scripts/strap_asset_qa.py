#!/usr/bin/env python3
"""
Asset QA for strap previews.

Checks:
- Transparency margins exist (no full-frame opaque checkerboard background).
- Pair join widths are reasonably matched (buckle-bottom vs tail-top).
- Basic orientation sanity (tail not upside down; buckle not inverted).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Iterable, List, Optional, Tuple

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
STRAP_DIR = ROOT / "public" / "strap-selection-kie"


def alpha_bbox(path: Path) -> Optional[Tuple[int, int, int, int]]:
    img = Image.open(path).convert("RGBA")
    return img.getchannel("A").getbbox()


def row_width(alpha: Image.Image, y: int, threshold: int = 12) -> int:
    w = alpha.width
    row = alpha.crop((0, y, w, y + 1)).getdata()
    nonzero = [i for i, v in enumerate(row) if v > threshold]
    if not nonzero:
        return 0
    return nonzero[-1] - nonzero[0] + 1


def sampled_edge_widths(path: Path) -> Tuple[float, float]:
    img = Image.open(path).convert("RGBA")
    alpha = img.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return 0.0, 0.0
    _, top, _, bottom = bbox
    height = max(1, bottom - top)
    fractions = [0.05, 0.08, 0.12, 0.16, 0.2]
    top_samples: List[int] = []
    bottom_samples: List[int] = []
    for f in fractions:
        d = max(0, int(round(height * f)))
        y_top = min(bottom - 1, top + d)
        y_bottom = max(top, bottom - 1 - d)
        tw = row_width(alpha, y_top)
        bw = row_width(alpha, y_bottom)
        if tw > 0:
            top_samples.append(tw)
        if bw > 0:
            bottom_samples.append(bw)
    top_avg = sum(top_samples) / len(top_samples) if top_samples else 0.0
    bottom_avg = sum(bottom_samples) / len(bottom_samples) if bottom_samples else 0.0
    return top_avg, bottom_avg


def parse_pairs() -> Iterable[Tuple[str, Path, Path]]:
    for buckle in sorted(STRAP_DIR.glob("*-buckle.png")):
        tail = buckle.with_name(buckle.name.replace("-buckle.png", "-tail.png"))
        if tail.exists():
            strap_id = buckle.name.replace("-buckle.png", "")
            yield strap_id, buckle, tail

    legacy = [
        ("sample-strap", ROOT / "public/sample-strap-a.png", ROOT / "public/sample-strap-b.png"),
        ("metal-strap", ROOT / "public/metal-strap-a.png", ROOT / "public/metal-strap-b.png"),
    ]
    for strap_id, a_path, b_path in legacy:
        if a_path.exists() and b_path.exists():
            yield strap_id, a_path, b_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--strict", action="store_true")
    parser.add_argument(
        "--pair",
        action="append",
        default=[],
        help="Check only matching pair ids (repeatable, substring match).",
    )
    args = parser.parse_args()

    failures: List[str] = []
    warnings: List[str] = []

    seen_files = set()
    pairs = list(parse_pairs())
    if args.pair:
        filters = [f.lower().strip() for f in args.pair if f.strip()]
        pairs = [
            (strap_id, a_path, b_path)
            for strap_id, a_path, b_path in pairs
            if any(f in strap_id.lower() for f in filters)
        ]

    for strap_id, a_path, b_path in pairs:
        for file_path in (a_path, b_path):
            if file_path in seen_files:
                continue
            seen_files.add(file_path)
            img = Image.open(file_path).convert("RGBA")
            alpha = img.getchannel("A")
            bbox = img.getchannel("A").getbbox()
            if not bbox:
                failures.append(f"{file_path.name}: empty alpha")
                continue
            if bbox == (0, 0, img.width, img.height):
                alpha_values = list(alpha.getdata())
                opaque_ratio = sum(1 for v in alpha_values if v > 0) / max(1, len(alpha_values))
                if opaque_ratio < 0.55:
                    failures.append(
                        f"{file_path.name}: alpha bbox touches full frame with low opaque ratio (checkerboard likely embedded)"
                    )

        a_top, a_bottom = sampled_edge_widths(a_path)
        b_top, b_bottom = sampled_edge_widths(b_path)
        if a_bottom <= 0 or b_top <= 0:
            failures.append(f"{strap_id}: could not measure join widths")
            continue

        join_mismatch = abs(a_bottom - b_top) / max(a_bottom, b_top)
        if join_mismatch > 0.16:
            failures.append(
                f"{strap_id}: lug/join width mismatch (buckle-bottom={a_bottom:.1f}, tail-top={b_top:.1f})"
            )

        # Orientation sanity heuristics (non-fatal unless strict)
        if b_bottom > b_top * 1.2:
            warnings.append(f"{strap_id}: tail may be upside down (tail-bottom wider than tail-top)")
        if a_top > a_bottom * 1.25:
            warnings.append(f"{strap_id}: buckle may be upside down (buckle-top much wider)")

    for msg in warnings:
        print(f"WARN: {msg}")
    for msg in failures:
        print(f"FAIL: {msg}")

    if failures or (args.strict and warnings):
        sys.exit(1)
    print(f"PASS: checked {len(pairs)} strap pairs, {len(seen_files)} files")


if __name__ == "__main__":
    main()
