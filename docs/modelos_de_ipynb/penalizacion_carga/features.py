"""
Funciones de extracción de características desde horarios históricos.

Parseo de horarios, construcción de bloques contiguos, firmas de patrones,
y métricas de fragmentación. Todas son funciones puras, sin estado.
"""

from __future__ import annotations

import re
import math
from typing import Any, List, Dict, Tuple, Optional

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

DIA_COLS: List[Tuple[str, str, str]] = [
    ("L", "lunes_i", "lunes_f"),
    ("M", "martes_i", "martes_f"),
    ("Mi", "miercoles_i", "miercoles_f"),
    ("J", "jueves_i", "jueves_f"),
    ("V", "viernes_i", "viernes_f"),
]

DIA_ALIASES: Dict[str, str] = {
    "L": "L", "LU": "L", "LUNES": "L",
    "M": "M", "MA": "M", "MARTES": "M",
    "MI": "Mi", "MIERCOLES": "Mi", "MIÉRCOLES": "Mi",
    "J": "J", "JU": "J", "JUEVES": "J",
    "V": "V", "VI": "V", "VIERNES": "V",
}

EPS: float = 1e-9


# ---------------------------------------------------------------------------
# Tipos
# ---------------------------------------------------------------------------

class Intervalo:
    """Un intervalo de clase en un día específico."""

    __slots__ = ("dia", "inicio", "fin", "uea")

    def __init__(self, dia: str, inicio: float, fin: float, uea: str = "") -> None:
        self.dia = dia
        self.inicio = inicio
        self.fin = fin
        self.uea = uea

    def __repr__(self) -> str:
        return f"Intervalo({self.dia} {fmt_hora(self.inicio)}-{fmt_hora(self.fin)} [{self.uea}])"


# ---------------------------------------------------------------------------
# Parseo de horas
# ---------------------------------------------------------------------------

