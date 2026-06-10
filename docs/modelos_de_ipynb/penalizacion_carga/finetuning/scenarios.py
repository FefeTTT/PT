"""
Generador de escenarios de evaluación para fine-tuning distribucional.

En lugar de usar targets fijos de unos pocos ecos, genera escenarios sintéticos
a partir de las distribuciones históricas de carga de TODOS los ecos, asegurando
que la optimización sea global y no sobreajuste a ejemplos particulares.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from penalizacion_carga.model import PenalizacionCargaHistoricaModel
from penalizacion_carga.features import (
    Intervalo,
    parse_horario_id,
    firma_bloques_semana,
    firma_bloques_desde_bloques,
    construir_bloques,
)


def generate_evaluation_scenarios(
    model: PenalizacionCargaHistoricaModel,
    n_scenarios_per_eco: int = 5,
    seed: int = 12345,
    min_trimestres: int = 2,
    max_ecos: Optional[int] = None,
) -> pd.DataFrame:
    """
    Genera escenarios sintéticos de evaluación a partir del histórico.

    Para cada eco con suficiente historia:
      1. Muestrea W (número de UEA) de la distribución histórica del eco
      2. Selecciona patrones de bloques representativos del histórico del eco
      3. Construye intervalos sintéticos equivalentes
      4. Genera también W+1 y W+2 para evaluar monotonicidad y extrapolación

    Args:
        model: modelo ya entrenado (fit)
        n_scenarios_per_eco: escenarios base por eco (se multiplican por ~3 al
            incluir variaciones de W)
        seed: semilla para reproducibilidad
        min_trimestres: ecos con menos trimestres se excluyen
        max_ecos: límite de ecos a muestrear (None = todos)

    Returns:
        DataFrame con columnas:
            eco, W, horario_id, firma_bloque, penalty_predicho,
            perfil_vector, es_historico, es_extrapolacion
    """
    rng = np.random.default_rng(seed)

    # Filtrar ecos con suficiente historia
    eligible_ecos = [
        eco for eco, perfil in model.eco_perfiles_.items()
        if perfil.get("n_trimestres", 0) >= min_trimestres
    ]

    if not eligible_ecos:
        return pd.DataFrame()

    if max_ecos is not None and len(eligible_ecos) > max_ecos:
        eligible_ecos = sorted(eligible_ecos)[:max_ecos]

    rows: List[dict] = []

    for eco in eligible_ecos:
        perfil = model.eco_perfiles_[eco]
        ueas_historicas = perfil.get("ueas_por_tri", [])
        if not ueas_historicas:
            continue

        # Distribución empírica de W
        values = np.array(ueas_historicas, dtype=float)
        w_min = max(1, int(np.min(values)))
        w_max = int(np.max(values))

        # Patrones de bloque del histórico del eco
        block_patterns = _get_eco_block_patterns(model, eco)
        if not block_patterns:
            block_patterns = _get_global_block_patterns(model)

        # Perfil vector para suavidad (cuantiles normalizados)
        perfil_vector = _build_perfil_vector(perfil)

        for _ in range(n_scenarios_per_eco):
            # Muestrear W del histórico
            w_hist = int(rng.integers(w_min, w_max + 1)) if w_max >= w_min else w_min

            # Seleccionar patrón de bloque
            pattern_idx = rng.integers(0, len(block_patterns))
            firma = block_patterns[pattern_idx]

            # Construir horario_id aproximado desde la firma
            horario_id = _firma_a_horario_id(firma)

            # Escenario histórico
            penalty = model.predict_penalty(
                eco=eco,
                horario_id=horario_id,
                ueas_asignadas_actuales=[f"UEA_{i}" for i in range(w_hist - 1)],
                uea_prediccion=f"UEA_{w_hist - 1}",
            )

            rows.append({
                "eco": eco,
                "W": w_hist,
                "horario_id": horario_id,
                "firma_bloque": firma,
                "penalty_predicho": penalty["penalty_total"],
                "perfil_vector": perfil_vector,
                "es_historico": True,
                "es_extrapolacion": False,
            })

            # Escenario de extrapolación: W+1 (si no excede w_max + 3)
            w_extra = w_hist + 1
            if w_extra <= w_max + 3:
                penalty_extra = model.predict_penalty(
                    eco=eco,
                    horario_id=horario_id,
                    ueas_asignadas_actuales=[f"UEA_{i}" for i in range(w_extra - 1)],
                    uea_prediccion=f"UEA_{w_extra - 1}",
                )
                rows.append({
                    "eco": eco,
                    "W": w_extra,
                    "horario_id": horario_id,
                    "firma_bloque": firma,
                    "penalty_predicho": penalty_extra["penalty_total"],
                    "perfil_vector": perfil_vector,
                    "es_historico": False,
                    "es_extrapolacion": True,
                })

    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _get_eco_block_patterns(
    model: PenalizacionCargaHistoricaModel, eco: str
) -> List[str]:
    """Obtiene los patrones de bloque más frecuentes del eco."""
    pesos = model._block_pattern_weights_.get(eco, {})
    if not pesos:
        return []
    # Top 5 patrones
    sorted_patterns = sorted(pesos.items(), key=lambda x: -x[1])
    return [p for p, _ in sorted_patterns[:5]]


def _get_global_block_patterns(
    model: PenalizacionCargaHistoricaModel,
) -> List[str]:
    """Obtiene los patrones de bloque más frecuentes globalmente."""
    pesos = model._global_block_pattern_weights_
    if not pesos:
        return ["L:07:00-10:00#1|M:07:00-10:00#1"]  # fallback
    sorted_patterns = sorted(pesos.items(), key=lambda x: -x[1])
    return [p for p, _ in sorted_patterns[:5]]


def _build_perfil_vector(perfil: dict) -> List[float]:
    """
    Construye un vector de características normalizado del perfil de un eco.

    Incluye cuantiles de W, horas/día, y UEA/bloque.
    """
    ueas = perfil.get("ueas_por_tri", [])
    horas = perfil.get("horas_por_dia", [])
    ueas_bloque = perfil.get("ueas_por_bloque", [])

    vec: List[float] = []

    for arr in [ueas, horas, ueas_bloque]:
        if arr:
            a = np.array(arr, dtype=float)
            for q in [0.25, 0.50, 0.75, 0.90]:
                vec.append(float(np.quantile(a, q)))
            vec.append(float(np.mean(a)))
            vec.append(float(np.std(a)))
        else:
            vec.extend([0.0] * 6)

    # Normalizar
    v = np.array(vec, dtype=float)
    norm = np.linalg.norm(v)
    if norm > 1e-9:
        v = v / norm

    return v.tolist()


def _firma_a_horario_id(firma: str) -> str:
    """
    Convierte una firma de bloques (L:07:00-10:00#1|M:07:00-10:00#1)
    en un horario_id compatible con parse_horario_id (L:07:00-10:00|M:07:00-10:00).
    """
    partes = []
    for segmento in firma.split("|"):
        segmento = segmento.strip()
        if not segmento:
            continue
        # Quitar el #N final
        if "#" in segmento:
            segmento = segmento.rsplit("#", 1)[0]
        partes.append(segmento)
    return "|".join(partes)


# ---------------------------------------------------------------------------
# Escenarios de contraste explícito (para debug e inspección)
# ---------------------------------------------------------------------------

def generate_contrast_scenarios(
    model: PenalizacionCargaHistoricaModel,
    eco_pairs: List[Tuple[str, str]],
    w_values: Optional[List[int]] = None,
) -> pd.DataFrame:
    """
    Genera escenarios de contraste entre pares de ecos para inspección.

    Útil para verificar que ecos con comportamientos opuestos
    (ej. 28650 vs 14416) reciben penalties cualitativamente distintos.

    Args:
        model: modelo entrenado
        eco_pairs: lista de pares (eco_A, eco_B) a contrastar
        w_values: valores de W a evaluar (default: 1..6)

    Returns:
        DataFrame con predicciones para ambos ecos en cada W
    """
    if w_values is None:
        w_values = list(range(1, 7))

    rows = []
    for eco_a, eco_b in eco_pairs:
        for eco in [eco_a, eco_b]:
            # Horario representativo del eco (top pattern)
            patterns = _get_eco_block_patterns(model, eco)
            if not patterns:
                patterns = _get_global_block_patterns(model)
            horario_eco = _firma_a_horario_id(patterns[0]) if patterns else "L:07:00-08:30|M:07:00-08:30"

            perfil = model.eco_perfiles_.get(eco, model.global_profile_)
            hist_w = perfil.get("ueas_por_tri", [])
            typical_w = (
                int(np.median(hist_w)) if hist_w else 2
            )

            for w in w_values:
                ueas = [f"U{i}" for i in range(w - 1)]
                uea_pred = f"U{w}" if w > 1 else "U1"
                penalty = model.predict_penalty(
                    eco=eco,
                    horario_id=horario_eco,
                    ueas_asignadas_actuales=ueas,
                    uea_prediccion=uea_pred,
                )

                rows.append({
                    "eco": eco,
                    "eco_par": eco_a if eco == eco_b else eco_b,
                    "W": w,
                    "W_typ": typical_w,
                    "penalty_total": penalty["penalty_total"],
                    "penalty_semanal": penalty["penalty_semanal"],
                    "penalty_bloques": penalty["penalty_bloques_historicos"],
                    "bonus_bloques": penalty["bonus_bloques_historicos"],
                })

    return pd.DataFrame(rows)
