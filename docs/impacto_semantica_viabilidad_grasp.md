# Impacto de cambiar soft constraints de penalizacion a viabilidad

## Resumen ejecutivo

El cambio semantico de "penalizacion por soft constraints" a "viabilidad positiva" es correcto para el dominio, porque `r_hat` y `h_ih` ya representan senales de factibilidad o conveniencia. Sin embargo, en el estado actual del proyecto hay tres capas con semanticas mezcladas:

1. `frontend-react/src/Code` conserva la funcion objetivo como recompensa menos penalizacion.
2. `frontend-react/solution` ya transforma las soft constraints en modulos de viabilidad y las suma a `Z`.
3. `ModeloSijhCached` declara un score tipo `[0,1]`, pero calcula una suma ponderada de `rhat` y `h_ih` sin normalizar. En los logs aparecen `puntajeSijh` negativos y mayores a `2`, por ejemplo `-0.00018267`, `1.99213729` y `2.26353934`.

Eso hace que el GRASP tenga poca senal util para explorar. La fase constructiva asigna al primer profesor que pasa la FSM, la RCL no esta contextualizada por grupo, y la ejection chain ve muchos movimientos como `RUIDO_NUMERICO` o `SIN_MEJORA`. La asignacion "de corrido" observada existe en la salida: el eco `28650` queda con tres grupos de la UEA `1112013`.

## Evidencia revisada

Archivos principales:

| Ruta | Hallazgo |
| --- | --- |
| `frontend-react/src/Code/objective/FuncionObjetivoZ.ts` | `Z = recompensa - penalizacionTotal`. |
| `frontend-react/src/Code/objective/SoftConstraints.ts` | `PenalizacionHuecos` y `PenalizacionCargaConsecutiva` devuelven violaciones no negativas en la intencion del contrato. |
| `frontend-react/solution/objective/FuncionObjetivoZ.ts` | `Z = recompensa + viabilidadTotal`. |
| `frontend-react/solution/objective/SoftConstraints.ts` | `ViabilidadHuecos` y `ViabilidadCargaConsecutiva` devuelven scores positivos. |
| `frontend-react/solution/ml/ModeloSijhCached.ts` | `score = lambda_j * avgRhat + lambda_h * avgHih`, sin normalizacion por `lambda_j + lambda_h`. |
| `frontend-react/solution/ml/SijhCacheManager.ts` | El cache usa llaves `Sijh_eco_uea_horario`, pero extrae solo rangos `HH:MM-HH:MM`; se pierde el patron de dias del horario completo. |
| `frontend-react/solution/greedy/EstrategiaRCL.ts` | La RCL usa `score(p.numeroEconomico, 0)`, no el grupo candidato real. |
| `frontend-react/solution/greedy/GreedyOrchestrator.ts` | La estrategia por defecto sigue siendo MCV; para cada grupo asigna al primer profesor que pasa FSM. |
| `frontend-react/solution/greedy/EjectionChain.ts` | La optimizacion elige movimientos aleatorios y, por iteracion, evalua el primer candidato que pasa FSM; si no mejora `Z`, no explora el resto de candidatos de esa iteracion. |
| `docs/modelos_de_ipynb/rhat_con_grupo.ipynb` | Contiene la formulacion de `R_hat_ij`. |
| `docs/modelos_de_ipynb/modelo_prediccion_ih.ipynb` | Contiene la formulacion de `h_ih`/afinidad horaria. |
| `frontend-react/solution/greedy/asignaciones_eco_grupo.json` | Confirma asignaciones concentradas, incluyendo eco `28650` con tres horarios de `1112013`. |
| `frontend-react/solution/greedy/debug_grasp_ejection.json` | Muestra muchos rechazos por `RUIDO_NUMERICO` y `SIN_MEJORA`, con deltas nulos o minimos. |

## Notacion

- `i` es profesor, identificado por `numeroEconomico`/eco.
- `j` es UEA, identificada por `ueaClave`.
- `g` es un grupo concreto de una UEA; incluye `j` y un conjunto de franjas horarias `H_g`.
- `h` es una franja o identificador de horario.
- `x_ig` es binaria: vale `1` si el profesor `i` imparte el grupo `g`.
- `P_X` es el conjunto de profesores activos en la solucion `X`.
- `s_ig` es el score usado por el solver para el par profesor-grupo.
- `R_hat_ij` mide viabilidad historica/probabilistica de que `i` imparta la UEA `j`.
- `h_ih` mide viabilidad de que `i` imparta algo en el horario `h`.

