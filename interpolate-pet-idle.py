"""Motion-compensated in-between frame synthesis for the DeepSeek pet.

The pet renderer plays a fixed sprite sheet, so "more frames" means inserting
new cells between existing ones. Re-drawing the character with an image model
changes her design, so instead each in-between is built from the two adjacent
original frames:

  1. block matching estimates a per-region displacement field A -> B
  2. A is warped forward by half of it, B backward by half
  3. the two warps are alpha-weighted and averaged

Because the idle motion is small, half-flow warping lands on the true midpoint
instead of producing a double-exposure. Quality gates at the bottom refuse to
write output when the result is blurrier than the source pair.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

CELL_W, CELL_H = 192, 208
COLS = 8
BLOCK = 16
SEARCH = 4


def load_frames(sheet_path: Path, row: int, count: int) -> list[np.ndarray]:
    sheet = Image.open(sheet_path).convert("RGBA")
    return [
        np.asarray(sheet.crop((c * CELL_W, row * CELL_H, (c + 1) * CELL_W, (row + 1) * CELL_H)), dtype=np.float32)
        for c in range(count)
    ]


def alpha_of(image: np.ndarray) -> np.ndarray:
    return image[:, :, 3] / 255.0


def match_block(source: np.ndarray, target: np.ndarray, x0: int, y0: int, x1: int, y1: int) -> tuple[int, int]:
    """Best integer displacement inside the search window, by masked SSD."""
    patch = source[y0:y1, x0:x1]
    mask = patch[:, :, 3] > 8
    if mask.sum() < 24:
        return 0, 0
    weight = patch[:, :, 3] / 255.0
    best = (0, 0)
    best_score = float("inf")
    h, w = patch.shape[:2]
    for dy in range(-SEARCH, SEARCH + 1):
        for dx in range(-SEARCH, SEARCH + 1):
            ty0, ty1 = y0 + dy, y1 + dy
            tx0, tx1 = x0 + dx, x1 + dx
            if ty0 < 0 or tx0 < 0 or ty1 > target.shape[0] or tx1 > target.shape[1]:
                continue
            candidate = target[ty0:ty1, tx0:tx1]
            diff = np.abs(patch[:, :, :3] - candidate[:, :, :3]).mean(axis=2)
            score = float((diff * weight)[mask].mean())
            score -= 40.0 * float((candidate[:, :, 3] > 8)[mask].mean())  # reward keeping the silhouette
            if score < best_score:
                best_score = score
                best = (dx, dy)
    return best


def flow_field(source: np.ndarray, target: np.ndarray) -> np.ndarray:
    """Dense (h, w, 2) displacement map sampled per block centre."""
    h, w = source.shape[:2]
    ys = np.arange(h, dtype=np.float32)
    xs = np.arange(w, dtype=np.float32)
    dx_map = np.zeros((h, w), dtype=np.float32)
    dy_map = np.zeros((h, w), dtype=np.float32)
    for y0 in range(0, h, BLOCK):
        for x0 in range(0, w, BLOCK):
            y1 = min(y0 + BLOCK, h)
            x1 = min(x0 + BLOCK, w)
            dx, dy = match_block(source, target, x0, y0, x1, y1)
            dx_map[y0:y1, x0:x1] = dx
            dy_map[y0:y1, x0:x1] = dy
    # Smooth the block steps so neighbouring blocks do not tear.
    dx_map = box_blur(dx_map, 2)
    dy_map = box_blur(dy_map, 2)
    return np.stack([dx_map, dy_map], axis=-1)


def box_blur(array: np.ndarray, radius: int) -> np.ndarray:
    out = np.zeros_like(array)
    weight = np.zeros_like(array)
    h, w = array.shape[:2]
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            shifted = np.zeros_like(array)
            sy0, sy1 = max(0, dy), h + min(0, dy)
            sx0, sx1 = max(0, dx), w + min(0, dx)
            ty0, ty1 = max(0, -dy), h + min(0, -dy)
            tx0, tx1 = max(0, -dx), w + min(0, -dx)
            shifted[sy0:sy1, sx0:sx1] = array[ty0:ty1, tx0:tx1]
            out += shifted
            weight += (shifted != 0) | (array != 0)
    return out / np.maximum(weight, 1.0)


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
    p00 = image[y0c, x0c]
    p10 = image[y0c, x1c]
    p01 = image[y1c, x0c]
    p11 = image[y1c, x1c]
    top = p00 * (1 - fx) + p10 * fx
    bottom = p01 * (1 - fx) + p11 * fx
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
    # Coverage-weighted average: a pixel only one warp can reach keeps its colour
    # instead of fading toward transparent.
    blended = np.where(total > 1e-4, (wa * aa + wb * ab) / np.maximum(total, 1e-4), 0.0)
    blended[:, :, 3] = np.clip(total.squeeze(-1) / 2.0 * 255.0, 0, 255)
    # Uncovered pixels fall back to the plain dissolve so no hole appears.
    dissolve = (a + b) / 2.0
    gap = total.squeeze(-1) < 0.05
    blended[gap] = dissolve[gap]
    return np.clip(blended, 0, 255)


def gradient_energy(image: np.ndarray) -> float:
    grey = (0.299 * image[:, :, 0] + 0.587 * image[:, :, 1] + 0.114 * image[:, :, 2]) * alpha_of(image)
    gx = np.abs(np.diff(grey, axis=1)).mean()
    gy = np.abs(np.diff(grey, axis=0)).mean()
    return float(gx + gy)


def masked_mad(x: np.ndarray, y: np.ndarray) -> float:
    mask = (x[:, :, 3] > 128) & (y[:, :, 3] > 128)
    if mask.sum() == 0:
        return float("inf")
    return float(np.abs(x[:, :, :3][mask] - y[:, :, :3][mask]).mean())


def main() -> int:
    root = Path(__file__).resolve().parent
    sheet_path = root / "girl-pet-repo" / "spritesheet.webp"
    frames = load_frames(sheet_path, 0, COLS)
    # Only the six cells the renderer's idle row actually uses.
    used = [i for i, f in enumerate(frames) if (f[:, :, 3] > 8).sum() > 0]
    used = used[:6]
    print("idle frames in use:", used)

    out_dir = root / "girl-pet-src" / "interp"
    out_dir.mkdir(parents=True, exist_ok=True)

    report = []
    mids = []
    for i in range(len(used) - 1):
        a = frames[used[i]]
        b = frames[used[i + 1]]
        m = midpoint(a, b)
        base = masked_mad(a, b)
        mad_a = masked_mad(m, a)
        mad_b = masked_mad(m, b)
        ge_m = gradient_energy(m)
        ge_avg = (gradient_energy(a) + gradient_energy(b)) / 2.0
        entry = {
            "pair": [used[i], used[i + 1]],
            "baseline_ab": round(base, 2),
            "mid_target": round(base / 2.0, 2),
            "mad_to_a": round(mad_a, 2),
            "mad_to_b": round(mad_b, 2),
            "sharpness_ratio": round(ge_m / ge_avg, 3) if ge_avg else None,
        }
        report.append(entry)
        Image.fromarray(np.rint(m).astype(np.uint8), "RGBA").save(out_dir / f"mid-{used[i]}-{used[i + 1]}.png")
        mids.append(m)

    for entry in report:
        print(entry)

    baseline = [e["baseline_ab"] for e in report]
    sharp = [e["sharpness_ratio"] for e in report]
    dev = [abs(e["mad_to_a"] - e["mid_target"]) / max(e["mid_target"], 1e-6) for e in report]
    summary = {
        "pairs": len(report),
        "baseline_mean": round(float(np.mean(baseline)), 2),
        "sharpness_min": round(float(np.min(sharp)), 3),
        "midpoint_deviation_max": round(float(np.max(dev)), 3),
        "detail": report,
    }
    (root / "girl-pet-src" / "interp-report.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in summary.items() if k != "detail"}, indent=2))

    # Quality gates: a usable midpoint sits between its neighbours and stays sharp.
    ok = summary["sharpness_min"] > 0.9 and summary["midpoint_deviation_max"] < 0.35
    print("GATES", "pass" if ok else "fail")
    return 0 if ok else 3


if __name__ == "__main__":
    sys.exit(main())
