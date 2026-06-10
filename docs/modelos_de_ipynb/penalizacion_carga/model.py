"""
Modelo de Penalización de Carga Histórica.

Versión refactorizada: todos los parámetros en __init__, sin monkey-patching,
con serialización completa vía to_dict() / from_dict().
"""

from __future__ import annotations

import math
import copy
from typing import Any, Dict, List, Optional, Tuple
from collections import Counter, defaultdict

import numpy as np
import pandas as pd

from penalizacion_carga.features import (
    EPS,
    DIA_COLS,
    weighted_quantile,
    parse_horario_id,
    construir_bloques,
    resumen_bloques_semana,
    firma_bloques_semana,
    firma_bloques_desde_bloques,
    Intervalo,
)


# ============================================================================
# Configuración de parámetros — un solo lugar, documentado
# ============================================================================

class ModelParams:
    """
    Contenedor inmutable-style de todos los parámetros del modelo.

    Se puede construir desde kwargs, dict o archivo YAML/JSON.
    Usa dataclass-like interface pero con validación.
    """

    __slots__ = (
        # ── Decaimiento temporal ──
        "half_life_trimestres",
        # ── Tolerancia global ──
        "q_tolerancia",
        "shrinkage_weight",
        # ── Cotas de saturación ──
        "horas_cap",
        "ueas_bloque_cap",
        "ueas_semana_cap",
        # ── Escalado global de penalización ──
        "lambda_semanal",
        "lambda_diaria",
        "lambda_bloques_historicos",
        # ── Pesos de componentes de exceso ──
        "peso_exceso_horas_dia",
        "peso_exceso_ueas_bloque",
        "peso_exceso_ueas_semana",
        # ── Multiplicadores por cardinalidad de UEA ──
        "lambda_ueas",
        # ── Factor horas-bloque (laboratorio vs normal) ──
        "lambda_horas_bloque_normal",
        "lambda_horas_bloque_laboratorio",
        "umbral_horas_laboratorio",
        "cap_horas_laboratorio",
        # ── Pesos de rareza de bloques históricos ──
        "peso_rareza_horas_bloque_hist",
        "peso_rareza_ueas_bloque_hist",
        "peso_rareza_fragmentacion_bloques",
        "peso_rareza_huecos_bloques",
        "peso_rareza_patron_bloques",
        "exponente_rareza_bloques",
        # ── Bonus por patrón respaldado ──
        "premio_respaldo_bloques",
        "premio_cap_bloques",
        "umbral_respaldo_bonus_bloques",
        "umbral_cost_bonus_bloques",
        "max_ueas_bonus_bloques",
        # ── Extrapolación individual ──
        "individual_alpha_min",
        "individual_decay_power",
        "individual_floor_strength",
        "individual_recent_decay",
        "individual_extra_gap_max",
        "individual_extra_gap_recent",
        "individual_extra_stale",
        # ── Hábito individual ──
        "individual_habit_strength",
        "individual_habit_power",
        "habit_recent_weight",
        "habit_q_weight",
        "habit_max_weight",
        # ── Penalización base ──
        "penalizacion_base",
        "exponente_rareza_ueas_totales",
    )

    def __init__(
        self,
        *,
        half_life_trimestres: float = 4.0,
        q_tolerancia: float = 0.90,
        shrinkage_weight: float = 3.0,
        horas_cap: float = 6.0,
        ueas_bloque_cap: float = 4.0,
        ueas_semana_cap: float = 6.0,
        lambda_semanal: float = 2.0,
        lambda_diaria: float = 2.0,
        lambda_bloques_historicos: float = 0.90,
        peso_exceso_horas_dia: float = 1.5,
        peso_exceso_ueas_bloque: float = 1.2,
        peso_exceso_ueas_semana: float = 1.5,
        lambda_ueas: Tuple[float, float, float, float, float] = (
            1.0, 1.0, 1.0, 1.0, 1.0,
        ),
        lambda_horas_bloque_normal: float = 1.0,
        lambda_horas_bloque_laboratorio: float = 0.35,
        umbral_horas_laboratorio: float = 2.25,
        cap_horas_laboratorio: float = 3.0,
        peso_rareza_horas_bloque_hist: float = 1.60,
        peso_rareza_ueas_bloque_hist: float = 0.90,
        peso_rareza_fragmentacion_bloques: float = 0.80,
        peso_rareza_huecos_bloques: float = 0.55,
        peso_rareza_patron_bloques: float = 0.35,
        exponente_rareza_bloques: float = 1.40,
        premio_respaldo_bloques: float = 0.12,
        premio_cap_bloques: float = 0.12,
        umbral_respaldo_bonus_bloques: float = 0.50,
        umbral_cost_bonus_bloques: float = 0.25,
        max_ueas_bonus_bloques: float = 2.0,
        individual_alpha_min: float = 0.05,
        individual_decay_power: float = 1.0,
        individual_floor_strength: float = 0.0,
        individual_recent_decay: float = 1.0,
        individual_extra_gap_max: float = 1.0,
        individual_extra_gap_recent: float = 0.20,
        individual_extra_stale: float = 0.0,
        individual_habit_strength: float = 0.0,
        individual_habit_power: float = 1.0,
        habit_recent_weight: float = 0.80,
        habit_q_weight: float = 0.40,
        habit_max_weight: float = 0.15,
        penalizacion_base: float = 0.0,
        exponente_rareza_ueas_totales: float = 2.0,
    ) -> None:
        self.half_life_trimestres = float(half_life_trimestres)
        self.q_tolerancia = float(q_tolerancia)
        self.shrinkage_weight = float(shrinkage_weight)
        self.horas_cap = float(horas_cap)
        self.ueas_bloque_cap = float(ueas_bloque_cap)
        self.ueas_semana_cap = float(ueas_semana_cap)
        self.lambda_semanal = float(lambda_semanal)
        self.lambda_diaria = float(lambda_diaria)
        self.lambda_bloques_historicos = float(lambda_bloques_historicos)
        self.peso_exceso_horas_dia = float(peso_exceso_horas_dia)
        self.peso_exceso_ueas_bloque = float(peso_exceso_ueas_bloque)
        self.peso_exceso_ueas_semana = float(peso_exceso_ueas_semana)
        self.lambda_ueas = tuple(float(v) for v in lambda_ueas)
        self.lambda_horas_bloque_normal = float(lambda_horas_bloque_normal)
        self.lambda_horas_bloque_laboratorio = float(lambda_horas_bloque_laboratorio)
        self.umbral_horas_laboratorio = float(umbral_horas_laboratorio)
        self.cap_horas_laboratorio = float(cap_horas_laboratorio)
        self.peso_rareza_horas_bloque_hist = float(peso_rareza_horas_bloque_hist)
        self.peso_rareza_ueas_bloque_hist = float(peso_rareza_ueas_bloque_hist)
        self.peso_rareza_fragmentacion_bloques = float(peso_rareza_fragmentacion_bloques)
        self.peso_rareza_huecos_bloques = float(peso_rareza_huecos_bloques)
        self.peso_rareza_patron_bloques = float(peso_rareza_patron_bloques)
        self.exponente_rareza_bloques = float(exponente_rareza_bloques)
        self.premio_respaldo_bloques = float(premio_respaldo_bloques)
        self.premio_cap_bloques = float(premio_cap_bloques)
        self.umbral_respaldo_bonus_bloques = float(umbral_respaldo_bonus_bloques)
        self.umbral_cost_bonus_bloques = float(umbral_cost_bonus_bloques)
        self.max_ueas_bonus_bloques = float(max_ueas_bonus_bloques)
        self.individual_alpha_min = float(individual_alpha_min)
        self.individual_decay_power = float(individual_decay_power)
        self.individual_floor_strength = float(individual_floor_strength)
        self.individual_recent_decay = float(individual_recent_decay)
        self.individual_extra_gap_max = float(individual_extra_gap_max)
        self.individual_extra_gap_recent = float(individual_extra_gap_recent)
        self.individual_extra_stale = float(individual_extra_stale)
        self.individual_habit_strength = float(individual_habit_strength)
        self.individual_habit_power = float(individual_habit_power)
        self.habit_recent_weight = float(habit_recent_weight)
        self.habit_q_weight = float(habit_q_weight)
        self.habit_max_weight = float(habit_max_weight)
        self.penalizacion_base = float(penalizacion_base)
        self.exponente_rareza_ueas_totales = float(exponente_rareza_ueas_totales)

    def to_dict(self) -> Dict[str, Any]:
        """Serializa todos los parámetros a diccionario."""
        d: Dict[str, Any] = {}
        for slot in self.__slots__:
            val = getattr(self, slot)
            d[slot] = list(val) if isinstance(val, tuple) else val
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ModelParams":
        """Reconstruye desde diccionario."""
        kwargs: Dict[str, Any] = {}
        for slot in cls.__slots__:
            if slot in data:
                val = data[slot]
                if slot == "lambda_ueas" and isinstance(val, list):
                    val = tuple(val)
                kwargs[slot] = val
        return cls(**kwargs)

    def clone(self) -> "ModelParams":
        """Copia profunda."""
        return ModelParams.from_dict(self.to_dict())