## Formula actual de `R_hat_ij`

El notebook `rhat_con_grupo.ipynb` define, para pares vistos:

```text
R_hat_ij = sigma(a * (B_ij - c)) * G_ij

B_ij = (1 - w_cont) * (w_r * r_ij^(a) + w_e * e_ij^(a)) + w_cont * C_ij

r_ij^(a) = (N_ij + alpha) / (N_ia + alpha * K_a)

e_ij^(a) = [ (N_ij / N_ia) * (log((E_a + 1) / (df_j + 1)) + 1) ] / max_a

C_ij = promedio_k 2 ^ (-(t_{k+1} - t_k) / lambda_half)

G_ij = 1 - exp(-(T_ij + omega * X_ij) / kappa)
```

Para pares no vistos o casos frios, el modelo usa una rama de baja magnitud:

```text
R_hat_ij = unseen_epsilon * r_ia * q_D
```

Lectura semantica: `R_hat_ij` ya es una viabilidad positiva. Mientras mas alto, mas razonable es asignar al profesor `i` a la UEA `j`.

## Formula actual de `h_ih`

El notebook `modelo_prediccion_ih.ipynb` calcula una afinidad horaria para profesores con horario regular. Los componentes relevantes son:

```text
c_ih = cobertura_contrato_regular(i, h)
     = minutos del horario h dentro del bloque contractual de i / minutos totales de h

a_exacta_ih = (conteo_exacto_ih + alpha_out * prior_global_h) / (total_out_i + alpha_out)

a_overlap_ih =
    w_overlap  * similitud_overlap
  + w_duration * similitud_duration
  + w_days     * similitud_days
  + w_time     * similitud_time

a_fuera_ih = rho_exact * a_exacta_ih + (1 - rho_exact) * a_overlap_ih

u_h = preferencia_admin(h)
```

La puntuacion lineal y el score final son:

```text
score_lineal_ih =
    lambda_in        * c_ih
  + lambda_out       * (1 - c_ih) * a_fuera_ih
  + lambda_admin_pos * u_h
  - gamma_contrato   * (1 - c_ih) * (1 - a_fuera_ih)
  - gamma_admin      * (1 - u_h)

h_ih = clip(score_lineal_ih, 0, 1)
```

Lectura semantica: `h_ih` tambien es una viabilidad positiva. No codifica una preferencia "matematicas en la tarde/fisica en la manana"; codifica si el profesor puede o suele estar disponible en ese horario considerando contrato, ajustes administrativos y patrones historicos.

## Formula actual del score cacheado `s_ig`

La implementacion `ModeloSijhCached.score(i, g)` obtiene todas las franjas `HH:MM-HH:MM` del grupo `g`, busca cada llave en Redis y promedia:

```text
avgRhat_ig = (1 / |H_g|) * sum_{h in H_g} rhat_ijh
avgHih_ig  = (1 / |H_g|) * sum_{h in H_g} h_ih

s_ig = lambda_j * avgRhat_ig + lambda_h * avgHih_ig
```

Problema: si `lambda_j = lambda_h = 1`, el score esperado queda en `[0,2]`, no en `[0,1]`. Ademas, los logs muestran valores negativos y mayores a `2`, por lo que alguna salida del backend/cache o la escala de entrada no esta acotada como el solver espera.

Tambien hay perdida de informacion: el cache extrae `HH:MM-HH:MM` desde horarios como `L:13:00-14:30|Mi:13:00-14:30|V:13:00-14:30`. Si el modelo `h_ih` fue entrenado con patron de dias, el solver esta reduciendo `h` a "hora del dia" y no a "horario completo".

## Funcion objetivo con penalizacion

La semantica de `src/Code` es:

```text
Z_pen(X) = sum_{(i,g)} s_ig * x_ig - sum_{k in K} lambda_k * f_k(X)
```

Donde `f_k(X) >= 0` representa una violacion. Para huecos:

```text
gap_{p,d,m} = max(0, inicio_{m} - fin_{m-1})

f_huecos(X) =
  (1 / |P_X|)
  * sum_{p in P_X} sum_d sum_m
      min(gap_{p,d,m} / REF_MAX_HUECOS, 1)
      * (1 - promedio_s_de_los_dos_grupos)
```

Para carga consecutiva:

```text
exceso_b = max(0, duracion_bloque_b - umbral_horas)

f_consecutiva(X) =
  (1 / |P_X|)
  * sum_{p in P_X} sum_b
      min(exceso_b / REF_MAX_EXCESO, 1)
      * (1 - promedio_s_del_bloque)
```

