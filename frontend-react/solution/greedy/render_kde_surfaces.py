from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "diagnosticos" / "kde_asignacion"
SURFACE_FILE = ARTIFACTS / "kde_surface_points.json"


def make_grid(points: list[dict], field: str):
    ueas = sorted({int(p["uea"]) for p in points})
    horas = sorted({float(p["hora"]) for p in points})
    x, y = np.meshgrid(ueas, horas)
    z = np.full_like(x, np.nan, dtype=float)
    values = {(int(p["uea"]), float(p["hora"])): float(p.get(field) or 0.0) for p in points}

    for row_idx, hora in enumerate(horas):
        for col_idx, uea in enumerate(ueas):
            z[row_idx, col_idx] = values.get((uea, hora), np.nan)

    return x, y, z


def draw_surface(ax, points: list[dict], field: str, title: str):
    x, y, z = make_grid(points, field)
    ax.plot_surface(x, y, z, cmap="viridis", linewidth=0, antialiased=True, alpha=0.92)
    ax.set_title(title, fontsize=10)
    ax.set_xlabel("UEA")
    ax.set_ylabel("Hora")
    ax.set_zlabel(field)
    ax.view_init(elev=28, azim=-138)
    ax.set_zlim(0, max(1.0, np.nanmax(z) if np.isfinite(z).any() else 1.0))


def render_dimensions(entry: dict):
    eco = entry["eco"]
    points = entry["l_mi_v"]
    fig = plt.figure(figsize=(13, 9))
    fields = [
        ("kde_ij", "Afinidad UEA KDE ij"),
        ("kde_ih", "Afinidad semanal KDE ih"),
        ("kde_plan", "Plan proyectado KDE"),
        ("score", "Z base aditivo"),
    ]

    for idx, (field, title) in enumerate(fields, start=1):
        ax = fig.add_subplot(2, 2, idx, projection="3d")
        draw_surface(ax, points, field, title)

    fig.suptitle(f"ECO {eco} - dimensiones continuas de Z (patron L-Mi-V)", fontsize=13)
    fig.tight_layout()
    output = ARTIFACTS / f"eco_{eco}_zscore_kde_3d.png"
    fig.savefig(output, dpi=160)
    plt.close(fig)
    return output


def render_patterns(entry: dict):
    eco = entry["eco"]
    fig = plt.figure(figsize=(15, 4.8))
    patterns = [("l_mi_v", "L-Mi-V"), ("m_j", "M-J"), ("l_m_mi_v", "L-M-Mi-V")]

    for idx, (field, title) in enumerate(patterns, start=1):
        ax = fig.add_subplot(1, 3, idx, projection="3d")
        draw_surface(ax, entry[field], "score", title)

    fig.suptitle(f"ECO {eco} - score KDE por patron semanal", fontsize=13)
    fig.tight_layout()
    output = ARTIFACTS / f"eco_{eco}_patterns_kde_3d.png"
    fig.savefig(output, dpi=160)
    plt.close(fig)
    return output


def main():
    if not SURFACE_FILE.exists():
        raise FileNotFoundError(f"No existe {SURFACE_FILE}. Ejecuta primero testAsinacionKDE.ts --render-only o el test completo.")

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    data = json.loads(SURFACE_FILE.read_text(encoding="utf-8"))
    outputs = []

    for entry in data:
        outputs.append(render_dimensions(entry))
        outputs.append(render_patterns(entry))

    summary_file = ARTIFACTS / "rendered_images.json"
    summary_file.write_text(json.dumps([str(path) for path in outputs], indent=2), encoding="utf-8")

    for output in outputs:
        print(output)


if __name__ == "__main__":
    main()