# ============================================================================
# Modelo principal
# ============================================================================

class PenalizacionCargaHistoricaModel:
    """
    Modelo de penalización por carga histórica.

    Predice qué tan atípica (y por tanto potencialmente rechazable) es una
    asignación de UEA para un profesor (eco), basándose exclusivamente en
    su histórico de carga y en el comportamiento global de todos los ecos.

    Uso:
        model = PenalizacionCargaHistoricaModel(params=ModelParams(...))
        model.fit(df_historico, eco_nombres)
        result = model.predict_penalty(eco="14416", horario_id="L:07:00-08:30", ...)
    """

    # ------------------------------------------------------------------
    # Constructor
    # ------------------------------------------------------------------

    def __init__(self, params: Optional[ModelParams] = None, **kwargs: Any) -> None:
        """
        params: instancia de ModelParams. Si es None, usa defaults.
        kwargs: overrides individuales (ej. half_life_trimestres=3.0).
        """
        if params is None:
            params = ModelParams(**kwargs)
        elif kwargs:
            d = params.to_dict()
            d.update(kwargs)
            params = ModelParams(**d)
        self.params = params

        # ── Estado aprendido en fit() ──
        self.eco_nombres_: Dict[str, str] = {}
        self.tri_actual_: int = 0
        self.eco_perfiles_: Dict[str, dict] = {}
        self.global_profile_: dict = {}

        # Cachés de colas semanales
        self._weekly_tail_cache_: Dict[str, Any] = {}
        self._global_weekly_tail_cache_: Any = None
        self._weekly_records_: Dict[str, List[dict]] = {}
        self._global_weekly_records_: List[dict] = []

        # Cachés de patrones de bloques
        self._block_shape_records_: Dict[str, List[dict]] = {}
        self._global_block_shape_records_: List[dict] = []
        self._block_pattern_weights_: Dict[str, Dict[str, float]] = {}
        self._global_block_pattern_weights_: Dict[str, float] = {}

        # Cachés de hábitos individuales
        self._habit_cache_: Dict[str, float] = {}

    # ------------------------------------------------------------------
    # fit()
    # ------------------------------------------------------------------

    def fit(
        self,
        df: pd.DataFrame,
        eco_nombres: Optional[Dict[str, str]] = None,
        tri_actual: Optional[int] = None,
    ) -> "PenalizacionCargaHistoricaModel":
        """
        Ajusta el modelo sobre el histórico de asignaciones.

        Args:
            df: DataFrame con columnas [eco, uea, tri_num, lunes_i, lunes_f, ...]
            eco_nombres: mapeo eco → nombre del profesor (opcional)
            tri_actual: número del trimestre más reciente
        """
        from penalizacion_carga.features import intervalos_desde_df, normalizar_eco_nombre

        if tri_actual is None:
            tri_actual = int(df["tri_num"].max())
        self.tri_actual_ = tri_actual

        if eco_nombres is not None:
            self.eco_nombres_ = normalizar_eco_nombre(eco_nombres)

        # Convertir a intervalos
        df_int = intervalos_desde_df(df)

        # Pesos temporales por trimestre
        pesos_tri = self._build_tri_weights(df["tri_num"].unique())

        # ── Perfiles por eco ──
        self.eco_perfiles_ = {}
        ecos = sorted(df_int["eco"].unique())

        for eco in ecos:
            df_eco = df_int[df_int["eco"] == eco].copy()
            self.eco_perfiles_[eco] = self._build_eco_profile(df_eco, pesos_tri)

        # ── Perfil global ──
        self.global_profile_ = self._build_global_profile(df_int, pesos_tri)

        # ── Registros semanales ──
        self._build_weekly_caches(df)

        # ── Registros de bloques ──
        self._build_block_caches(df)

        # ── Registros de hábitos ──
        self._build_habit_caches(df)

        return self

    # ------------------------------------------------------------------
    # predict_penalty() — la interfaz principal
    # ------------------------------------------------------------------

    def predict_penalty(
        self,
        eco: str,
        horario_id: str,
        horarios_asignados_actuales: Optional[List[str]] = None,
        ueas_asignadas_actuales: Optional[List[str]] = None,
        uea_prediccion: str = "__PRED__",
    ) -> dict:
        """
        Predice la penalización de asignar una UEA con horario_id a un eco.

        Args:
            eco: identificador del profesor
            horario_id: horario de la UEA a evaluar (formato 'L:07:00-08:30')
            horarios_asignados_actuales: otros horarios ya asignados al eco
            ueas_asignadas_actuales: UEA ya asignadas al eco
            uea_prediccion: identificador de la UEA being predicted

        Returns:
            dict con penalty_total, penalty_semanal, penalty_bloques_historicos,
            bonus_bloques_historicos, respaldo_bloques_historicos, features, ...
        """
        p = self.params

        if horarios_asignados_actuales is None:
            horarios_asignados_actuales = []
        if ueas_asignadas_actuales is None:
            ueas_asignadas_actuales = []

        # Parsear todos los intervalos (asignados + predicción)
        intervalos: List[Intervalo] = []
        for hid in horarios_asignados_actuales:
            intervalos.extend(parse_horario_id(hid, uea="__ASIG__"))
        intervalos.extend(parse_horario_id(horario_id, uea=uea_prediccion))

        total_ueas = len(ueas_asignadas_actuales) + 1  # +1 por la predicción

        # ── Penalización semanal ──
        penalty_semanal, features_semanal = self._evaluar_semanal(
            eco, intervalos, total_ueas
        )

        # ── Penalización diaria ──
        penalty_diaria, features_diaria = self._evaluar_diaria(eco, intervalos)

        # ── Penalización de bloques históricos ──
        (
            penalty_bloques,
            bonus_bloques,
            respaldo_bloques,
            features_bloques,
        ) = self._evaluar_bloques_historicos(eco, intervalos)

        # ── Combinación ──
        total_cost = (
            penalty_semanal
            + penalty_diaria
            + penalty_bloques
            - bonus_bloques  # bonus reduce la penalización
            - respaldo_bloques  # respaldo también reduce
            + p.penalizacion_base
        )

        features = {**features_semanal, **features_diaria, **features_bloques}

        return {
            "penalty_total": -float(total_cost),
            "penalty_semanal": -float(penalty_semanal),
            "penalty_diaria": -float(penalty_diaria),
            "penalty_bloques_historicos": -float(penalty_bloques),
            "bonus_bloques_historicos": float(bonus_bloques),
            "respaldo_bloques_historicos": float(respaldo_bloques),
            "factor_horas_bloque": float(
                features_bloques.get("factor_horas_bloque", 1.0)
            ),
            "score_laboratorio_bloque": float(
                features_bloques.get("score_laboratorio_bloque", 0.0)
            ),
            "features": features,
        }

    # ------------------------------------------------------------------
    # Evaluadores internos
    # ------------------------------------------------------------------

    def _evaluar_semanal(
        self, eco: str, intervalos: List[Intervalo], total_ueas: int
    ) -> Tuple[float, dict]:
        """Evalúa penalización semanal basada en rareza de UEA totales."""
        p = self.params

        resumen = resumen_bloques_semana(intervalos)
        n_bloques = resumen["n_bloques_semana"]
        max_horas = resumen["max_horas_consecutivas"]
        dias = resumen["dias_con_clase"]

        # Rareza de UEA totales (usa versión unificada)
        rareza_w = self._rareza_ueas_totales(eco, total_ueas)

        # Multiplicador por cardinalidad
        idx_ueas = min(total_ueas, len(p.lambda_ueas) + 1) - 2  # 0-based desde 2
        if idx_ueas < 0:
            idx_ueas = 0
        if idx_ueas >= len(p.lambda_ueas):
            idx_ueas = len(p.lambda_ueas) - 1
        mult_ueas = p.lambda_ueas[idx_ueas]

        penalty = (
            p.lambda_semanal
            * (rareza_w ** p.exponente_rareza_ueas_totales)
            * mult_ueas
        )

        features = {
            "W_ueas_totales": total_ueas,
            "S_rareza_ueas": rareza_w,
            "S_n_bloques": n_bloques,
            "S_max_horas": max_horas,
            "S_dias": dias,
        }
        return penalty, features

    def _evaluar_diaria(
        self, eco: str, intervalos: List[Intervalo]
    ) -> Tuple[float, dict]:
        """Evalúa penalización diaria por exceso de horas y UEA en bloques."""
        p = self.params

        resumen = resumen_bloques_semana(intervalos)
        max_horas = resumen["max_horas_consecutivas"]
        max_ueas_bloque = resumen["max_ueas_bloque"]

        perfil = self.eco_perfiles_.get(eco, self.global_profile_)

        # Exceso de horas en bloque
        q_horas = perfil.get("q_horas_dia", 3.0)
        exceso_horas = max(0.0, max_horas - q_horas) / max(p.horas_cap - q_horas, EPS)
        exceso_horas = float(np.clip(exceso_horas, 0.0, 1.0))

        # Exceso de UEA en bloque
        q_ueas_bloque = perfil.get("q_ueas_bloque", 2.0)
        exceso_ueas = max(0.0, max_ueas_bloque - q_ueas_bloque) / max(
            p.ueas_bloque_cap - q_ueas_bloque, EPS
        )
        exceso_ueas = float(np.clip(exceso_ueas, 0.0, 1.0))

        penalty = (
            p.lambda_diaria
            * (
                p.peso_exceso_horas_dia * exceso_horas
                + p.peso_exceso_ueas_bloque * exceso_ueas
            )
            / (p.peso_exceso_horas_dia + p.peso_exceso_ueas_bloque)
        )

        features = {
            "L_horas_consecutivas": max_horas,
            "max_horas_intervalo": max_horas,
            "B_ueas_en_bloque": max_ueas_bloque,
            "max_bloques_dia": resumen["max_bloques_dia"],
            "total_gap_horas": resumen["total_gap_horas"],
            "D_exceso_horas": exceso_horas,
            "D_exceso_ueas": exceso_ueas,
        }
        return penalty, features

    def _evaluar_bloques_historicos(
        self, eco: str, intervalos: List[Intervalo]
    ) -> Tuple[float, float, float, dict]:
        """
        Evalúa qué tan atípicos son los bloques resultantes respecto al
        histórico de patrones del eco.
        """
        p = self.params

        bloques = construir_bloques(intervalos)
        if not bloques:
            return 0.0, 0.0, 0.0, {
                "factor_horas_bloque": 1.0,
                "score_laboratorio_bloque": 0.0,
            }

        eco_records = self._block_shape_records_.get(eco, [])
        global_records = self._global_block_shape_records_

        # Factor de horas-bloque (laboratorio vs normal)
        max_factor = 1.0
        max_score_lab = 0.0
        for b in bloques:
            factor, score_lab = self._factor_horas_bloque(b["horas"])
            if factor > max_factor:
                max_factor = factor
            if score_lab > max_score_lab:
                max_score_lab = score_lab

        # Rareza de horas de bloque
        rareza_horas = self._rareza_bloque_horas(eco, bloques, eco_records, global_records)

        # Rareza de UEA por bloque
        rareza_ueas = self._rareza_bloque_ueas(eco, bloques, eco_records, global_records)

        # Rareza de fragmentación
        fragmentacion = len(bloques)
        rareza_frag = self._rareza_bloque_fragmentacion(
            eco, fragmentacion, eco_records, global_records
        )

        # Rareza de huecos
        resumen = resumen_bloques_semana(intervalos)
        total_gap = resumen["total_gap_horas"]
        rareza_gaps = self._rareza_bloque_gaps(
            eco, total_gap, eco_records, global_records
        )

        # Rareza de patrón
        firma = firma_bloques_desde_bloques(bloques)
        rareza_patron = self._rareza_patron_bloque(eco, firma)

        # Combinación de rarezas con pesos
        rareza_combinada = (
            p.peso_rareza_horas_bloque_hist * rareza_horas
            + p.peso_rareza_ueas_bloque_hist * rareza_ueas
            + p.peso_rareza_fragmentacion_bloques * rareza_frag
            + p.peso_rareza_huecos_bloques * rareza_gaps
            + p.peso_rareza_patron_bloques * rareza_patron
        ) / max(
            p.peso_rareza_horas_bloque_hist
            + p.peso_rareza_ueas_bloque_hist
            + p.peso_rareza_fragmentacion_bloques
            + p.peso_rareza_huecos_bloques
            + p.peso_rareza_patron_bloques,
            EPS,
        )

        # Penalización escalada
        penalty_bloques = (
            p.lambda_bloques_historicos
            * (rareza_combinada ** p.exponente_rareza_bloques)
            * max_factor
        )

        # Bonus y respaldo
        bonus = 0.0
        respaldo = 0.0

        total_ueas_bloque = sum(b["n_ueas"] for b in bloques)
        n_ueas = total_ueas_bloque

        if n_ueas <= p.max_ueas_bonus_bloques:
            respaldo = p.premio_respaldo_bloques * p.lambda_bloques_historicos
        if rareza_combinada <= p.umbral_respaldo_bonus_bloques:
            bonus = p.premio_cap_bloques * p.lambda_bloques_historicos

        features = {
            "factor_horas_bloque": max_factor,
            "score_laboratorio_bloque": max_score_lab,
            "B_rareza_horas": rareza_horas,
            "B_rareza_ueas": rareza_ueas,
            "B_rareza_fragmentacion": rareza_frag,
            "B_rareza_gaps": rareza_gaps,
            "B_rareza_patron": rareza_patron,
            "B_rareza_combinada": rareza_combinada,
        }
        return penalty_bloques, bonus, respaldo, features

    # ------------------------------------------------------------------
    # Métodos de rareza para bloques
    # ------------------------------------------------------------------

    def _factor_horas_bloque(self, horas: float) -> Tuple[float, float]:
        """
        Determina el factor de penalización por horas de bloque.

        Bloque tipo laboratorio (≥ umbral) recibe factor reducido.
        Retorna (factor, score_laboratorio).
        """
        p = self.params
        if horas >= p.umbral_horas_laboratorio:
            score_lab = min(1.0, (horas - p.umbral_horas_laboratorio) / max(
                p.cap_horas_laboratorio - p.umbral_horas_laboratorio, EPS
            ))
            factor = p.lambda_horas_bloque_laboratorio + (
                p.lambda_horas_bloque_normal - p.lambda_horas_bloque_laboratorio
            ) * (1.0 - score_lab)
            return factor, score_lab
        else:
            return p.lambda_horas_bloque_normal, 0.0

    def _rareza_bloque_horas(
        self,
        eco: str,
        bloques: List[dict],
        eco_records: List[dict],
        global_records: List[dict],
    ) -> float:
        """Rareza de las horas de bloque respecto al histórico."""
        records = eco_records if len(eco_records) >= 5 else global_records
        if not records:
            return 0.0

        horas_historicas = [r.get("horas", 0.0) for r in records]
        q90 = float(np.quantile(horas_historicas, 0.90)) if horas_historicas else 3.0

        max_rareza = 0.0
        for b in bloques:
            exceso = max(0.0, b["horas"] - q90) / max(q90, EPS)
            rareza = float(np.clip(exceso, 0.0, 1.0))
            if rareza > max_rareza:
                max_rareza = rareza

        return max_rareza

    def _rareza_bloque_ueas(
        self,
        eco: str,
        bloques: List[dict],
        eco_records: List[dict],
        global_records: List[dict],
    ) -> float:
        """Rareza del número de UEA por bloque."""
        records = eco_records if len(eco_records) >= 5 else global_records
        if not records:
            return 0.0

        ueas_historicas = [r.get("n_ueas", 1) for r in records]
        q90 = float(np.quantile(ueas_historicas, 0.90)) if ueas_historicas else 2.0

        max_rareza = 0.0
        for b in bloques:
            exceso = max(0.0, b["n_ueas"] - q90) / max(q90, EPS)
            rareza = float(np.clip(exceso, 0.0, 1.0))
            if rareza > max_rareza:
                max_rareza = rareza

        return max_rareza

    def _rareza_bloque_fragmentacion(
        self,
        eco: str,
        n_bloques: int,
        eco_records: List[dict],
        global_records: List[dict],
    ) -> float:
        """Rareza de la fragmentación (número de bloques)."""
        records = eco_records if len(eco_records) >= 5 else global_records
        if not records:
            return 0.0

        n_bloques_historicos = [r.get("n_bloques_semana", 1) for r in records]
        q90 = float(np.quantile(n_bloques_historicos, 0.90)) if n_bloques_historicos else 3.0

        exceso = max(0.0, n_bloques - q90) / max(q90, EPS)
        return float(np.clip(exceso, 0.0, 1.0))

    def _rareza_bloque_gaps(
        self,
        eco: str,
        total_gap: float,
        eco_records: List[dict],
        global_records: List[dict],
    ) -> float:
        """Rareza de los huecos entre bloques."""
        records = eco_records if len(eco_records) >= 5 else global_records
        if not records:
            return 0.0

        gaps_historicos = [r.get("total_gap_horas", 0.0) for r in records]
        q10 = float(np.quantile(gaps_historicos, 0.10)) if gaps_historicos else 0.0

        if total_gap >= q10:
            return 0.0  # gap suficiente → sin rareza
        deficit = (q10 - total_gap) / max(q10, EPS)
        return float(np.clip(deficit, 0.0, 1.0))

    def _rareza_patron_bloque(self, eco: str, firma: str) -> float:
        """Rareza del patrón de bloques (firma)."""
        pesos = self._block_pattern_weights_.get(eco, self._global_block_pattern_weights_)
        if not pesos:
            return 0.0

        total = sum(pesos.values())
        if total <= 0:
            return 0.0

        frecuencia = pesos.get(firma, 0.0) / total
        # frecuencia 0 → rareza 1; frecuencia alta → rareza baja
        return float(np.clip(1.0 - frecuencia * 10.0, 0.0, 1.0))

    # ------------------------------------------------------------------
    # _rareza_ueas_totales — versión unificada con extrapolación individual
    # ------------------------------------------------------------------

    def _rareza_ueas_totales(self, eco: str, w: int) -> float:
        """
        Rareza de tener W UEA totales para este eco.

        Combina:
        - Perfil individual del eco (cuantiles de W histórico)
        - Extrapolación para W > max histórico
        - Hábito individual (qué tan consistente es el eco en su carga)
        - Referencia global para ecos con poca historia
        """
        p = self.params

        # Obtener perfil individual
        perfil = self.eco_perfiles_.get(eco, self.global_profile_)
        hist_w = perfil.get("histograma_ueas", {})
        ueas_historicas = perfil.get("ueas_por_tri", [])

        if not ueas_historicas:
            # Sin histórico → usar perfil global
            hist_w = self.global_profile_.get("histograma_ueas", {})
            ueas_historicas = self.global_profile_.get("ueas_por_tri", [])
            if not ueas_historicas:
                return 0.0 if w <= 3 else 0.5

        # Frecuencia de W en el histórico
        n_total = sum(hist_w.values()) if hist_w else 0
        freq_w = hist_w.get(w, 0) / max(n_total, 1)

        # Cuantiles empíricos de W
        values = np.array(ueas_historicas, dtype=float)
        q_med = float(np.median(values))
        q_max = float(np.max(values))

        # ── Caso 1: W dentro del rango histórico ──
        if w <= q_max:
            # Probabilidad de observar ≥ W
            prob_ge = float(np.mean(values >= w))
            rareza_base = 1.0 - prob_ge

            # Ajuste por hábito individual (0 = sin ajuste, >0 = amplifica rareza)
            habit_factor = self._habit_factor(eco)
            # Exponente: 1/(1+habit) → habit=0 → exp=1 (sin cambio); habit>0 → exp<1 (amplifica)
            rareza = rareza_base ** (1.0 / (1.0 + max(habit_factor, 0.0)))

            # Record para suavizar transición en la frontera
            self._last_rareza_in_range_ = rareza

        # ── Caso 2: W fuera del rango histórico (extrapolación) ──
        else:
            gap = w - q_max
            # rareza_base: función sigmoide simple: gap/(gap+decay)
            gap_factor = float(gap) / (float(gap) + max(p.individual_decay_power, EPS))
            rareza_base = p.individual_alpha_min + (1.0 - p.individual_alpha_min) * gap_factor

            # Garantizar monotonía: extrapolación ≥ rareza en W=q_max
            rareza_en_frontera = getattr(self, '_last_rareza_in_range_', 0.0)
            rareza_base = max(rareza_base, rareza_en_frontera)

            # Bonus: W recién fuera de rango (gap pequeño) → reducir rareza
            if gap <= p.individual_extra_gap_max and p.individual_extra_gap_recent > 0:
                bonus = p.individual_extra_gap_recent * (1.0 - gap / max(p.individual_extra_gap_max, 1))
                rareza_base = max(rareza_base * (1.0 - bonus), rareza_en_frontera)

            habit_factor = self._habit_factor(eco)
            rareza = rareza_base ** (1.0 / (1.0 + max(habit_factor, 0.0)))

        return float(np.clip(rareza, 0.0, 1.0))

    def _habit_factor(self, eco: str) -> float:
        """Factor de hábito: qué tan predecible es la carga del eco."""
        cached = self._habit_cache_.get(eco)
        if cached is not None:
            return cached

        p = self.params

        perfil = self.eco_perfiles_.get(eco, self.global_profile_)
        ueas_historicas = perfil.get("ueas_por_tri", [])

        if len(ueas_historicas) < 2:
            return 1.0

        values = np.array(ueas_historicas, dtype=float)
        q25 = float(np.quantile(values, 0.25))
        q75 = float(np.quantile(values, 0.75))
        iqr = q75 - q25
        mad = float(np.median(np.abs(values - np.median(values))))

        dispersion = mad / max(np.median(values), 1.0)

        habit = p.individual_habit_strength / max(dispersion ** p.individual_habit_power, EPS)
        habit = float(np.clip(habit, 0.0, p.habit_max_weight))

        self._habit_cache_[eco] = habit
        return habit

    # ------------------------------------------------------------------
    # Construcción de perfiles
    # ------------------------------------------------------------------

    def _build_tri_weights(self, tri_values: np.ndarray) -> Dict[int, float]:
        """Pesos exponenciales por trimestre (half-life decay)."""
        tri_max = int(np.max(tri_values))
        pesos: Dict[int, float] = {}
        for t in np.unique(tri_values):
            ti = int(t)
            delta = tri_max - ti
            pesos[ti] = math.exp(-delta * math.log(2) / self.params.half_life_trimestres)
        return pesos

    def _build_eco_profile(
        self, df_eco: pd.DataFrame, pesos_tri: Dict[int, float]
    ) -> dict:
        """Construye el perfil de carga de un eco individual."""
        # Agrupar por trimestre → UEA por trimestre
        ueas_por_tri: List[int] = []
        horas_por_dia: List[float] = []
        ueas_por_bloque: List[int] = []
        pesos_observaciones: List[float] = []

        for tri, grp in df_eco.groupby("tri_num"):
            w_tri = pesos_tri.get(int(tri), 0.01)
            ueas_por_tri.append(grp["uea"].nunique())

            # Horas por día y UEA por bloque
            for dia in ["L", "M", "Mi", "J", "V"]:
                df_dia = grp[grp["dia"] == dia]
                if len(df_dia) > 0:
                    horas_dia = df_dia["horas"].sum()
                    horas_por_dia.append(horas_dia)
                    ueas_por_bloque.append(df_dia["uea"].nunique())
                    pesos_observaciones.append(w_tri)

        # Histograma de UEA por trimestre
        hist: Dict[int, int] = {}
        for w in ueas_por_tri:
            hist[w] = hist.get(w, 0) + 1

        # Cuantiles ponderados
        if len(horas_por_dia) > 0:
            w_arr = np.array(pesos_observaciones, dtype=float)
            h_arr = np.array(horas_por_dia, dtype=float)
            q_horas_dia = weighted_quantile(h_arr, w_arr, self.params.q_tolerancia)
        else:
            q_horas_dia = 3.0

        if len(ueas_por_bloque) > 0:
            w_arr = np.array(pesos_observaciones, dtype=float)
            u_arr = np.array(ueas_por_bloque, dtype=float)
            q_ueas_bloque = weighted_quantile(u_arr, w_arr, self.params.q_tolerancia)
        else:
            q_ueas_bloque = 2.0

        return {
            "ueas_por_tri": ueas_por_tri,
            "horas_por_dia": horas_por_dia,
            "ueas_por_bloque": ueas_por_bloque,
            "histograma_ueas": hist,
            "q_horas_dia": q_horas_dia,
            "q_ueas_bloque": q_ueas_bloque,
            "n_trimestres": len(ueas_por_tri),
        }

    def _build_global_profile(
        self, df_int: pd.DataFrame, pesos_tri: Dict[int, float]
    ) -> dict:
        """Perfil global agregado de todos los ecos."""
        ueas_por_tri: List[int] = []
        horas_por_dia: List[float] = []
        ueas_por_bloque: List[int] = []
        pesos_observaciones: List[float] = []

        for (eco, tri), grp in df_int.groupby(["eco", "tri_num"]):
            w_tri = pesos_tri.get(int(tri), 0.01)
            ueas_por_tri.append(grp["uea"].nunique())

            for dia in ["L", "M", "Mi", "J", "V"]:
                df_dia = grp[grp["dia"] == dia]
                if len(df_dia) > 0:
                    horas_por_dia.append(df_dia["horas"].sum())
                    ueas_por_bloque.append(df_dia["uea"].nunique())
                    pesos_observaciones.append(w_tri)

        hist: Dict[int, int] = {}
        for w in ueas_por_tri:
            hist[w] = hist.get(w, 0) + 1

        if len(horas_por_dia) > 0:
            w_arr = np.array(pesos_observaciones, dtype=float)
            h_arr = np.array(horas_por_dia, dtype=float)
            q_horas_dia = weighted_quantile(h_arr, w_arr, self.params.q_tolerancia)
        else:
            q_horas_dia = 3.0

        if len(ueas_por_bloque) > 0:
            w_arr = np.array(pesos_observaciones, dtype=float)
            u_arr = np.array(ueas_por_bloque, dtype=float)
            q_ueas_bloque = weighted_quantile(u_arr, w_arr, self.params.q_tolerancia)
        else:
            q_ueas_bloque = 2.0

        return {
            "ueas_por_tri": ueas_por_tri,
            "horas_por_dia": horas_por_dia,
            "ueas_por_bloque": ueas_por_bloque,
            "histograma_ueas": hist,
            "q_horas_dia": q_horas_dia,
            "q_ueas_bloque": q_ueas_bloque,
            "n_observaciones": len(ueas_por_tri),
        }

    # ------------------------------------------------------------------
    # Cachés de registros semanales y de bloques
    # ------------------------------------------------------------------

    def _build_weekly_caches(self, df: pd.DataFrame) -> None:
        """Construye cachés de registros semanales por eco y globales."""
        from penalizacion_carga.features import intervalos_desde_df

        df_int = intervalos_desde_df(df)

        for eco, grp in df_int.groupby("eco"):
            records: List[dict] = []
            for tri, grp_tri in grp.groupby("tri_num"):
                intervalos = [
                    Intervalo(
                        str(r["dia"]), float(r["inicio"]), float(r["fin"]), str(r["uea"])
                    )
                    for _, r in grp_tri.iterrows()
                ]
                resumen = resumen_bloques_semana(intervalos)
                records.append({
                    "tri_num": int(tri),
                    **{k: v for k, v in resumen.items() if k != "bloques"},
                    "n_ueas": grp_tri["uea"].nunique(),
                })
            self._weekly_records_[eco] = records
            self._global_weekly_records_.extend(records)

    def _build_block_caches(self, df: pd.DataFrame) -> None:
        """Construye cachés de patrones de bloques."""
        from penalizacion_carga.features import intervalos_desde_df

        df_int = intervalos_desde_df(df)

        for eco, grp in df_int.groupby("eco"):
            records: List[dict] = []
            pattern_counter: Counter = Counter()

            for tri, grp_tri in grp.groupby("tri_num"):
                intervalos = [
                    Intervalo(
                        str(r["dia"]), float(r["inicio"]), float(r["fin"]), str(r["uea"])
                    )
                    for _, r in grp_tri.iterrows()
                ]
                bloques = construir_bloques(intervalos)
                firma = firma_bloques_desde_bloques(bloques)
                resumen = resumen_bloques_semana(intervalos)

                records.append({
                    "tri_num": int(tri),
                    "n_bloques_semana": resumen["n_bloques_semana"],
                    "max_horas_consecutivas": resumen["max_horas_consecutivas"],
                    "max_ueas_bloque": resumen["max_ueas_bloque"],
                    "total_gap_horas": resumen["total_gap_horas"],
                    "dias_con_clase": resumen["dias_con_clase"],
                    "firma": firma,
                })

                for b in bloques:
                    b["horas"] = float(b["horas"])
                    b["n_ueas"] = int(b["n_ueas"])
                pattern_counter[firma] += 1

            self._block_shape_records_[eco] = records
            self._global_block_shape_records_.extend(records)

            total = sum(pattern_counter.values()) or 1
            self._block_pattern_weights_[eco] = {
                k: v / total for k, v in pattern_counter.items()
            }

        # Pesos globales de patrones
        global_counter: Counter = Counter()
        for records in self._block_shape_records_.values():
            for r in records:
                global_counter[r.get("firma", "")] += 1
        total = sum(global_counter.values()) or 1
        self._global_block_pattern_weights_ = {
            k: v / total for k, v in global_counter.items()
        }

    def _build_habit_caches(self, df: pd.DataFrame) -> None:
        """Pre-calcula factores de hábito para todos los ecos."""
        for eco in self.eco_perfiles_:
            self._habit_factor(eco)  # calcula y cachea

    # ------------------------------------------------------------------
    # Serialización
    # ------------------------------------------------------------------

    def to_dict(self) -> Dict[str, Any]:
        """Serializa el modelo completo a diccionario."""
        return {
            "params": self.params.to_dict(),
            "eco_nombres": self.eco_nombres_,
            "tri_actual": self.tri_actual_,
            "eco_perfiles": self.eco_perfiles_,
            "global_profile": self.global_profile_,
            "weekly_records": self._weekly_records_,
            "global_weekly_records": self._global_weekly_records_,
            "block_shape_records": self._block_shape_records_,
            "global_block_shape_records": self._global_block_shape_records_,
            "block_pattern_weights": self._block_pattern_weights_,
            "global_block_pattern_weights": self._global_block_pattern_weights_,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PenalizacionCargaHistoricaModel":
        """Reconstruye el modelo desde diccionario."""
        params = ModelParams.from_dict(data["params"])
        model = cls(params=params)
        model.eco_nombres_ = data.get("eco_nombres", {})
        model.tri_actual_ = data.get("tri_actual", 0)
        model.eco_perfiles_ = data.get("eco_perfiles", {})
        model.global_profile_ = data.get("global_profile", {})
        model._weekly_records_ = data.get("weekly_records", {})
        model._global_weekly_records_ = data.get("global_weekly_records", [])
        model._block_shape_records_ = data.get("block_shape_records", {})
        model._global_block_shape_records_ = data.get("global_block_shape_records", [])
        model._block_pattern_weights_ = data.get("block_pattern_weights", {})
        model._global_block_pattern_weights_ = data.get("global_block_pattern_weights", {})

        # Reconstruir cachés derivadas
        model._build_habit_caches_from_profiles()
        return model

    def _build_habit_caches_from_profiles(self) -> None:
        """Reconstruye caché de hábitos desde perfiles ya cargados."""
        self._habit_cache_ = {}
        for eco in self.eco_perfiles_:
            self._habit_factor(eco)

    def save(self, path: str) -> None:
        """Guarda el modelo en disco (JSON)."""
        import json
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False, default=str)

    @classmethod
    def load(cls, path: str) -> "PenalizacionCargaHistoricaModel":
        """Carga el modelo desde disco (JSON)."""
        import json
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return cls.from_dict(data)

    @classmethod
    def from_data_files(
        cls,
        df_hist_path: str = "/content/df_hist.json",
        eco_nombres_path: str = "/content/eco-nombre.json",
        params: "ModelParams | None" = None,
        **kwargs,
    ) -> "PenalizacionCargaHistoricaModel":
        """
        Factory method: carga los JSON y entrena el modelo en un solo paso.

        Args:
            df_hist_path: ruta al JSON del histórico de asignaciones
            eco_nombres_path: ruta al JSON de nombres de ecos
            params: instancia de ModelParams (opcional)
            **kwargs: overrides de parámetros

        Returns:
            Modelo entrenado listo para predict_penalty() y fine-tuning.

        Example:
            model = PenalizacionCargaHistoricaModel.from_data_files()
            model = PenalizacionCargaHistoricaModel.from_data_files(
                df_hist_path="/content/mis_datos.json",
                half_life_trimestres=3.0,
            )
        """
        import json
        import pandas as pd
        from penalizacion_carga.features import normalizar_eco_nombre

        # Cargar histórico
        with open(df_hist_path, "r", encoding="utf-8") as f:
            raw = json.load(f)
        if isinstance(raw, dict) and "data" in raw:
            raw = raw["data"]
        df_historico = pd.DataFrame(raw if isinstance(raw, list) else [raw])

        # Cargar nombres de ecos
        eco_nombres = None
        if eco_nombres_path:
            try:
                with open(eco_nombres_path, "r", encoding="utf-8") as f:
                    eco_nombres_raw = json.load(f)
                eco_nombres = normalizar_eco_nombre(eco_nombres_raw)
            except FileNotFoundError:
                pass  # eco-nombre.json es opcional

        # Construir y entrenar
        model = cls(params=params, **kwargs)
        model.fit(df_historico, eco_nombres)
        return model

    def clone(self) -> "PenalizacionCargaHistoricaModel":
        """Copia profunda del modelo con su estado."""
        return self.from_dict(self.to_dict())
