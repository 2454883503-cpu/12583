"""Motion-compensated in-between synthesis for every DeepSeek-pet animation row.

Each row of the 9-row pet atlas is an independent loop. For every adjacent pair
of *used* frames this builds the midpoint the way a hand-drawn in-between would:
estimate the per-region displacement with block matching, warp both neighbours
half-way toward each other, composite by coverage, then restore edge energy.

Rows whose midpoints fail the quality gates are reported as not extended and are
left byte-identical in the atlas, so a hard-to-interpolate cycle (e.g. fast
running legs) can never degrade the pet.

Output: girl-pet-src/interp/row<N>/mid-<a>-<b>.png plus rows-report.json.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

CELL_W, CELL_H = 192, 208
COLS = 8
BLOCK = 8
SEARCH = 8

# Plugin row order and the durations it ships with, so a skipped row keeps its
# original timing exactly.
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

# Rows that are worth smoothing: the states the pet actually shows while a turn
# is running. `idle` was already extended and is left untouched here.
TARGET_ROWS = [1, 2, 3, 4, 5, 6, 7, 8]


def load_row(sheet: Image.Image, row: int) -> list[np.ndarray]:
    return [
        np.asarray(
            sheet.crop((c * CELL_W, row * CELL_H, (c + 1) * CELL_W, (row + 1) * CELL_H)),
            dtype=np.float32,
        )
        for c in range(COLS)
    ]


def alpha_of(image: np.ndarray) -> np.ndarray:
    return image[:, :, 3] / 255.0


def shifted(image: np.ndarray, dy: int, dx: int) -> np.ndarray:
    out = np.zeros_like(image)
    h, w = image.shape[:2]
    sy0, sy1 = max(0, dy), h + min(0, dy)
    sx0, sx1 = max(0, dx), w + min(0, dx)
    ty0, ty1 = max(0, -dy), h + min(0, -dy)
    tx0, tx1 = max(0, -dx), w + min(0, -dx)
    out[sy0:sy1, sx0:sx1] = image[ty0:ty1, tx0:tx1]
    return out


def flow_field(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """(h, w, 2) displacement map in pixels, evaluated per BLOCK grid cell.

    All candidate offsets are scored at once: for each offset a full-image
    difference map is block-averaged, and the per-block argmin picks the flow.
    That keeps a 17x17 search cheap enough to run over every animation row.
    """
    h, w = a.shape[:2]
    gh, gw = h // BLOCK, w // BLOCK
    mask_a = a[:, :, 3] > 40
    scores = []
    offsets = []
    for dy in range(-SEARCH, SEARCH + 1):
        for dx in range(-SEARCH, SEARCH + 1):
            bs = shifted(b, dy, dx)
            valid = mask_a & (bs[:, :, 3] > 40)
            if valid.sum() == 0:
                continue
            diff = np.abs(a[:, :, :3] - bs[:, :, :3]).mean(axis=2)
            diff = np.where(valid, diff, 0.0)
            sums = diff[: gh * BLOCK, : gw * BLOCK].reshape(gh, BLOCK, gw, BLOCK).sum(axis=(1, 3))
            counts = valid[: gh * BLOCK, : gw * BLOCK].reshape(gh, BLOCK, gw, BLOCK).sum(axis=(1, 3))
            score = np.where(counts >= 0.25 * BLOCK * BLOCK, sums / np.maximum(counts, 1), np.inf)
            scores.append(score)
            offsets.append((dx, dy))
    stack = np.stack(scores)
    best = np.argmin(stack, axis=0)
    dx_grid = np.zeros((gh, gw), dtype=np.float32)
    dy_grid = np.zeros((gh, gw), dtype=np.float32)
    for index, (dx, dy) in enumerate(offsets):
        hit = best == index
        dx_grid[hit] = dx
        dy_grid[hit] = dy

    def expand(grid: np.ndarray) -> np.ndarray:
        return np.asarray(
            Image.fromarray(grid, "F").resize((w, h), Image.BILINEAR), dtype=np.float32
        )

    return np.stack([expand(dx_grid), expand(dy_grid)], axis=-1)


def bilinear_warp(image: np.ndarray, dx: np.ndarray, dy: np.ndarray) -> np.ndarray:
    h, w = image.shape[:2]
    ys, xs = np.meshgrid(np.arange(h, dtype=np.float32), np.arange(w, dtype=np.float32), indexing="ij")
    sx = xs + dx
    sy = ys + dy
    x0 = np.floor(sx).astype(np.int32)
    y0 = np.floor(sy).astype(np.int32)
    fx = (sx - x0)[..., None]
    fy = (sy - y0)[..., None]
    x0c = np.clip(x0, 0, w - 1)
    x1c = np.clip(x0 + 1, 0, w - 1)
    y0c = np.clip(y0, 0, h - 1)
    y1c = np.clip(y0 + 1, 0, h - 1)
    top = image[y0c, x0c] * (1 - fx) + image[y0c, x1c] * fx
    bottom = image[y1c, x0c] * (1 - fx) + image[y1c, x1c] * fx
    warped = top * (1 - fy) + bottom * fy
    outside = (sx < 0) | (sy < 0) | (sx > w - 1) | (sy > h - 1)
    warped[outside] = 0.0
    return warped


def midpoint(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    flow = flow_field(a, b)
    half = flow / 2.0
    wa = bilinear_warp(a, half[..., 0], half[..., 1])
    wb = bilinear_warp(b, -half[..., 0], -half[..., 1])
    aa = alpha_of(wa)[..., None]
    ab = alpha_of(wb)[..., None]
    total = aa + ab
    colour = np.where(total > 1e-4, (wa * aa + wb * ab) / np.maximum(total, 1e-4), 0.0)
    # Coverage *intersection*. Taking max(aa, ab) inflated the silhouette
    # wherever the flow failed to track a limb (fast running legs): both poses
    # survived side by side and the row measured 15-26% larger than its
    # neighbours, i.e. visible ghosting. A pixel is only part of the in-between
    # when both warps agree it is.
    alpha = np.minimum(aa, ab).squeeze(-1)
    out = np.dstack([colour[:, :, :3], alpha * 255.0])
    gap = total.squeeze(-1) < 0.05
    out[gap] = ((a + b) / 2.0)[gap]
    return out


def unsharp(image: np.ndarray, percent: int = 110) -> np.ndarray:
    rgb = np.asarray(
        Image.fromarray(np.rint(image[:, :, :3]).clip(0, 255).astype(np.uint8), "RGB")
        .filter(ImageFilter.UnsharpMask(radius=1.2, percent=percent, threshold=1)),
        dtype=np.float32,
    )
    return np.dstack([rgb, image[:, :, 3]])


def gradient_energy(image: np.ndarray) -> float:
    grey = (0.299 * image[:, :, 0] + 0.587 * image[:, :, 1] + 0.114 * image[:, :, 2]) * alpha_of(image)
    return float(np.abs(np.diff(grey, axis=1)).mean() + np.abs(np.diff(grey, axis=0)).mean())


def masked_mad(x: np.ndarray, y: np.ndarray) -> float:
    mask = (x[:, :, 3] > 128) & (y[:, :, 3] > 128)
    if mask.sum() == 0:
        return float("nan")
    return float(np.abs(x[:, :, :3][mask] - y[:, :, :3][mask]).mean())


def opaque_area(image: np.ndarray) -> int:
    return int((image[:, :, 3] > 8).sum())


def durations_for(original: list[int], inserted: int) -> list[int]:
    """Hold the original frames longer than the inserted ones, same cycle time."""
    cycle = sum(original)
    n = len(original)
    total_weight = 2 * n + inserted
    weights = []
    for i in range(n):
        weights.append(2)
        if i < n - 1:
            weights.append(1)
    raw = [cycle * w / total_weight for w in weights]
    out = [max(30, int(round(v))) for v in raw]
    # Absorb rounding drift into the final hold so the loop length is exact.
    out[-1] += cycle - sum(out)
    return out


def original_durations(state: str, plugin_src: str) -> list[int] | None:
    import re

    match = re.search(
        r'state: "%s",\s*\n\s*durations: \[([^\]]*)\]' % re.escape(state), plugin_src
    )
    if not match:
        return None
    return [int(float(v)) for v in re.findall(r"[\d.]+", match.group(1))]


def main() -> int:
    root = Path(__file__).resolve().parent
    sheet = Image.open(root / "girl-pet-out" / "spritesheet.webp").convert("RGBA")
    assert sheet.size == (COLS * CELL_W, 9 * CELL_H), sheet.size

    plugin_src = Path(
        r"C:\Users\tanyu\.dsh\profiles\desktop\node_modules\dsh-desktop-pet\lib\index.js"
    ).read_text(encoding="utf-8")

    report: dict[str, object] = {"rows": []}
    for row in range(9):
        state = ROW_STATES[row]
        cells = load_row(sheet, row)
        used = [i for i, c in enumerate(cells) if (c[:, :, 3] > 8).sum() > 0]
        entry: dict[str, object] = {
            "row": row,
            "state": state,
            "used": len(used),
            "extended": False,
        }
        base_durations = original_durations(state, plugin_src) or []

        if row not in TARGET_ROWS or len(used) < 2:
            entry["skipped"] = "not targeted" if row not in TARGET_ROWS else "too few frames"
            report["rows"].append(entry)
            continue

        out_dir = root / "girl-pet-src" / "interp" / f"row{row}"
        out_dir.mkdir(parents=True, exist_ok=True)

        pairs = []
        ratios, balances, sharpness, areas = [], [], [], []
        for i in range(len(used) - 1):
            a, b = cells[used[i]], cells[used[i + 1]]
            sharp = unsharp(midpoint(a, b))
            a_ref, b_ref = unsharp(a), unsharp(b)
            base = masked_mad(a_ref, b_ref)
            ge_ref = (gradient_energy(a) + gradient_energy(b)) / 2.0
            mad_a = masked_mad(sharp, a_ref)
            mad_b = masked_mad(sharp, b_ref)
            pair = {
                "pair": [used[i], used[i + 1]],
                "baseline": round(base, 2),
                "mad_a": round(mad_a, 2),
                "mad_b": round(mad_b, 2),
                "ratio": round(max(mad_a, mad_b) / base, 3) if base else None,
                "balance": round(abs(mad_a - mad_b), 2),
                "sharpness": round(gradient_energy(sharp) / ge_ref, 3) if ge_ref else None,
                "area_ratio": round(opaque_area(sharp) / max(opaque_area(a), opaque_area(b), 1), 3),
            }
            pairs.append(pair)
            Image.fromarray(np.rint(sharp).clip(0, 255).astype(np.uint8), "RGBA").save(
                out_dir / f"mid-{used[i]}-{used[i + 1]}.png"
            )
            if pair["ratio"] is not None:
                ratios.append(pair["ratio"])
            balances.append(pair["balance"])
            if pair["sharpness"] is not None:
                sharpness.append(pair["sharpness"])
            areas.append(pair["area_ratio"])

        worst_ratio = max(ratios) if ratios else 9.9
        worst_balance = max(balances) if balances else 9.9
        worst_sharp = min(sharpness) if sharpness else 0.0
        # Symmetry is judged relative to how much the pair moves at all. A pair
        # whose silhouette area changes sharply (arms opening, e.g. the review
        # row) cannot have a perfectly equidistant midpoint, and pinning it to an
        # absolute pixel budget would reject good frames. What actually matters
        # is that the imbalance is small next to the pair's own difference.
        worst_balance_rel = max(
            (p["balance"] / p["baseline"] for p in pairs if p["baseline"]), default=9.9
        )
        worst_area = max(areas) if areas else 9.9
        # An inserted frame must not be visibly bigger than the poses it sits
        # between: that is exactly what a failed flow looks like (two gestures
        # surviving side by side). Shrinking is harmless, growing reads as a
        # ghost, so only overshoot is gated.
        passed = (
            worst_ratio < 0.85
            and worst_sharp > 0.92
            and worst_balance_rel < 0.10
            and worst_area < 1.06
        )
        entry.update(
            {
                "worst_ratio": round(worst_ratio, 3),
                "worst_balance_px": round(worst_balance, 2),
                "worst_balance_rel": round(worst_balance_rel, 4),
                "worst_sharpness": round(worst_sharp, 3),
                "worst_area_ratio": round(worst_area, 3),
                "extended": passed,
                "pairs": pairs,
            }
        )
        if passed:
            frames = len(used) * 2 - 1
            entry["new_frames"] = frames
            entry["durations"] = durations_for(base_durations, len(used) - 1) if base_durations else []
            entry["cycle_before"] = sum(base_durations)
            entry["cycle_after"] = sum(entry["durations"])
            print(
                f"row {row} {state:<14} {len(used)} -> {frames} frames  "
                f"ratio={worst_ratio:.3f} sharp={worst_sharp:.3f} bal={worst_balance_rel:.3f}  PASS"
            )
        else:
            reason = []
            if worst_ratio >= 0.85:
                reason.append("midpoint not between neighbours")
            if worst_sharp <= 0.92:
                reason.append("too soft")
            if worst_balance_rel >= 0.10:
                reason.append("unbalanced")
            if worst_area >= 1.06:
                reason.append("silhouette inflated (ghosting)")
            entry["skipped"] = ", ".join(reason)
            print(
                f"row {row} {state:<14} {len(used)} frames  "
                f"ratio={worst_ratio:.3f} sharp={worst_sharp:.3f} bal={worst_balance_rel:.3f}  SKIP"
            )
        report["rows"].append(entry)

    out = root / "girl-pet-src" / "rows-report.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    extended = [r for r in report["rows"] if r["extended"]]
    print()
    print("extended rows:", [(r["row"], r["state"], r["new_frames"]) for r in extended])
    print("wrote", out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
