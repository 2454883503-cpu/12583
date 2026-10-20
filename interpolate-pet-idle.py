"""Motion-compensated in-between frame synthesis for the DeepSeek pet.

The pet renderer plays a fixed sprite row, so "more frames" means inserting new
cells between the existing ones. Re-drawing the character with an image model
changes her design (measured: torso/leg MAD 38-63 vs. a 16 baseline), so each
in-between is instead built from the two adjacent *original* frames:

  1. block matching at 2x upscale estimates a sub-pixel displacement field A->B
  2. A is warped forward by half of it, B backward by half
  3. the warps are coverage-weighted, then lightly unsharp-masked

Quality gates at the bottom refuse to write a sheet when a midpoint does not
actually sit between its neighbours or comes out soft.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

CELL_W, CELL_H = 192, 208
COLS = 8
UPSAMPLE = 2
BLOCK = 8
SEARCH = 5


def load_row(sheet_path: Path, row: int, count: int) -> list[np.ndarray]:
    sheet = Image.open(sheet_path).convert("RGBA")
    return [
        np.asarray(
            sheet.crop((c * CELL_W, row * CELL_H, (c + 1) * CELL_W, (row + 1) * CELL_H)),
            dtype=np.float32,
        )
        for c in range(count)
    ]


def alpha_of(image: np.ndarray) -> np.ndarray:
    return image[:, :, 3] / 255.0


def match_block(a: np.ndarray, b: np.ndarray, x0: int, y0: int, x1: int, y1: int) -> tuple[int, int, float]:
    """Best integer displacement by masked SSD, plus its score."""
    patch = a[y0:y1, x0:x1]
    mask = patch[:, :, 3] > 40
    if mask.sum() < 16:
        return 0, 0, float("inf")
    weight = patch[:, :, 3] / 255.0
    h, w = a.shape[:2]
    best = (0, 0)
    best_score = float("inf")
    for dy in range(-SEARCH, SEARCH + 1):
        for dx in range(-SEARCH, SEARCH + 1):
            ty0, ty1 = y0 + dy, y1 + dy
            tx0, tx1 = x0 + dx, x1 + dx
            if ty0 < 0 or tx0 < 0 or ty1 > h or tx1 > w:
                continue
            cand = b[ty0:ty1, tx0:tx1]
            if (cand[:, :, 3] > 40)[mask].mean() < 0.6:
                continue  # moved onto empty space: not a real match
            diff = np.abs(patch[:, :, :3] - cand[:, :, :3]).mean(axis=2)
            score = float((diff * weight)[mask].mean())
            if score < best_score:
                best_score = score
                best = (dx, dy)
    return best[0], best[1], best_score


def flow_field(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Dense (h, w, 2) displacement map, in source-cell pixels."""
    small_a = np.asarray(Image.fromarray(np.rint(a).astype(np.uint8), "RGBA")
                         .resize((CELL_W * UPSAMPLE, CELL_H * UPSAMPLE), Image.BICUBIC), dtype=np.float32)
    small_b = np.asarray(Image.fromarray(np.rint(b).astype(np.uint8), "RGBA")
                         .resize((CELL_W * UPSAMPLE, CELL_H * UPSAMPLE), Image.BICUBIC), dtype=np.float32)
    h, w = small_a.shape[:2]
    dx_map = np.zeros((h, w), dtype=np.float32)
    dy_map = np.zeros((h, w), dtype=np.float32)
    step = BLOCK * UPSAMPLE
    for y0 in range(0, h, step):
        for x0 in range(0, w, step):
            y1 = min(y0 + step, h)
            x1 = min(x0 + step, w)
            dx, dy, score = match_block(small_a, small_b, x0, y0, x1, y1)
            if not np.isfinite(score):
                continue
            dx_map[y0:y1, x0:x1] = dx / UPSAMPLE
            dy_map[y0:y1, x0:x1] = dy / UPSAMPLE
    # Median-style smoothing removes isolated block outliers without smearing
    # the field across the whole sprite.
    dx_map = smooth(dx_map, radius=3)
    dy_map = smooth(dy_map, radius=3)
    # Downscale the field back to cell resolution.
    dx_small = np.asarray(Image.fromarray(dx_map, "F").resize((CELL_W, CELL_H), Image.BILINEAR), dtype=np.float32)
    dy_small = np.asarray(Image.fromarray(dy_map, "F").resize((CELL_W, CELL_H), Image.BILINEAR), dtype=np.float32)
    return np.stack([dx_small, dy_small], axis=-1)


