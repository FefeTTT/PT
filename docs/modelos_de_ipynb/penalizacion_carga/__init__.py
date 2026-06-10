"""
Penalización de Carga Histórica — Modelo de viabilidad diaria/semanal.

Infra penalizaciones por sobrecarga de UEA asignadas a un profesor (eco)
a partir de su histórico de asignaciones, sin targets fijos ni magic numbers.
"""

from penalizacion_carga.model import PenalizacionCargaHistoricaModel, ModelParams
from penalizacion_carga.features import (
    parse_horario_id,
    horario_id_desde_row,
    construir_bloques,
    resumen_bloques_semana,
    firma_bloques_semana,
)

__all__ = [
    "PenalizacionCargaHistoricaModel",
    "ModelParams",
    "parse_horario_id",
    "horario_id_desde_row",
    "construir_bloques",
    "resumen_bloques_semana",
    "firma_bloques_semana",
]
