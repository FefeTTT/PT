# Informe depurado: impacto de cambiar soft constraints de penalización a viabilidad en GRASP

## Resumen ejecutivo

El cambio semántico de soft constraints desde **penalización** hacia **viabilidad positiva** es consistente con la interpretación de `R_hat_ij` y `h_ih`, porque ambos ya representan señales de conveniencia o factibilidad. Por sí mismo, ese cambio **no debería deteriorar** el funcionamiento de GRASP.

El riesgo real aparece cuando coexisten tres problemas:

1. se mezclan escalas incompatibles entre el bloque ML y los módulos estructurales;
2. se usa un score local `s_ig` en fórmulas que asumen implícitamente que vive en `[0,1]` aunque en implementación no siempre se cumple;
3. la construcción y la mejora local no utilizan de forma contextual el score por grupo factible.

La conclusión técnica es:

- **el problema principal no es pasar de penalización a viabilidad**;
- **el problema principal es la mezcla de contratos, escalas y semánticas dentro de la función objetivo y de la heurística**.

---

## Alcance de este documento

Este documento distingue entre tres niveles de afirmación:

- **Hecho matemático**: se sostiene por formulación y álgebra.
- **Inferencia técnica**: es consistente con el diseño descrito, pero depende de calibración o de cómo se integran los módulos.
- **Hipótesis de implementación**: requiere validación directa sobre el código fuente, logs y artefactos del proyecto.

---

## 1. Hechos matemáticos

### 1.1 Cambiar de penalización a viabilidad no altera GRASP si se preserva el orden

Sea una función objetivo con restricciones suaves expresadas como penalización:

```text
Z_pen(X) = Recompensa(X) - sum_k lambda_k f_k(X)
```

con `f_k(X) >= 0`.

Si se redefine cada módulo como viabilidad:

```text
V_k(X) = 1 - f_k(X)
```

entonces:

```text
Z_via(X) = Recompensa(X) + sum_k lambda_k V_k(X)
         = Recompensa(X) + sum_k lambda_k (1 - f_k(X))
         = Z_pen(X) + sum_k lambda_k
```

Si `lambda_k` es constante y `f_k(X)` está bien acotada, pasar de penalización a viabilidad **solo desplaza el valor absoluto de Z por una constante**, sin alterar el orden relativo entre soluciones.

### 1.2 El valor absoluto de `Z` deja de ser comparable entre semánticas

Después de ese cambio, comparar únicamente valores absolutos de `Z` entre dos versiones del solver puede inducir conclusiones erróneas. Lo correcto es comparar:

```text
Delta Z = Z_nuevo - Z_actual
```

junto con el desglose por componentes.

### 1.3 El uso de expresiones tipo `1 - s_ig` exige contrato de rango

Si una soft constraint usa factores como:

```text
1 - s_ig
```

o variantes equivalentes, entonces `s_ig` debe tener un contrato claro, idealmente en `[0,1]`.

Si `s_ig > 1`, ocurren dos problemas:

1. `1 - s_ig` se vuelve negativo;
2. al envolverlo en expresiones como `max(0, 1 - s_ig)`, la penalización puede saturarse o apagarse por completo.

Esto no es un problema de GRASP en abstracto; es un problema de **inconsistencia entre la fórmula y el rango efectivo del score**.

### 1.4 `R_hat_ij` y `h_ih` ya tienen semántica positiva

Si:

- `R_hat_ij` representa qué tan razonable es asignar al profesor `i` a la UEA `j`, y
- `h_ih` representa qué tan razonable es asignar al profesor `i` al horario `h`,

entonces ambos son naturalmente interpretables como **viabilidades positivas**. Por tanto, usarlos en una combinación que luego se maximiza es coherente con el dominio.

---

## 2. Inferencias técnicas correctas pero dependientes de calibración

### 2.1 Normalizar `s_ig` a `[0,1]` no es requisito universal, pero sí una decisión prudente

GRASP no exige por definición que el score local viva en `[0,1]`. Solo necesita una función ordenable y consistente.

Sin embargo, si el sistema usa `s_ig` además como factor dentro de módulos estructurales formulados con expresiones tipo `1 - s_ig`, entonces sí conviene imponer un contrato explícito:

```text
s_ig in [0,1]
```

