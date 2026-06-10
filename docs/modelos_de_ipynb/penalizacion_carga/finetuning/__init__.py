"""
Pipeline de Fine-Tuning para Penalización de Carga Histórica.

Reemplaza el enfoque de targets fijos por una optimización distribucional
que opera sobre el score de predicción global, sin magic numbers.
"""

from __future__ import annotations

from penalizacion_carga.finetuning.optimizer import finetune
from penalizacion_carga.finetuning.config import (
    FineTuningConfig,
    LossConfig,
    OptimizerConfig,
    ParamBounds,
    load_config,
    save_config,
)
from penalizacion_carga.finetuning.loss import compute_distributional_loss
from penalizacion_carga.finetuning.scenarios import (
    generate_evaluation_scenarios,
    generate_contrast_scenarios,
)

__all__ = [
    "finetune",
    "FineTuningConfig",
    "LossConfig",
    "OptimizerConfig",
    "ParamBounds",
    "load_config",
    "save_config",
    "compute_distributional_loss",
    "generate_evaluation_scenarios",
    "generate_contrast_scenarios",
]
