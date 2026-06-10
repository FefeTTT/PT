"""
Función de pérdida distribucional para fine-tuning global.

Reemplaza RMSE contra targets fijos por una métrica compuesta que evalúa
qué tan bien las predicciones del modelo reflejan las distribuciones
empíricas del histórico para todos los ecos simultáneamente.

Componentes:
  1. Calibración distribucional: divergencia Wasserstein entre distribución
     predicha de penalties y distribución de cargas históricas
  2. Monotonicidad: penalty(W) debe ser no-decreciente con W
  3. Cobertura: evitar colapso a un solo modo de penalty
  4. Suavidad: ecos con perfiles similares → curvas de penalty similares
  5. Regularización: evitar divergencia de parámetros
  6. Escala: mantener la escala absoluta de penalties en rango útil
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from penalizacion_carga.finetuning.config import LossConfig
from penalizacion_carga.model import PenalizacionCargaHistoricaModel


def compute_distributional_loss(
    model: PenalizacionCargaHistoricaModel,
    evaluation_scenarios: pd.DataFrame,
    loss_config: LossConfig,
    initial_params: Optional[Dict[str, float]] = None,
) -> Dict[str, float]:
    """
    Calcula la pérdida distribucional completa.

    Args:
        model: modelo con parámetros ya aplicados
        evaluation_scenarios: DataFrame con escenarios de evaluación
            (columnas: eco, W, penalty_predicho, perfil_vector, ...)
        loss_config: configuración de la función de pérdida
        initial_params: parámetros iniciales para regularización (None = sin reg)

    Returns:
        dict con loss_total + cada componente individual + métricas de diagnóstico
    """
    # ── Obtener predicciones ──
    penalties = evaluation_scenarios["penalty_predicho"].to_numpy(dtype=float)
    ecos = evaluation_scenarios["eco"].to_numpy()
    ws = evaluation_scenarios["W"].to_numpy(dtype=float)
    perfiles = np.array(evaluation_scenarios["perfil_vector"].tolist(), dtype=float)

    if len(penalties) == 0:
        return {
            "loss_total": 0.0,
            "loss_calibration": 0.0,
            "loss_monotonicity": 0.0,
            "loss_coverage": 0.0,
            "loss_smoothness": 0.0,
            "loss_regularization": 0.0,
            "loss_penalty_scale": 0.0,
        }

    # ── Componente 1: Calibración distribucional ──
    loss_cal = _calibration_loss(
        model, evaluation_scenarios, loss_config
    )

    # ── Componente 2: Monotonicidad ──
    loss_mono = _monotonicity_loss(
        ecos, ws, penalties, loss_config
    )

    # ── Componente 3: Cobertura ──
    loss_cov = _coverage_loss(penalties, loss_config)

    # ── Componente 4: Suavidad ──
    loss_smooth = _smoothness_loss(ecos, penalties, perfiles, loss_config)

    # ── Componente 5: Regularización ──
    if initial_params is not None:
        loss_reg = _regularization_loss(model, initial_params, loss_config)
    else:
        loss_reg = 0.0

    # ── Componente 6: Escala de penalty ──
    loss_scale = _penalty_scale_loss(penalties, loss_config)

    # ── Combinación ponderada ──
    w_sum = (
        loss_config.w_calibration
        + loss_config.w_monotonicity
        + loss_config.w_coverage
        + loss_config.w_smoothness
        + loss_config.w_regularization
        + loss_config.w_penalty_scale
    )
    if w_sum <= 0:
        w_sum = 1.0

    loss_total = (
        loss_config.w_calibration * loss_cal
        + loss_config.w_monotonicity * loss_mono
        + loss_config.w_coverage * loss_cov
        + loss_config.w_smoothness * loss_smooth
        + loss_config.w_regularization * loss_reg
        + loss_config.w_penalty_scale * loss_scale
    ) / w_sum

    return {
        "loss_total": float(loss_total),
        "loss_calibration": float(loss_cal),
        "loss_monotonicity": float(loss_mono),
        "loss_coverage": float(loss_cov),
        "loss_smoothness": float(loss_smooth),
        "loss_regularization": float(loss_reg),
        "loss_penalty_scale": float(loss_scale),
    }


# ---------------------------------------------------------------------------
# Componente 1: Calibración distribucional
# ---------------------------------------------------------------------------

def _calibration_loss(
    model: PenalizacionCargaHistoricaModel,
    scenarios: pd.DataFrame,
    cfg: LossConfig,
) -> float:
    """
    Mide divergencia entre distribución de penalties predichos y
    distribución histórica de cargas.

    Usa distancia de Wasserstein-1 (Earth Mover's Distance) entre
    la distribución de |penalty| y la distribución empírica de rareza
    de UEA en el histórico para cada eco, agregada sobre todos los ecos.
    """
    ecos = scenarios["eco"].unique()
    if len(ecos) == 0:
        return 0.0

    wasserstein_sum = 0.0
    n_valid = 0

    for eco in ecos:
        df_eco = scenarios[scenarios["eco"] == eco]
        penalties = np.abs(df_eco["penalty_predicho"].to_numpy(dtype=float))
        ws = df_eco["W"].to_numpy(dtype=float)

        if len(penalties) < 2:
            continue

        # Distribución histórica de rareza de UEA para este eco
        perfil = model.eco_perfiles_.get(str(eco), model.global_profile_)
        hist_w = perfil.get("histograma_ueas", {})
        ueas_historicas = perfil.get("ueas_por_tri", [])

        if not ueas_historicas:
            continue

        # Mapear W → rareza empírica
        values = np.array(ueas_historicas, dtype=float)
        rarezas_historicas = np.array([
            1.0 - float(np.mean(values >= w))
            for w in ws
        ])

        # Normalizar ambas distribuciones a [0, 1]
        if penalties.max() - penalties.min() > 1e-9:
            penalties_norm = (penalties - penalties.min()) / (
                penalties.max() - penalties.min()
            )
        else:
            penalties_norm = penalties

        if rarezas_historicas.max() - rarezas_historicas.min() > 1e-9:
            rarezas_norm = (rarezas_historicas - rarezas_historicas.min()) / (
                rarezas_historicas.max() - rarezas_historicas.min()
            )
        else:
            rarezas_norm = rarezas_historicas

        # Wasserstein-1: diferencia entre CDFs
        w_dist = _wasserstein_1d(penalties_norm, rarezas_norm, p=cfg.wasserstein_p)

        wasserstein_sum += w_dist
        n_valid += 1

    if n_valid == 0:
        return 0.0

    return wasserstein_sum / n_valid


def _wasserstein_1d(u: np.ndarray, v: np.ndarray, p: int = 1) -> float:
    """Distancia de Wasserstein-p entre dos muestras 1D."""
    u_sorted = np.sort(u)
    v_sorted = np.sort(v)

    # Interpolar para igual longitud
    n = min(len(u_sorted), len(v_sorted), 500)
    if n < 2:
        return float(np.abs(np.mean(u_sorted) - np.mean(v_sorted)))

    u_interp = np.interp(
        np.linspace(0, 1, n),
        np.linspace(0, 1, len(u_sorted)),
        u_sorted,
    )
    v_interp = np.interp(
        np.linspace(0, 1, n),
        np.linspace(0, 1, len(v_sorted)),
        v_sorted,
    )

    return float(np.mean(np.abs(u_interp - v_interp) ** p) ** (1.0 / p))


# ---------------------------------------------------------------------------
# Componente 2: Monotonicidad
# ---------------------------------------------------------------------------

def _monotonicity_loss(
    ecos: np.ndarray,
    ws: np.ndarray,
    penalties: np.ndarray,
    cfg: LossConfig,
) -> float:
    """
    Penaliza ecos donde penalty(W) no es monótono no-decreciente.

    Para cada eco, verifica que W₁ < W₂ ⇒ |penalty(W₁)| ≤ |penalty(W₂)| + ε.
    """
    abs_penalties = np.abs(penalties)
    violaciones_total = 0.0
    n_ecos = 0

    for eco in np.unique(ecos):
        mask = ecos == eco
        w_eco = ws[mask]
        p_eco = abs_penalties[mask]

        if len(w_eco) < 2:
            continue

        # Ordenar por W
        order = np.argsort(w_eco)
        w_sorted = w_eco[order]
        p_sorted = p_eco[order]

        violaciones = 0.0
        for i in range(len(p_sorted) - 1):
            if w_sorted[i] == w_sorted[i + 1]:
                continue
            diff = p_sorted[i] - p_sorted[i + 1]
            if diff > cfg.monotonicity_tolerance:
                violaciones += diff

        violaciones_total += min(violaciones, cfg.monotonicity_max_penalty)
        n_ecos += 1

    if n_ecos == 0:
        return 0.0

    return violaciones_total / n_ecos


# ---------------------------------------------------------------------------
# Componente 3: Cobertura
# ---------------------------------------------------------------------------

def _coverage_loss(
    penalties: np.ndarray,
    cfg: LossConfig,
) -> float:
    """
    Penaliza si la distribución de penalties colapsa a un solo modo.

    Mide 1 - entropía_normalizada de la distribución de penalties.
    """
    abs_pen = np.abs(penalties)
    if len(abs_pen) < 10:
        return 0.0

    hist, _ = np.histogram(abs_pen, bins=cfg.coverage_n_bins, range=(0, abs_pen.max() or 1))
    hist = hist.astype(float)
    hist = hist / hist.sum()

    # Entropía
    ent = -np.sum(hist[hist > 0] * np.log(hist[hist > 0]))

    # Normalizar (entropía máxima = log(n_bins))
    max_ent = math.log(cfg.coverage_n_bins)
    norm_ent = ent / max_ent if max_ent > 0 else 1.0

    # Pérdida: distancia a entropía mínima deseada
    return float(max(0.0, cfg.coverage_min_entropy - norm_ent))


# ---------------------------------------------------------------------------
# Componente 4: Suavidad entre ecos similares
# ---------------------------------------------------------------------------

def _smoothness_loss(
    ecos: np.ndarray,
    penalties: np.ndarray,
    perfiles: np.ndarray,
    cfg: LossConfig,
) -> float:
    """
    Penaliza que ecos con perfiles históricos similares tengan curvas
    de penalty muy diferentes.

    Usa un kernel gaussiano sobre la distancia coseno entre vectores
    de perfil para pesar las diferencias de penalty.
    """
    unique_ecos = np.unique(ecos)
    if len(unique_ecos) < 2 or perfiles.shape[1] == 0:
        return 0.0

    # Agregar penalty por eco (mediana)
    eco_indices = {eco: i for i, eco in enumerate(unique_ecos)}
    eco_penalties = np.zeros(len(unique_ecos))
    eco_perfiles_agg = np.zeros((len(unique_ecos), perfiles.shape[1]))

    for i, eco in enumerate(unique_ecos):
        mask = ecos == eco
        eco_penalties[i] = np.median(np.abs(penalties[mask]))
        eco_perfiles_agg[i] = perfiles[mask].mean(axis=0)

    # Matriz de similitud
    loss = 0.0
    count = 0

    for i in range(len(unique_ecos)):
        for j in range(i + 1, len(unique_ecos)):
            # Similitud coseno
            norm_i = np.linalg.norm(eco_perfiles_agg[i])
            norm_j = np.linalg.norm(eco_perfiles_agg[j])
            if norm_i < 1e-9 or norm_j < 1e-9:
                continue

            cos_sim = np.dot(eco_perfiles_agg[i], eco_perfiles_agg[j]) / (norm_i * norm_j)

            # Kernel gaussiano: ecos similares (cos_sim alto) reciben más peso
            sim_weight = math.exp(-((1.0 - cos_sim) ** 2) / (2 * cfg.smoothness_bandwidth ** 2))

            # Diferencia de penalty
            pen_diff = abs(eco_penalties[i] - eco_penalties[j])
            max_pen = max(eco_penalties[i], eco_penalties[j], 1e-9)
            pen_diff_norm = pen_diff / max_pen

            loss += sim_weight * pen_diff_norm
            count += 1

    if count == 0:
        return 0.0

    return loss / count


# ---------------------------------------------------------------------------
# Componente 5: Regularización
# ---------------------------------------------------------------------------

def _regularization_loss(
    model: PenalizacionCargaHistoricaModel,
    initial_params: Dict[str, float],
    cfg: LossConfig,
) -> float:
    """
    Regularización L2 sobre la distancia de los parámetros a sus valores
    iniciales (pre-fine-tuning). Evita divergencia catastrófica.
    """
    current = model.params.to_dict()
    reg_sum = 0.0
    count = 0

    for key, init_val in initial_params.items():
        if key not in current:
            continue
        cur_val = current[key]

        if isinstance(cur_val, (list, tuple)):
            if isinstance(init_val, (list, tuple)):
                for cv, iv in zip(cur_val, init_val):
                    reg_sum += (cv - iv) ** 2
                    count += 1
        elif isinstance(cur_val, (int, float)):
            reg_sum += (float(cur_val) - float(init_val)) ** 2
            count += 1

    if count == 0:
        return 0.0

    return cfg.regularization_strength * reg_sum / count


# ---------------------------------------------------------------------------
# Componente 6: Escala de penalty
# ---------------------------------------------------------------------------

def _penalty_scale_loss(
    penalties: np.ndarray,
    cfg: LossConfig,
) -> float:
    """
    Penaliza si la escala de penalties es demasiado pequeña (colapso a ~0)
    o demasiado grande (todo penalizado igual).
    """
    abs_pen = np.abs(penalties)
    if len(abs_pen) < 10:
        return 0.0

    median = float(np.median(abs_pen))
    q25, q75 = float(np.quantile(abs_pen, 0.25)), float(np.quantile(abs_pen, 0.75))
    iqr = q75 - q25

    # Distancia normalizada a los targets
    target_median = cfg.penalty_scale_target_median
    target_iqr = cfg.penalty_scale_target_iqr

    loss_median = (median - target_median) ** 2 / max(target_median ** 2, 1e-6)
    loss_iqr = (iqr - target_iqr) ** 2 / max(target_iqr ** 2, 1e-6)

    return float(loss_median + loss_iqr)
