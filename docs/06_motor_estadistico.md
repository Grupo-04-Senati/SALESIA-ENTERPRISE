# 06 · Motor Estadístico (Semana 07)

**SalesIA Enterprise** — Documento 06 de la serie de arquitectura · Versión 1.0
**Ubicación:** `backend/app/analytics/` · **Librerías:** Python (NumPy, Pandas, SciPy)

---

## 1. Principio del módulo

> Las ventas generan los datos → PostgreSQL los almacena → el motor estadístico los calcula → la API los expone → Analytics los visualiza.

El motor **no es una calculadora independiente**: todo cálculo se ejecuta sobre un *dataset* derivado de las operaciones comerciales y queda registrado en `statistical_analyses` + `statistical_results` (RF-21).

---

## 2. Variables estadísticas (RF-14)

### 2.1 Clasificación

```
Variables
├── Cualitativas (categóricas)
│   ├── Nominales  → género, categoría de producto, método de pago
│   └── Ordinales  → nivel de satisfacción, estado de venta
└── Cuantitativas
    ├── Discretas  → cantidad de productos por venta, nº de clientes
    └── Continuas  → monto de venta, peso, tiempo de entrega
```

### 2.2 En SalesIA

| Variable | Tipo | Naturaleza |
|---|---|---|
| Monto total de venta | Cuantitativa | Continua |
| Cantidad de productos por venta | Cuantitativa | Discreta |
| Número de compras por cliente | Cuantitativa | Discreta |
| Categoría de producto | Cualitativa | Nominal |
| Método de pago | Cualitativa | Nominal |
| Estado de venta | Cualitativa | Ordinal |
| Ticket promedio (derivada) | Cuantitativa | Continua |

El endpoint `POST /statistics/variables` recibe una columna del dataset y devuelve `{type, scale, unit, unique_count, samples}`.

---

## 3. Media aritmética (RF-11)

### 3.1 Fórmula

```
media = (x₁ + x₂ + … + xₙ) / n
```

### 3.2 Aplicación empresarial

- **Ticket promedio** = suma de totales de venta / número de ventas.
- Venta promedio por producto, por vendedor, por categoría y por periodo.

### 3.3 Algoritmo

```
1. Obtener la serie de valores del dataset (campo numérico, sin nulos)
2. n = longitud de la serie
3. Si n = 0 → error de negocio "sin datos para el periodo"
4. media = sum(valores) / n
5. Persistir resultado con metric="mean", value, count
```

### 3.4 Ejemplo

Valores: `[120, 80, 200, 60, 140]` → media = `600 / 5 = 120.0`

---

## 4. Mediana (RF-12)

### 4.1 Fórmula

1. Ordenar los valores de menor a mayor.
2. Si `n` es **impar**: mediana = valor central (posición `(n+1)/2`).
3. Si `n` es **par**: mediana = promedio de los dos valores centrales.

### 4.2 Algoritmo

```
1. serie = ordenar(valores)
2. n = len(serie)
3. Si n = 0 → error "sin datos"
4. Si n es impar → mediana = serie[n // 2]
5. Si n es par   → mediana = (serie[n//2 - 1] + serie[n//2]) / 2
6. Persistir metric="median"
```

### 4.3 Ejemplo

- Impar: `[60, 80, 120, 140, 200]` → mediana = `120`
- Par: `[60, 80, 120, 140]` → mediana = `(80 + 120) / 2 = 100`

---

## 5. Comparación media vs. mediana (RF-13)

```json
POST /api/v1/statistics/compare
{ "mean": 356.87, "median": 298.40, "difference": 58.47,
  "interpretation": "media > mediana → cola derecha: unas pocas ventas altas elevan el promedio" }
```

| Situación | Lectura |
|---|---|
| media ≈ mediana | Distribución aproximadamente simétrica. |
| media > mediana | Asimetría positiva (cola derecha): valores extremos altos. |
| media < mediana | Asimetría negativa (cola izquierda): valores extremos bajos. |

