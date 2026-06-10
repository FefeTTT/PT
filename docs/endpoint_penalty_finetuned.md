# `POST /get_horario_penalty_finetuned`

Penalización de carga histórica — modelo fine-tuneado (V2).

Evalúa qué tan compatible es una asignación propuesta (eco + horario + UEA) con el perfil histórico de carga del profesor, retornando un score de penalización, una curva de carga por número de UEAs, y los 5 patrones de horario más frecuentes del profesor.

---

## Request

**Method:** `POST`  
**Content-Type:** `application/json`  
**URL:** `http://<host>:8000/get_horario_penalty_finetuned`

### Body Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `eco` | `string` | ✅ | Número económico del profesor |
| `horario` | `string` | ✅ | Horario de la UEA a evaluar (ver [Formatos de horario](#formatos-de-horario)) |
| `ueas_asignadas_actuales` | `string[]` | ✅ | Claves de UEA ya asignadas al profesor en el periodo actual. Enviar `[]` si no tiene ninguna |
| `horarios_asignados_actuales` | `string[]` | ✅ | Horarios correspondientes a las UEAs ya asignadas (mismo orden que `ueas_asignadas_actuales`). Enviar `[]` si no tiene ninguna |
| `uea_prediccion` | `string` | ❌ | Clave de la UEA que se está evaluando. Default: `"__PRED__"` |

### Formatos de horario

Se aceptan dos formatos para `horario` y cada elemento de `horarios_asignados_actuales`:

| Formato | Ejemplo | Interpretación |
|---|---|---|
| **Simple** | `"07:00-08:30"` | Se distribuye automáticamente a L+Mi+V: `"L:07:00-08:30\|Mi:07:00-08:30\|V:07:00-08:30"` |
| **Completo** | `"L:07:00-08:30\|Mi:07:00-08:30\|V:07:00-08:30"` | Días explícitos separados por `\|`. Días válidos: `L`, `M`, `Mi`, `J`, `V` |

---

## Response

**Content-Type:** `application/json`  
**Status:** `200 OK`

### Response Body

```json
{
    "eco": "28650",
    "total_penalty": -0.7939659472302814,
    "loads": [-1.34e-06, -0.75571069, -0.10956443, -0.10956443],
    "best_5": [
        {
            "pattern": "L:16:00-17:30#1|Mi:16:00-17:30#1|V:16:00-17:30#1",
            "frequency": 0.1
        },
        {
            "pattern": "L:16:00-19:00#2|Mi:16:00-19:00#2|V:16:00-19:00#2",
            "frequency": 0.1
        }
    ]
}
```

### Response Fields

| Field | Type | Description |
|---|---|---|
| `eco` | `string` | Número económico del profesor (echo-back) |
| `total_penalty` | `float` | Score total de penalización para la asignación propuesta. Negativo = más penalización, positivo = la asignación está respaldada por el historial |
| `loads` | `float[]` | Curva de carga semanal: penalty para W=2, 3, 4, 5 UEAs. Representa cuánta penalización acumula el profesor por tener esa cantidad total de UEAs en el periodo, basándose únicamente en el componente semanal (rareza histórica) |
| `best_5` | `object[]` | Top 5 patrones de bloques históricos del profesor, ordenados por frecuencia descendente |

### `loads` — Detalle

El array `loads` contiene 4 valores correspondientes a W=2, W=3, W=4, W=5 UEAs totales en el periodo:

```
loads[0] → penalty si el profesor tuviera 2 UEAs en total
loads[1] → penalty si el profesor tuviera 3 UEAs en total
loads[2] → penalty si el profesor tuviera 4 UEAs en total
loads[3] → penalty si el profesor tuviera 5 UEAs en total
```

- Usa solo el componente **semanal** (rareza de UEA totales × lambda_semanal), sin componentes diarios ni de bloques (que dependen de la geometría específica de horarios).
- Los valores son **idénticos** para un mismo eco independientemente de qué horarios concretos se asignen, ya que reflejan la tolerancia inherente del profesor a cargas de diferente magnitud.
- Valores más negativos = mayor penalización = menos típico para ese profesor.

### `best_5` — Detalle

Cada entrada en `best_5` contiene:

| Field | Type | Description |
|---|---|---|
| `pattern` | `string` | Firma canónica del patrón de bloques. Formato: `DÍA:INICIO-FIN#N_UEAS` por bloque, separados por `\|` |
| `frequency` | `float` | Frecuencia normalizada (0–1) de este patrón en el historial del profesor |

**Lectura de la firma:**
```
L:16:00-19:00#2|Mi:16:00-19:00#2|V:16:00-19:00#2
│  │         │ │
│  │         │ └─ 2 UEAs en ese bloque
│  │         └─── fin del bloque
│  └──────────── inicio del bloque
└─────────────── día de la semana
```

Si el profesor no tiene historial, se retornan los patrones globales más frecuentes como fallback.

---

## Componentes del `total_penalty`

El score `total_penalty` combina tres componentes ponderados:

```
total_penalty = -(λ_diaria × cost_diaria + λ_semanal × cost_semanal + λ_bloques × cost_bloques - bonus)
```

| Componente | Qué mide |
|---|---|
| **Diario** (`cost_diaria`) | Exceso de horas consecutivas en un bloque + exceso de UEAs por bloque respecto al perfil histórico |
| **Semanal** (`cost_semanal`) | Qué tan inusual es tener W UEAs totales para este profesor, basado en probabilidad de cola histórica |
| **Bloques históricos** (`cost_bloques`) | Qué tan atípica es la forma de los bloques (horas, fragmentación, gaps) respecto al historial |
| **Bonus** | Reduce la penalización si el patrón de bloques tiene respaldo histórico fuerte |

### Escala de valores

| Rango | Interpretación |
|---|---|
| `> 0` | La asignación está **respaldada** por el historial (patrón familiar, bonus) |
| `0` | Neutral — ni penaliza ni beneficia |
| `-0.5 a 0` | Penalización **leve** — ligeramente atípico |
| `-1.0 a -0.5` | Penalización **moderada** — carga o patrón inusual |
| `-2.0 a -1.0` | Penalización **severa** — muy fuera del perfil histórico |
| `-2.0` | **Tope** — penalización máxima (clamped) |

---

## Errores

| Status | Condición | Ejemplo |
|---|---|---|
| `400` | Parámetros faltantes o inválidos | `{"error": "eco es requerido"}` |
| `400` | Horario vacío o no parseable | `{"error": "horario no puede estar vacío."}` |
| `500` | Error interno del modelo | `{"error": "Error interno en predicción de penalty fine-tuneado: ..."}` |
| `503` | Modelo `.joblib` no encontrado | `{"error": "Modelo fine-tuneado no encontrado: ..."}` |

---

## Ejemplos

### Ejemplo 1 — Asignar la 2ª UEA

Profesor ya tiene 1 UEA (14:30-16:00), evaluando asignar 16:00-17:30.

**Request:**
```json
{
    "eco": "28650",
    "horario": "L:16:00-17:30|Mi:16:00-17:30|V:16:00-17:30",
    "ueas_asignadas_actuales": ["UEA_1430"],
    "horarios_asignados_actuales": [
        "L:14:30-16:00|Mi:14:30-16:00|V:14:30-16:00"
    ],
    "uea_prediccion": "UEA_1600"
}
```

**Response:**
```json
{
    "eco": "28650",
    "total_penalty": 0.031187846064919665,
    "loads": [-1.34e-06, -0.75571069, -0.10956443, -0.10956443],
    "best_5": [
        {"pattern": "L:16:00-17:30#1|Mi:16:00-17:30#1|V:16:00-17:30#1", "frequency": 0.1},
        {"pattern": "L:16:00-19:00#2|Mi:16:00-19:00#2|V:16:00-19:00#2", "frequency": 0.1},
        {"pattern": "L:16:00-19:00#2|V:16:00-19:00#2", "frequency": 0.066667},
        {"pattern": "L:14:30-17:30#2|M:16:00-17:30#1|Mi:14:30-16:00#1|J:16:00-17:30#1|V:14:30-17:30#2", "frequency": 0.033333},
        {"pattern": "L:08:30-11:30#2|Mi:08:30-11:30#2|V:08:30-11:30#2", "frequency": 0.033333}
    ]
}
```

> `total_penalty = +0.031` → Asignación favorable, patrón familiar para el profesor.

---

### Ejemplo 2 — Asignar la 3ª UEA (consecutiva)

Profesor ya tiene 2 UEAs (14:30-16:00 y 16:00-17:30), evaluando asignar 17:30-19:00 (consecutiva).

**Request:**
```json
{
    "eco": "28650",
    "horario": "L:17:30-19:00|Mi:17:30-19:00|V:17:30-19:00",
    "ueas_asignadas_actuales": ["UEA_1430", "UEA_1600"],
    "horarios_asignados_actuales": [
        "L:14:30-16:00|Mi:14:30-16:00|V:14:30-16:00",
        "L:16:00-17:30|Mi:16:00-17:30|V:16:00-17:30"
    ],
    "uea_prediccion": "UEA_1730"
}
```

**Response:**
```json
{
    "eco": "28650",
    "total_penalty": -0.7939659472302814,
    "loads": [-1.34e-06, -0.75571069, -0.10956443, -0.10956443],
    "best_5": [...]
}
```

> `total_penalty = -0.794` → Penalización moderada. El bloque consecutivo 14:30→19:00 (4.5h) excede los hábitos típicos del profesor.

---

### Ejemplo 3 — Asignar la 3ª UEA (gap matutino)

Profesor ya tiene 2 UEAs tarde (14:30-16:00 y 16:00-17:30), evaluando asignar 11:30-13:00 (mañana, con gap).

**Request:**
```json
{
    "eco": "28650",
    "horario": "L:11:30-13:00|Mi:11:30-13:00|V:11:30-13:00",
    "ueas_asignadas_actuales": ["UEA_1430", "UEA_1600"],
    "horarios_asignados_actuales": [
        "L:14:30-16:00|Mi:14:30-16:00|V:14:30-16:00",
        "L:16:00-17:30|Mi:16:00-17:30|V:16:00-17:30"
    ],
    "uea_prediccion": "UEA_1130"
}
```

**Response:**
```json
{
    "eco": "28650",
    "total_penalty": -0.8462867109489718,
    "loads": [-1.34e-06, -0.75571069, -0.10956443, -0.10956443],
    "best_5": [...]
}
```

> `total_penalty = -0.846` → Peor que el caso consecutivo. El gap mañana-tarde más la carga de 3 UEAs es más atípico para este profesor cuyo historial es exclusivamente vespertino.

---

## PowerShell — Comandos de prueba

```powershell
# Asignar 3ª UEA (17:30-19:00) con 2 ya asignadas
$body = @{
    eco = "28650"
    horario = "L:17:30-19:00|Mi:17:30-19:00|V:17:30-19:00"
    ueas_asignadas_actuales = @("UEA_1430", "UEA_1600")
    horarios_asignados_actuales = @(
        "L:14:30-16:00|Mi:14:30-16:00|V:14:30-16:00",
        "L:16:00-17:30|Mi:16:00-17:30|V:16:00-17:30"
    )
    uea_prediccion = "UEA_1730"
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "http://127.0.0.1:8000/get_horario_penalty_finetuned" `
    -Method Post `
    -Headers @{"Content-Type"="application/json"} `
    -Body $body | ConvertTo-Json -Depth 5
```

### curl (Linux / Git Bash)

```bash
curl -s -X POST http://127.0.0.1:8000/get_horario_penalty_finetuned \
  -H "Content-Type: application/json" \
  -d '{
    "eco": "28650",
    "horario": "L:17:30-19:00|Mi:17:30-19:00|V:17:30-19:00",
    "ueas_asignadas_actuales": ["UEA_1430", "UEA_1600"],
    "horarios_asignados_actuales": [
        "L:14:30-16:00|Mi:14:30-16:00|V:14:30-16:00",
        "L:16:00-17:30|Mi:16:00-17:30|V:16:00-17:30"
    ],
    "uea_prediccion": "UEA_1730"
  }' | python -m json.tool
```

---

## Notas técnicas

- El modelo cargado es `modelo_penalizacion_carga_historica_gpu.joblib`, serializado como instancia de `PenalizacionCargaHistoricaModel` (V2) con parámetros optimizados vía fine-tuning distribucional.
- El modelo se carga como singleton (una sola instancia compartida entre requests).
- `loads` se computa usando solo el componente semanal (`_rareza_ueas_totales × lambda_ueas × lambda_semanal`). No incluye componentes diarios ni de bloques porque esos requieren la geometría exacta de los horarios, que no está disponible para cargas hipotéticas.
- `best_5` proviene de `_block_pattern_weights_[eco]`, que cuenta la frecuencia de cada firma de bloques en el historial del profesor. Si el profesor no tiene historial, se usan los patrones globales.
