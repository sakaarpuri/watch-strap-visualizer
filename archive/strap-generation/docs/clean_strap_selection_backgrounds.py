import math
import os
import sys
from collections import deque

from PIL import Image


def color_distance(left, right):
    return math.sqrt(
        (left[0] - right[0]) ** 2 +
        (left[1] - right[1]) ** 2 +
        (left[2] - right[2]) ** 2
    )


def luma(rgb):
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]


def load_rgba(path):
    return Image.open(path).convert("RGBA")


def sample_background_colors(image):
    width, height = image.size
    pixels = image.load()
    points = [
        (0, 0),
        (width - 1, 0),
        (0, height - 1),
        (width - 1, height - 1),
        (width // 2, 0),
        (width // 2, height - 1),
        (0, height // 2),
        (width - 1, height // 2),
    ]
    samples = [pixels[x, y][:3] for x, y in points]
    samples.sort(key=luma)
    return samples[0], samples[-1]


def is_background(pixel, dark_bg, light_bg):
    r, g, b, a = pixel
    if a < 8:
        return True
    max_value = max(r, g, b)
    min_value = min(r, g, b)
    low_saturation = (max_value - min_value) < 42
    if not low_saturation:
        return False
    rgb = (r, g, b)
    return (
        color_distance(rgb, dark_bg) <= 68 or
        color_distance(rgb, light_bg) <= 68
    )


def remove_checkerboard(image):
    width, height = image.size
    pixels = image.load()
    dark_bg, light_bg = sample_background_colors(image)

    visited = bytearray(width * height)
    queue = deque()

    def enqueue(x, y):
        if x < 0 or x >= width or y < 0 or y >= height:
            return
        index = y * width + x
        if visited[index]:
            return
        if not is_background(pixels[x, y], dark_bg, light_bg):
            return
        visited[index] = 1
        queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)
        enqueue(x - 1, y)
        enqueue(x + 1, y)
        enqueue(x, y - 1)
        enqueue(x, y + 1)

    return image


def crop_to_opaque(image, padding=2):
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return image
    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.size[0], right + padding)
    bottom = min(image.size[1], bottom + padding)
    return image.crop((left, top, right, bottom))


def process_image(source_path, output_path):
    image = load_rgba(source_path)
    cleaned = remove_checkerboard(image)
    cropped = crop_to_opaque(cleaned)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    cropped.save(output_path, format="PNG")


def main():
    if len(sys.argv) != 3:
        print("Usage: python3 scripts/clean_strap_selection_backgrounds.py <input_dir> <output_dir>")
        sys.exit(1)

    input_dir = sys.argv[1]
    output_dir = sys.argv[2]
    if not os.path.isdir(input_dir):
        print(f"ERROR: Input directory not found: {input_dir}")
        sys.exit(1)

    filenames = [
        name for name in os.listdir(input_dir)
        if name.lower().endswith((".jpg", ".jpeg", ".png"))
    ]
    filenames.sort()

    for name in filenames:
        source_path = os.path.join(input_dir, name)
        output_name = os.path.splitext(name)[0] + ".png"
        output_path = os.path.join(output_dir, output_name)
        process_image(source_path, output_path)
        print(f"cleaned {name} -> {output_name}")


if __name__ == "__main__":
    main()
