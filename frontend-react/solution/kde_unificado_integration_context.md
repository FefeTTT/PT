# KDE Unificado — Contexto Completo para Integración al GRASP

## 1. ¿Qué es el Modelo KDE Unificado?

El **KDE Unificado** es un modelo de scoring basado en **Kernel Density Estimation** que evalúa qué tan compatible es un profesor (ECO) con un horario específico (día + hora). A diferencia del modelo IH existente (que usa regresión lineal sobre features estáticas), el KDE produce una señal continua de densidad de probabilidad entrenada directamente sobre el historial de clases impartidas.

### ¿Por qué existe?

El modelo IH legacy produce un `score_lineal` que combina features como recencia, frecuencia y carga, pero tiene limitaciones:
- **No discrimina por día de la semana** de forma granular.
- **Trata regulares e irregulares con la misma lógica**, cuando los irregulares no tienen contrato fijo.
- **No captura señales de densidad temporal continua** (hora exacta del día).

El KDE Unificado resuelve esto con una señal bidimensional **hora × día** que es específica por profesor.

---

## 2. Formulación Matemática

El score final del modelo se compone de **cuatro señales aditivas y multiplicativas**:

```
score_final = score_horas × score_dias + bonus_laboral + bonus_admin
```

### 2.1 Score de Horas (`score_horas` ∈ [0, 1])

Para cada ECO se entrena un KDE 1D gaussiano sobre las horas de inicio de todas sus clases históricas, ponderadas por recencia (half-life de 8 trimestres).

```
densidad_cruda = kde_horas_eco(hora_consulta)
score_horas = clamp(densidad_cruda / pico_eco, 0, 1)
```

- Si el ECO tiene menos de 2 clases históricas, se usa un **KDE global fallback** (entrenado con todos los ECOs).
- El `pico_eco` es el valor máximo del KDE del eco en el rango [6:00, 22:00].

### 2.2 Score de Días (`score_dias` ∈ [0, 1])

Un KDE 1D gaussiano sobre los días de la semana (L=0, M=1, Mi=2, J=3, V=4), con **steep interpolation** para producir una señal casi binaria:

```
score_dias_raw = clamp(kde_dia / max_kde_dias, 0, 1)
score_dias     = score_dias_raw ^ steep_power
```

El `steep_power` es distinto por tipo de ECO:
- **Regulares**: `steep_power = 6.0` (muy agresivo, casi binario)
- **Irregulares**: `steep_power = 2.0` (más suave, permite variabilidad)

Efecto práctico: Un día con `score_raw = 0.5` queda en `0.5^6 = 0.016` para regulares (lo descarta) vs `0.5^2 = 0.25` para irregulares (lo permite parcialmente).

### 2.3 Bonus Laboral (`bonus_laboral` ∈ [0, λ_bonus])

Lógica distinta por tipo de ECO:

**ECO Regular** (contrato conocido, ej. "10:00-18:00"):
```
si hora_consulta ∈ [contrato_inicio, contrato_fin]:
    bonus = λ_bonus × min(1.0, densidad_cruda / pico_eco)
sino:
    bonus = 0.0
```

**ECO Irregular** (sin contrato fijo, basado en densidad):
```
umbral = threshold_ratio × pico_eco   # threshold_ratio = 0.85
si densidad_cruda >= umbral:
    bonus = λ_bonus × min(1.0, densidad_cruda / pico_eco)
sino:
    bonus = 0.0
```

> [!IMPORTANT]
> El bonus es **proporcional a la densidad**, no fijo. Un horario dentro del contrato pero con poca evidencia recibe un bonus menor que un horario con evidencia fuerte.

### 2.4 Bonus Administrativo (`bonus_admin` ∈ [0, 0.1])

Un bonus fijo para horarios que caigan en ventanas preferentes definidas por la administración:
- `10:00-14:00` (turno matutino preferente)
- `16:00-18:00` (turno vespertino preferente)

El bonus es `0.1` si la hora cae dentro de alguna ventana, `0.0` si no.

---

## 3. Parámetros Actuales del Modelo

| Parámetro | Valor Actual | Descripción |
|---|---|---|
| `kde_bandwidth_horas` | 0.225 | σ del kernel gaussiano para horas |
| `kde_bandwidth_dias` | 0.175 | σ del kernel gaussiano para días |
| `half_life_trimestres` | 8.0 | Half-life para pesos de recencia |
| `lambda_bonus` | 0.20 | Magnitud máxima del bonus laboral |
| `threshold_ratio` | 0.85 | Ratio para umbral de bonus en irregulares |
| `steep_power_regular` | 6.0 | Exponente steep para días (regulares) |
| `steep_power_irregular` | 2.0 | Exponente steep para días (irregulares) |
| `admin_bonus` | 0.10 | Bonus de preferencia administrativa |