Problema: si `s_ig > 1`, entonces `(1 - s_ig)` puede ser negativo. En la semantica de penalizacion eso convierte una violacion en "bono" y distorsiona `Z`. En `solution` se agrego `max(0, 1 - wPromedio)`, lo cual evita penalizaciones negativas, pero tambien apaga toda penalizacion cuando `s_ig >= 1`.

## Funcion objetivo con viabilidad

La semantica de `solution` es:

```text
Z_via(X) = sum_{(i,g)} s_ig * x_ig + sum_{k in K} lambda_k * V_k(X)
```

Con:

```text
V_huecos(X) =
  (1 / |P_X|)
  * sum_{p in P_X} max(0, 1 - reducciones_huecos_p)

V_consecutiva(X) =
  (1 / |P_X|)
  * sum_{p in P_X} max(0, 1 - reducciones_consecutiva_p)
```

Si `V_k(X) = 1 - f_k(X)` y `f_k` esta acotada en `[0,1]`, entonces:

```text
Z_via(X) = sum s_ig*x_ig + sum lambda_k * (1 - f_k(X))
         = Z_pen(X) + sum lambda_k
```

Es decir, para comparar dos soluciones con la misma estructura de asignacion, el cambio es casi solo una constante y no deberia cambiar las decisiones. Pero la implementacion actual no garantiza esa equivalencia por cuatro razones:

1. `s_ig` no esta acotado en `[0,1]`.
2. Las reducciones usan `max(0, 1 - wPromedio)`, asi que cualquier `wPromedio >= 1` elimina el efecto de la soft constraint.
3. La recompensa principal tambien usa `s_ig`, de modo que el mismo score ML se usa dos veces: como recompensa directa y como mitigador de violaciones.
4. El cache de horarios puede estar perdiendo dias, reduciendo el contraste real de `h_ih`.

## Impacto del cambio semantico

### 1. El valor absoluto de `Z` deja de ser comparable

Un valor como `384.14` antes y despues no basta para concluir que la busqueda local no funciono si se cambio la semantica. Al pasar de penalizacion a viabilidad, `Z` puede desplazarse por constantes `sum lambda_k`. La comparacion correcta debe hacerse con:

```text
Delta Z = Z_nuevo - Z_actual
desglose = recompensa, viabilidadTotal o penalizacionTotal
conteo de movimientos aceptados/rechazados
```

### 2. Las lambdas cambian de significado

En penalizacion, `lambda_k` es el precio de violar una preferencia. En viabilidad, `lambda_k` es el premio por mantener una propiedad deseable. No se deben reutilizar sin calibracion.

### 3. La FSM domina al modelo

La FSM decide si una asignacion es legal. En `solution`, las reglas duras incluyen ignorar grupos SAI/CPRO, asignacion global, traslape, horario laboral, programacion, area y maximo diario. Si un profesor pasa esas reglas antes que otros, el greedy lo asigna, aun si su score ML no es el mejor entre todos los factibles.

Esto explica parte del patron "de corrido": el solver no esta resolviendo `argmax_i s_ig` por grupo; esta recorriendo profesores en orden y aceptando al primero que sea factible.

### 4. La RCL no esta guiando por `s_ig`

La interfaz actual de estrategia solo recibe:

```text
ordenarProfesores(profesores)
```

No recibe el grupo `g`, por lo que `EstrategiaRCL` usa:

```text
score(p.numeroEconomico, 0)
```

Para `ModeloSijhCached`, `grupoId = 0` no existe, asi que el score tiende a `0` para todos. La RCL queda sin senal contextual.

### 5. La ejection chain queda con poca capacidad de mejora

La busqueda local selecciona un grupo aleatorio, baraja candidatos del area y evalua el primer candidato que pasa FSM. Si ese candidato no mejora `Z`, restaura y termina esa iteracion sin probar los demas candidatos factibles.

En los logs se observan rechazos como:

```text
ZNuevo: 386.08 | ZActual: 386.09 -> SIN_MEJORA
ZNuevo: 386.34 | ZActual: 386.34 -> RUIDO_NUMERICO
ZNuevo: 388.83 | ZActual: 388.83 -> RUIDO_NUMERICO
```

Si la soft constraint esta saturada por `s_ig >= 1`, muchos swaps producen el mismo `Z` o diferencias minimas.

### 6. `h_ih` puede estar subutilizado

El usuario espera que el horario del profesor pese bastante, pero hoy hay dos posibles bloqueos:

