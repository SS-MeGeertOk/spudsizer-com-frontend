#!/usr/bin/env python3
"""
Converts every JPG/PNG in the site folder to WebP and updates all references
in .html, .css and .js files. Run it from the root of the website repo:

    pip install pillow
    python convert-images-to-webp.py            # convert + update references
    python convert-images-to-webp.py --delete   # also remove the original files

Options:
    --quality 82     WebP quality (75-85 is a good range for photos)
    --max-width 2000 Downscale images wider than this (0 = never resize)
"""
import argparse
import re
from pathlib import Path
from PIL import Image

SKIP_DIRS = {".git", "node_modules", "worker"}
IMAGE_EXT = {".jpg", ".jpeg", ".png"}
TEXT_EXT = {".html", ".htm", ".css", ".js", ".json", ".md"}


def walk(root, exts):
    for p in root.rglob("*"):
        if p.is_file() and p.suffix.lower() in exts and not (SKIP_DIRS & set(p.parts)):
            yield p


def convert(path, quality, max_width):
    out = path.with_suffix(".webp")
    with Image.open(path) as im:
        if max_width and im.width > max_width:
            im = im.resize((max_width, round(im.height * max_width / im.width)), Image.LANCZOS)
        has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
        im = im.convert("RGBA" if has_alpha else "RGB")
        # PNGs with transparency (logos, icons) are stored lossless so edges stay crisp
        if has_alpha and path.suffix.lower() == ".png":
            im.save(out, "WEBP", lossless=True, method=6)
        else:
            im.save(out, "WEBP", quality=quality, method=6)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quality", type=int, default=82)
    ap.add_argument("--max-width", type=int, default=2000)
    ap.add_argument("--delete", action="store_true", help="delete originals after converting")
    args = ap.parse_args()
    root = Path(".").resolve()

    converted = []
    for img in walk(root, IMAGE_EXT):
        out = convert(img, args.quality, args.max_width)
        before, after = img.stat().st_size, out.stat().st_size
        print(f"{img.relative_to(root)}: {before/1024:.0f} KB -> {after/1024:.0f} KB")
        converted.append(img)

    names = {p.name for p in converted}
    if names:
        pattern = re.compile(r"([\w\-./%+ ]*?)(" + "|".join(re.escape(n) for n in names) + r")")
        for f in walk(root, TEXT_EXT):
            text = f.read_text(encoding="utf-8")
            new = pattern.sub(lambda m: m.group(1) + Path(m.group(2)).with_suffix(".webp").name, text)
            if new != text:
                f.write_text(new, encoding="utf-8")
                print(f"updated references in {f.relative_to(root)}")

    if args.delete:
        for img in converted:
            img.unlink()
        print(f"deleted {len(converted)} originals")
    print(f"done: {len(converted)} images converted")


if __name__ == "__main__":
    main()