---

## 4. Endpoints Disponibles en el Backend Python

El servidor Flask (puerto 8000 por defecto) expone dos endpoints para este modelo:

### 4.1 `POST /predecir_kde_unificado` — Score Compacto

**Uso recomendado para el pipeline GRASP (alto throughput).**

**Request:**
```json
{
    "eco": "28650",
    "horario": "L:16:00-17:30"
}
```

**Response:**
```json
{
    "eco": "28650",
    "tipo_eco": "regular",
    "score": 0.542037
}
```

### 4.2 `POST /predecir_kde_unificado_detalle` — Desglose Completo

**Uso para debugging, visualización o análisis manual.**

**Request:** (mismo formato)
```json
{
    "eco": "28650",
    "horario": "L:16:00-17:30"
}
```

**Response:**
```json
{
    "eco": "28650",
    "tipo_eco": "regular",
    "horario": "L:16:00-17:30",
    "score_combinado": 0.542037,
    "score_horas": 0.605982,
    "score_dias": 0.661965,
    "score_dias_raw": 0.933553,
    "bonus_laboral": 0.090897,
    "bonus_admin": 0.050000,
    "pico_eco": 0.821435,
    "n_clases_historicas": 47,
    "steep_power": 6.0,
    "sesiones": [
        {
            "dia": "L",
            "hora_eval": 16.0,
            "score_horas": 0.605982,
            "score_dias": 0.661965,
            "score_dias_raw": 0.933553,
            "bonus_laboral": 0.090897,
            "bonus_admin": 0.050000,
            "densidad_cruda": 0.497644,
            "score_sesion": 0.542037,
            "kde_source": "per_eco"
        }
    ]
}
```

---

## 5. Formato del Horario — Contrato de Entrada

El formato de horario es idéntico al usado por el modelo IH existente y debe llegar desde el frontend:

```
Dia:HH:MM-HH:MM
```

Ejemplos:
- Sesión simple: `"L:16:00-17:30"`
- Multi-sesión (separadas con `|`): `"L:16:00-17:30|Mi:16:00-17:30|V:16:00-17:30"`

Días válidos: `L`, `M`, `Mi`, `J`, `V`

> [!IMPORTANT]
> Para multi-sesión, el modelo calcula scores individuales por cada sesión y luego **promedia** todos los componentes. El score final es: `avg(score_horas) × avg(score_dias) + avg(bonus_laboral) + avg(bonus_admin)`.

---

## 6. Relación con los Otros Modelos del Pipeline

El GRASP actualmente consume los siguientes endpoints del backend Python:

| Endpoint | Modelo | Produce | Rol en GRASP |
|---|---|---|---|
| `POST /soft_constraints/r_hat/single` | RHat | `{rhat: float}` | Afinidad profesor↔UEA |
| `POST /predecir_ih` | IH (regresión lineal) | `{ih: float}` ó detalle | Afinidad profesor↔horario (legacy) |
| `POST /S_ijh` | RHat + IH combinado | `{rhat: float, h_ih: float}` | Score compuesto `S_ijh` |
| `POST /get_horario_penalty_finetuned` | Penalty Fine-tuned | `{total_penalty: float, ...}` | Penalización de sobrecarga |
| **`POST /predecir_kde_unificado`** | **KDE Unificado (NUEVO)** | **`{score: float}`** | **Señal de compatibilidad horaria granular** |

### ¿Cómo se diferencia del IH existente?

| Aspecto | IH Legacy (`/predecir_ih`) | KDE Unificado (`/predecir_kde_unificado`) |
|---|---|---|
| Método | Regresión lineal sobre features | Kernel Density Estimation continua |
| Discrimina por día | Limitado (via prefijo de día) | Sí — KDE de días con steep power |
| Señal temporal | Discreta (bloques) | Continua (hora exacta) |
| Bonus laboral | No | Sí — proporcional, por tipo de ECO |
| Bonus admin | No | Sí — ventanas preferentes |
| Rango de output | ~[-2, +3] (score_lineal) | [0, ~1.3] (score + bonuses) |
| Irregulares | Modelo separado (clustering) | Modelo unificado (misma lógica, parámetros distintos) |

---

## 7. Recomendaciones de Integración para el GRASP

### 7.1 Endpoint a Utilizar

Para el pipeline de optimización GRASP, usar **`POST /predecir_kde_unificado`** (el compacto). Devuelve solo `{eco, tipo_eco, score}` y es más eficiente para alto throughput.

### 7.2 Semántica del Score

- **`score ∈ [0, ~1.3]`**: Valores cercanos a 0 significan nula compatibilidad. Valores cercanos a 1.0+ significan alta compatibilidad.
- El score ya incluye los bonuses (laboral + admin), por lo que es auto-contenido.
- **No necesita normalización adicional** — ya está diseñado para ser interpretable directamente.

