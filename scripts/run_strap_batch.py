#!/usr/bin/env python3
from __future__ import annotations

import csv
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GENERATOR = ROOT / "scripts" / "kie_generate_transparent.py"


def load_rows(csv_path: Path) -> list[dict[str, str]]:
    with csv_path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def main() -> int:
    if len(sys.argv) < 2:
        print(
            "Usage: python3 scripts/run_strap_batch.py <variants.csv> "
            "[category|slug-filter|limit]"
        )
        return 1

    csv_path = Path(sys.argv[1]).resolve()
    category_filter = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != "-" else None
    slug_filter = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] != "-" else None
    limit = int(sys.argv[4]) if len(sys.argv) > 4 else None

    rows = load_rows(csv_path)
    selected: list[dict[str, str]] = []
    for row in rows:
        if category_filter and row["category"] != category_filter:
            continue
        if slug_filter and slug_filter not in row["slug"]:
            continue
        selected.append(row)

    if limit is not None:
        selected = selected[:limit]

    if not selected:
        print("No matching rows.")
        return 1

    for idx, row in enumerate(selected, start=1):
        prompt_file = Path(row["prompt_file"])
        output_file = Path(row["output_file"])
        print(f"[{idx}/{len(selected)}] {row['slug']} {row['part']}")
        cmd = [
            sys.executable,
            str(GENERATOR),
            str(prompt_file),
            str(output_file),
            "1:1",
        ]
        completed = subprocess.run(cmd, cwd=str(ROOT))
        if completed.returncode != 0:
            print(f"FAILED: {row['slug']} {row['part']}")
            return completed.returncode

    print(f"Completed {len(selected)} renders.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