En esta arquitectura, normalizar o acotar `s_ig` no es una necesidad teórica general, pero sí una **decisión prudente y casi obligada** para evitar saturaciones y ambigüedad semántica.

### 2.2 Conviene separar mezcla interna y peso global

Si se define:

```text
s_ig = alpha_r * r_ig + alpha_h * h_ig
```

con `alpha_r + alpha_h = 1`, eso resuelve la mezcla interna entre afinidad profesor-UEA y afinidad profesor-horario.

Pero aún queda otro problema: cuánto pesa el bloque ML frente a la estructura global del horario.

Por claridad conviene distinguir:

```text
s_ig = alpha_r * r_ig + alpha_h * h_ig

Z(X) = beta_s * ScoreML(X) + lambda_gap * V_gap(X) + lambda_con * V_consecutiva(X) + ...
```

Aquí:

- `alpha_r`, `alpha_h` controlan la mezcla **dentro** de `s_ig`;
- `beta_s` controla el peso **global** del bloque ML dentro de `Z`.

### 2.3 La FSM debe dominar la factibilidad, no necesariamente la preferencia

En un solver con restricciones duras es normal que la FSM filtre candidatos. Eso no es un error.

Lo problemático sería que, una vez construido el conjunto factible para un grupo `g`, la heurística no elija con base en el score contextual ni explore bien alternativas comparables.

Así, la afirmación correcta no es “la FSM domina al modelo y eso está mal”, sino:

- la FSM debe dominar la **factibilidad**;
- el modelo debe dominar la **priorización entre candidatos factibles**.

### 2.4 Una penalización de diversidad es una preferencia adicional, no una corrección semántica

Agregar un término para evitar que un mismo profesor concentre demasiados grupos de la misma UEA es razonable si eso refleja una política académica o administrativa.

Pero esa decisión no corrige el cambio penalización→viabilidad; introduce una preferencia distinta:

```text
V_diversidad(X)
```

Conviene tratarla como módulo independiente y no como “arreglo” del bloque `R_hat` o `h_ih`.

---

## 3. Hipótesis de implementación que deben validarse sobre el código

Las afirmaciones de esta sección son plausibles, pero requieren confirmación directa en el repositorio, artefactos y logs.

### 3.1 Hipótesis: la RCL no usa realmente el grupo candidato

Si la estrategia de ordenamiento o la RCL no recibe el grupo `g` y consulta el modelo con un identificador dummy o no contextual, entonces el score usado para ordenar profesores pierde señal específica del grupo.

Efecto esperado:

- la RCL se vuelve casi ciega al contexto;
- el componente ML deja de diferenciar bien entre candidatos para ese grupo.

### 3.2 Hipótesis: la fase constructiva toma al primer factible

Si el greedy no construye explícitamente el conjunto:

```text
C_g = { i | FSM(i, g) = OK }
```

y en cambio asigna al primer profesor que pasa la FSM, entonces el solver deja de aproximar:

```text
argmax_i s_ig
```

y pasa a depender del orden de iteración.

Efecto esperado:

- asignaciones rígidas o “de corrido”;
- concentración de grupos en profesores tempranos en el orden.

### 3.3 Hipótesis: la mejora local explora pocos candidatos por movimiento

Si una ejection chain o búsqueda local restaura el estado al primer candidato factible que no mejora `Z` y no continúa explorando, entonces la búsqueda local queda muy débil para salir de mesetas.

Efecto esperado:

- muchos eventos tipo `SIN_MEJORA` o `RUIDO_NUMERICO`;
- diferencias minúsculas entre estados vecinos;
- bajo aprovechamiento del espacio de vecindad.

### 3.4 Hipótesis: el cache de horarios reduce demasiado la semántica de `h_ih`

Si el modelo horario fue entrenado con patrones completos del tipo:

```text
L:13:00-14:30|Mi:13:00-14:30|V:13:00-14:30
```

y el solver consulta el cache usando solo rangos simples como:

```text
13:00-14:30
```

entonces podría estarse perdiendo el patrón de días, que sí era informativo en entrenamiento.

Efecto esperado:

- aplanamiento de la señal horaria;
- menor contraste entre horarios aparentemente iguales en hora pero distintos en patrón semanal.

### 3.5 Hipótesis: el score local participa dos veces en `Z`

Si `s_ig` aparece:

1. como recompensa directa de asignación, y
2. como modulador dentro de soft constraints,

entonces el modelo ML influye dos veces sobre el objetivo total.

Efecto esperado:

- pérdida de interpretabilidad de lambdas;
- dificultad para calibrar el peso relativo entre adecuación local y estructura global.

---

## 4. Interpretación del impacto real del cambio de semántica

El cambio de penalización a viabilidad **no parece ser la causa primaria** de una degradación en el comportamiento del solver.

El impacto real del cambio es este:

1. obliga a revisar el contrato de rango de los scores usados por las soft constraints;
2. vuelve no comparables los valores absolutos de `Z` entre versiones;
3. hace visible la necesidad de separar mejor los componentes del objetivo.

Si la búsqueda actual presenta poca sensibilidad, asignaciones concentradas o mejoras locales débiles, la explicación más plausible no es “usar viabilidad está mal”, sino la interacción entre:

- score local sin contrato claro;
- RCL posiblemente no contextual;
- greedy posiblemente dependiente del orden;
- búsqueda local con poca exploración;
- posible pérdida de semántica del horario en el cache.

---

## 5. Formulación recomendada

### 5.1 Score local profesor-grupo

Definir primero una utilidad local coherente y acotada:

```text
r_ig = clip(R_hat_ij, 0, 1)
h_ig = clip(promedio_{h in H_g} h_ih, 0, 1)

s_ig = alpha_r * r_ig + alpha_h * h_ig
```

con:

```text
alpha_r >= 0
alpha_h >= 0
alpha_r + alpha_h = 1
```

### 5.2 Función objetivo total

Separar cobertura, adecuación local y calidad estructural:

```text
Z(X) = M * grupos_asignados
     + beta_s   * promedio_{x_ig = 1}(s_ig)
     + lambda_gap * V_gap(X)
     + lambda_con * V_consecutiva(X)
     + lambda_div * V_diversidad(X)
```

con todas las viabilidades estructurales acotadas en `[0,1]`.

Esto permite:

- mantener prioridad lexicográfica por cobertura mediante `M`;
- interpretar claramente el papel de cada módulo;
- evitar usar el mismo score local como recompensa y corrector estructural al mismo tiempo.

---

## 6. Recomendaciones de implementación

### 6.1 Recomendaciones de alta prioridad

1. **Unificar semántica**: elegir una sola convención para soft constraints, preferentemente viabilidad positiva si esa es la interpretación del dominio.
2. **Fijar contrato de `s_ig`**: si la documentación promete `[0,1]`, hacerlo cumplir con tests.
3. **Contextualizar la RCL por grupo**: la estrategia de ordenamiento debe recibir el grupo real y operar sobre candidatos factibles para ese grupo.
4. **Construir sobre el conjunto factible completo**: no sobre el primer profesor que pasa la FSM.
5. **Registrar desglose de `Delta Z`**: no solo `ZNuevo` y `ZActual`, sino contribuciones por componente.

### 6.2 Recomendaciones de validación

1. Revisar histogramas de `R_hat_ij`, `h_ih`, `s_ig` y `Delta Z`.
2. Medir cuántos candidatos factibles existen por grupo.
3. Verificar si el cache de horarios preserva la semántica con la que fue entrenado `h_ih`.
4. Confirmar si la búsqueda local prueba varios candidatos factibles por iteración.
5. Verificar si existe dependencia fuerte del orden de iteración de profesores.

---

## 7. Conclusión

El cambio de soft constraints desde penalización hacia viabilidad es **matemáticamente válido** y **semánticamente más coherente** con `R_hat_ij` y `h_ih`.

No hay evidencia conceptual de que ese cambio, por sí solo, deba empeorar un GRASP. Si el solver actual presenta saturación, poca señal de mejora o asignaciones rígidas, la explicación más consistente es una combinación de:

- contratos de rango no alineados con las fórmulas;
- reutilización excesiva de `s_ig` en distintos papeles;
- falta de contextualización por grupo en la heurística;
- exploración local insuficiente;
- posible pérdida de información semántica en el manejo del horario.

La ruta técnica más segura es:

1. acotar y clarificar `s_ig`;
2. separar mezcla local y peso global;
3. contextualizar la RCL por grupo factible;
4. mantener las soft constraints como módulos de viabilidad estructural claramente independientes.