1. `ReglaHorarioLaboral` convierte parte de la disponibilidad en restriccion dura.
2. `SijhCacheManager` reduce horarios completos a rangos `HH:MM-HH:MM`, perdiendo dias y patron semanal.

Si `h_ih` fue entrenado con horarios tipo `L:14:30-16:00|Mi:14:30-16:00|V:14:30-16:00`, usar solo `14:30-16:00` aplana la senal.

## Posibles soluciones

### Solucion 1: normalizar `s_ig` antes de usarlo

Reemplazar la suma por una combinacion convexa:

```text
r_ig = clip(avgRhat_ig, 0, 1)
h_ig = clip(avgHih_ig, 0, 1)

s_ig = alpha_r * r_ig + alpha_h * h_ig

alpha_r >= 0, alpha_h >= 0, alpha_r + alpha_h = 1
```

O, si se quiere que una mala senal reduzca fuertemente la otra:

```text
s_ig = (r_ig + epsilon) ^ alpha_r * (h_ig + epsilon) ^ alpha_h
```

Esto evita que `s_ig > 1` apague las soft constraints y permite que `h_ih` compita con `r_hat`.

### Solucion 2: hacer la RCL contextual por grupo

Cambiar la interfaz a algo como:

```text
ordenarProfesores(profesores, grupo, grafoActual)
```

Y construir la RCL con:

```text
s_max = max_i s_ig
s_min = min_i s_ig
threshold = s_max - alpha * (s_max - s_min)

RCL(g) = { i | s_ig >= threshold y FSM(i,g) = OK }
```

Despues seleccionar aleatoriamente dentro de `RCL(g)`, no solo barajar una lista global de profesores.

### Solucion 3: construir candidatos factibles antes de asignar

La fase constructiva deberia cambiar de "primer profesor que pasa FSM" a:

```text
C_g = { i | FSM(i,g) = OK }
elegir i desde RCL(C_g, s_ig)
asignar i,g
```

Esto ataca directamente la asignacion rigida. Si eco `28650` recibe tres grupos de `1112013`, deberia ser porque gana dentro de candidatos factibles en cada grupo, no solo porque aparece temprano en el orden.

### Solucion 4: preservar el horario completo en el cache

Si el backend/modelo `h_ih` entiende horario completo, la llave y el payload deben conservarlo:

```text
Sijh_{eco}_{uea}_{horario_id_completo}
```

Ejemplo:

```text
Sijh_28650_1112013_L:13:00-14:30|Mi:13:00-14:30|V:13:00-14:30
```

Si se decide seguir usando franjas atomicas, entonces el notebook y el backend deben entrenarse y validarse con esa misma semantica atomica. Mezclar entrenamiento con horario completo y cache con franja simple baja el contraste del modelo.

### Solucion 5: separar recompensa ML de viabilidad estructural

Evitar que `s_ig` aparezca dos veces, como recompensa directa y como mitigador de huecos. Una funcion mas interpretable seria:

```text
Z(X) =
    lambda_A   * A(X)
  + lambda_r   * R(X)
  + lambda_h   * H(X)
  + lambda_gap * V_gap(X)
  + lambda_con * V_consecutiva(X)
  + lambda_div * V_diversidad(X)
```

Con:

```text
A(X) = grupos_asignados / grupos_totales

R(X) = promedio de R_hat_ij sobre asignaciones

H(X) = promedio de h_ih sobre asignaciones

V_gap(X) = 1 - f_huecos(X)

V_consecutiva(X) = 1 - f_consecutiva(X)
```

Los pesos deben estar en una escala comun. Una opcion robusta es imponer:

```text
lambda_A + lambda_r + lambda_h + lambda_gap + lambda_con + lambda_div = 1
```

Si cubrir todos los grupos es lexicograficamente prioritario, usar:

```text
Z(X) = M * grupos_asignados + Z_secundaria(X)
```

con `M` mayor que la maxima variacion posible de `Z_secundaria`.

### Solucion 6: agregar diversidad contra asignaciones "de corrido"

Si pedagogica o administrativamente no se desea que un profesor concentre demasiados grupos de la misma UEA, agregar un modulo explicito:

```text
n_ij(X) = numero de grupos de UEA j asignados al profesor i

f_repeticion(X) = sum_i sum_j max(0, n_ij(X) - q_j)^2

V_diversidad(X) = 1 - min(f_repeticion(X) / REF_REPETICION, 1)
```