def smooth(array: np.ndarray, radius: int) -> np.ndarray:
    """Edge-preserving local average: keeps a dominant block value."""
    h, w = array.shape
    # 3x3 (or larger) median over stacked shifts: removes isolated block
    # outliers without smearing the field across the whole sprite.
    stack = []
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            shifted = np.full_like(array, np.nan)
            sy0, sy1 = max(0, dy), h + min(0, dy)
            sx0, sx1 = max(0, dx), w + min(0, dx)
            ty0, ty1 = max(0, -dy), h + min(0, -dy)
            tx0, tx1 = max(0, -dx), w + min(0, -dx)
            shifted[ty0:ty1, tx0:tx1] = array[sy0:sy1, sx0:sx1]
            stack.append(shifted)
    return np.nanmedian(np.stack(stack), axis=0).astype(np.float32)


def bilinear_warp(image: np.ndarray, dx: np.ndarray, dy: np.ndarray) -> np.ndarray:
    """Sample `image` at (x + dx, y + dy) with bilinear filtering."""
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
    # Coverage intersection, matching interpolate-pet-rows.py: a pixel belongs to
    # the in-between only when both warps agree it is covered. A union here
    # inflates the silhouette wherever the flow misses a limb.
    alpha = np.minimum(aa, ab).squeeze(-1)
    out = np.dstack([colour[:, :, :3], alpha * 255.0])
    gap = total.squeeze(-1) < 0.05
    out[gap] = ((a + b) / 2.0)[gap]
    return out


def unsharp(image: np.ndarray, percent: int = 110) -> np.ndarray:
    """Recover the edge energy lost to blur-and-average."""
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


def main() -> int:
    root = Path(__file__).resolve().parent
    frames = load_row(root / "girl-pet-repo" / "spritesheet.webp", 0, COLS)
    used = [i for i in range(6) if (frames[i][:, :, 3] > 8).sum() > 0]
    print("idle frames in use:", used)

    out_dir = root / "girl-pet-src" / "interp"
    out_dir.mkdir(parents=True, exist_ok=True)

    report = []
    for i in range(len(used) - 1):
        a, b = frames[used[i]], frames[used[i + 1]]
        raw = midpoint(a, b)
        sharp = unsharp(raw)
        # Score against equally sharpened neighbours: comparing a sharpened
        # midpoint to unsharpened frames inflates its distance to both and would
        # reject a perfectly good frame.
        a_ref, b_ref = unsharp(a), unsharp(b)
        base = masked_mad(a_ref, b_ref)
        # Sharpness is judged against the ORIGINAL frames: the goal is a frame
        # that carries as much edge detail as the art it sits between, not as
        # much as an artificially sharpened copy of it.
        ge_ref = (gradient_energy(a) + gradient_energy(b)) / 2.0
        entry = {
            "pair": [used[i], used[i + 1]],
            "baseline_ab": round(base, 2),
            "raw_mad_to_a": round(masked_mad(raw, unsharp(a)), 2),
            "raw_mad_to_b": round(masked_mad(raw, unsharp(b)), 2),
            "raw_sharpness": round(gradient_energy(raw) / ge_ref, 3),
            "out_mad_to_a": round(masked_mad(sharp, a_ref), 2),
            "out_mad_to_b": round(masked_mad(sharp, b_ref), 2),
            "out_sharpness": round(gradient_energy(sharp) / ge_ref, 3),
        }
        report.append(entry)
        Image.fromarray(np.rint(sharp).clip(0, 255).astype(np.uint8), "RGBA").save(
            out_dir / f"mid-{used[i]}-{used[i + 1]}.png"
        )
        print(entry)

    # A good midpoint is measurably closer to each neighbour than the two
    # neighbours are to each other, and keeps the source edge energy.
    balance = [abs(e["out_mad_to_a"] - e["out_mad_to_b"]) for e in report]
    closeness = [max(e["out_mad_to_a"], e["out_mad_to_b"]) / e["baseline_ab"] for e in report]
    sharpness = [e["out_sharpness"] for e in report]
    summary = {
        "pairs": len(report),
        "worst_max_side_ratio": round(float(max(closeness)), 3),
        "worst_balance_px": round(float(max(balance)), 2),
        "min_sharpness": round(float(min(sharpness)), 3),
        "detail": report,
    }
    (root / "girl-pet-src" / "interp-report.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in summary.items() if k != "detail"}, indent=2))

    ok = summary["worst_max_side_ratio"] < 0.85 and summary["min_sharpness"] > 0.92 and summary["worst_balance_px"] < 3.0
    print("GATES", "pass" if ok else "fail")
    return 0 if ok else 3


if __name__ == "__main__":
    sys.exit(main())