**Uso empresarial:** si la media supera mucho a la mediana, el promedio miente — conviene mirar la mediana para fijar precios o metas.

---

## 6. Variables aleatorias (RF-15)

- **Definición:** variable cuyo valor depende del azar de un experimento (p. ej. cantidad de productos en una venta, monto de una venta futura).
- **Discreta:** valores contables (0, 1, 2, …) con probabilidad asociada.
- **Continua:** valores en un rango; se analiza mediante distribución e histograma.

El endpoint `POST /random-variables/analyze` devuelve:

```json
{
  "variable": "cantidad_productos_por_venta",
  "type": "discrete",
  "distribution": [ { "value": 1, "frequency": 40, "probability": 0.40 }, ... ],
  "expected_value": 2.35,
  "mean": 2.35,
  "median": 2
}
```

*(Varianza, desviación estándar y esperanza matemática completa: evolución Semana 08.)*

---

## 7. Probabilidad básica (RF-16)

```
P(A) = casos favorables / casos posibles
```

Propiedades: `0 ≤ P(A) ≤ 1` · `P(Aᶜ) = 1 − P(A)` · `P(A ∪ B) = P(A) + P(B) − P(A ∩ B)`.

**Ejemplo:** 30 de 120 ventas usaron promoción → `P(promoción) = 0.25`.

---

## 8. Teorema de Bayes (RF-17)

### 8.1 Fórmula

```
P(A|B) = P(B|A) · P(A) / P(B)
```

Donde `P(B) = P(B|A)·P(A) + P(B|Aᶜ)·P(Aᶜ)`.

### 8.2 Ejemplo aplicado a ventas

| Símbolo | Significado | Valor |
|---|---|---|
| A | El cliente es recurrente | P(A) = 0.30 |
| B | El cliente usa promoción | P(B\|A) = 0.80 (recurrentes que usan promo) |
| B | — | P(B\|Aᶜ) = 0.40 · P(Aᶜ)=0.70 → P(B)=0.52 |

```
P(A|B) = (0.80 × 0.30) / 0.52 = 0.4615
```

**Interpretación:** un cliente que usa promoción tiene 46.15% de probabilidad de ser recurrente (frente al 30% previo). El sistema devuelve además una frase explicando el cambio de probabilidad — el resultado siempre es **explicable y reproducible**.

### 8.3 Validaciones

- Todos los valores ∈ [0,1] (CHECK en BD).
- `P(B) > 0` → si es 0, error de negocio: «La evidencia B es imposible».
- Se persiste el análisis completo en `bayes_analyses` con su explicación.

---

## 9. Persistencia de análisis (RF-21)

```
dataset → statistical_analyses (qué, cuándo, quién, parámetros)
              ├── statistical_results (mean, median, compare…)
              ├── bayes_analyses
              ├── random_variables
              └── insights (regla generada + evidencia)
```

- Cada ejecución crea un registro **nuevo** (historial, nunca sobrescribe).
- El frontend permite consultar el historial y **re-ejecutar** un análisis con los mismos parámetros → mismo resultado (reproducibilidad).

---

## 10. Estrategia de pruebas del motor (RNF-09)

| Prueba | Casos |
|---|---|
| Media | Serie normal · un valor · todos iguales · lista vacía (error) |
| Mediana | n par · n impar · n=1 · lista vacía (error) |
| Comparación | media = mediana · media > mediana · media < mediana |
| Variables | clasificación correcta de cada campo de ejemplo |
| Bayes | valores típicos · P(B)=0 (error) · valores fuera de rango (error) |
| Repetibilidad | misma entrada, dos ejecuciones → mismo resultado |

Ubicación: `backend/tests/unit/test_mean.py`, `test_median.py`, `test_bayes.py`, `test_probability.py`.

---

## 11. Evolución — Semana 08

Previsto sin reescritura: **varianza**, **desviación estándar**, distribuciones y probabilidades continuas, **pruebas de hipótesis**, **p-valor** y **esperanza matemática**, y si el alcance lo permite, modelos predictivos.