Donde `q_j` puede ser `1` si se quiere repartir grupos de la misma UEA, o un limite mayor si repetir profesor es aceptable pero no de forma ilimitada.

Importante: esta regla no debe esconderse dentro de `r_hat` o `h_ih`; es una preferencia operacional distinta.

### Solucion 7: fortalecer ejection chains

Cambios recomendados:

1. Ordenar candidatos de swap por `Delta Z` estimada, no solo por azar.
2. Probar mas de un candidato factible por iteracion.
3. Permitir movimientos neutrales controlados si ayudan a escapar de mesetas.
4. Registrar desglose de `Delta recompensa`, `Delta h_ih`, `Delta r_hat`, `Delta V_gap` y `Delta V_consecutiva`.
5. Usar una lista tabu corta para no volver inmediatamente al mismo swap.

Con la semantica actual, la ejection chain no esta superando mesetas porque el objetivo tiene demasiados empates o casi empates.

### Solucion 8: calibrar por distribuciones reales

Antes de tocar lambdas a mano, generar histogramas:

```text
hist(R_hat_ij)
hist(h_ih)
hist(s_ig)
hist(Delta Z por swap factible)
hist(numero de candidatos FSM-validos por grupo)
```

Criterios minimos:

1. `s_ig` debe estar en `[0,1]`.
2. Para cada grupo debe haber contraste entre candidatos factibles.
3. `Delta Z` por swaps factibles debe tener varianza visible.
4. Las soft constraints no deben devolver siempre `1.0` ni siempre `0.0`.
5. La RCL debe contener mas de un candidato en grupos con alternativas reales.

## Formula recomendada

Para mantener la interpretacion de viabilidad, recomiendo usar una funcion de utilidad normalizada:

```text
s_ig =
    alpha_r * clip(R_hat_ij, 0, 1)
  + alpha_h * clip(avg_{h in H_g} h_ih, 0, 1)

alpha_r + alpha_h = 1
```

Y:

```text
Z(X) =
    M * grupos_asignados
  + lambda_s   * promedio_{x_ig = 1}(s_ig)
  + lambda_gap * V_gap(X)
  + lambda_con * V_consecutiva(X)
  + lambda_div * V_diversidad(X)
```

Donde:

```text
V_gap(X) = 1 - f_huecos_normalizado(X)
V_consecutiva(X) = 1 - f_consecutiva_normalizado(X)
```

Y todas las `V` viven en `[0,1]`. En esta version:

- `R_hat_ij` decide adecuacion profesor-UEA.
- `h_ih` decide viabilidad profesor-horario.
- `V_gap` y `V_consecutiva` deciden calidad estructural del horario resultante.
- `V_diversidad` controla concentracion de grupos si se desea evitar asignaciones de corrido.

## Checklist de implementacion

1. Unificar `src/Code` y `solution` para que solo exista una semantica de objetivo.
2. Normalizar `ModeloSijhCached.score()` a `[0,1]`.
3. Corregir la documentacion de `IModeloML`: si el contrato dice `[0,1]`, hacerlo cumplir con tests.
4. Preservar el `horario_id` completo en Redis si el modelo horario fue entrenado con dias.
5. Cambiar `EstrategiaOrdenamiento.ordenarProfesores()` para recibir `grupo` y, opcionalmente, `grafoActual`.
6. Construir RCL con candidatos que pasan FSM para el grupo actual.
7. Hacer que ejection chain pruebe varios candidatos factibles por movimiento.
8. Agregar un modulo de diversidad si se quiere limitar `n_ij`, es decir, muchos grupos de la misma UEA al mismo eco.
9. Registrar en logs los componentes de `Z`, no solo `ZNuevo` y `ZActual`.
10. Validar con histogramas que `r_hat`, `h_ih`, `s_ig` y `Delta Z` tienen contraste.

## Conclusion

Cambiar de penalizacion a viabilidad no es el problema por si mismo. De hecho, encaja mejor con `r_hat` y `h_ih`. El problema es que la implementacion actual mezcla escalas y contratos:

- `s_ig` no esta normalizado.
- La RCL no usa el grupo real.
- La fase constructiva asigna al primer factible.
- La ejection chain explora pocos candidatos por iteracion.
- El cache de `h_ih` puede estar perdiendo dias del horario.
- Las soft constraints se saturan cuando `s_ig >= 1`.

La ruta mas segura es normalizar primero la puntuacion, contextualizar la RCL por grupo, preservar la semantica completa de horario y separar en la funcion objetivo las viabilidades de UEA, horario, estructura y diversidad.
