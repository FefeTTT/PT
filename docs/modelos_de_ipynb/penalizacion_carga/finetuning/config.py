"""
Configuración externalizada del proceso de fine-tuning.

Toda la configuración se define aquí o en archivos YAML/JSON externos.
Cero magic numbers en el código de optimización.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple


# ============================================================================
# Configuración de la función de pérdida
# ============================================================================

@dataclass
class LossConfig:
    """
    Pesos y parámetros de la función de pérdida compuesta.

    La pérdida total es una combinación ponderada de:
      L = w_cal * L_cal + w_mono * L_mono + w_cov * L_cov + w_smooth * L_smooth + w_reg * L_reg

    donde cada componente se escala para estar aproximadamente en [0, 1].
    """

    # ── Pesos de cada componente (deben sumar ~1.0) ──
    w_calibration: float = 0.35       # Calibración distribucional (KS / Wasserstein)
    w_monotonicity: float = 0.15      # Penalización por no-monotonicidad
    w_coverage: float = 0.10          # Cobertura de comportamientos diversos
    w_smoothness: float = 0.10        # Suavidad entre ecos con perfiles similares
    w_regularization: float = 0.15    # Regularización L2 sobre params
    w_penalty_scale: float = 0.15     # Escala absoluta de penalties (evitar colapso a 0)

    # ── Parámetros de calibración distribucional ──
    calibration_quantiles: Tuple[float, ...] = (0.25, 0.50, 0.75, 0.90, 0.95)
    n_bootstrap_samples: int = 500
    wasserstein_p: int = 1             # Orden de la distancia de Wasserstein (1 = earth mover)

    # ── Parámetros de monotonicidad ──
    monotonicity_tolerance: float = 0.01  # Margen de tolerancia para no-monotonicidad
    monotonicity_max_penalty: float = 5.0  # Penalización máxima por eco no-monótono

    # ── Parámetros de cobertura ──
    coverage_min_entropy: float = 0.3   # Entropía mínima deseada en distribución de penalties
    coverage_n_bins: int = 20           # Bins para histograma de cobertura

    # ── Parámetros de suavidad ──
    smoothness_n_neighbors: int = 5     # Vecinos más cercanos para suavidad
    smoothness_bandwidth: float = 0.5   # Ancho de banda del kernel de similitud

    # ── Parámetros de regularización ──
    regularization_strength: float = 0.01  # λ de regularización L2

    # ── Parámetros de escala de penalty ──
    penalty_scale_target_median: float = 0.15  # Mediana deseada de |penalty|
    penalty_scale_target_iqr: float = 0.20      # IQR deseado de |penalty|

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {}
        for field_name in self.__dataclass_fields__:
            val = getattr(self, field_name)
            d[field_name] = list(val) if isinstance(val, tuple) else val
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "LossConfig":
        valid_fields = set(cls.__dataclass_fields__.keys())
        kwargs = {k: v for k, v in data.items() if k in valid_fields}
        return cls(**kwargs)


# ============================================================================
# Configuración del optimizador
# ============================================================================

@dataclass
class OptimizerConfig:
    """Configuración del algoritmo de optimización."""

    algorithm: str = "differential_evolution"
    # Opciones: "differential_evolution", "random_search", "L-BFGS-B", "optuna"

    max_iterations: int = 200
    population_size: int = 10
    seed: int = 42

    # ── Differential Evolution ──
    de_tol: float = 1e-3
    de_polish: bool = False
    de_mutation: Tuple[float, float] = (0.5, 1.0)
    de_recombination: float = 0.7

    # ── Random Search ──
    random_samples: int = 5000

    # ── L-BFGS-B ──
    lbfgsb_maxiter: int = 100

    # ── Optuna ──
    optuna_n_trials: int = 200
    optuna_sampler: str = "TPE"  # TPE | Random | CMA-ES

    # ── Early Stopping ──
    early_stopping_patience: int = 20
    early_stopping_min_delta: float = 1e-4

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {}
        for field_name in self.__dataclass_fields__:
            val = getattr(self, field_name)
            d[field_name] = list(val) if isinstance(val, tuple) else val
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "OptimizerConfig":
        valid_fields = set(cls.__dataclass_fields__.keys())
        kwargs = {k: v for k, v in data.items() if k in valid_fields}
        return cls(**kwargs)


# ============================================================================
# Configuración de parámetros optimizables
# ============================================================================

@dataclass
class ParamBounds:
    """
    Define qué parámetros se optimizan y sus cotas.

    Cada entrada es (lower_bound, upper_bound, log_scale).
    log_scale=True significa que la búsqueda se hace en espacio log.
    """

    bounds: Dict[str, Tuple[float, float, bool]] = field(default_factory=dict)

    @classmethod
    def default_semanal(cls) -> "ParamBounds":
        """Bounds por defecto para parámetros de señal semanal."""
        return cls(bounds={
            "lambda_semanal":           (0.50, 8.0, False),
            "lambda_ueas":              (0.20, 10.0, True),   # tuple, mismo bound para todos
            "peso_exceso_ueas_semana":  (0.50, 8.0, True),
            "exponente_rareza_ueas_totales": (0.50, 5.0, True),
            "shrinkage_weight":         (0.50, 15.0, True),
            "individual_alpha_min":     (0.00, 0.50, False),
            "individual_decay_power":   (0.50, 4.0, True),
            "individual_floor_strength": (0.00, 0.80, False),
            "individual_extra_gap_max":  (0.00, 3.0, False),
            "individual_extra_gap_recent": (0.00, 0.50, False),
            "individual_habit_strength":   (0.00, 2.0, False),
            "individual_habit_power":      (0.50, 4.0, True),
            "habit_recent_weight":    (0.10, 0.95, False),
            "habit_q_weight":         (0.05, 0.80, False),
            "habit_max_weight":       (0.01, 0.50, False),
        })

    @classmethod
    def default_bloques(cls) -> "ParamBounds":
        """Bounds por defecto para parámetros de bloques históricos."""
        return cls(bounds={
            "lambda_diaria":                (0.25, 8.0, False),
            "lambda_bloques_historicos":    (0.10, 5.0, True),
            "lambda_horas_bloque_normal":   (0.25, 8.0, True),
            "lambda_horas_bloque_laboratorio": (0.05, 2.0, True),
            "peso_rareza_horas_bloque_hist":   (0.25, 8.0, True),
            "peso_rareza_ueas_bloque_hist":    (0.25, 8.0, True),
            "peso_rareza_fragmentacion_bloques": (0.10, 8.0, True),
            "peso_rareza_huecos_bloques":       (0.10, 8.0, True),
            "peso_rareza_patron_bloques":       (0.05, 4.0, True),
            "premio_respaldo_bloques":     (0.00, 0.50, False),
            "premio_cap_bloques":          (0.00, 0.50, False),
            "exponente_rareza_bloques":    (0.50, 5.0, True),
        })


# ============================================================================
# Configuración maestra de fine-tuning
# ============================================================================

@dataclass
class FineTuningConfig:
    """
    Configuración completa del proceso de fine-tuning.

    Uso:
        config = FineTuningConfig.default()
        # Editar lo necesario:
        config.loss.w_calibration = 0.50
        config.optimizer.max_iterations = 300
        # Ejecutar:
        result = finetune(model, config)
    """

    loss: LossConfig = field(default_factory=LossConfig)
    optimizer: OptimizerConfig = field(default_factory=OptimizerConfig)
    param_bounds_semanal: ParamBounds = field(default_factory=ParamBounds.default_semanal)
    param_bounds_bloques: ParamBounds = field(default_factory=ParamBounds.default_bloques)

    # ── Evaluación ──
    n_evaluation_scenarios_per_eco: int = 5
    # Número de escenarios sintéticos generados por eco para evaluar la pérdida

    n_evaluation_ecos_sample: Optional[int] = None
    # Si no es None, muestrea esta cantidad de ecos para evaluación (más rápido)
    # None → todos los ecos

    evaluation_seed: int = 12345

    # ── Filtros ──
    min_trimestres_eco: int = 2
    # Ecos con menos trimestres se excluyen del fine-tuning
    # (se benefician igual de los parámetros globales optimizados)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "loss": self.loss.to_dict(),
            "optimizer": self.optimizer.to_dict(),
            "param_bounds_semanal": self.param_bounds_semanal.bounds,
            "param_bounds_bloques": self.param_bounds_bloques.bounds,
            "n_evaluation_scenarios_per_eco": self.n_evaluation_scenarios_per_eco,
            "n_evaluation_ecos_sample": self.n_evaluation_ecos_sample,
            "evaluation_seed": self.evaluation_seed,
            "min_trimestres_eco": self.min_trimestres_eco,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FineTuningConfig":
        return cls(
            loss=LossConfig.from_dict(data.get("loss", {})),
            optimizer=OptimizerConfig.from_dict(data.get("optimizer", {})),
            param_bounds_semanal=ParamBounds(bounds=data.get("param_bounds_semanal", {})),
            param_bounds_bloques=ParamBounds(bounds=data.get("param_bounds_bloques", {})),
            n_evaluation_scenarios_per_eco=data.get("n_evaluation_scenarios_per_eco", 5),
            n_evaluation_ecos_sample=data.get("n_evaluation_ecos_sample"),
            evaluation_seed=data.get("evaluation_seed", 12345),
            min_trimestres_eco=data.get("min_trimestres_eco", 2),
        )

    @classmethod
    def default(cls) -> "FineTuningConfig":
        """Configuración por defecto equilibrada."""
        return cls()


# ============================================================================
# Helpers para cargar/guardar desde archivo
# ============================================================================

def load_config(path: str) -> FineTuningConfig:
    """Carga configuración desde YAML o JSON."""
    import json
    import os

    with open(path, "r", encoding="utf-8") as f:
        if path.endswith((".yaml", ".yml")):
            try:
                import yaml
                data = yaml.safe_load(f)
            except ImportError:
                raise ImportError("PyYAML required for YAML config files. pip install pyyaml")
        else:
            data = json.load(f)

    return FineTuningConfig.from_dict(data)


def save_config(config: FineTuningConfig, path: str) -> None:
    """Guarda configuración a YAML o JSON."""
    import json
    import os

    data = config.to_dict()
    with open(path, "w", encoding="utf-8") as f:
        if path.endswith((".yaml", ".yml")):
            try:
                import yaml
                yaml.safe_dump(data, f, indent=2, allow_unicode=True, sort_keys=False)
            except ImportError:
                raise ImportError("PyYAML required for YAML config files. pip install pyyaml")
        else:
            json.dump(data, f, indent=2, ensure_ascii=False)
