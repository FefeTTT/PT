"""
Optimizador de fine-tuning.

Orquesta la búsqueda de parámetros óptimos usando la función de pérdida
distribucional, con soporte para múltiples algoritmos (DE, random search,
L-BFGS-B, Optuna).
"""

from __future__ import annotations

import time
import math
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from penalizacion_carga.model import PenalizacionCargaHistoricaModel, ModelParams
from penalizacion_carga.finetuning.config import (
    FineTuningConfig,
    LossConfig,
    OptimizerConfig,
    ParamBounds,
)
from penalizacion_carga.finetuning.loss import compute_distributional_loss
from penalizacion_carga.finetuning.scenarios import generate_evaluation_scenarios


# ============================================================================
# Interfaz principal
# ============================================================================

def finetune(
    model: PenalizacionCargaHistoricaModel,
    config: Optional[FineTuningConfig] = None,
    *,
    verbose: bool = True,
    progress_callback: Optional[Callable[[int, int, float], None]] = None,
) -> Dict[str, Any]:
    """
    Ejecuta fine-tuning global sobre el modelo.

    Args:
        model: modelo entrenado (fit)
        config: configuración completa. Si es None, usa FineTuningConfig.default()
        verbose: mostrar progreso
        progress_callback: función(iteracion, total, loss) para barras de progreso

    Returns:
        dict con:
            - model: modelo optimizado (nueva instancia)
            - best_params: dict con parámetros óptimos
            - best_loss: pérdida final
            - loss_components: desglose de componentes de pérdida
            - history: lista de (iteración, loss) durante la optimización
            - evaluation: DataFrame con predicciones finales
            - metrics: dict con métricas de diagnóstico
    """
    if config is None:
        config = FineTuningConfig.default()

    # ── Guardar params iniciales para regularización ──
    initial_params = model.params.to_dict()

    # ── Preparar bounds planos para el optimizador ──
    flat_bounds, param_names, log_mask = _flatten_bounds(
        config.param_bounds_semanal, config.param_bounds_bloques
    )

    # ── Codificar params actuales como punto de partida ──
    x0 = _encode_params(model.params, param_names, log_mask)

    if not flat_bounds:
        return {
            "model": model,
            "best_params": {},
            "best_loss": float("inf"),
            "loss_components": {},
            "history": [],
            "evaluation": pd.DataFrame(),
            "metrics": {},
        }

    # ── Función objetivo ──
    def objective(x: np.ndarray) -> float:
        params_dict = _decode_params(x, param_names, log_mask)
        test_model = _apply_params(model, params_dict)
        scenarios = generate_evaluation_scenarios(
            test_model,
            n_scenarios_per_eco=config.n_evaluation_scenarios_per_eco,
            seed=config.evaluation_seed,
            min_trimestres=config.min_trimestres_eco,
            max_ecos=config.n_evaluation_ecos_sample,
        )
        if len(scenarios) == 0:
            return 1e6

        loss_dict = compute_distributional_loss(
            test_model, scenarios, config.loss, initial_params
        )
        return loss_dict["loss_total"]

    # ── Ejecutar optimización según algoritmo ──
    algo = config.optimizer.algorithm
    history: List[Tuple[int, float]] = []
    start_time = time.time()

    if algo == "differential_evolution":
        result = _optimize_de(
            objective, flat_bounds, config.optimizer,
            verbose, progress_callback, history,
        )
    elif algo == "random_search":
        result = _optimize_random(
            objective, flat_bounds, config.optimizer,
            verbose, progress_callback, history,
            x0=x0,
        )
    elif algo in ("L-BFGS-B", "lbfgsb"):
        result = _optimize_lbfgsb(
            objective, flat_bounds, config.optimizer,
            verbose, progress_callback, history,
        )
    elif algo == "optuna":
        result = _optimize_optuna(
            objective, flat_bounds, config.optimizer,
            verbose, progress_callback, history,
        )
    else:
        raise ValueError(f"Algoritmo no reconocido: {algo}")

    elapsed = time.time() - start_time

    # ── Construir modelo final ──
    best_x = result["x"]
    best_params = _decode_params(best_x, param_names, log_mask)
    best_model = _apply_params(model, best_params)

    # ── Evaluación final ──
    final_scenarios = generate_evaluation_scenarios(
        best_model,
        n_scenarios_per_eco=max(5, config.n_evaluation_scenarios_per_eco),
        seed=config.evaluation_seed,
        min_trimestres=config.min_trimestres_eco,
        max_ecos=config.n_evaluation_ecos_sample,
    )

    final_loss_dict = compute_distributional_loss(
        best_model, final_scenarios, config.loss, initial_params
    )

    # ── Métricas de diagnóstico ──
    metrics = _compute_diagnostics(best_model, final_scenarios)

    if verbose:
        _print_summary(best_params, final_loss_dict, metrics, algo, elapsed)

    return {
        "model": best_model,
        "best_params": best_params,
        "best_loss": final_loss_dict["loss_total"],
        "loss_components": final_loss_dict,
        "history": history,
        "evaluation": final_scenarios,
        "metrics": metrics,
    }