### 7.3 Caching

El modelo es stateless y determinístico: la misma tupla `(eco, horario)` siempre produce el mismo score. Esto lo hace ideal para cacheo en Redis (como ya se hace con `/S_ijh` y `/get_horario_penalty_finetuned`).

Clave de cache sugerida: `kde:{eco}:{horario}` → `float`

### 7.4 Manejo de Errores

| HTTP Status | Significado |
|---|---|
| `200` | Score calculado exitosamente |
| `400` | Payload inválido: eco no encontrado o horario malformado |
| `500` | Error interno del modelo |

En caso de `400` por eco desconocido, el GRASP debe manejar la ausencia de score KDE gracefully (e.g., usar score 0 o neutral).

### 7.5 Decisión Abierta para el Agente GRASP

> [!IMPORTANT]
> **¿Cómo debe combinarse el score KDE con el `S_ijh` existente?**
> 
> Opciones:
> 1. **Aditivo**: `S_ijh_final = S_ijh_actual + w_kde × score_kde` — El KDE actúa como un boost.
> 2. **Multiplicativo**: `S_ijh_final = S_ijh_actual × (1 + score_kde)` — Amplifica la señal existente.
> 3. **Reemplazo del componente IH**: Sustituir `h_ih` por `score_kde` dentro del cálculo de `S_ijh`. Esto es viable porque el KDE subsume la información del IH con mayor granularidad.
> 4. **Señal independiente en la función objetivo**: Agregar como un término separado en la función objetivo del GRASP, con su propio peso.
> 
> **El agente del GRASP debe decidir** cuál estrategia es más adecuada según la formulación actual de la función objetivo y el RCL (Restricted Candidate List).

> [!WARNING]
> **Rangos distintos**: El `score_lineal` del IH legacy opera en un rango de ~[-2, +3], mientras que el KDE opera en [0, ~1.3]. Si se combinan aditivamente, considerar normalización previa o pesos calibrados.

---

## 8. Ejemplo de Consumo desde TypeScript/Node.js

```typescript
interface KDEUnificadoResponse {
    eco: string;
    tipo_eco: "regular" | "irregular";
    score: number;
}

async function getKDEScore(eco: string, horario: string): Promise<number> {
    const res = await fetch("http://localhost:8000/predecir_kde_unificado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eco, horario }),
    });

    if (!res.ok) {
        // ECO desconocido o horario inválido → score neutro
        return 0.0;
    }

    const data: KDEUnificadoResponse = await res.json();
    return data.score;
}
```

---

## 9. Datos de Referencia (Golden Set)

Estos son resultados verificados del modelo actual para calibración:

| ECO | Tipo | Horario | `score` | `score_horas` | `score_dias` | `bonus_laboral` | Interpretación |
|---|---|---|---|---|---|---|---|
| 28650 | regular | `L:16:30-17:30` | 0.542 | 0.606 | 0.662 | 0.091 | ✅ Dentro de contrato, hora fuerte, día fuerte |
| 28650 | regular | `L:08:00-09:00` | 0.004 | 0.005 | 0.662 | 0.000 | ❌ Fuera de contrato, sin evidencia |
| 28650 | regular | `M:16:30-17:30` | 0.225 | 0.606 | 0.138 | 0.091 | ⚠️ Hora buena, día débil (steep lo aplasta) |
| 28650 | regular | `Mi:16:30-17:30` | 0.747 | 0.606 | 1.000 | 0.091 | ✅ Hora buena, mejor día |
| 6864 | irregular | `L:16:00-17:30` | 0.905 | 1.000 | 0.705 | 0.150 | ✅ Pico de densidad, día fuerte |
| 6864 | irregular | `L:08:00-09:00` | 0.000 | 0.000 | 0.705 | 0.000 | ❌ Sin evidencia alguna |

---

## 10. Archivos Relevantes

| Archivo | Descripción |
|---|---|
| `app/kde_unificado_model.py` | Wrapper de inferencia (carga joblib, expone `predecir()`) |
| `app/main.py` (líneas 363-410) | Registro de endpoints Flask |
| `app/entrenar_kde_unificado.py` | Script de entrenamiento standalone |
| `volumen/archivos/entrenar_kde_unificado_colab.ipynb` | Notebook de entrenamiento para Colab |
| `volumen/archivos/modelo_kde_unificado.joblib` | Artefacto serializado del modelo (~1.1 MB) |
| `volumen/archivos/ecos_vigentes_con_horario_regular.json` | Diccionario ECO → bloque contractual |
| `volumen/archivos/ecos_vigentes_con_horario_irregular.json` | Diccionario ECO → bloques inferidos |
| `app/verify_kde_unificado.py` | Script de verificación golden set |
