from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def main() -> int:
    if len(sys.argv) < 2:
      print("Usage: python3 scripts/crop_alpha_asset.py <image_path> [canvas_size] [alpha_threshold] [padding]")
      return 1

    image_path = Path(sys.argv[1])
    canvas_size = int(sys.argv[2]) if len(sys.argv) > 2 else 1024
    alpha_threshold = int(sys.argv[3]) if len(sys.argv) > 3 else 10
    padding = int(sys.argv[4]) if len(sys.argv) > 4 else 24

    image = Image.open(image_path).convert("RGBA")
    alpha = image.getchannel("A")
    mask = alpha.point(lambda px: 255 if px >= alpha_threshold else 0)
    bbox = mask.getbbox()
    if not bbox:
      print(f"Skipping {image_path}: no visible alpha bbox")
      return 0

    cropped = image.crop(bbox)
    inner_size = max(1, canvas_size - padding * 2)
    scale = min(inner_size / cropped.width, inner_size / cropped.height)
    target = cropped.resize(
      (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))),
      Image.Resampling.LANCZOS,
    )

    out = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    x = (canvas_size - target.width) // 2
    y = (canvas_size - target.height) // 2
    out.paste(target, (x, y), target)
    out.save(image_path)
    print(f"Cropped {image_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