# ============================================================================
# Codificación/decodificación de parámetros
# ============================================================================

def _flatten_bounds(
    bounds_semanal: ParamBounds,
    bounds_bloques: ParamBounds,
) -> Tuple[List[Tuple[float, float]], List[str], List[bool]]:
    """Convierte bounds semánticos en vectores planos para el optimizador."""
    flat: List[Tuple[float, float]] = []
    names: List[str] = []
    log_mask: List[bool] = []

    for bounds in [bounds_semanal, bounds_bloques]:
        for param_name, (lo, hi, log_scale) in bounds.bounds.items():
            if param_name == "lambda_ueas":
                # Expandir tuple en 5 parámetros individuales
                for i in range(5):
                    flat.append((lo, hi))
                    names.append(f"lambda_ueas_{i}")
                    log_mask.append(log_scale)
            else:
                flat.append((lo, hi))
                names.append(param_name)
                log_mask.append(log_scale)

    return flat, names, log_mask


def _encode_params(
    params: ModelParams, param_names: List[str], log_mask: List[bool]
) -> np.ndarray:
    """Codifica ModelParams → vector x para el optimizador."""
    x = np.zeros(len(param_names))
    d = params.to_dict()

    for i, (name, use_log) in enumerate(zip(param_names, log_mask)):
        if name.startswith("lambda_ueas_"):
            idx = int(name.split("_")[-1])
            val = d.get("lambda_ueas", [1.0] * 5)[idx]
        else:
            val = d.get(name, 1.0)

        if use_log:
            x[i] = math.log(max(val, 1e-9))
        else:
            x[i] = float(val)

    return x


def _decode_params(
    x: np.ndarray, param_names: List[str], log_mask: List[bool]
) -> Dict[str, Any]:
    """Decodifica vector x → dict de parámetros."""
    params_dict: Dict[str, Any] = {"lambda_ueas": [1.0] * 5}
    lambda_ueas = list(params_dict["lambda_ueas"])

    for i, (name, use_log) in enumerate(zip(param_names, log_mask)):
        val = math.exp(x[i]) if use_log else float(x[i])

        if name.startswith("lambda_ueas_"):
            idx = int(name.split("_")[-1])
            lambda_ueas[idx] = val
        else:
            params_dict[name] = val

    params_dict["lambda_ueas"] = tuple(lambda_ueas)
    return params_dict


def _apply_params(
    model: PenalizacionCargaHistoricaModel,
    params_dict: Dict[str, Any],
) -> PenalizacionCargaHistoricaModel:
    """Crea una copia del modelo con nuevos parámetros."""
    new_model = model.clone()
    for key, value in params_dict.items():
        if hasattr(new_model.params, key):
            setattr(new_model.params, key, value)
    return new_model


# ============================================================================
# Algoritmos de optimización
# ============================================================================

