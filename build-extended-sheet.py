"""Assemble the fully extended DeepSeek-pet sprite sheet.

Input : girl-pet-out/spritesheet.webp            (1536x1872, the clean 9-row source)
       girl-pet-src/interp/row0/mid-*.png        (idle midpoints, 5)
       girl-pet-src/interp/row<N>/mid-*.png      (row midpoints from the row pass)
       girl-pet-src/rows-report.json             (which rows passed the gates)
Output: girl-pet-out/spritesheet.extended.webp   (2880x1872, 15 cols x 9 rows)

Each animation row is rewritten as
    orig0, mid01, orig1, mid12, ... , origN
so the atlas column count is the widest sequence. Rows with fewer frames simply
leave the remaining cells transparent; the renderer addresses them by their own
per-state frame counts, so trailing cells are never read.

Rows that were not extended (or failed the gates) are copied verbatim at their
original columns, which keeps their behaviour identical.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

CELL_W, CELL_H = 192, 208
SRC_COLS, ROWS = 8, 9
IDLE_SEQUENCE = [0, "mid01", 1, "mid12", 2, "mid23", 3, "mid34", 4, "mid45", 5]
IDLE_SPARE_COLUMN = 6

ROW_STATES = [
    "idle",
    "running-right",
    "running-left",
    "waving",
    "jumping",
    "failed",
    "waiting",
    "running",
    "review",
]


def same_visible(x: np.ndarray, y: np.ndarray) -> bool:
    """Compare cells as *seen*; WebP may rewrite RGB under transparent pixels."""
    if x.shape != y.shape:
        return False
    if not np.array_equal(x[:, :, 3], y[:, :, 3]):
        return False
    visible = x[:, :, 3] > 0
    if not visible.any():
        return True
    return np.array_equal(x[:, :, :3][visible], y[:, :, :3][visible])


def main() -> int:
    root = Path(__file__).resolve().parent
    src = root / "girl-pet-out" / "spritesheet.webp"
    out = root / "girl-pet-out" / "spritesheet.extended.webp"
    rows_report = json.loads((root / "girl-pet-src" / "rows-report.json").read_text(encoding="utf-8"))

    sheet = Image.open(src).convert("RGBA")
    assert sheet.size == (SRC_COLS * CELL_W, ROWS * CELL_H), f"unexpected source size {sheet.size}"

    def cell(row: int, col: int) -> Image.Image:
        return sheet.crop((col * CELL_W, row * CELL_H, (col + 1) * CELL_W, (row + 1) * CELL_H))

    # Build each row's frame sequence first so the atlas width can be sized.
    sequences: dict[int, list[Image.Image]] = {}
    extended_rows: dict[int, int] = {}

    for row in range(ROWS):
        state = ROW_STATES[row]
        report = next(r for r in rows_report["rows"] if r["row"] == row)
        used = [c for c in range(SRC_COLS) if cell(row, c).getbbox() is not None]

        if row == 0:
            sequence = []
            for item in IDLE_SEQUENCE:
                if isinstance(item, int):
                    sequence.append(cell(0, item))
                else:
                    pair = item[3:]
                    sequence.append(
                        Image.open(root / "girl-pet-src" / "interp" / "row0" / f"mid-{pair[0]}-{pair[1]}.png")
                        if (root / "girl-pet-src" / "interp" / "row0").exists()
                        else Image.open(root / "girl-pet-src" / "interp" / f"mid-{pair[0]}-{pair[1]}.png")
                    )
            sequence = [im.convert("RGBA") for im in sequence]
            extended_rows[row] = len(sequence)
            sequences[row] = sequence
            continue

        if report.get("extended") and len(used) >= 2:
            sequence = []
            row_dir = root / "girl-pet-src" / "interp" / f"row{row}"
            for i, col in enumerate(used):
                sequence.append(cell(row, col))
                if i < len(used) - 1:
                    mid = Image.open(row_dir / f"mid-{used[i]}-{used[i + 1]}.png").convert("RGBA")
                    assert mid.size == (CELL_W, CELL_H), mid.size
                    sequence.append(mid)
            sequences[row] = sequence
            extended_rows[row] = len(sequence)
        else:
            sequences[row] = [cell(row, col) for col in range(SRC_COLS)]
            extended_rows[row] = 0

    out_cols = max(len(seq) for seq in sequences.values())
    # Keep a slot for the idle row's unreferenced source frame.
    idle_seq = sequences[0]
    out_cols = max(out_cols, len(idle_seq) + 1)
    canvas = Image.new("RGBA", (out_cols * CELL_W, ROWS * CELL_H), (0, 0, 0, 0))

    for row, sequence in sequences.items():
        for index, image in enumerate(sequence):
            assert image.size == (CELL_W, CELL_H), (row, index, image.size)
            canvas.paste(image.convert("RGBA"), (index * CELL_W, row * CELL_H))

    # The idle row's seventh source frame is not part of any loop; keep it
    # rather than silently discarding source art.
    canvas.paste(cell(0, IDLE_SPARE_COLUMN), (len(idle_seq) * CELL_W, 0))

    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, format="WEBP", lossless=True, quality=100, method=6)
    written = Image.open(out).convert("RGBA")
    assert written.size == (out_cols * CELL_W, ROWS * CELL_H), written.size

    report: dict[str, object] = {
        "file": str(out),
        "size": list(written.size),
        "columns": out_cols,
        "rows": ROWS,
        "frames_per_row": {ROW_STATES[r]: extended_rows[r] or SRC_COLS for r in range(ROWS)},
        "extended_rows": [ROW_STATES[r] for r in sorted(extended_rows) if extended_rows[r]],
    }
    problems: list[str] = []

    # 1. Every written frame must be non-empty and stay inside its own cell.
    frame_stats = {}
    for row, sequence in sequences.items():
        stats = []
        for index in range(len(sequence)):
            patch = written.crop((index * CELL_W, row * CELL_H, (index + 1) * CELL_W, (row + 1) * CELL_H))
            array = np.asarray(patch)
            opaque = int((array[:, :, 3] > 8).sum())
            bbox = patch.getbbox()
            stats.append({"index": index, "opaque": opaque, "bbox": list(bbox) if bbox else None})
            if opaque == 0:
                problems.append(f"{ROW_STATES[row]} frame {index} is empty")
            if bbox is not None and (bbox[0] <= 0 or bbox[2] >= CELL_W):
                problems.append(f"{ROW_STATES[row]} frame {index} touches a side cell edge")
        frame_stats[ROW_STATES[row]] = stats
    report["frame_stats"] = frame_stats

    # 2. Original frames must survive untouched in their new positions.
    mutated = []
    for row in range(ROWS):
        sequence = sequences[row]
        for index, image in enumerate(sequence):
            # Only original frames are checked against the source; midpoints have
            # no source counterpart.
            source_col = None
            if row == 0:
                frame_map = {0: 0, 2: 1, 4: 2, 6: 3, 8: 4, 10: 5}
                source_col = frame_map.get(index)
            elif extended_rows[row]:
                used = [c for c in range(SRC_COLS) if cell(row, c).getbbox() is not None]
                if index % 2 == 0:
                    source_col = used[index // 2]
            else:
                source_col = index
            if source_col is None:
                continue
            rebuilt = np.asarray(written.crop((index * CELL_W, row * CELL_H, (index + 1) * CELL_W, (row + 1) * CELL_H)))
            if not same_visible(np.asarray(image), rebuilt):
                mutated.append([ROW_STATES[row], index])
    report["mutated_original_frames"] = mutated
    if mutated:
        problems.append(f"{len(mutated)} original frames were altered")

    # 3. The unreferenced idle frame must still be present.
    spare = np.asarray(written.crop((len(idle_seq) * CELL_W, 0, (len(idle_seq) + 1) * CELL_W, CELL_H)))
    report["idle_spare_preserved"] = bool(same_visible(spare, np.asarray(cell(0, IDLE_SPARE_COLUMN))))
    if not report["idle_spare_preserved"]:
        problems.append("unreferenced idle source frame was not preserved")

    # 4. Each inserted frame must sit inside its neighbours' silhouette range.
    #    Comparing a whole row's span is wrong: jumping and waving legitimately
    #    change area a lot between key poses. What matters is that an inserted
    #    frame neither collapsed nor ballooned relative to the two it sits between.
    area_problems = []
    for row, stats in frame_stats.items():
        if not extended_rows.get(ROW_STATES.index(row)):
            continue
        for index in range(1, len(stats) - 1):
            left, mid, right = stats[index - 1], stats[index], stats[index + 1]
            if min(left["opaque"], right["opaque"]) == 0:
                continue
            low = min(left["opaque"], right["opaque"]) * 0.90
            high = max(left["opaque"], right["opaque"]) * 1.10
            if not (low <= mid["opaque"] <= high):
                area_problems.append(
                    [row, index, mid["opaque"], left["opaque"], right["opaque"]]
                )
    report["area_out_of_range"] = area_problems
    if area_problems:
        problems.append(f"{len(area_problems)} inserted frames fell outside their neighbours' area range")

    report["problems"] = problems
    (root / "girl-pet-src" / "sheet-build-report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    print(json.dumps({k: v for k, v in report.items() if k != "frame_stats"}, indent=2, ensure_ascii=False))
    print(f"wrote {out} ({out.stat().st_size} bytes)")
    print("RESULT", "ok" if not problems else "fail")
    return 0 if not problems else 3


if __name__ == "__main__":
    sys.exit(main())
