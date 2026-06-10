# -*- coding: utf-8 -*-
"""
Modelo de viabilidad historica con pandas acelerado por GPU via cudf.pandas.

Pensado para ejecutarse dentro de un contenedor RAPIDS en WSL2/Docker con una GPU NVIDIA.
Por defecto busca df_hist.json y eco-nombre.json en /data; fuera de Docker intenta usar
la ruta local de Windows indicada abajo.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from pprint import pprint

# Debe ejecutarse antes de importar pandas. En Docker RAPIDS esto activa el acelerador pandas.
# En WSL2 el modo pool puede intentar reservar demasiada VRAM; async evita esa preasignacion.
os.environ.setdefault("CUDF_PANDAS_RMM_MODE", "async")
USE_CUDF = os.getenv("USE_CUDF", "1").strip().lower() not in {"0", "false", "no"}
GPU_ACTIVA = False
CUDF_ERROR = None

if USE_CUDF:
    try:
        import cudf.pandas
        cudf.pandas.install()
        GPU_ACTIVA = True
    except Exception as exc:  # fallback controlado para entornos sin RAPIDS/cuDF
        CUDF_ERROR = repr(exc)
        GPU_ACTIVA = False


import re
import json
import math
import pickle
try:
    import joblib
except Exception:
    joblib = None
import numpy as np
import pandas as pd

PD_ACCELERATED = pd
PD_CPU = getattr(pd, "_fsproxy_slow", pd)
USE_CPU_PANDAS_FOR_MODEL = os.getenv("VIABILIDAD_USE_CPU_PANDAS_FOR_MODEL", "1").strip().lower() not in {"0", "false", "no"}

if USE_CPU_PANDAS_FOR_MODEL:
    # El modelo tiene muchos loops Python sobre filas/intervalos. En cudf.pandas esos loops
    # suelen caer en proxy/fallback y pueden ser mas lentos que pandas nativo.
    pd = PD_CPU

from dataclasses import dataclass
from typing import Dict, List, Optional, Any, Tuple


DIA_COLS = [
    ("L", "lunes_i", "lunes_f"),
    ("M", "martes_i", "martes_f"),
    ("Mi", "miercoles_i", "miercoles_f"),
    ("J", "jueves_i", "jueves_f"),
    ("V", "viernes_i", "viernes_f"),
]

DIA_ALIASES = {
    "L": "L", "LU": "L", "LUNES": "L",
    "M": "M", "MA": "M", "MARTES": "M",
    "MI": "Mi", "MIERCOLES": "Mi", "MIÉRCOLES": "Mi",
    "J": "J", "JU": "J", "JUEVES": "J",
    "V": "V", "VI": "V", "VIERNES": "V",
}

EPS = 1e-9


@dataclass
class Intervalo:
    dia: str
    inicio: float
    fin: float
    uea: str


def parse_hora(valor: Any) -> Optional[float]:
    if valor is None or pd.isna(valor):
        return None

    if isinstance(valor, (int, float, np.integer, np.floating)):
        return float(valor) if np.isfinite(valor) else None

    s = str(valor).strip()
    if not s or s.lower() == "nan":
        return None

    # Ignora marcas administrativas: BAJAGPO, CANCELADO, S/H, etc.
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
    hh = int(math.floor(h))
    mm = int(round((h - hh) * 60))
    return f"{hh:02d}:{mm:02d}"


def normalizar_dia(dia: str) -> str:
    key = dia.strip().upper()
    if key not in DIA_ALIASES:
        raise ValueError(f"Dia no reconocido en horario_id: {dia}")
    return DIA_ALIASES[key]


def parse_rango_horario(rango: str) -> Tuple[float, float]:
    m = re.match(r"\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*", rango)
    if not m:
        raise ValueError(f"Rango horario invalido: {rango}")
    inicio = parse_hora(m.group(1))
    fin = parse_hora(m.group(2))
    if inicio is None or fin is None or fin <= inicio:
        raise ValueError(f"Rango horario invalido: {rango}")
    return inicio, fin


def parse_horario_id(horario_id: str, uea: str = "__PRED__") -> List[Intervalo]:
    intervalos = []
    for parte in str(horario_id).split("|"):
        parte = parte.strip()
        if not parte:
            continue
        dia_raw, rango = parte.split(":", 1)
        inicio, fin = parse_rango_horario(rango)
        intervalos.append(Intervalo(normalizar_dia(dia_raw), inicio, fin, str(uea)))
    return intervalos


def horario_id_desde_row(row: pd.Series) -> str:
    partes = []
    for dia, col_i, col_f in DIA_COLS:
        inicio = parse_hora(row.get(col_i))
        fin = parse_hora(row.get(col_f))
        if inicio is not None and fin is not None and fin > inicio:
            partes.append(f"{dia}:{fmt_hora(inicio)}-{fmt_hora(fin)}")
    return "|".join(partes)


def intervalos_desde_df(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
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


def construir_bloques(intervalos: List[Intervalo]) -> List[dict]:
    bloques = []
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
                actual_fin = max(actual_fin, iv.fin)
                actual_ueas.add(iv.uea)
            else:
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
    bloques = construir_bloques(intervalos)
    por_dia: Dict[str, List[dict]] = {}

    for b in bloques:
        por_dia.setdefault(b["dia"], []).append(b)

    gaps = []
    for bs in por_dia.values():
        bs = sorted(bs, key=lambda b: (b["inicio"], b["fin"]))
        for prev, cur in zip(bs, bs[1:]):
            gaps.append(max(0.0, float(cur["inicio"] - prev["fin"])))

    total_gap_horas = float(sum(gaps))
    n_gaps = len(gaps)

    return {
        "bloques": bloques,
        "max_horas_consecutivas": float(max([b["horas"] for b in bloques], default=0.0)),
        "max_ueas_bloque": int(max([b["n_ueas"] for b in bloques], default=0)),
        "n_bloques_semana": int(len(bloques)),
        "max_bloques_dia": int(max([len(bs) for bs in por_dia.values()], default=0)),
        "total_gap_horas": total_gap_horas,
        "max_gap_horas": float(max(gaps, default=0.0)),
        "promedio_gap_horas": float(total_gap_horas / n_gaps) if n_gaps else 0.0,
        "dias_con_clase": int(len(por_dia)),
    }


def firma_bloques_desde_bloques(bloques: List[dict]) -> str:
    orden_dia = {dia: i for i, (dia, _, _) in enumerate(DIA_COLS)}
    partes = []

    for b in sorted(bloques, key=lambda x: (orden_dia.get(x["dia"], 99), x["inicio"], x["fin"])):
        partes.append(
            f"{b['dia']}:{fmt_hora(float(b['inicio']))}-{fmt_hora(float(b['fin']))}#{int(b['n_ueas'])}"
        )

    return "|".join(partes)


def firma_bloques_semana(intervalos: List[Intervalo]) -> str:
    return firma_bloques_desde_bloques(construir_bloques(intervalos))


def weighted_quantile(values, weights, q: float) -> float:
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


def rareza_ratio(
    valor: float,
    centro: float,
    cap: float,
    zona_libre: float = 0.75,
) -> float:
    """
    Penaliza no solo excesos sobre Q90, sino tambien valores cercanos al borde.

    - valor <= zona_libre * centro: sin penalizacion
    - valor == centro: penalizacion baja-media
    - valor >= cap: penalizacion maxima
    """
    if valor <= 0 or centro <= 0:
        return 0.0

    inicio_penalizacion = zona_libre * centro

    if valor <= inicio_penalizacion:
        return 0.0

    if valor <= centro:
        denom = max(centro - inicio_penalizacion, EPS)
        return float(0.35 * (valor - inicio_penalizacion) / denom)

    denom = max(cap - centro, EPS)
    return float(np.clip(0.35 + 0.65 * (valor - centro) / denom, 0.0, 1.0))



def normalizar_eco_nombre(raw: Any) -> Dict[str, str]:
    if isinstance(raw, dict):
        out = {}
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
            eco = item.get("eco", item.get("numeroEconomico", item.get("numero_economico")))
            nombre = item.get("nombre", item.get("name", item.get("profesor")))
            if eco is not None:
                out[str(eco)] = str(nombre or eco)
        return out

    return {}


class PenalizacionCargaHistoricaModel:
    def __init__(
        self,
        half_life_trimestres: float = 4.0,
        q_tolerancia: float = 0.90,
        horas_cap: float = 6.0,
        ueas_bloque_cap: float = 4.0,
        ueas_semana_cap: float = 6.0,
        peso_exceso_horas_dia: float = 1.5,
        peso_exceso_ueas_bloque: float = 1.2,
        peso_exceso_ueas_semana: float = 1.5,
        lambda_diaria: float = 2.0,
        lambda_semanal: float = 2.0,
        lambda_ueas_2: float = 1.0,
        lambda_ueas_3: float = 1.0,
        lambda_ueas_4: float = 1.0,
        lambda_ueas_5: float = 1.0,
        lambda_ueas_6_plus: float = 1.0,
        penalizacion_base: float = 0.0,
        shrinkage_weight: float = 3.0,
        exponente_rareza_ueas_totales: float = 2.0,
        lambda_bloques_historicos: float = 0.90,
        lambda_horas_bloque_normal: float = 1.0,
        lambda_horas_bloque_laboratorio: float = 0.35,
        peso_rareza_horas_bloque_hist: float = 1.60,
        peso_rareza_ueas_bloque_hist: float = 0.90,
        peso_rareza_fragmentacion_bloques: float = 0.80,
        peso_rareza_huecos_bloques: float = 0.55,
        peso_rareza_patron_bloques: float = 0.35,
        premio_respaldo_bloques: float = 0.12,
        premio_cap_bloques: float = 0.12,
        exponente_rareza_bloques: float = 1.40,
        min_ueas_piso_rareza_bloques: int = 3,
        max_ueas_bonus_bloques: int = 2,
        umbral_respaldo_bonus_bloques: float = 0.50,
        umbral_cost_bonus_bloques: float = 0.25,
        umbral_horas_laboratorio: float = 2.25,
        cap_horas_laboratorio: float = 3.0,
    ):
        self.weekly_records_ = {}
        self.global_weekly_records_ = []
        self.exponente_rareza_ueas_totales = exponente_rareza_ueas_totales
        self.block_shape_records_ = {}
        self.global_block_shape_records_ = []
        self.block_pattern_weights_ = {}
        self.global_block_pattern_weights_ = {}

        self.half_life_trimestres = half_life_trimestres
        self.q_tolerancia = q_tolerancia
        self.horas_cap = horas_cap
        self.ueas_bloque_cap = ueas_bloque_cap
        self.ueas_semana_cap = ueas_semana_cap
        self.peso_exceso_horas_dia = peso_exceso_horas_dia
        self.peso_exceso_ueas_bloque = peso_exceso_ueas_bloque
        self.peso_exceso_ueas_semana = peso_exceso_ueas_semana
        self.lambda_diaria = lambda_diaria
        self.lambda_semanal = lambda_semanal
        self.lambda_ueas_2 = lambda_ueas_2
        self.lambda_ueas_3 = lambda_ueas_3
        self.lambda_ueas_4 = lambda_ueas_4
        self.lambda_ueas_5 = lambda_ueas_5
        self.lambda_ueas_6_plus = lambda_ueas_6_plus
        self.penalizacion_base = penalizacion_base
        self.shrinkage_weight = shrinkage_weight
        self.lambda_bloques_historicos = lambda_bloques_historicos
        self.lambda_horas_bloque_normal = lambda_horas_bloque_normal
        self.lambda_horas_bloque_laboratorio = lambda_horas_bloque_laboratorio
        self.peso_rareza_horas_bloque_hist = peso_rareza_horas_bloque_hist
        self.peso_rareza_ueas_bloque_hist = peso_rareza_ueas_bloque_hist
        self.peso_rareza_fragmentacion_bloques = peso_rareza_fragmentacion_bloques
        self.peso_rareza_huecos_bloques = peso_rareza_huecos_bloques
        self.peso_rareza_patron_bloques = peso_rareza_patron_bloques
        self.premio_respaldo_bloques = premio_respaldo_bloques
        self.premio_cap_bloques = premio_cap_bloques
        self.exponente_rareza_bloques = exponente_rareza_bloques
        self.min_ueas_piso_rareza_bloques = int(min_ueas_piso_rareza_bloques)
        self.max_ueas_bonus_bloques = int(max_ueas_bonus_bloques)
        self.umbral_respaldo_bonus_bloques = umbral_respaldo_bonus_bloques
        self.umbral_cost_bonus_bloques = umbral_cost_bonus_bloques
        self.umbral_horas_laboratorio = umbral_horas_laboratorio
        self.cap_horas_laboratorio = cap_horas_laboratorio

        self.perfiles_: Dict[str, dict] = {}
        self.global_profile_: dict = {}
        self.eco_nombre_: Dict[str, str] = {}
        self.top_horarios_: Dict[str, List[str]] = {}
        self.top_patrones_bloque_: Dict[str, List[str]] = {}

    def _peso_tri(self, tri_num: int, max_tri: int) -> float:
        return 2 ** (-(max_tri - tri_num) / self.half_life_trimestres)

    def _q_shrink(self, vals, weights, global_q):
        vals = np.asarray(vals, dtype=float)
        weights = np.asarray(weights, dtype=float)
        if len(vals) == 0 or np.sum(weights) <= 0:
            return float(global_q)

        q_local = weighted_quantile(vals, weights, self.q_tolerancia)
        alpha = float(np.sum(weights) / (np.sum(weights) + self.shrinkage_weight))
        return alpha * q_local + (1 - alpha) * global_q

    def fit(self, df_hist: pd.DataFrame, eco_nombre_raw: Optional[Any] = None):
        df = df_hist.copy()
        df["eco"] = df["eco"].astype(str)
        df["uea"] = df["uea"].astype(str)
        df["tri_num"] = df["tri_num"].astype(int)

        max_tri = int(df["tri_num"].max())
        df["_w"] = df["tri_num"].apply(lambda t: self._peso_tri(int(t), max_tri))
        df["_horario_id"] = df.apply(horario_id_desde_row, axis=1)

        if eco_nombre_raw is not None:
            self.eco_nombre_ = normalizar_eco_nombre(eco_nombre_raw)

        ints = intervalos_desde_df(df)
        ints["_w"] = ints["tri_num"].apply(lambda t: self._peso_tri(int(t), max_tri))

        daily_records = []
        for (eco, tri_num, dia), g in ints.groupby(["eco", "tri_num", "dia"]):
            intervalos = [
                Intervalo(r.dia, r.inicio, r.fin, r.uea)
                for r in g.itertuples(index=False)
            ]
            bloques = construir_bloques(intervalos)
            if not bloques:
                continue
            max_bloque = max(bloques, key=lambda b: (b["horas"], b["n_ueas"]))
            daily_records.append({
                "eco": eco,
                "tri_num": tri_num,
                "dia": dia,
                "max_horas_consecutivas": max_bloque["horas"],
                "max_ueas_bloque": max_bloque["n_ueas"],
                "w": float(g["_w"].iloc[0]),
            })

        daily = pd.DataFrame(daily_records)

        weekly = (
            df.groupby(["eco", "tri_num"])
            .agg(n_ueas_semana=("uea", "nunique"), w=("_w", "max"))
            .reset_index()
        )
        self.global_weekly_records_ = list(
            zip(
                weekly["n_ueas_semana"].astype(float),
                weekly["w"].astype(float),
            )
        )

        block_records = []
        for (eco, tri_num), g in ints.groupby(["eco", "tri_num"]):
            intervalos_semana = [
                Intervalo(r.dia, r.inicio, r.fin, r.uea)
                for r in g.itertuples(index=False)
            ]
            resumen_b = resumen_bloques_semana(intervalos_semana)
            firma_b = firma_bloques_desde_bloques(resumen_b["bloques"])
            block_records.append({
                "eco": str(eco),
                "tri_num": int(tri_num),
                "n_ueas_semana": int(g["uea"].nunique()),
                "max_horas_consecutivas": resumen_b["max_horas_consecutivas"],
                "max_ueas_bloque": resumen_b["max_ueas_bloque"],
                "n_bloques_semana": resumen_b["n_bloques_semana"],
                "max_bloques_dia": resumen_b["max_bloques_dia"],
                "total_gap_horas": resumen_b["total_gap_horas"],
                "max_gap_horas": resumen_b["max_gap_horas"],
                "promedio_gap_horas": resumen_b["promedio_gap_horas"],
                "dias_con_clase": resumen_b["dias_con_clase"],
                "firma_bloques": firma_b,
                "w": float(g["_w"].iloc[0]),
            })

        block_shapes = pd.DataFrame(block_records)
        self.global_block_shape_records_ = block_records
        self.global_block_pattern_weights_ = {}
        for r in block_records:
            W = int(r["n_ueas_semana"])
            firma = str(r["firma_bloques"])
            self.global_block_pattern_weights_.setdefault(W, {})[firma] = \
                self.global_block_pattern_weights_.setdefault(W, {}).get(firma, 0.0) + float(r["w"])

        self.global_profile_ = {
            "q_horas_dia": weighted_quantile(daily["max_horas_consecutivas"], daily["w"], self.q_tolerancia),
            "q_ueas_bloque": weighted_quantile(daily["max_ueas_bloque"], daily["w"], self.q_tolerancia),
            "q_ueas_semana": weighted_quantile(weekly["n_ueas_semana"], weekly["w"], self.q_tolerancia),
            "q_horas_intervalo": weighted_quantile(ints["horas"], ints["_w"], self.q_tolerancia),
            "q_max_bloques_dia": weighted_quantile(block_shapes["max_bloques_dia"], block_shapes["w"], self.q_tolerancia),
            "q_total_gap_horas": weighted_quantile(block_shapes["total_gap_horas"], block_shapes["w"], self.q_tolerancia),
            "q_max_gap_horas": weighted_quantile(block_shapes["max_gap_horas"], block_shapes["w"], self.q_tolerancia),
        }

        ecos = sorted(set(df["eco"]))
        for eco in ecos:
            d = daily[daily["eco"] == eco]
            i = ints[ints["eco"] == eco]
            w = weekly[weekly["eco"] == eco]

            w_prof = weekly[weekly["eco"] == eco]
            bs = block_shapes[block_shapes["eco"] == eco]

            self.weekly_records_[eco] = list(
                zip(
                    w_prof["n_ueas_semana"].astype(float),
                    w_prof["w"].astype(float),
                )
            )
            self.block_shape_records_[eco] = bs.to_dict("records")
            self.block_pattern_weights_[eco] = {}
            for r in self.block_shape_records_[eco]:
                W = int(r["n_ueas_semana"])
                firma = str(r["firma_bloques"])
                self.block_pattern_weights_[eco].setdefault(W, {})[firma] = \
                    self.block_pattern_weights_[eco].setdefault(W, {}).get(firma, 0.0) + float(r["w"])

            self.perfiles_[eco] = {
                "eco": eco,
                "nombre": self.eco_nombre_.get(eco, eco),
                "q_horas_dia": self._q_shrink(
                    d["max_horas_consecutivas"], d["w"], self.global_profile_["q_horas_dia"]
                ),
                "q_ueas_bloque": self._q_shrink(
                    d["max_ueas_bloque"], d["w"], self.global_profile_["q_ueas_bloque"]
                ),
                "q_ueas_semana": self._q_shrink(
                    w["n_ueas_semana"], w["w"], self.global_profile_["q_ueas_semana"]
                ),
                "q_horas_intervalo": self._q_shrink(
                    i["horas"], i["_w"], self.global_profile_["q_horas_intervalo"]
                ),
                "q_max_bloques_dia": self._q_shrink(
                    bs["max_bloques_dia"], bs["w"], self.global_profile_["q_max_bloques_dia"]
                ),
                "q_total_gap_horas": self._q_shrink(
                    bs["total_gap_horas"], bs["w"], self.global_profile_["q_total_gap_horas"]
                ),
                "q_max_gap_horas": self._q_shrink(
                    bs["max_gap_horas"], bs["w"], self.global_profile_["q_max_gap_horas"]
                ),
                "peso_hist_reciente": float(d["w"].sum() + w["w"].sum()),
                "n_trimestres": int(w["tri_num"].nunique()),
            }

        top = (
            df[df["_horario_id"] != ""]
            .groupby(["eco", "_horario_id"])["_w"]
            .sum()
            .reset_index()
            .sort_values(["eco", "_w"], ascending=[True, False])
        )

        self.top_horarios_ = {
            eco: g["_horario_id"].head(5).tolist()
            for eco, g in top.groupby("eco")
        }

        self.top_patrones_bloque_ = {}
        for eco, por_w in self.block_pattern_weights_.items():
            acumulado = {}
            for patrones in por_w.values():
                for firma, wgt in patrones.items():
                    acumulado[firma] = acumulado.get(firma, 0.0) + float(wgt)
            self.top_patrones_bloque_[eco] = [
                firma for firma, _ in sorted(acumulado.items(), key=lambda kv: kv[1], reverse=True)[:5]
            ]

        return self

    def _perfil(self, eco: str) -> dict:
        eco = str(eco)
        if eco in self.perfiles_:
            return self.perfiles_[eco]
        return {
            "eco": eco,
            "nombre": self.eco_nombre_.get(eco, eco),
            **self.global_profile_,
            "peso_hist_reciente": 0.0,
            "n_trimestres": 0,
        }

    def _weighted_tail_probability(self, records, value: float) -> float:
        total = 0.0
        tail = 0.0

        for n, w in records:
            if not np.isfinite(n) or not np.isfinite(w) or w <= 0:
                continue
            total += w
            if n >= value:
                tail += w

        if total <= 0:
            return np.nan

        return tail / total

    def _records_candidatos_bloques(self, records: List[dict], n_ueas: int) -> List[dict]:
        if not records:
            return []

        W = int(n_ueas)
        exactos = [r for r in records if int(r.get("n_ueas_semana", -1)) == W]
        if sum(float(r.get("w", 0.0)) for r in exactos) > 0:
            return exactos

        previos = [r for r in records if int(r.get("n_ueas_semana", -1)) <= W]
        if sum(float(r.get("w", 0.0)) for r in previos) > 0:
            return previos

        return records

    def _weighted_proximity_probability(
        self,
        records: List[dict],
        feature: str,
        value: float,
        n_ueas: int,
        tolerance: float,
    ) -> tuple[float, float]:
        total = 0.0
        match = 0.0

        for r in self._records_candidatos_bloques(records, n_ueas):
            v = float(r.get(feature, np.nan))
            w = float(r.get("w", 0.0))
            if not np.isfinite(v) or not np.isfinite(w) or w <= 0:
                continue
            total += w
            if abs(v - float(value)) <= tolerance + EPS:
                match += w

        if total <= 0:
            return np.nan, 0.0

        return float(match / total), float(total)

    def _pattern_probability(self, pattern_weights: dict, n_ueas: int, firma: str) -> tuple[float, float]:
        if not pattern_weights:
            return np.nan, 0.0

        W = int(n_ueas)
        candidatos = dict(pattern_weights.get(W, {}))

        if sum(candidatos.values()) <= 0:
            candidatos = {}
            for k, patrones in pattern_weights.items():
                if int(k) <= W:
                    for f, w in patrones.items():
                        candidatos[f] = candidatos.get(f, 0.0) + float(w)

        if sum(candidatos.values()) <= 0:
            for patrones in pattern_weights.values():
                for f, w in patrones.items():
                    candidatos[f] = candidatos.get(f, 0.0) + float(w)

        total = float(sum(candidatos.values()))
        if total <= 0:
            return np.nan, 0.0

        return float(candidatos.get(firma, 0.0) / total), total

    def _support_bloques_feature(
        self,
        eco: str,
        feature: str,
        value: float,
        n_ueas: int,
        tolerance: float,
    ) -> tuple[float, dict]:
        local_records = self.block_shape_records_.get(str(eco), [])
        s_global, peso_global = self._weighted_proximity_probability(
            self.global_block_shape_records_, feature, value, n_ueas, tolerance
        )
        if not np.isfinite(s_global):
            s_global = 1.0

        s_local, peso_local = self._weighted_proximity_probability(
            local_records, feature, value, n_ueas, tolerance
        )

        if np.isfinite(s_local):
            alpha = peso_local / (peso_local + self.shrinkage_weight)
            support = alpha * s_local + (1.0 - alpha) * s_global
        else:
            alpha = 0.0
            support = s_global

        return float(np.clip(support, 0.0, 1.0)), {
            "support_local": float(s_local) if np.isfinite(s_local) else np.nan,
            "support_global": float(s_global),
            "peso_local": float(peso_local),
            "peso_global": float(peso_global),
            "alpha_local": float(alpha),
        }

    def _support_patron_bloques(self, eco: str, n_ueas: int, firma: str) -> tuple[float, dict]:
        s_global, peso_global = self._pattern_probability(self.global_block_pattern_weights_, n_ueas, firma)
        if not np.isfinite(s_global):
            s_global = 1.0

        s_local, peso_local = self._pattern_probability(
            self.block_pattern_weights_.get(str(eco), {}), n_ueas, firma
        )

        if np.isfinite(s_local):
            alpha = peso_local / (peso_local + self.shrinkage_weight)
            support = alpha * s_local + (1.0 - alpha) * s_global
        else:
            alpha = 0.0
            support = s_global

        return float(np.clip(support, 0.0, 1.0)), {
            "support_local": float(s_local) if np.isfinite(s_local) else np.nan,
            "support_global": float(s_global),
            "peso_local": float(peso_local),
            "peso_global": float(peso_global),
            "alpha_local": float(alpha),
        }

    def _evaluar_bloques_historicos(
        self,
        eco: str,
        resumen_bloques: dict,
        n_ueas_semana: int,
        firma_bloques: str,
    ) -> dict:
        specs = [
            ("max_horas_consecutivas", "horas_consecutivas", self.peso_rareza_horas_bloque_hist, 0.75),
            ("max_ueas_bloque", "ueas_en_bloque", self.peso_rareza_ueas_bloque_hist, 0.25),
            ("max_bloques_dia", "fragmentacion_dia", self.peso_rareza_fragmentacion_bloques, 0.25),
            ("total_gap_horas", "huecos_entre_bloques", self.peso_rareza_huecos_bloques, 0.75),
        ]

        detalles = {}
        supports = []
        signal = 0.0
        peso_total = 0.0

        for feature, etiqueta, peso, tol in specs:
            valor = float(resumen_bloques.get(feature, 0.0))
            support, meta = self._support_bloques_feature(
                eco, feature, valor, n_ueas_semana, tol
            )
            rareza = (1.0 - support) ** self.exponente_rareza_bloques
            signal += float(peso) * rareza
            peso_total += float(peso)
            supports.append(support)

            detalles[f"valor_{etiqueta}"] = valor
            detalles[f"support_{etiqueta}"] = support
            detalles[f"rareza_{etiqueta}"] = float(rareza)
            detalles[f"support_local_{etiqueta}"] = meta["support_local"]
            detalles[f"support_global_{etiqueta}"] = meta["support_global"]
            detalles[f"alpha_local_{etiqueta}"] = meta["alpha_local"]

        support_patron, meta_patron = self._support_patron_bloques(eco, n_ueas_semana, firma_bloques)
        rareza_patron = (1.0 - support_patron) ** self.exponente_rareza_bloques
        signal += self.peso_rareza_patron_bloques * rareza_patron
        peso_total += self.peso_rareza_patron_bloques
        supports.append(support_patron)

        rareza_agregada = float(np.clip(signal / max(peso_total, EPS), 0.0, 1.0))
        cost_suavizado = 1.0 - math.exp(-signal) if signal > 0 else 0.0
        piso_rareza_aplicado = 0.0
        if int(n_ueas_semana) >= self.min_ueas_piso_rareza_bloques:
            piso_rareza_aplicado = rareza_agregada
        cost = max(cost_suavizado, piso_rareza_aplicado)
        respaldo = float(np.mean(supports)) if supports else 0.0
        peso_local_total = sum(
            float(r.get("w", 0.0))
            for r in self.block_shape_records_.get(str(eco), [])
            if np.isfinite(float(r.get("w", 0.0))) and float(r.get("w", 0.0)) > 0
        )
        confianza_local = peso_local_total / (peso_local_total + self.shrinkage_weight) if peso_local_total > 0 else 0.0
        bonus = 0.0
        if (
            int(n_ueas_semana) >= 2
            and int(n_ueas_semana) <= self.max_ueas_bonus_bloques
            and respaldo >= self.umbral_respaldo_bonus_bloques
            and cost <= self.umbral_cost_bonus_bloques
        ):
            bonus = min(
                self.premio_cap_bloques,
                self.premio_respaldo_bloques * respaldo * (1.0 - cost),
            )

        detalles.update({
            "firma_bloques": firma_bloques,
            "support_patron_bloques": support_patron,
            "support_local_patron_bloques": meta_patron["support_local"],
            "support_global_patron_bloques": meta_patron["support_global"],
            "rareza_patron_bloques": float(rareza_patron),
            "signal_bloques_historicos": float(signal),
            "cost_suavizado_bloques_historicos": float(cost_suavizado),
            "piso_rareza_bloques_historicos": float(piso_rareza_aplicado),
            "cost_bloques_historicos": float(cost),
            "rareza_bloques_historicos": rareza_agregada,
            "respaldo_bloques_historicos": respaldo,
            "confianza_local_bloques": float(confianza_local),
        })

        return {
            "cost": float(cost),
            "bonus": float(bonus),
            "details": detalles,
        }

    def _rareza_ueas_totales(self, eco: str, n_ueas_totales: int) -> tuple[float, float]:
        local_records = self.weekly_records_.get(str(eco), [])
        s_global = self._weighted_tail_probability(self.global_weekly_records_, n_ueas_totales)

        if not np.isfinite(s_global):
            s_global = 1.0 if n_ueas_totales <= 1 else 0.0

        s_local = self._weighted_tail_probability(local_records, n_ueas_totales)
        peso_local = sum(w for _, w in local_records if np.isfinite(w) and w > 0)

        if np.isfinite(s_local):
            alpha = peso_local / (peso_local + self.shrinkage_weight)
            s = alpha * s_local + (1 - alpha) * s_global
        else:
            s = s_global

        rareza_cruda = np.clip(1.0 - s, 0.0, 1.0)
        rareza = rareza_cruda ** self.exponente_rareza_ueas_totales

        return float(rareza), float(s)

    def _lambda_ueas_semana(self, n_ueas_totales: int) -> float:
        W = int(n_ueas_totales)
        if W <= 1:
            return 1.0
        if W == 2:
            return float(self.lambda_ueas_2)
        if W == 3:
            return float(self.lambda_ueas_3)
        if W == 4:
            return float(self.lambda_ueas_4)
        if W == 5:
            return float(self.lambda_ueas_5)
        return float(self.lambda_ueas_6_plus)

    def _factor_horas_bloque(self, perfil: dict, max_horas_intervalo: float) -> tuple[float, float]:
        q_intervalo = float(perfil.get("q_horas_intervalo", 0.0) or 0.0)
        max_horas_intervalo = float(max_horas_intervalo or 0.0)

        if max_horas_intervalo < self.umbral_horas_laboratorio or q_intervalo < self.umbral_horas_laboratorio:
            score_laboratorio = 0.0
        else:
            base_lab = min(max_horas_intervalo, q_intervalo)
            score_laboratorio = float(np.clip(
                (base_lab - self.umbral_horas_laboratorio)
                / max(self.cap_horas_laboratorio - self.umbral_horas_laboratorio, EPS),
                0.0,
                1.0,
            ))

        factor = (
            (1.0 - score_laboratorio) * self.lambda_horas_bloque_normal
            + score_laboratorio * self.lambda_horas_bloque_laboratorio
        )
        return float(max(0.0, factor)), float(score_laboratorio)

    def exceso_ratio(self, valor: float, tolerancia: float, cap: float) -> float:
        if not np.isfinite(valor) or not np.isfinite(tolerancia) or not np.isfinite(cap):
            return 0.0

        if valor <= tolerancia:
            return 0.0

        if cap <= tolerancia:
            return 1.0

        return float(np.clip((valor - tolerancia) / (cap - tolerancia), 0.0, 1.0))


    def predict_penalty(
        self,
        eco: str,
        horario_id: str,
        horarios_asignados_actuales: Optional[List[str]] = None,
        ueas_asignadas_actuales: Optional[List[str]] = None,
        uea_prediccion: str = "__PRED__",
    ) -> dict:
        eco = str(eco)
        perfil = self._perfil(eco)

        intervalos = []

        horarios_asignados_actuales = horarios_asignados_actuales or []
        ueas_asignadas_actuales = list(ueas_asignadas_actuales or [])

        # Si hay horarios actuales sin etiqueta de UEA, cada horario_id se trata como una UEA distinta.
        for idx in range(len(ueas_asignadas_actuales), len(horarios_asignados_actuales)):
            ueas_asignadas_actuales.append(f"__UEA_ACTUAL_{idx + 1}__")

        for idx, h_id in enumerate(horarios_asignados_actuales):
            uea = ueas_asignadas_actuales[idx] if idx < len(ueas_asignadas_actuales) else f"ASIG_{idx}"
            intervalos.extend(parse_horario_id(h_id, str(uea)))

        intervalos.extend(parse_horario_id(horario_id, str(uea_prediccion)))

        resumen_bloques = resumen_bloques_semana(intervalos)
        bloques = resumen_bloques["bloques"]
        firma_bloques = firma_bloques_desde_bloques(bloques)
        max_horas = resumen_bloques["max_horas_consecutivas"]
        max_ueas_bloque = resumen_bloques["max_ueas_bloque"]
        max_horas_intervalo = max([iv.fin - iv.inicio for iv in intervalos], default=0.0)

        ueas_totales = set(map(str, ueas_asignadas_actuales))
        ueas_totales.add(str(uea_prediccion))
        n_ueas_semana = len(ueas_totales)

        r_horas = self.exceso_ratio(
            max_horas,
            perfil["q_horas_dia"],
            self.horas_cap
        )

        r_bloque = self.exceso_ratio(
            max_ueas_bloque,
            perfil["q_ueas_bloque"],
            self.ueas_bloque_cap
        )

        r_semana, prob_hist_semana = self._rareza_ueas_totales(
            eco,
            n_ueas_semana
        )
        lambda_ueas_semana = self._lambda_ueas_semana(n_ueas_semana)
        factor_horas_bloque, score_laboratorio_bloque = self._factor_horas_bloque(
            perfil,
            max_horas_intervalo,
        )

        signal_diaria = self.peso_exceso_horas_dia * factor_horas_bloque * r_horas + self.peso_exceso_ueas_bloque * r_bloque
        cost_diaria = 1 - math.exp(-signal_diaria) if signal_diaria > 0 else 0.0

        signal_semanal = self.peso_exceso_ueas_semana * r_semana
        cost_semanal = 1 - math.exp(-signal_semanal) if signal_semanal > 0 else 0.0

        eval_bloques = self._evaluar_bloques_historicos(
            eco,
            resumen_bloques,
            n_ueas_semana,
            firma_bloques,
        )
        cost_bloques = eval_bloques["cost"]
        bonus_bloques = eval_bloques["bonus"]

        total_sin_bonus = min(
            2.0,
            self.lambda_diaria * cost_diaria
            + self.lambda_semanal * lambda_ueas_semana * cost_semanal
            + self.lambda_bloques_historicos * cost_bloques,
        )
        total_cost = min(2.0, max(-self.premio_cap_bloques, total_sin_bonus - bonus_bloques))

        return {
            "eco": eco,
            "nombre": perfil["nombre"],
            "penalty_total": -float(total_cost),
            "penalty_total_sin_bonus": -float(total_sin_bonus),
            "penalty_diaria": -float(cost_diaria),
            "penalty_semanal": -float(cost_semanal),
            "lambda_ueas_semana": float(lambda_ueas_semana),
            "factor_horas_bloque": float(factor_horas_bloque),
            "score_laboratorio_bloque": float(score_laboratorio_bloque),
            "penalty_bloques_historicos": -float(cost_bloques),
            "bonus_bloques_historicos": float(bonus_bloques),
            "prob_hist_ueas_totales_geq_W": prob_hist_semana,
            "rareza_ueas_totales": r_semana,
            "rareza_bloques_historicos": eval_bloques["details"]["rareza_bloques_historicos"],
            "respaldo_bloques_historicos": eval_bloques["details"]["respaldo_bloques_historicos"],
            "features": {
                "L_horas_consecutivas": max_horas,
                "B_ueas_en_bloque": max_ueas_bloque,
                "W_ueas_semana": n_ueas_semana,
                "max_horas_intervalo": float(max_horas_intervalo),
                "n_bloques_semana": resumen_bloques["n_bloques_semana"],
                "max_bloques_dia": resumen_bloques["max_bloques_dia"],
                "total_gap_horas": resumen_bloques["total_gap_horas"],
                "max_gap_horas": resumen_bloques["max_gap_horas"],
                "firma_bloques": firma_bloques,
            },
            "perfil": {
                "q_horas_dia": perfil["q_horas_dia"],
                "q_ueas_bloque": perfil["q_ueas_bloque"],
                "q_ueas_semana": perfil["q_ueas_semana"],
                "q_horas_intervalo": perfil.get("q_horas_intervalo"),
                "q_max_bloques_dia": perfil.get("q_max_bloques_dia"),
                "q_total_gap_horas": perfil.get("q_total_gap_horas"),
                "q_max_gap_horas": perfil.get("q_max_gap_horas"),
                "n_trimestres": perfil["n_trimestres"],
            },
            "historico_bloques": eval_bloques["details"],
            "top_5_horarios": self.top_horarios_.get(eco, []),
            "top_5_patrones_bloque": self.top_patrones_bloque_.get(eco, []),
        }

    def to_profiles_dataframe(self) -> pd.DataFrame:
        rows = []
        for eco, p in self.perfiles_.items():
            rows.append({
                **p,
                "top_5_horarios": "<br>".join(self.top_horarios_.get(eco, [])),
                "top_5_patrones_bloque": "<br>".join(self.top_patrones_bloque_.get(eco, [])),
            })
        return pd.DataFrame(rows)



# Salida compatible con codigo proveniente de notebook.
def display(obj):
    try:
        _pd = PD_CPU
        if isinstance(obj, _pd.DataFrame):
            print(obj.to_string(index=False))
            return
        if isinstance(obj, _pd.Series):
            print(obj.to_string())
            return
        if hasattr(obj, "data") and isinstance(obj.data, _pd.DataFrame):
            print(obj.data.to_string(index=False))
            return
    except Exception:
        pass
    pprint(obj)

try:
    pd.set_option("compute.use_numexpr", True)
    pd.set_option("compute.use_bottleneck", True)
    pd.set_option("mode.copy_on_write", True)
except Exception:
    pass

print("=== Entorno pandas/GPU ===")
print("GPU_ACTIVA:", GPU_ACTIVA)
print("CUDF_PANDAS_RMM_MODE:", os.getenv("CUDF_PANDAS_RMM_MODE"))
print("PANDAS_MODELO_BACKEND:", "pandas_cpu_para_loops" if USE_CPU_PANDAS_FOR_MODEL else "cudf_pandas_proxy")
if CUDF_ERROR:
    print("CUDF_ERROR:", CUDF_ERROR)
print("pandas:", pd.__version__)
try:
    import subprocess
    gpu_name = subprocess.check_output(
        ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
        text=True,
    ).strip()
    print("GPU detectada:", gpu_name)
except Exception as exc:
    print("nvidia-smi no disponible desde este entorno:", repr(exc))

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_WINDOWS_DATA_DIR = Path(r"C:\Users\jafet\OneDrive\Escritorio\Uni\CB\ServidorPython\volumen\archivos")
DEFAULT_DOCKER_DATA_DIR = Path("/data")

if "VIABILIDAD_DATA_DIR" in os.environ:
    DATA_DIR = Path(os.environ["VIABILIDAD_DATA_DIR"])
elif (DEFAULT_DOCKER_DATA_DIR / "df_hist.json").exists():
    DATA_DIR = DEFAULT_DOCKER_DATA_DIR
else:
    DATA_DIR = DEFAULT_WINDOWS_DATA_DIR

DF_HIST_PATH = Path(os.getenv("DF_HIST_PATH", str(DATA_DIR / "df_hist.json")))
ECO_NOMBRE_PATH = Path(os.getenv("ECO_NOMBRE_PATH", str(DATA_DIR / "eco-nombre.json")))
OUTPUT_DIR = Path(os.getenv("VIABILIDAD_OUTPUT_DIR", str(SCRIPT_DIR)))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print("DATA_DIR:", DATA_DIR)
print("DF_HIST_PATH:", DF_HIST_PATH)
print("ECO_NOMBRE_PATH:", ECO_NOMBRE_PATH)
print("OUTPUT_DIR:", OUTPUT_DIR)




with open(DF_HIST_PATH, "r", encoding="utf-8") as f:
    hist_raw = json.load(f)

with open(ECO_NOMBRE_PATH, "r", encoding="utf-8") as f:
    eco_nombre_raw = json.load(f)

df_hist = pd.DataFrame(hist_raw)
df_hist["eco"] = df_hist["eco"].astype(str)
df_hist = df_hist[df_hist["eco"] != "0"].copy()

if os.getenv("VIABILIDAD_VALIDATE_ONLY", "0").strip().lower() in {"1", "true", "yes"}:
    print("\nVALIDATE_ONLY correcto: datos cargados antes del fit.")
    print("df_hist shape:", df_hist.shape)
    print("columnas:", list(df_hist.columns))
    raise SystemExit(0)

modelo_carga = PenalizacionCargaHistoricaModel(
    half_life_trimestres=8.0,
    q_tolerancia=0.95,
    horas_cap=6.0,
    ueas_bloque_cap=4.0,
    ueas_semana_cap=4.0,
    peso_exceso_ueas_semana=2.4,
    exponente_rareza_ueas_totales=2.0,
)

modelo_carga.fit(df_hist, eco_nombre_raw)
perfiles_df = modelo_carga.to_profiles_dataframe()
print("\n=== Perfiles iniciales ===")
display(perfiles_df.head())

if os.getenv("VIABILIDAD_VALIDATE_FIT_ONLY", "0").strip().lower() in {"1", "true", "yes"}:
    print("\nVALIDATE_FIT_ONLY correcto: datos cargados y modelo base ajustado.")
    raise SystemExit(0)


# === Rareza semanal individual parametrica + habito individual + busqueda real ===

import math
import time
import numpy as np
import pandas as pd

try:
    from IPython.display import clear_output
except Exception:
    clear_output = None

SEED = int(os.getenv("SEED", "42"))
N_RANDOM_FALLBACK = int(os.getenv("N_RANDOM_FALLBACK", "10000"))
MAXITER_DE = int(os.getenv("MAXITER_DE", "100"))
POPSIZE_DE = int(os.getenv("POPSIZE_DE", "20"))


def _fmt_duracion(segundos):
    if segundos is None or not np.isfinite(segundos):
        return "calculando..."

    segundos = int(max(0, segundos))
    h, rem = divmod(segundos, 3600)
    m, s = divmod(rem, 60)

    if h:
        return f"{h:d}h {m:02d}m {s:02d}s"
    if m:
        return f"{m:d}m {s:02d}s"
    return f"{s:d}s"


def _limpiar_consola_finetuning():
    if clear_output is not None:
        clear_output(wait=True)
    else:
        print("\033[2J\033[H", end="")


def mostrar_progreso_finetuning(etapa, actual, total, inicio, loss=None, extra=""):
    total = max(1, int(total))
    actual = int(np.clip(actual, 0, total))
    transcurrido = time.time() - inicio
    pct = 100.0 * actual / total
    eta = (transcurrido / actual) * (total - actual) if actual > 0 else np.nan

    _limpiar_consola_finetuning()
    print(f"Fine tuning: {etapa}")
    print(f"Progreso: {actual}/{total} ({pct:5.1f}%)")
    print(f"Transcurrido: {_fmt_duracion(transcurrido)}")
    print(f"ETA: {_fmt_duracion(eta)}")
    if loss is not None and np.isfinite(loss):
        print(f"Loss actual: {float(loss):.6f}")
    if extra:
        print(extra)


def crear_callback_progreso(etapa, total, inicio, loss_fn=None):
    estado = {"i": 0}

    def _callback(*args, **kwargs):
        estado["i"] += 1
        loss = None

        if loss_fn is not None and args:
            try:
                loss = float(loss_fn(args[0]))
            except Exception:
                loss = None

        extra = ""
        if len(args) >= 2 and np.isscalar(args[1]):
            extra = f"Convergencia: {float(args[1]):.6g}"

        mostrar_progreso_finetuning(etapa, estado["i"], total, inicio, loss=loss, extra=extra)
        return False

    return _callback

# Datos de calibracion: targets externos, no reglas hardcodeadas dentro del modelo.
objetivos_finetuning = pd.DataFrame(
    [
        ("14416", 2, -0.05),
        ("14416", 3, -0.25),
        ("14416", 4, -0.60),
        ("14416", 5, -1.25),

        ("28650", 2, -0.10),
        ("28650", 3, -0.60),
        ("28650", 4, -1.50),
        ("28650", 5, -2.00),

        ("4377", 2, -0.05),
        ("4377", 3, -0.10),
        ("4377", 4, -0.50),
        ("4377", 5, -1.33),

        ("19834", 2, -0.30),
        ("19834", 3, -1.50),
        ("19834", 4, -2.25),
        ("19834", 5, -2.50),

        ("41339", 2, -0.10),
        ("41339", 3, -0.60),
        ("41339", 4, -1.80),
        ("41339", 5, -2.50),

        ("37492", 2, -0.05),
        ("37492", 3, -0.30),
        ("37492", 4, -1.80),
        ("37492", 5, -2.50),
    ],
    columns=["eco", "W_ueas_semana", "penalty_objetivo"],
)

objetivos_finetuning["eco"] = objetivos_finetuning["eco"].astype(str)
objetivos_finetuning["W_ueas_semana"] = objetivos_finetuning["W_ueas_semana"].astype(int)
objetivos_finetuning["penalty_objetivo"] = objetivos_finetuning["penalty_objetivo"].astype(float)

PENALIZACION_MAXIMA = max(2.0, float(objetivos_finetuning["penalty_objetivo"].abs().max()))


def _build_weighted_tail_cache(records):
    pares = [
        (float(n), float(w))
        for n, w in records
        if np.isfinite(n) and np.isfinite(w) and float(w) > 0
    ]

    if not pares:
        return {
            "values": np.array([], dtype=float),
            "tail_weights": np.array([], dtype=float),
            "total_weight": 0.0,
            "max_value": 0.0,
            "recent_value": 0.0,
        }

    arr = np.asarray(pares, dtype=float)

    order = np.argsort(arr[:, 0])
    values = arr[order, 0]
    weights = arr[order, 1]
    tail_weights = np.cumsum(weights[::-1])[::-1]

    max_w = np.max(arr[:, 1])
    recent_value = float(np.max(arr[arr[:, 1] == max_w, 0]))

    return {
        "values": values,
        "tail_weights": tail_weights,
        "total_weight": float(tail_weights[0]),
        "max_value": float(values[-1]),
        "recent_value": recent_value,
    }


def _tail_probability_from_cache(cache, value):
    if cache is None or cache["total_weight"] <= 0:
        return np.nan

    idx = int(np.searchsorted(cache["values"], float(value), side="left"))
    if idx >= len(cache["values"]):
        return 0.0

    return float(cache["tail_weights"][idx] / cache["total_weight"])


def _rebuild_weekly_tail_caches(self):
    self._global_weekly_tail_cache_ = _build_weighted_tail_cache(self.global_weekly_records_)
    self._weekly_tail_cache_ = {
        str(eco): _build_weighted_tail_cache(records)
        for eco, records in self.weekly_records_.items()
    }
    return self


def _ensure_weekly_tail_caches(self):
    if not hasattr(self, "_global_weekly_tail_cache_") or not hasattr(self, "_weekly_tail_cache_"):
        self._rebuild_weekly_tail_caches()


def _rareza_ueas_totales_parametrica(self, eco, n_ueas_totales):
    eco = str(eco)
    W = max(0, int(n_ueas_totales))

    if W <= 1:
        return 0.0, 1.0

    self._ensure_weekly_tail_caches()

    local_cache = self._weekly_tail_cache_.get(eco)
    global_cache = self._global_weekly_tail_cache_

    s_global = _tail_probability_from_cache(global_cache, W)
    if not np.isfinite(s_global):
        s_global = 0.0

    if local_cache is None or local_cache["total_weight"] <= 0:
        s = s_global
        rareza_extra = 0.0
        rareza_habito = 0.0
    else:
        perfil = self._perfil(eco)

        peso_local = float(local_cache["total_weight"])
        max_local = float(local_cache["max_value"])
        recent_value = float(local_cache["recent_value"])
        q_ueas = float(perfil.get("q_ueas_semana", recent_value))

        s_local = _tail_probability_from_cache(local_cache, W)

        # Carga tipica individual. Esta es la parte que permite que W=2
        # no signifique lo mismo para alguien de 1 UEA que para alguien de 3.
        habit_recent_weight = float(getattr(self, "habit_recent_weight", 0.80))
        habit_q_weight = float(getattr(self, "habit_q_weight", 0.40))
        habit_max_weight = float(getattr(self, "habit_max_weight", 0.15))

        weight_sum = max(habit_recent_weight + habit_q_weight + habit_max_weight, 1e-9)

        carga_ref = (
            habit_recent_weight * recent_value
            + habit_q_weight * q_ueas
            + habit_max_weight * max_local
        ) / weight_sum

        carga_ref = max(1.0, carga_ref)

        exceso_sobre_habito = max(0.0, float(W) - carga_ref)

        rareza_habito = (
            float(getattr(self, "individual_habit_strength", 0.0))
            * (exceso_sobre_habito ** float(getattr(self, "individual_habit_power", 1.0)))
        )

        if np.isfinite(s_local) and s_local > 0:
            alpha_base = peso_local / (peso_local + self.shrinkage_weight)
            alpha_min = float(getattr(self, "individual_alpha_min", 0.0))
            alpha = max(alpha_base, alpha_min)

            s = alpha * s_local + (1.0 - alpha) * s_global
            rareza_extra = 0.0
        else:
            max_local_int = int(math.floor(max_local))
            recent_value_int = int(math.floor(recent_value))
            W_ref = min(W - 1, max_local_int)

            s_ref_local = _tail_probability_from_cache(local_cache, W_ref) if W_ref >= 1 else 0.0
            s_ref_global = _tail_probability_from_cache(global_cache, W_ref) if W_ref >= 1 else 0.0

            if np.isfinite(s_ref_local) and s_ref_local > 0 and np.isfinite(s_ref_global) and s_ref_global > 0:
                decay_power = float(getattr(self, "individual_decay_power", 1.0))
                decay_global = (max(s_global, 1e-12) / s_ref_global) ** decay_power
                s_extrap = s_ref_local * decay_global
            else:
                s_extrap = 0.0

            support = float(np.clip(s_ref_local if np.isfinite(s_ref_local) else 0.0, 0.0, 1.0))

            gap_max = max(0, W - max_local_int)
            gap_recent = max(0, W - recent_value_int - 1)
            stale_gap = max(0, max_local_int - recent_value_int)

            recent_decay = float(getattr(self, "individual_recent_decay", 1.0))
            floor_strength = float(getattr(self, "individual_floor_strength", 0.0))

            recent_factor = math.exp(-recent_decay * gap_recent)
            s_floor = floor_strength * support * recent_factor

            s = float(np.clip(max(s_extrap, s_floor), 0.0, 1.0))

            falta_respaldo = 1.0 - support
            rareza_extra = (
                float(getattr(self, "individual_extra_gap_max", 0.0)) * gap_max * falta_respaldo
                + float(getattr(self, "individual_extra_gap_recent", 0.0)) * gap_recent * falta_respaldo
                + float(getattr(self, "individual_extra_stale", 0.0)) * stale_gap * falta_respaldo
            )

    rareza_prob = np.clip(1.0 - s, 0.0, 1.0) ** self.exponente_rareza_ueas_totales
    rareza = rareza_prob + rareza_extra + rareza_habito

    return float(max(0.0, rareza)), float(np.clip(s, 0.0, 1.0))


PenalizacionCargaHistoricaModel._rebuild_weekly_tail_caches = _rebuild_weekly_tail_caches
PenalizacionCargaHistoricaModel._ensure_weekly_tail_caches = _ensure_weekly_tail_caches
PenalizacionCargaHistoricaModel._rareza_ueas_totales = _rareza_ueas_totales_parametrica

modelo_carga._rebuild_weekly_tail_caches()


def decodificar(x):
    return {
        "lambda_semanal": float(x[0]),
        "lambda_ueas_2": float(math.exp(x[1])),
        "lambda_ueas_3": float(math.exp(x[2])),
        "lambda_ueas_4": float(math.exp(x[3])),
        "lambda_ueas_5": float(math.exp(x[4])),
        "lambda_ueas_6_plus": float(math.exp(x[5])),
        "peso_exceso_ueas_semana": float(math.exp(x[6])),
        "exponente_rareza_ueas_totales": float(math.exp(x[7])),
        "shrinkage_weight": float(math.exp(x[8])),

        "individual_alpha_min": float(x[9]),
        "individual_decay_power": float(x[10]),
        "individual_floor_strength": float(x[11]),
        "individual_recent_decay": float(x[12]),
        "individual_extra_gap_max": float(x[13]),
        "individual_extra_gap_recent": float(x[14]),
        "individual_extra_stale": float(x[15]),

        "individual_habit_strength": float(math.exp(x[16])),
        "individual_habit_power": float(x[17]),
        "habit_recent_weight": float(x[18]),
        "habit_q_weight": float(x[19]),
        "habit_max_weight": float(x[20]),
    }


bounds = [
    (0.75, PENALIZACION_MAXIMA),          # lambda_semanal
    (math.log(0.20), math.log(4.00)),     # lambda_ueas_2
    (math.log(0.20), math.log(4.00)),     # lambda_ueas_3
    (math.log(0.20), math.log(4.00)),     # lambda_ueas_4
    (math.log(0.20), math.log(4.00)),     # lambda_ueas_5
    (math.log(0.20), math.log(4.00)),     # lambda_ueas_6_plus
    (math.log(0.05), math.log(50.0)),     # peso_exceso_ueas_semana
    (math.log(0.30), math.log(50.0)),      # exponente_rareza_ueas_totales
    (math.log(0.10), math.log(50.0)),    # shrinkage_weight

    (0.00, 0.95),                         # individual_alpha_min
    (0.05, 3.00),                         # individual_decay_power
    (0.00, 1.00),                         # individual_floor_strength
    (0.00, 4.00),                         # individual_recent_decay
    (0.00, 2.50),                         # individual_extra_gap_max
    (0.00, 2.50),                         # individual_extra_gap_recent
    (0.00, 2.50),                         # individual_extra_stale

    (math.log(0.001), math.log(1.0)),     # individual_habit_strength
    (0.50, 3.00),                         # individual_habit_power
    (0.00, 1.00),                         # habit_recent_weight
    (0.00, 1.00),                         # habit_q_weight
    (0.00, 1.00),                         # habit_max_weight
]


def aplicar_parametros(modelo, params):
    for k, v in params.items():
        setattr(modelo, k, float(v))


def evaluar_parametros(params):
    aplicar_parametros(modelo_carga, params)

    rows = []
    for r in objetivos_finetuning.itertuples(index=False):
        rareza, prob = modelo_carga._rareza_ueas_totales(
            str(r.eco),
            int(r.W_ueas_semana),
        )

        costo_semana = 1.0 - math.exp(
            -modelo_carga.peso_exceso_ueas_semana * rareza
        )
        lambda_ueas_semana = modelo_carga._lambda_ueas_semana(int(r.W_ueas_semana))

        penalty = -min(
            PENALIZACION_MAXIMA,
            modelo_carga.lambda_semanal * lambda_ueas_semana * costo_semana,
        )

        rows.append({
            "eco": str(r.eco),
            "W_ueas_semana": int(r.W_ueas_semana),
            "penalty_objetivo": float(r.penalty_objetivo),
            "penalty_calculado": penalty,
            "error": penalty - float(r.penalty_objetivo),
            "prob_hist_geq_W": prob,
            "rareza": rareza,
            "lambda_ueas_semana": lambda_ueas_semana,
        })

    return pd.DataFrame(rows)


def perdida_desde_params(params):
    df_eval = evaluar_parametros(params)
    err = df_eval["error"].to_numpy(dtype=float)

    rmse = float(np.sqrt(np.mean(err ** 2)))
    mae = float(np.mean(np.abs(err)))
    max_abs = float(np.max(np.abs(err)))

    monotonia = 0.0
    for _, g in df_eval.sort_values("W_ueas_semana").groupby("eco"):
        p = g["penalty_calculado"].to_numpy(dtype=float)
        subidas = np.diff(p)
        monotonia += float(np.sum(np.maximum(subidas, 0.0) ** 2))

    reg = (
        0.008 * (params["lambda_ueas_2"] - 1.0) ** 2
        + 0.008 * (params["lambda_ueas_3"] - 1.0) ** 2
        + 0.008 * (params["lambda_ueas_4"] - 1.0) ** 2
        + 0.008 * (params["lambda_ueas_5"] - 1.0) ** 2
        + 0.008 * (params["lambda_ueas_6_plus"] - 1.0) ** 2
        + 0.015 * params["individual_extra_gap_max"] ** 2
        + 0.015 * params["individual_extra_gap_recent"] ** 2
        + 0.015 * params["individual_extra_stale"] ** 2
        + 0.010 * params["individual_floor_strength"] ** 2
        + 0.005 * params["individual_alpha_min"] ** 2
        + 0.010 * params["individual_habit_strength"] ** 2
        + 0.003 * (params["individual_habit_power"] - 1.0) ** 2
    )

    return rmse + 0.25 * mae + 0.10 * max_abs + 2.0 * monotonia + reg


def perdida_desde_x(x):
    return perdida_desde_params(decodificar(x))


try:
    from scipy.optimize import differential_evolution, minimize

    inicio_de_semana = time.time()
    resultado = differential_evolution(
        perdida_desde_x,
        bounds=bounds,
        seed=SEED,
        maxiter=MAXITER_DE,
        popsize=POPSIZE_DE,
        tol=1e-3,
        polish=False,
        workers=1,
        updating="immediate",
        callback=crear_callback_progreso(
            "semanal / differential_evolution",
            MAXITER_DE,
            inicio_de_semana,
            loss_fn=perdida_desde_x,
        ),
    )
    mostrar_progreso_finetuning(
        "semanal / differential_evolution",
        MAXITER_DE,
        MAXITER_DE,
        inicio_de_semana,
        loss=float(resultado.fun),
        extra="Etapa completada.",
    )

    maxiter_refinado_semana = 350
    inicio_refinado_semana = time.time()
    refinado = minimize(
        perdida_desde_x,
        resultado.x,
        method="L-BFGS-B",
        bounds=bounds,
        options={"maxiter": maxiter_refinado_semana},
        callback=crear_callback_progreso(
            "semanal / L-BFGS-B",
            maxiter_refinado_semana,
            inicio_refinado_semana,
            loss_fn=perdida_desde_x,
        ),
    )
    mostrar_progreso_finetuning(
        "semanal / L-BFGS-B",
        int(getattr(refinado, "nit", maxiter_refinado_semana)),
        maxiter_refinado_semana,
        inicio_refinado_semana,
        loss=float(refinado.fun),
        extra="Etapa completada.",
    )

    x_mejor = refinado.x if refinado.fun <= resultado.fun else resultado.x
    metodo = "differential_evolution + L-BFGS-B"

except Exception as e:
    print("No se pudo usar scipy.optimize; usando busqueda aleatoria.", repr(e))

    rng = np.random.default_rng(SEED)
    mejor_loss = float("inf")
    x_mejor = None

    inicio_random_semana = time.time()
    for i in range(N_RANDOM_FALLBACK):
        x = np.array([rng.uniform(lo, hi) for lo, hi in bounds], dtype=float)
        loss = perdida_desde_x(x)

        if loss < mejor_loss:
            mejor_loss = loss
            x_mejor = x

        if (i + 1) == 1 or (i + 1) % 200 == 0 or (i + 1) == N_RANDOM_FALLBACK:
            mostrar_progreso_finetuning(
                "semanal / random_search",
                i + 1,
                N_RANDOM_FALLBACK,
                inicio_random_semana,
                loss=mejor_loss,
                extra="Fallback sin scipy.optimize.",
            )

    metodo = "random_search_" + str(N_RANDOM_FALLBACK)


mejores_params = decodificar(x_mejor)
aplicar_parametros(modelo_carga, mejores_params)

resumen_parametros = pd.DataFrame([{
    "metodo": metodo,
    "loss": perdida_desde_params(mejores_params),
    **mejores_params,
}])

resumen_finetuning = evaluar_parametros(mejores_params)

print("Mejores parametros encontrados:")
display(resumen_parametros)

print("Comparacion contra targets:")
display(
    resumen_finetuning
    .sort_values(["eco", "W_ueas_semana"])
    .style.format({
        "penalty_objetivo": "{:.3f}",
        "penalty_calculado": "{:.3f}",
        "error": "{:.3f}",
        "prob_hist_geq_W": "{:.6f}",
        "rareza": "{:.6f}",
        "lambda_ueas_semana": "{:.3f}",
    })
)

err = resumen_finetuning["error"].to_numpy(dtype=float)

print("MAE semanal:", float(np.mean(np.abs(err))))
print("RMSE semanal:", float(np.sqrt(np.mean(err ** 2))))
print("Max abs error semanal:", float(np.max(np.abs(err))))


# === Fine tuning de la senal de bloques historicos ===
# Estos targets calibran escala, no reemplazan la inferencia historica del modelo.
# Ajusta/agrega casos aqui cuando tengas validaciones humanas de acomodos concretos.
def _horario_triple(rango):
    return "L:" + rango + "|Mi:" + rango + "|V:" + rango


objetivos_bloques_finetuning = pd.DataFrame([
    {
        "descripcion": "28650: tercera UEA pegada, bloque 14:30-19:00",
        "eco": "28650",
        "horarios_asignados_actuales": [
            _horario_triple("14:30-16:00"),
            _horario_triple("16:00-17:30"),
        ],
        "ueas_asignadas_actuales": ["UEA_1430_1600", "UEA_1600_1730"],
        "horario_id": _horario_triple("17:30-19:00"),
        "uea_prediccion": "UEA_1730_1900",
        "penalty_objetivo": -0.78,
    },
    {
        "descripcion": "28650: tercera UEA con hueco 13:00-14:30",
        "eco": "28650",
        "horarios_asignados_actuales": [
            _horario_triple("14:30-16:00"),
            _horario_triple("16:00-17:30"),
        ],
        "ueas_asignadas_actuales": ["UEA_1430_1600", "UEA_1600_1730"],
        "horario_id": _horario_triple("11:30-13:00"),
        "uea_prediccion": "UEA_1130_1300",
        "penalty_objetivo": -0.53,
    },
    {
        "descripcion": "28650: segunda UEA respaldada en bloque",
        "eco": "28650",
        "horarios_asignados_actuales": [_horario_triple("14:30-16:00")],
        "ueas_asignadas_actuales": ["UEA_1430_1600"],
        "horario_id": _horario_triple("16:00-17:30"),
        "uea_prediccion": "UEA_1600_1730",
        "penalty_objetivo": 0.05,
    },
])


def decodificar_bloques(x):
    return {
        "lambda_diaria": float(x[0]),
        "lambda_bloques_historicos": float(x[1]),
        "lambda_horas_bloque_normal": float(math.exp(x[2])),
        "lambda_horas_bloque_laboratorio": float(math.exp(x[3])),
        "peso_rareza_horas_bloque_hist": float(math.exp(x[4])),
        "peso_rareza_ueas_bloque_hist": float(math.exp(x[5])),
        "peso_rareza_fragmentacion_bloques": float(math.exp(x[6])),
        "peso_rareza_huecos_bloques": float(math.exp(x[7])),
        "peso_rareza_patron_bloques": float(math.exp(x[8])),
        "premio_respaldo_bloques": float(x[9]),
        "premio_cap_bloques": float(x[10]),
        "exponente_rareza_bloques": float(math.exp(x[11])),
    }


bounds_bloques = [
    (0.20, 2.00),                      # lambda_diaria
    (0.75, PENALIZACION_MAXIMA),       # lambda_bloques_historicos
    (math.log(0.35), math.log(3.50)),  # lambda_horas_bloque_normal
    (math.log(0.05), math.log(1.25)),  # lambda_horas_bloque_laboratorio
    (math.log(0.05), math.log(8.0)),   # peso_rareza_horas_bloque_hist
    (math.log(0.05), math.log(8.0)),   # peso_rareza_ueas_bloque_hist
    (math.log(0.05), math.log(8.0)),   # peso_rareza_fragmentacion_bloques
    (math.log(0.05), math.log(8.0)),   # peso_rareza_huecos_bloques
    (math.log(0.01), math.log(4.0)),   # peso_rareza_patron_bloques
    (0.00, 0.25),                      # premio_respaldo_bloques
    (0.00, 0.25),                      # premio_cap_bloques
    (math.log(0.50), math.log(5.0)),   # exponente_rareza_bloques
]


def evaluar_bloques_parametros(params):
    aplicar_parametros(modelo_carga, params)

    rows = []
    for r in objetivos_bloques_finetuning.itertuples(index=False):
        pred = modelo_carga.predict_penalty(
            eco=str(r.eco),
            horario_id=r.horario_id,
            horarios_asignados_actuales=list(r.horarios_asignados_actuales),
            ueas_asignadas_actuales=list(r.ueas_asignadas_actuales),
            uea_prediccion=str(r.uea_prediccion),
        )

        rows.append({
            "descripcion": r.descripcion,
            "eco": str(r.eco),
            "penalty_objetivo": float(r.penalty_objetivo),
            "penalty_calculado": float(pred["penalty_total"]),
            "error": float(pred["penalty_total"] - r.penalty_objetivo),
            "penalty_semanal": float(pred["penalty_semanal"]),
            "penalty_bloques_historicos": float(pred["penalty_bloques_historicos"]),
            "bonus_bloques_historicos": float(pred["bonus_bloques_historicos"]),
            "respaldo_bloques_historicos": float(pred["respaldo_bloques_historicos"]),
            "factor_horas_bloque": float(pred["factor_horas_bloque"]),
            "score_laboratorio_bloque": float(pred["score_laboratorio_bloque"]),
            "L_horas_consecutivas": float(pred["features"]["L_horas_consecutivas"]),
            "max_horas_intervalo": float(pred["features"]["max_horas_intervalo"]),
            "B_ueas_en_bloque": int(pred["features"]["B_ueas_en_bloque"]),
            "max_bloques_dia": int(pred["features"]["max_bloques_dia"]),
            "total_gap_horas": float(pred["features"]["total_gap_horas"]),
        })

    return pd.DataFrame(rows)


def perdida_bloques_desde_params(params):
    df_eval = evaluar_bloques_parametros(params)
    err_b = df_eval["error"].to_numpy(dtype=float)

    rmse_b = float(np.sqrt(np.mean(err_b ** 2)))
    mae_b = float(np.mean(np.abs(err_b)))
    max_abs_b = float(np.max(np.abs(err_b)))

    reg = (
        0.004 * params["lambda_diaria"] ** 2
        + 0.010 * params["lambda_bloques_historicos"] ** 2
        + 0.006 * (params["lambda_horas_bloque_normal"] - 1.0) ** 2
        + 0.006 * (params["lambda_horas_bloque_laboratorio"] - 0.35) ** 2
        + 0.003 * params["peso_rareza_horas_bloque_hist"] ** 2
        + 0.003 * params["peso_rareza_ueas_bloque_hist"] ** 2
        + 0.003 * params["peso_rareza_fragmentacion_bloques"] ** 2
        + 0.003 * params["peso_rareza_huecos_bloques"] ** 2
        + 0.002 * params["peso_rareza_patron_bloques"] ** 2
        + 0.020 * params["premio_respaldo_bloques"] ** 2
        + 0.020 * params["premio_cap_bloques"] ** 2
        + 0.003 * (params["exponente_rareza_bloques"] - 1.0) ** 2
    )

    return rmse_b + 0.30 * mae_b + 0.10 * max_abs_b + reg


def perdida_bloques_desde_x(x):
    return perdida_bloques_desde_params(decodificar_bloques(x))


try:
    from scipy.optimize import differential_evolution, minimize

    maxiter_de_bloques = max(35, MAXITER_DE // 3)
    popsize_de_bloques = max(8, POPSIZE_DE // 2)
    inicio_de_bloques = time.time()
    resultado_bloques = differential_evolution(
        perdida_bloques_desde_x,
        bounds=bounds_bloques,
        seed=SEED,
        maxiter=maxiter_de_bloques,
        popsize=popsize_de_bloques,
        tol=1e-3,
        polish=False,
        workers=1,
        updating="immediate",
        callback=crear_callback_progreso(
            "bloques / differential_evolution",
            maxiter_de_bloques,
            inicio_de_bloques,
            loss_fn=perdida_bloques_desde_x,
        ),
    )
    mostrar_progreso_finetuning(
        "bloques / differential_evolution",
        maxiter_de_bloques,
        maxiter_de_bloques,
        inicio_de_bloques,
        loss=float(resultado_bloques.fun),
        extra="Etapa completada.",
    )

    maxiter_refinado_bloques = 250
    inicio_refinado_bloques = time.time()
    refinado_bloques = minimize(
        perdida_bloques_desde_x,
        resultado_bloques.x,
        method="L-BFGS-B",
        bounds=bounds_bloques,
        options={"maxiter": maxiter_refinado_bloques},
        callback=crear_callback_progreso(
            "bloques / L-BFGS-B",
            maxiter_refinado_bloques,
            inicio_refinado_bloques,
            loss_fn=perdida_bloques_desde_x,
        ),
    )
    mostrar_progreso_finetuning(
        "bloques / L-BFGS-B",
        int(getattr(refinado_bloques, "nit", maxiter_refinado_bloques)),
        maxiter_refinado_bloques,
        inicio_refinado_bloques,
        loss=float(refinado_bloques.fun),
        extra="Etapa completada.",
    )

    x_mejor_bloques = refinado_bloques.x if refinado_bloques.fun <= resultado_bloques.fun else resultado_bloques.x
    metodo_bloques = "differential_evolution + L-BFGS-B"

except Exception as e:
    print("No se pudo usar scipy.optimize para bloques; usando busqueda aleatoria.", repr(e))

    rng = np.random.default_rng(SEED + 1)
    mejor_loss_bloques = float("inf")
    x_mejor_bloques = None

    n_random_bloques = max(3000, N_RANDOM_FALLBACK // 3)
    inicio_random_bloques = time.time()
    for i in range(n_random_bloques):
        x = np.array([rng.uniform(lo, hi) for lo, hi in bounds_bloques], dtype=float)
        loss = perdida_bloques_desde_x(x)

        if loss < mejor_loss_bloques:
            mejor_loss_bloques = loss
            x_mejor_bloques = x

        if (i + 1) == 1 or (i + 1) % 100 == 0 or (i + 1) == n_random_bloques:
            mostrar_progreso_finetuning(
                "bloques / random_search",
                i + 1,
                n_random_bloques,
                inicio_random_bloques,
                loss=mejor_loss_bloques,
                extra="Fallback sin scipy.optimize.",
            )

    metodo_bloques = "random_search_bloques"


mejores_params_bloques = decodificar_bloques(x_mejor_bloques)
aplicar_parametros(modelo_carga, mejores_params_bloques)

resumen_parametros_bloques = pd.DataFrame([{
    "metodo": metodo_bloques,
    "loss": perdida_bloques_desde_params(mejores_params_bloques),
    **mejores_params_bloques,
}])

resumen_finetuning_bloques = evaluar_bloques_parametros(mejores_params_bloques)

print("Mejores parametros de bloques historicos:")
display(resumen_parametros_bloques)

print("Comparacion contra targets de bloques:")
display(
    resumen_finetuning_bloques
    .sort_values(["eco", "descripcion"])
    .style.format({
        "penalty_objetivo": "{:.3f}",
        "penalty_calculado": "{:.3f}",
        "error": "{:.3f}",
        "penalty_semanal": "{:.3f}",
        "penalty_bloques_historicos": "{:.3f}",
        "bonus_bloques_historicos": "{:.3f}",
        "respaldo_bloques_historicos": "{:.3f}",
        "factor_horas_bloque": "{:.3f}",
        "score_laboratorio_bloque": "{:.3f}",
        "L_horas_consecutivas": "{:.1f}",
        "max_horas_intervalo": "{:.1f}",
        "total_gap_horas": "{:.1f}",
    })
)


# === Refinamiento conjunto: semanal + bloques ===
PESO_FINE_TUNING_BLOQUES = max(
    1.0,
    len(objetivos_finetuning) / max(1, len(objetivos_bloques_finetuning)),
)


def codificar_semana(params):
    return np.array([
        params["lambda_semanal"],
        math.log(params["lambda_ueas_2"]),
        math.log(params["lambda_ueas_3"]),
        math.log(params["lambda_ueas_4"]),
        math.log(params["lambda_ueas_5"]),
        math.log(params["lambda_ueas_6_plus"]),
        math.log(params["peso_exceso_ueas_semana"]),
        math.log(params["exponente_rareza_ueas_totales"]),
        math.log(params["shrinkage_weight"]),
        params["individual_alpha_min"],
        params["individual_decay_power"],
        params["individual_floor_strength"],
        params["individual_recent_decay"],
        params["individual_extra_gap_max"],
        params["individual_extra_gap_recent"],
        params["individual_extra_stale"],
        math.log(params["individual_habit_strength"]),
        params["individual_habit_power"],
        params["habit_recent_weight"],
        params["habit_q_weight"],
        params["habit_max_weight"],
    ], dtype=float)


def codificar_bloques(params):
    return np.array([
        params["lambda_diaria"],
        params["lambda_bloques_historicos"],
        math.log(params["lambda_horas_bloque_normal"]),
        math.log(params["lambda_horas_bloque_laboratorio"]),
        math.log(params["peso_rareza_horas_bloque_hist"]),
        math.log(params["peso_rareza_ueas_bloque_hist"]),
        math.log(params["peso_rareza_fragmentacion_bloques"]),
        math.log(params["peso_rareza_huecos_bloques"]),
        math.log(params["peso_rareza_patron_bloques"]),
        params["premio_respaldo_bloques"],
        params["premio_cap_bloques"],
        math.log(params["exponente_rareza_bloques"]),
    ], dtype=float)


def decodificar_integrado(x):
    return {
        **decodificar(x[:len(bounds)]),
        **decodificar_bloques(x[len(bounds):]),
    }


bounds_integrados = bounds + bounds_bloques


def evaluar_integrado_parametros(params):
    aplicar_parametros(modelo_carga, params)
    df_semana = evaluar_parametros(params).assign(tipo_target="semanal")
    df_bloques = evaluar_bloques_parametros(params).assign(tipo_target="bloques")
    return df_semana, df_bloques


def metricas_integradas_desde_params(params):
    df_semana, df_bloques = evaluar_integrado_parametros(params)
    err_semana = df_semana["error"].to_numpy(dtype=float)
    err_bloques = df_bloques["error"].to_numpy(dtype=float)

    denom_integrado = len(err_semana) + PESO_FINE_TUNING_BLOQUES * len(err_bloques)
    err_general_sin_ponderar = np.concatenate([err_semana, err_bloques])
    rmse_integrado = math.sqrt(
        (
            float(np.sum(err_semana ** 2))
            + PESO_FINE_TUNING_BLOQUES * float(np.sum(err_bloques ** 2))
        ) / max(denom_integrado, EPS)
    )
    mae_integrado = (
        float(np.sum(np.abs(err_semana)))
        + PESO_FINE_TUNING_BLOQUES * float(np.sum(np.abs(err_bloques)))
    ) / max(denom_integrado, EPS)

    return {
        "rmse_modelo_general": float(rmse_integrado),
        "mae_modelo_general": float(mae_integrado),
        "rmse_modelo_general_sin_ponderar": float(np.sqrt(np.mean(err_general_sin_ponderar ** 2))),
        "mae_modelo_general_sin_ponderar": float(np.mean(np.abs(err_general_sin_ponderar))),
        "rmse_semanal": float(np.sqrt(np.mean(err_semana ** 2))),
        "mae_semanal": float(np.mean(np.abs(err_semana))),
        "rmse_bloques": float(np.sqrt(np.mean(err_bloques ** 2))),
        "mae_bloques": float(np.mean(np.abs(err_bloques))),
        "rmse_integrado": float(rmse_integrado),
        "mae_integrado": float(mae_integrado),
        "peso_targets_bloques": float(PESO_FINE_TUNING_BLOQUES),
    }


def perdida_integrada_desde_params(params):
    metricas = metricas_integradas_desde_params(params)
    reg_semana = (
        0.006 * (params["lambda_ueas_2"] - 1.0) ** 2
        + 0.006 * (params["lambda_ueas_3"] - 1.0) ** 2
        + 0.006 * (params["lambda_ueas_4"] - 1.0) ** 2
        + 0.006 * (params["lambda_ueas_5"] - 1.0) ** 2
        + 0.006 * (params["lambda_ueas_6_plus"] - 1.0) ** 2
    )
    reg_bloques = (
        0.003 * params["lambda_diaria"] ** 2
        + 0.006 * params["lambda_bloques_historicos"] ** 2
        + 0.004 * (params["lambda_horas_bloque_normal"] - 1.0) ** 2
        + 0.004 * (params["lambda_horas_bloque_laboratorio"] - 0.35) ** 2
        + 0.002 * params["peso_rareza_horas_bloque_hist"] ** 2
        + 0.002 * params["peso_rareza_ueas_bloque_hist"] ** 2
        + 0.002 * params["peso_rareza_fragmentacion_bloques"] ** 2
        + 0.002 * params["peso_rareza_huecos_bloques"] ** 2
        + 0.001 * params["peso_rareza_patron_bloques"] ** 2
        + 0.010 * params["premio_respaldo_bloques"] ** 2
        + 0.010 * params["premio_cap_bloques"] ** 2
    )
    return metricas["rmse_integrado"] + 0.15 * metricas["mae_integrado"] + reg_semana + reg_bloques


def perdida_integrada_desde_x(x):
    return perdida_integrada_desde_params(decodificar_integrado(x))


x_inicial_integrado = np.concatenate([
    codificar_semana(mejores_params),
    codificar_bloques(mejores_params_bloques),
])

try:
    from scipy.optimize import minimize

    maxiter_refinado_integrado = 450
    inicio_refinado_integrado = time.time()
    refinado_integrado = minimize(
        perdida_integrada_desde_x,
        x_inicial_integrado,
        method="L-BFGS-B",
        bounds=bounds_integrados,
        options={"maxiter": maxiter_refinado_integrado},
        callback=crear_callback_progreso(
            "integrado / L-BFGS-B",
            maxiter_refinado_integrado,
            inicio_refinado_integrado,
            loss_fn=perdida_integrada_desde_x,
        ),
    )
    mostrar_progreso_finetuning(
        "integrado / L-BFGS-B",
        int(getattr(refinado_integrado, "nit", maxiter_refinado_integrado)),
        maxiter_refinado_integrado,
        inicio_refinado_integrado,
        loss=float(refinado_integrado.fun),
        extra="Etapa completada.",
    )

    x_mejor_integrado = refinado_integrado.x if refinado_integrado.fun <= perdida_integrada_desde_x(x_inicial_integrado) else x_inicial_integrado
    metodo_integrado = "L-BFGS-B desde parametros semanales+bloques"

except Exception as e:
    print("No se pudo hacer refinamiento integrado; usando parametros previos.", repr(e))
    x_mejor_integrado = x_inicial_integrado
    metodo_integrado = "sin_refinamiento_integrado"


mejores_params_integrados = decodificar_integrado(x_mejor_integrado)
aplicar_parametros(modelo_carga, mejores_params_integrados)

resumen_finetuning_integrado_semana, resumen_finetuning_integrado_bloques = evaluar_integrado_parametros(mejores_params_integrados)
metricas_integradas = metricas_integradas_desde_params(mejores_params_integrados)

resumen_rmse_modelo_general = pd.DataFrame([{
    "rmse_modelo_general": metricas_integradas["rmse_modelo_general"],
    "mae_modelo_general": metricas_integradas["mae_modelo_general"],
    "rmse_modelo_general_sin_ponderar": metricas_integradas["rmse_modelo_general_sin_ponderar"],
    "mae_modelo_general_sin_ponderar": metricas_integradas["mae_modelo_general_sin_ponderar"],
    "rmse_semanal": metricas_integradas["rmse_semanal"],
    "rmse_bloques": metricas_integradas["rmse_bloques"],
    "peso_targets_bloques": metricas_integradas["peso_targets_bloques"],
}])

resumen_parametros_integrados = pd.DataFrame([{
    "metodo": metodo_integrado,
    "loss": perdida_integrada_desde_params(mejores_params_integrados),
    **metricas_integradas,
    **mejores_params_integrados,
}])

print("Metricas finales integradas:")
display(resumen_rmse_modelo_general)
display(resumen_parametros_integrados)

print("Comparacion final contra targets semanales:")
display(
    resumen_finetuning_integrado_semana
    .sort_values(["eco", "W_ueas_semana"])
    .style.format({
        "penalty_objetivo": "{:.3f}",
        "penalty_calculado": "{:.3f}",
        "error": "{:.3f}",
        "prob_hist_geq_W": "{:.6f}",
        "rareza": "{:.6f}",
        "lambda_ueas_semana": "{:.3f}",
    })
)

print("Comparacion final contra targets de bloques:")
display(
    resumen_finetuning_integrado_bloques
    .sort_values(["eco", "descripcion"])
    .style.format({
        "penalty_objetivo": "{:.3f}",
        "penalty_calculado": "{:.3f}",
        "error": "{:.3f}",
        "penalty_semanal": "{:.3f}",
        "penalty_bloques_historicos": "{:.3f}",
        "bonus_bloques_historicos": "{:.3f}",
        "respaldo_bloques_historicos": "{:.3f}",
        "factor_horas_bloque": "{:.3f}",
        "score_laboratorio_bloque": "{:.3f}",
        "L_horas_consecutivas": "{:.1f}",
        "max_horas_intervalo": "{:.1f}",
        "total_gap_horas": "{:.1f}",
    })
)

def diagnosticar_carga(eco):
    modelo_carga._ensure_weekly_tail_caches()
    c = modelo_carga._weekly_tail_cache_[str(eco)]

    rows = []
    for W in [2, 3, 4, 5]:
        rareza, prob = modelo_carga._rareza_ueas_totales(str(eco), W)
        costo = 1.0 - math.exp(-modelo_carga.peso_exceso_ueas_semana * rareza)
        penalty = -min(2.0, modelo_carga.lambda_semanal * costo)

        rows.append({
            "eco": str(eco),
            "W": W,
            "recent_value": c["recent_value"],
            "max_value": c["max_value"],
            "prob": prob,
            "rareza": rareza,
            "penalty": penalty,
        })

    return pd.DataFrame(rows)

display(pd.concat([
    diagnosticar_carga("14416"),
    diagnosticar_carga("28650"),
    diagnosticar_carga("4377"),
    diagnosticar_carga("37492"),
    diagnosticar_carga("19834"),
    diagnosticar_carga("41339"),
]))

eco_prediccion = "28650"

horario_1 = "14:30-16:00"
horario_2 = "16:00-17:30"
horario_3 = "17:30-19:00"
horario_3_separado = "11:30-13:00"

horario_id_1 = "L:" + horario_1 + "|Mi:" + horario_1 + "|V:" + horario_1
horario_id_2 = "L:" + horario_2 + "|Mi:" + horario_2 + "|V:" + horario_2
horario_id_3 = "L:" + horario_3 + "|Mi:" + horario_3 + "|V:" + horario_3
horario_id_3_separado = "L:" + horario_3_separado + "|Mi:" + horario_3_separado + "|V:" + horario_3_separado

# Caso A: intentar asignar la primera UEA
pred_1_uea = modelo_carga.predict_penalty(
    eco=eco_prediccion,
    horario_id=horario_id_1,
    horarios_asignados_actuales=[],
    ueas_asignadas_actuales=[],
    uea_prediccion="UEA_1430_1600",
)

# Caso B: ya tiene 1 UEA, intentar asignar la segunda
pred_2_ueas = modelo_carga.predict_penalty(
    eco=eco_prediccion,
    horario_id=horario_id_2,
    horarios_asignados_actuales=[
        horario_id_1,
    ],
    ueas_asignadas_actuales=[
        "UEA_1430_1600",
    ],
    uea_prediccion="UEA_1600_1730",
)

# Caso C: ya tiene 2 UEAs, intentar asignar la tercera
pred_3_ueas = modelo_carga.predict_penalty(
    eco=eco_prediccion,
    horario_id=horario_id_3,
    horarios_asignados_actuales=[
        horario_id_1,
        horario_id_2,
    ],
    ueas_asignadas_actuales=[
        "UEA_1430_1600",
        "UEA_1600_1730",
    ],
    uea_prediccion="UEA_1730_1900",
)

print("=== 1 UEA ===")
display(pred_1_uea)

print("=== 2 UEAs ===")
display(pred_2_ueas)

print("=== 3 UEAs ===")
display(pred_3_ueas)

resumen = pd.DataFrame([
    {
        "caso": "1 UEA",
        "penalty_total": pred_1_uea["penalty_total"],
        "penalty_diaria": pred_1_uea["penalty_diaria"],
        "penalty_ueas_totales": pred_1_uea["penalty_semanal"],
        "lambda_ueas_semana": pred_1_uea["lambda_ueas_semana"],
        "penalty_bloques_historicos": pred_1_uea["penalty_bloques_historicos"],
        "bonus_bloques_historicos": pred_1_uea["bonus_bloques_historicos"],
        "factor_horas_bloque": pred_1_uea["factor_horas_bloque"],
        "score_laboratorio_bloque": pred_1_uea["score_laboratorio_bloque"],
        "L_horas_consecutivas": pred_1_uea["features"]["L_horas_consecutivas"],
        "max_horas_intervalo": pred_1_uea["features"]["max_horas_intervalo"],
        "B_ueas_en_bloque": pred_1_uea["features"]["B_ueas_en_bloque"],
        "W_ueas_totales": pred_1_uea["features"]["W_ueas_semana"],
        "max_bloques_dia": pred_1_uea["features"]["max_bloques_dia"],
        "total_gap_horas": pred_1_uea["features"]["total_gap_horas"],
        "prob_hist_geq_W": pred_1_uea.get("prob_hist_ueas_totales_geq_W"),
        "rareza_ueas_totales": pred_1_uea.get("rareza_ueas_totales"),
        "rareza_bloques_historicos": pred_1_uea.get("rareza_bloques_historicos"),
        "respaldo_bloques_historicos": pred_1_uea.get("respaldo_bloques_historicos"),
    },
    {
        "caso": "2 UEAs",
        "penalty_total": pred_2_ueas["penalty_total"],
        "penalty_diaria": pred_2_ueas["penalty_diaria"],
        "penalty_ueas_totales": pred_2_ueas["penalty_semanal"],
        "lambda_ueas_semana": pred_2_ueas["lambda_ueas_semana"],
        "penalty_bloques_historicos": pred_2_ueas["penalty_bloques_historicos"],
        "bonus_bloques_historicos": pred_2_ueas["bonus_bloques_historicos"],
        "factor_horas_bloque": pred_2_ueas["factor_horas_bloque"],
        "score_laboratorio_bloque": pred_2_ueas["score_laboratorio_bloque"],
        "L_horas_consecutivas": pred_2_ueas["features"]["L_horas_consecutivas"],
        "max_horas_intervalo": pred_2_ueas["features"]["max_horas_intervalo"],
        "B_ueas_en_bloque": pred_2_ueas["features"]["B_ueas_en_bloque"],
        "W_ueas_totales": pred_2_ueas["features"]["W_ueas_semana"],
        "max_bloques_dia": pred_2_ueas["features"]["max_bloques_dia"],
        "total_gap_horas": pred_2_ueas["features"]["total_gap_horas"],
        "prob_hist_geq_W": pred_2_ueas.get("prob_hist_ueas_totales_geq_W"),
        "rareza_ueas_totales": pred_2_ueas.get("rareza_ueas_totales"),
        "rareza_bloques_historicos": pred_2_ueas.get("rareza_bloques_historicos"),
        "respaldo_bloques_historicos": pred_2_ueas.get("respaldo_bloques_historicos"),
    },
    {
        "caso": "3 UEAs",
        "penalty_total": pred_3_ueas["penalty_total"],
        "penalty_diaria": pred_3_ueas["penalty_diaria"],
        "penalty_ueas_totales": pred_3_ueas["penalty_semanal"],
        "lambda_ueas_semana": pred_3_ueas["lambda_ueas_semana"],
        "penalty_bloques_historicos": pred_3_ueas["penalty_bloques_historicos"],
        "bonus_bloques_historicos": pred_3_ueas["bonus_bloques_historicos"],
        "factor_horas_bloque": pred_3_ueas["factor_horas_bloque"],
        "score_laboratorio_bloque": pred_3_ueas["score_laboratorio_bloque"],
        "L_horas_consecutivas": pred_3_ueas["features"]["L_horas_consecutivas"],
        "max_horas_intervalo": pred_3_ueas["features"]["max_horas_intervalo"],
        "B_ueas_en_bloque": pred_3_ueas["features"]["B_ueas_en_bloque"],
        "W_ueas_totales": pred_3_ueas["features"]["W_ueas_semana"],
        "max_bloques_dia": pred_3_ueas["features"]["max_bloques_dia"],
        "total_gap_horas": pred_3_ueas["features"]["total_gap_horas"],
        "prob_hist_geq_W": pred_3_ueas.get("prob_hist_ueas_totales_geq_W"),
        "rareza_ueas_totales": pred_3_ueas.get("rareza_ueas_totales"),
        "rareza_bloques_historicos": pred_3_ueas.get("rareza_bloques_historicos"),
        "respaldo_bloques_historicos": pred_3_ueas.get("respaldo_bloques_historicos"),
    },
])

display(resumen)

# Comparativo directo: tercera UEA pegada vs tercera UEA con hueco.
pred_3_ueas_separada = modelo_carga.predict_penalty(
    eco=eco_prediccion,
    horario_id=horario_id_3_separado,
    horarios_asignados_actuales=[
        horario_id_1,
        horario_id_2,
    ],
    ueas_asignadas_actuales=[
        "UEA_1430_1600",
        "UEA_1600_1730",
    ],
    uea_prediccion="UEA_1130_1300",
)

comparativo_tercera = pd.DataFrame([
    {
        "caso": "3 UEAs bloque continuo",
        "penalty_total": pred_3_ueas["penalty_total"],
        "penalty_semanal": pred_3_ueas["penalty_semanal"],
        "lambda_ueas_semana": pred_3_ueas["lambda_ueas_semana"],
        "penalty_bloques_historicos": pred_3_ueas["penalty_bloques_historicos"],
        "bonus_bloques_historicos": pred_3_ueas["bonus_bloques_historicos"],
        "factor_horas_bloque": pred_3_ueas["factor_horas_bloque"],
        "score_laboratorio_bloque": pred_3_ueas["score_laboratorio_bloque"],
        "L_horas_consecutivas": pred_3_ueas["features"]["L_horas_consecutivas"],
        "max_horas_intervalo": pred_3_ueas["features"]["max_horas_intervalo"],
        "B_ueas_en_bloque": pred_3_ueas["features"]["B_ueas_en_bloque"],
        "max_bloques_dia": pred_3_ueas["features"]["max_bloques_dia"],
        "total_gap_horas": pred_3_ueas["features"]["total_gap_horas"],
        "respaldo_bloques_historicos": pred_3_ueas["respaldo_bloques_historicos"],
        "firma_bloques": pred_3_ueas["features"]["firma_bloques"],
    },
    {
        "caso": "3 UEAs con hueco",
        "penalty_total": pred_3_ueas_separada["penalty_total"],
        "penalty_semanal": pred_3_ueas_separada["penalty_semanal"],
        "lambda_ueas_semana": pred_3_ueas_separada["lambda_ueas_semana"],
        "penalty_bloques_historicos": pred_3_ueas_separada["penalty_bloques_historicos"],
        "bonus_bloques_historicos": pred_3_ueas_separada["bonus_bloques_historicos"],
        "factor_horas_bloque": pred_3_ueas_separada["factor_horas_bloque"],
        "score_laboratorio_bloque": pred_3_ueas_separada["score_laboratorio_bloque"],
        "L_horas_consecutivas": pred_3_ueas_separada["features"]["L_horas_consecutivas"],
        "max_horas_intervalo": pred_3_ueas_separada["features"]["max_horas_intervalo"],
        "B_ueas_en_bloque": pred_3_ueas_separada["features"]["B_ueas_en_bloque"],
        "max_bloques_dia": pred_3_ueas_separada["features"]["max_bloques_dia"],
        "total_gap_horas": pred_3_ueas_separada["features"]["total_gap_horas"],
        "respaldo_bloques_historicos": pred_3_ueas_separada["respaldo_bloques_historicos"],
        "firma_bloques": pred_3_ueas_separada["features"]["firma_bloques"],
    },
])

display(comparativo_tercera)



ruta_joblib = OUTPUT_DIR / "modelo_penalizacion_carga_historica_gpu_local.joblib"
if joblib is not None:
    joblib.dump(modelo_carga, ruta_joblib)
else:
    ruta_joblib = OUTPUT_DIR / "modelo_penalizacion_carga_historica_gpu_local.pkl"
    with open(ruta_joblib, "wb") as f:
        pickle.dump(modelo_carga, f)
print("\nModelo guardado en:", ruta_joblib)

resumen_parametros_integrados_path = OUTPUT_DIR / "resumen_parametros_integrados.csv"
resumen_rmse_modelo_general_path = OUTPUT_DIR / "resumen_rmse_modelo_general.csv"
perfiles_path = OUTPUT_DIR / "perfiles_carga_historica_gpu_local.csv"

try:
    resumen_parametros_integrados.to_csv(resumen_parametros_integrados_path, index=False)
    resumen_rmse_modelo_general.to_csv(resumen_rmse_modelo_general_path, index=False)
    perfiles_df.to_csv(perfiles_path, index=False)
    print("Resumen parametros:", resumen_parametros_integrados_path)
    print("Resumen RMSE:", resumen_rmse_modelo_general_path)
    print("Perfiles:", perfiles_path)
except Exception as exc:
    print("No se pudieron guardar todos los CSV de resumen:", repr(exc))