def _optimize_de(
    objective: Callable[[np.ndarray], float],
    bounds: List[Tuple[float, float]],
    cfg: OptimizerConfig,
    verbose: bool,
    progress_callback: Optional[Callable],
    history: List,
) -> Dict[str, Any]:
    """Differential Evolution (scipy)."""
    try:
        from scipy.optimize import differential_evolution
    except ImportError:
        if verbose:
            print("[WARN] scipy no disponible. Usando random search.")
        return _optimize_random(objective, bounds, cfg, verbose, progress_callback, history)

    best_loss = float("inf")
    best_x = None

    def callback(xk: np.ndarray, convergence: float = 0.0) -> bool:
        nonlocal best_loss, best_x
        loss = float(objective(xk))
        history.append((len(history), loss))
        if loss < best_loss:
            best_loss = loss
            best_x = xk.copy()
        if progress_callback and len(history) % 5 == 0:
            progress_callback(len(history), cfg.max_iterations, best_loss)
        return False  # continuar

    if verbose:
        print(f"[DE] Iniciando differential_evolution (maxiter={cfg.max_iterations}, "
              f"popsize={cfg.population_size})...")

    result = differential_evolution(
        objective,
        bounds=bounds,
        seed=cfg.seed,
        maxiter=cfg.max_iterations,
        popsize=cfg.population_size,
        tol=cfg.de_tol,
        polish=cfg.de_polish,
        mutation=cfg.de_mutation,
        recombination=cfg.de_recombination,
        workers=1,
        updating="immediate",
        callback=callback,
    )

    final_x = result.x if best_x is None else best_x
    if result.fun < best_loss:
        final_x = result.x

    return {"x": final_x, "fun": min(result.fun, best_loss)}