def parse_hora(valor: Any) -> Optional[float]:
    """Convierte un valor a hora fraccional (0-24). Retorna None si es inválido."""
    if valor is None:
        return None
    if isinstance(valor, float) and np.isnan(valor):
        return None
    if isinstance(valor, (int, float, np.integer, np.floating)):
        v = float(valor)
        return v if np.isfinite(v) else None

    s = str(valor).strip()
    if not s or s.lower() == "nan":
        return None

    m = re.match(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?$", s)
    if not m:
        return None

    h = int(m.group(1))
    mins = int(m.group(2))
    secs = int(m.group(3) or 0)

    if not (0 <= h <= 23 and 0 <= mins <= 59 and 0 <= secs <= 59):
        return None

    return h + mins / 60.0 + secs / 3600.0


def fmt_hora(h: float) -> str:
    """Formatea una hora fraccional como HH:MM."""
    hh = int(math.floor(h))
    mm = int(round((h - hh) * 60))
    return f"{hh:02d}:{mm:02d}"


def normalizar_dia(dia: str) -> str:
    """Normaliza un nombre de día a su abreviación canónica."""
    key = dia.strip().upper()
    if key not in DIA_ALIASES:
        raise ValueError(f"Día no reconocido en horario_id: {dia}")
    return DIA_ALIASES[key]


def parse_rango_horario(rango: str) -> Tuple[float, float]:
    """Parsea 'HH:MM-HH:MM' → (inicio, fin) en horas fraccionales."""
    m = re.match(
        r"\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*", rango
    )
    if not m:
        raise ValueError(f"Rango horario inválido: {rango}")
    inicio = parse_hora(m.group(1))
    fin = parse_hora(m.group(2))
    if inicio is None or fin is None or fin <= inicio:
        raise ValueError(f"Rango horario inválido: {rango}")
    return inicio, fin


# ---------------------------------------------------------------------------
# Horario ID
# ---------------------------------------------------------------------------

def parse_horario_id(horario_id: str, uea: str = "__PRED__") -> List[Intervalo]:
    """
    Parsea un horario_id en partes separadas por '|'.

    Formato: 'L:07:00-08:30|M:10:00-11:30'
    """
    intervalos: List[Intervalo] = []
    for parte in str(horario_id).split("|"):
        parte = parte.strip()
        if not parte:
            continue
        dia_raw, rango = parte.split(":", 1)
        inicio, fin = parse_rango_horario(rango)
        intervalos.append(Intervalo(normalizar_dia(dia_raw), inicio, fin, str(uea)))
    return intervalos


def horario_id_desde_row(row: pd.Series) -> str:
    """Construye un horario_id a partir de una fila del DataFrame histórico."""
    partes: List[str] = []
    for dia, col_i, col_f in DIA_COLS:
        inicio = parse_hora(row.get(col_i))
        fin = parse_hora(row.get(col_f))
        if inicio is not None and fin is not None and fin > inicio:
            partes.append(f"{dia}:{fmt_hora(inicio)}-{fmt_hora(fin)}")
    return "|".join(partes)


def intervalos_desde_df(df: pd.DataFrame) -> pd.DataFrame:
    """Convierte un DataFrame de asignaciones en un DataFrame de intervalos."""
    rows: List[dict] = []
    for _, row in df.iterrows():
        eco = str(row["eco"])
        uea = str(row["uea"])
        tri_num = int(row["tri_num"])

        for dia, col_i, col_f in DIA_COLS:
            inicio = parse_hora(row.get(col_i))
            fin = parse_hora(row.get(col_f))
            if inicio is None or fin is None or fin <= inicio:
                continue
            rows.append({
                "eco": eco,
                "uea": uea,
                "tri_num": tri_num,
                "dia": dia,
                "inicio": inicio,
                "fin": fin,
                "horas": fin - inicio,
            })

    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Bloques contiguos
# ---------------------------------------------------------------------------

def _orden_dia(dia: str) -> int:
    orden = {d: i for i, (d, _, _) in enumerate(DIA_COLS)}
    return orden.get(dia, 99)


def construir_bloques(intervalos: List[Intervalo]) -> List[dict]:
    """
    Agrupa intervalos solapados o adyacentes en bloques contiguos por día.

    Dos intervalos forman un bloque si inicio₂ ≤ fin₁ (sin gap).
    """
    bloques: List[dict] = []
    por_dia: Dict[str, List[Intervalo]] = {}

    for iv in intervalos:
        por_dia.setdefault(iv.dia, []).append(iv)

    for dia, ints in por_dia.items():
        ints = sorted(ints, key=lambda x: (x.inicio, x.fin))
        if not ints:
            continue

        actual_inicio = ints[0].inicio
        actual_fin = ints[0].fin
        actual_ueas = {ints[0].uea}

        for iv in ints[1:]:
            if iv.inicio <= actual_fin + EPS:
                # Se solapa o es adyacente → mismo bloque
                actual_fin = max(actual_fin, iv.fin)
                actual_ueas.add(iv.uea)
            else:
                # Hay gap → cierra bloque actual
                bloques.append({
                    "dia": dia,
                    "inicio": actual_inicio,
                    "fin": actual_fin,
                    "horas": actual_fin - actual_inicio,
                    "n_ueas": len(actual_ueas),
                })
                actual_inicio = iv.inicio
                actual_fin = iv.fin
                actual_ueas = {iv.uea}

        bloques.append({
            "dia": dia,
            "inicio": actual_inicio,
            "fin": actual_fin,
            "horas": actual_fin - actual_inicio,
            "n_ueas": len(actual_ueas),
        })

    return bloques


def resumen_bloques_semana(intervalos: List[Intervalo]) -> dict:
    """
    Calcula métricas agregadas de bloques para una semana completa.

    Retorna:
        bloques: lista de bloques
        max_horas_consecutivas: máximo de horas en un solo bloque
        max_ueas_bloque: máximo de UEA en un solo bloque
        n_bloques_semana: total de bloques en la semana
        max_bloques_dia: máximo de bloques en un mismo día
        total_gap_horas: suma de horas de hueco entre bloques
        max_gap_horas: hueco máximo
        promedio_gap_horas: hueco promedio
        dias_con_clase: número de días con al menos una clase
    """
    bloques = construir_bloques(intervalos)
    por_dia: Dict[str, List[dict]] = {}

    for b in bloques:
        por_dia.setdefault(b["dia"], []).append(b)

    gaps: List[float] = []
    for bs in por_dia.values():
        bs = sorted(bs, key=lambda b: (b["inicio"], b["fin"]))
        for prev, cur in zip(bs, bs[1:]):
            gaps.append(max(0.0, float(cur["inicio"] - prev["fin"])))

    total_gap_horas = float(sum(gaps))
    n_gaps = len(gaps)

    return {
        "bloques": bloques,
        "max_horas_consecutivas": float(
            max([b["horas"] for b in bloques], default=0.0)
        ),
        "max_ueas_bloque": int(max([b["n_ueas"] for b in bloques], default=0)),
        "n_bloques_semana": int(len(bloques)),
        "max_bloques_dia": int(
            max([len(bs) for bs in por_dia.values()], default=0)
        ),
        "total_gap_horas": total_gap_horas,
        "max_gap_horas": float(max(gaps, default=0.0)),
        "promedio_gap_horas": float(total_gap_horas / n_gaps) if n_gaps else 0.0,
        "dias_con_clase": int(len(por_dia)),
    }


def firma_bloques_semana(intervalos: List[Intervalo]) -> str:
    """Genera una firma canónica de la configuración de bloques semanal."""
    return firma_bloques_desde_bloques(construir_bloques(intervalos))


def firma_bloques_desde_bloques(bloques: List[dict]) -> str:
    """
    Serializa una lista de bloques a string canónico.

    Formato: 'L:07:00-08:30#1|M:10:00-13:00#2'
    """
    partes: List[str] = []
    for b in sorted(
        bloques, key=lambda x: (_orden_dia(x["dia"]), x["inicio"], x["fin"])
    ):
        partes.append(
            f"{b['dia']}:{fmt_hora(float(b['inicio']))}-"
            f"{fmt_hora(float(b['fin']))}#{int(b['n_ueas'])}"
        )
    return "|".join(partes)


# ---------------------------------------------------------------------------
# Utilidades estadísticas
# ---------------------------------------------------------------------------

def weighted_quantile(
    values: np.ndarray, weights: np.ndarray, q: float
) -> float:
    """Cuantil ponderado."""
    values = np.asarray(values, dtype=float)
    weights = np.asarray(weights, dtype=float)

    mask = np.isfinite(values) & np.isfinite(weights) & (weights > 0)
    values = values[mask]
    weights = weights[mask]

    if len(values) == 0:
        return np.nan

    order = np.argsort(values)
    values = values[order]
    weights = weights[order]

    cdf = np.cumsum(weights) / np.sum(weights)
    return float(values[np.searchsorted(cdf, q, side="left")])


def normalizar_eco_nombre(raw: Any) -> Dict[str, str]:
    """Normaliza mapeo eco→nombre desde diversos formatos de entrada."""
    if isinstance(raw, dict):
        out: Dict[str, str] = {}
        for k, v in raw.items():
            if isinstance(v, str):
                out[str(k)] = v
            elif isinstance(v, dict):
                out[str(k)] = str(v.get("nombre", v.get("name", k)))
            else:
                out[str(k)] = str(v)
        return out

    if isinstance(raw, list):
        out = {}
        for item in raw:
            if not isinstance(item, dict):
                continue
            eco = item.get(
                "eco",
                item.get("numeroEconomico", item.get("numero_economico")),
            )
            nombre = item.get("nombre", item.get("name", item.get("profesor")))
            if eco is not None:
                out[str(eco)] = str(nombre or eco)
        return out

    return {}