def _optimize_random(
    objective: Callable[[np.ndarray], float],
    bounds: List[Tuple[float, float]],
    cfg: OptimizerConfig,
    verbose: bool,
    progress_callback: Optional[Callable],
    history: List,
    x0: Optional[np.ndarray] = None,
) -> Dict[str, Any]:
    """
    Búsqueda aleatoria con warm-start desde defaults.
    
    70% de las muestras: perturbación local (±20%) alrededor de x0.
    30% de las muestras: exploración uniforme global.
    Siempre evalúa x0 primero.
    """
    rng = np.random.default_rng(cfg.seed)
    best_loss = float("inf")
    best_x: Optional[np.ndarray] = None

    n = cfg.random_samples
    if verbose:
        print(f"[RandomSearch] {n} muestras (70% local + 30% global)...")

    # Siempre evaluar el punto default primero
    if x0 is not None:
        loss = float(objective(x0))
        history.append((0, loss))
        best_loss = loss
        best_x = x0.copy()
        if verbose:
            print(f"[RandomSearch] x0 (defaults): loss={loss:.4f}")

    for i in range(n):
        ith = len(history)  # contador real (incluye x0)
        
        # 70% perturbación local, 30% exploración global
        if x0 is not None and rng.random() < 0.70:
            # Muestrear alrededor de x0 con sigma = 20% del rango
            x = np.zeros(len(bounds), dtype=float)
            for j, (lo, hi) in enumerate(bounds):
                sigma = 0.20 * (hi - lo)
                val = rng.normal(x0[j], sigma)
                x[j] = float(np.clip(val, lo, hi))
        else:
            x = np.array([rng.uniform(lo, hi) for lo, hi in bounds], dtype=float)

        loss = float(objective(x))
        history.append((ith, loss))

        if loss < best_loss:
            best_loss = loss
            best_x = x.copy()

        if progress_callback and (ith + 1) % max(1, n // 20) == 0:
            progress_callback(ith + 1, n, best_loss)

        # Early stopping
        patience = cfg.early_stopping_patience
        if ith >= patience:
            recent = [h[1] for h in history[-patience:]]
            if min(recent) >= best_loss - cfg.early_stopping_min_delta:
                if verbose:
                    print(f"[RandomSearch] Early stopping en iteración {ith + 1}")
                break

    if best_x is None:
        best_x = np.array([(lo + hi) / 2 for lo, hi in bounds])

    return {"x": best_x, "fun": best_loss}


def _optimize_lbfgsb(
    objective: Callable[[np.ndarray], float],
    bounds: List[Tuple[float, float]],
    cfg: OptimizerConfig,
    verbose: bool,
    progress_callback: Optional[Callable],
    history: List,
) -> Dict[str, Any]:
    """L-BFGS-B (scipy). Típicamente usado como refinamiento post-DE."""
    try:
        from scipy.optimize import minimize
    except ImportError:
        return _optimize_random(objective, bounds, cfg, verbose, progress_callback, history)

    # Inicializar desde el centro de los bounds
    x0 = np.array([(lo + hi) / 2 for lo, hi in bounds])
    best_loss = float("inf")
    best_x = x0.copy()

    def callback(xk: np.ndarray) -> None:
        nonlocal best_loss, best_x
        loss = float(objective(xk))
        history.append((len(history), loss))
        if loss < best_loss:
            best_loss = loss
            best_x = xk.copy()
        if progress_callback and len(history) % 10 == 0:
            progress_callback(len(history), cfg.lbfgsb_maxiter, best_loss)

    if verbose:
        print(f"[L-BFGS-B] Iniciando (maxiter={cfg.lbfgsb_maxiter})...")

    result = minimize(
        objective,
        x0,
        method="L-BFGS-B",
        bounds=bounds,
        options={"maxiter": cfg.lbfgsb_maxiter},
        callback=callback,
    )

    final_x = result.x if best_loss <= result.fun else best_x
    final_loss = min(result.fun, best_loss)

    return {"x": final_x, "fun": final_loss}


def _optimize_optuna(
    objective: Callable[[np.ndarray], float],
    bounds: List[Tuple[float, float]],
    cfg: OptimizerConfig,
    verbose: bool,
    progress_callback: Optional[Callable],
    history: List,
) -> Dict[str, Any]:
    """Optuna (opcional, requiere pip install optuna)."""
    try:
        import optuna
    except ImportError:
        if verbose:
            print("[WARN] optuna no instalado. Usando random search.")
        return _optimize_random(objective, bounds, cfg, verbose, progress_callback, history)

    best_loss = float("inf")
    best_x: Optional[np.ndarray] = None

    def optuna_objective(trial: optuna.Trial) -> float:
        nonlocal best_loss, best_x
        x = np.array([
            trial.suggest_float(f"x{i}", lo, hi)
            for i, (lo, hi) in enumerate(bounds)
        ])
        loss = float(objective(x))
        history.append((len(history), loss))
        if loss < best_loss:
            best_loss = loss
            best_x = x.copy()
        if progress_callback and len(history) % 5 == 0:
            progress_callback(len(history), cfg.optuna_n_trials, best_loss)
        return loss

    sampler_map = {
        "TPE": optuna.samplers.TPESampler(seed=cfg.seed),
        "Random": optuna.samplers.RandomSampler(seed=cfg.seed),
        "CMA-ES": optuna.samplers.CmaEsSampler(seed=cfg.seed),
    }
    sampler = sampler_map.get(cfg.optuna_sampler, sampler_map["TPE"])

    study = optuna.create_study(
        direction="minimize",
        sampler=sampler,
    )

    if verbose:
        print(f"[Optuna] {cfg.optuna_n_trials} trials con sampler={cfg.optuna_sampler}...")

    study.optimize(
        optuna_objective,
        n_trials=cfg.optuna_n_trials,
        show_progress_bar=verbose,
    )

    if best_x is None:
        best_x = np.array([(lo + hi) / 2 for lo, hi in bounds])
        best_loss = study.best_value or best_loss

    return {"x": best_x, "fun": best_loss}


# ============================================================================
# Diagnóstico y reporting
# ============================================================================

def _compute_diagnostics(
    model: PenalizacionCargaHistoricaModel,
    scenarios: pd.DataFrame,
) -> Dict[str, Any]:
    """Calcula métricas de diagnóstico post-fine-tuning."""
    if len(scenarios) == 0:
        return {}

    abs_pen = np.abs(scenarios["penalty_predicho"].to_numpy(dtype=float))

    # Estadísticas de escala
    median = float(np.median(abs_pen))
    q25, q75 = float(np.quantile(abs_pen, 0.25)), float(np.quantile(abs_pen, 0.75))
    iqr = q75 - q25
    mean_abs = float(np.mean(abs_pen))

    # Monotonicidad por eco
    ecos = scenarios["eco"].to_numpy()
    ws = scenarios["W"].to_numpy(dtype=float)
    mono_violations = 0
    mono_total = 0
    for eco in np.unique(ecos):
        mask = ecos == eco
        w_eco = ws[mask]
        p_eco = abs_pen[mask]
        if len(w_eco) < 2:
            continue
        order = np.argsort(w_eco)
        p_sorted = p_eco[order]
        w_sorted = w_eco[order]
        for i in range(len(p_sorted) - 1):
            if w_sorted[i] == w_sorted[i + 1]:
                continue
            mono_total += 1
            if p_sorted[i] > p_sorted[i + 1] + 0.01:
                mono_violations += 1

    mono_ratio = mono_violations / max(mono_total, 1)

    # Cobertura (entropía)
    hist, _ = np.histogram(abs_pen, bins=20, range=(0, max(abs_pen.max(), 0.01)))
    hist = hist.astype(float)
    hist = hist / hist.sum()
    ent = -np.sum(hist[hist > 0] * np.log(hist[hist > 0]))
    max_ent = math.log(20)
    coverage_entropy = ent / max_ent if max_ent > 0 else 0.0

    # Diversidad entre ecos (CV acotado)
    eco_medians = scenarios.groupby("eco")["penalty_predicho"].median()
    eco_abs = eco_medians.abs()
    eco_cv = float(eco_abs.std() / max(eco_abs.mean(), 0.01)) if len(eco_abs) > 1 else 0.0
    eco_cv = min(eco_cv, 10.0)  # cap razonable

    return {
        "penalty_median": median,
        "penalty_iqr": iqr,
        "penalty_mean_abs": mean_abs,
        "monotonicity_ratio": 1.0 - mono_ratio,
        "coverage_entropy": coverage_entropy,
        "eco_cv": eco_cv,
        "n_ecos_evaluated": int(scenarios["eco"].nunique()),
        "n_scenarios": len(scenarios),
    }


def _print_summary(
    best_params: Dict[str, Any],
    loss_dict: Dict[str, float],
    metrics: Dict[str, Any],
    algorithm: str,
    elapsed: float,
) -> None:
    """Imprime resumen de fine-tuning."""
    print(f"\n{'='*60}")
    print(f"  Fine-Tuning Completado ({algorithm}) — {elapsed:.1f}s")
    print(f"{'='*60}")
    print(f"  Loss total:            {loss_dict['loss_total']:.6f}")
    print(f"    └─ Calibración:      {loss_dict.get('loss_calibration', 0):.6f}")
    print(f"    └─ Monotonicidad:    {loss_dict.get('loss_monotonicity', 0):.6f}")
    print(f"    └─ Cobertura:        {loss_dict.get('loss_coverage', 0):.6f}")
    print(f"    └─ Suavidad:         {loss_dict.get('loss_smoothness', 0):.6f}")
    print(f"    └─ Regularización:   {loss_dict.get('loss_regularization', 0):.6f}")
    print(f"    └─ Escala:           {loss_dict.get('loss_penalty_scale', 0):.6f}")
    print(f"  ──────────────────────")
    print(f"  Métricas de diagnóstico:")
    print(f"    Penalty mediana:     {metrics.get('penalty_median', 0):.4f}")
    print(f"    Penalty IQR:         {metrics.get('penalty_iqr', 0):.4f}")
    print(f"    Monotonicidad:       {metrics.get('monotonicity_ratio', 0):.2%}")
    print(f"    Cobertura (entropía): {metrics.get('coverage_entropy', 0):.3f}")
    print(f"    Diversidad eco CV:   {metrics.get('eco_cv', 0):.3f}")
    print(f"    Ecos evaluados:      {metrics.get('n_ecos_evaluated', 0)}")
    print(f"    Escenarios:          {metrics.get('n_scenarios', 0)}")
    print(f"  ──────────────────────")
    print(f"  Parámetros principales:")
    for k, v in sorted(best_params.items()):
        if isinstance(v, (list, tuple)):
            print(f"    {k}: {v}")
        else:
            print(f"    {k}: {v:.4f}")
    print(f"{'='*60}\n")
