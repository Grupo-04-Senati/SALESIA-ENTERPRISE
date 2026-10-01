# SalesIA Enterprise — Contrato de API REST

> **Anexo del entregable FASE 02** — *"Definir DTO/schemas y contratos REST"*.
> Fuente normativa: *SalesIA Enterprise — Plan Integral de Desarrollo v1.0* (§16 *API inicial*).
> Arquitectura y decisiones: [`docs/02_arquitectura.md`](02_arquitectura.md).

| Campo | Valor |
|---|---|
| **Documento** | Contrato de API REST — SalesIA Enterprise |
| **Fase** | FASE 02 (implementación en FASE 05) |
| **Versión** | 1.0 |
| **Base URL** | `{API_BASE_URL}` = `http://localhost:8000/api/v1` |
| **Formato** | JSON · UTF-8 · `snake_case` |
| **Esquema** | OpenAPI 3.1 generado por FastAPI en `/docs` (RNF-05) |
| **Estado** | En revisión |

---

## 1. Convenciones generales

### 1.1 Cabeceras

| Cabecera | Dirección | Valor |
|---|---|---|
| `Content-Type` | Petición y respuesta | `application/json; charset=utf-8` |
| `Authorization` | Petición | `Bearer <access_token>` |
| `X-Request-Id` | Ambas | ID de correlación (opcional; si no viene, lo genera el servidor) |

### 1.2 URL y verbos

| Elemento | Regla | Ejemplo |
|---|---|---|
| Prefijo de versión | `/api/v1` | `/api/v1/sales` |
| Recursos | sustantivos en **plural**, `snake_case` | `/sale_details` no se expone (va embebido) |
| Subrecurso | `/padre/{id}/hijo` | `/sales/{sale_id}/payments` |
| Acciones | verbo en inglés al final si no es CRUD | `/statistics/compare`, `/auth/login` |
| IDs | en la URL, numéricos o UUID | `/sales/101` |
| Filtros | query string | `?estado=COMPLETADA&desde=2026-01-01` |
| Paginación | `page`, `page_size` (máx. 100) | `?page=2&page_size=20` |
| Orden | `sort=campo_asc\|campo_desc` | `?sort=fecha_desc` |

**Verbos:** `GET` leer · `POST` crear/actuar · `PUT` reemplazar · `PATCH` modificar parcial · `DELETE` desactivar.

### 1.3 Respuesta paginada (listados)

```json
{
  "items": [ /* recurso[] */ ],
  "total": 137,
  "page": 1,
  "page_size": 20,
  "pages": 7
}
```

### 1.4 Respuesta de éxito

- `POST` → `201` + cuerpo del recurso creado (+ cabecera `Location`).
- `GET/PUT/PATCH` → `200` + cuerpo.
- `DELETE` → `204` sin cuerpo.
- No se usa envoltorio `data`: el recurso se devuelve **directo** (el envoltorio solo aplica a listados, §1.3).

### 1.5 Formato de error (obligatorio en toda respuesta ≥ 400)

```json
{
  "codigo": "VENTA_STOCK_INSUFICIENTE",
  "mensaje": "Stock insuficiente para el producto SKU-0001.",
  "detalle": { "sku": "SKU-0001", "disponible": 3, "solicitado": 5 },
  "trace_id": "9f2c1a7e4b0d"
}
```

Catálogo completo de códigos en `02_arquitectura.md` §10.3.

### 1.6 Fechas, moneda y nulos

| Tipo | Formato | Ejemplo |
|---|---|---|
| Fecha y hora | ISO-8601 UTC | `2026-10-01T14:30:00Z` |
| Fecha | `YYYY-MM-DD` | `2026-10-01` |
| Moneda | decimal 2 decimales, moneda `PEN` | `149.90` |
| Porcentaje | decimal 2 decimales | `18.50` |
| Campos opcionales | `null` explícito | `"fecha_anulacion": null` |

---

## 2. Autenticación y autorización

- Todo endpoint salvo los marcados `público` exige `Authorization: Bearer <jwt>`.
- Los roles permitidos se listan en cada endpoint con la sigla: **A**dministrador · **G**erente · **V**endedor · **Ana**lista · **Alm**acén.
- Falta de token → `401 AUTH_TOKEN_INVALIDO`; rol no permitido → `403 AUTH_ACCESO_DENEGADO`.

### Token

```json
// POST /auth/login  → 200
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 28800,
  "user": { "id": 1, "nombre": "Ana Torres", "email": "ana@salesia.pe", "rol": "Gerente" }
}
```

---

## 3. DTO — reglas de nombrado

| Sufijo | Dirección | Ejemplo |
|---|---|---|
| `*Create` | Entrada para crear | `CustomerCreate` |
| `*Update` | Entrada para modificar (todos opcionales) | `ProductUpdate` |
| `*Response` | Salida | `SaleResponse` |
| `*Summary` | Salida ligera para listados | `SaleSummary` |
| `*Paginated` | Envoltorio de listado | `SalePaginated` |

Campos de solo salida (`id`, `fecha_creacion`, `estado`, totales calculados) se **ignoran** si llegan en la petición.

---

## 4. Endpoints

> ✅ = incluido en los 14 endpoints iniciales del plan (§16). Los demás son necesarios para RF-01…RF-22.

### 4.1 Auth — `/auth` (RF-01, RF-02)

| Método | Ruta | Descripción | Roles | Código |
|---|---|---|---|:---:|
| ✅ POST | `/auth/login` | Autenticación | público | 200 / 401 / 429 |
| POST | `/auth/logout` | Cerrar sesión | cualquiera | 204 |
| POST | `/auth/refresh` | Renovar token | cualquiera | 200 / 401 |
| POST | `/auth/forgot-password` | Solicitar recuperación | público | 202 |
| POST | `/auth/reset-password` | Restablecer clave | público | 200 / 422 |
| GET | `/auth/me` | Usuario actual | cualquiera | 200 |
| GET | `/users` | Listar usuarios | **A** | 200 |
| POST | `/users` | Crear usuario | **A** | 201 / 409 |
| PATCH | `/users/{id}` | Modificar usuario/rol | **A** | 200 / 403 |

```json
// POST /auth/login — Request
{ "email": "ana@salesia.pe", "password": "********" }

// POST /auth/login — Error 401
{ "codigo": "AUTH_CREDENCIALES_INVALIDAS",
  "mensaje": "Credenciales inválidas.",
  "detalle": { "intentos_restantes": 3 },
  "trace_id": "ab12cd34ef56" }
```

### 4.2 Clientes — `/customers` (RF-03)

| Método | Ruta | Descripción | Roles | Código |
|---|---|---|---|:---:|
| ✅ GET | `/customers` | Listar (paginado, `q`, `segmento`) | **A G V Ana** | 200 |
| ✅ POST | `/customers` | Crear cliente | **A G V** | 201 / 409 |
| GET | `/customers/{id}` | Detalle | **A G V Ana** | 200 / 404 |
| PUT | `/customers/{id}` | Actualizar | **A G V** | 200 / 409 |
| PATCH | `/customers/{id}/status` | Activar/desactivar | **A G** | 200 |
| GET | `/customers/{id}/purchases` | Historial de compras | **A G V Ana** | 200 |

```json
// CustomerCreate
{
  "tipo_documento": "DNI",
  "numero_documento": "74125896",
  "nombre": "María Quispe",
  "email": "maria@correo.com",
  "telefono": "+51987654321",
  "direccion": "Av. Los Olivos 123, Lima",
  "segmento": "Recurrente"
}

// CustomerResponse
{
  "id": 12, "tipo_documento": "DNI", "numero_documento": "74125896",
  "nombre": "María Quispe", "email": "maria@correo.com",
  "telefono": "+51987654321", "direccion": "Av. Los Olivos 123, Lima",
  "segmento": "Recurrente", "estado": "ACTIVO",
  "fecha_creacion": "2026-03-14T10:05:00Z",
  "total_compras": 18, "monto_total_comprado": 1450.50
}
```

**Errores:** `CLIENTE_DOCUMENTO_DUPLICADO` (409, RN-01), `VALIDACION_FALLIDA` (422).

### 4.3 Productos y categorías — `/products`, `/categories` (RF-04)

| Método | Ruta | Descripción | Roles | Código |
|---|---|---|---|:---:|
| ✅ GET | `/products` | Listar (paginado, `q`, `categoria_id`, `estado`, `bajo_stock`) | **A G V Ana Alm** | 200 |
| POST | `/products` | Crear producto | **A G** | 201 / 409 |
| GET | `/products/{id}` | Detalle | **A G V Ana Alm** | 200 / 404 |
| PUT | `/products/{id}` | Actualizar | **A G** | 200 / 409 |
| PATCH | `/products/{id}/status` | Activar/desactivar | **A G** | 200 |
| GET | `/categories` | Listar categorías | **A G V Ana Alm** | 200 |
| POST | `/categories` | Crear categoría | **A G** | 201 |

```json
// ProductCreate
{
  "sku": "SKU-0001", "nombre": "Gaseosa 500ml",
  "categoria_id": 3, "precio_costo": 3.50, "precio_venta": 5.00,
  "stock_minimo": 24, "unidad": "UND"
}

// ProductResponse
{
  "id": 1, "sku": "SKU-0001", "nombre": "Gaseosa 500ml",
  "categoria": { "id": 3, "nombre": "Bebidas" },
  "precio_costo": 3.50, "precio_venta": 5.00,
  "stock_minimo": 24, "stock_actual": 96, "unidad": "UND",
  "estado": "ACTIVO", "fecha_creacion": "2026-02-01T09:00:00Z"
}
```

**Errores:** `PRODUCTO_SKU_DUPLICADO` (409), `VALIDACION_FALLIDA` (422 si `precio_venta < precio_costo`, RN-05).

### 4.4 Vendedores — `/employees` (RF-05 · **AR-04 pendiente de aprobación**)

| Método | Ruta | Descripción | Roles | Código |
|---|---|---|---|:---:|
| GET | `/employees` | Listar vendedores | **A G Ana** | 200 |
| POST | `/employees` | Crear vendedor | **A** | 201 / 409 |
| PUT | `/employees/{id}` | Actualizar | **A** | 200 |
| GET | `/employees/{id}/metrics` | Métricas comerciales (ventas, ingresos, promedio) | **A G Ana** | 200 |

```json
// EmployeeResponse
{
  "id": 4, "nombre": "Luis Ríos", "email": "luis@salesia.pe",
  "cargo": "Vendedor", "estado": "ACTIVO",
  "fecha_ingreso": "2026-01-15",
  "metricas": { "ventas": 214, "ingresos": 38250.00, "ticket_promedio": 178.74 }
}
```

### 4.5 Ventas y pagos — `/sales` (RF-06, RF-07)

| Método | Ruta | Descripción | Roles | Código |
|---|---|---|---|:---:|
| ✅ GET | `/sales` | Listar (paginado, `estado`, `desde`, `hasta`, `cliente_id`, `vendedor_id`) | **A G V Ana Alm** | 200 |
| ✅ POST | `/sales` | Registrar venta (pedido → venta) | **A G V** | 201 / 400 / 409 |
| GET | `/sales/{id}` | Detalle con líneas y pagos | **A G V Ana** | 200 / 404 |
| PATCH | `/sales/{id}/status` | Cambiar estado | **A G** | 200 |
| POST | `/sales/{id}/cancel` | Anular venta (devuelve stock) | **A G** | 200 / 400 |
| GET | `/sales/{id}/payments` | Pagos de la venta | **A G V** | 200 |
| POST | `/sales/{id}/payments` | Registrar pago | **A G V** | 201 / 400 |

```json
// SaleCreate
{
  "cliente_id": 12,
  "vendedor_id": 4,
  "descuento_global": 10.00,
  "items": [
    { "product_id": 1, "cantidad": 6, "precio_unitario": 5.00, "descuento": 0.00 },
    { "product_id": 7, "cantidad": 2, "precio_unitario": 12.90, "descuento": 2.00 }
  ]
}

// SaleResponse  (el servidor recalcula todo — RN-11)
{
  "id": 101, "numero": "V-000000101", "cliente": { "id": 12, "nombre": "María Quispe" },
  "vendedor": { "id": 4, "nombre": "Luis Ríos" },
  "fecha": "2026-10-01T15:42:00Z", "estado": "COMPLETADA",
  "items": [
    { "product_id": 1, "sku": "SKU-0001", "nombre": "Gaseosa 500ml",
      "cantidad": 6, "precio_unitario": 5.00, "descuento": 0.00, "subtotal": 30.00 },
    { "product_id": 7, "sku": "SKU-0007", "nombre": "Galletas x6",
      "cantidad": 2, "precio_unitario": 12.90, "descuento": 2.00, "subtotal": 23.80 }
  ],
  "subtotal": 53.80, "descuento": 10.00, "impuesto": 7.45, "total": 51.25,
  "pagado": 51.25, "saldo": 0.00, "metodo_pago": "TARJETA",
  "fecha_anulacion": null, "motivo_anulacion": null
}

// PaymentCreate
{ "monto": 25.00, "metodo_pago": "EFECTIVO" }
// metodo_pago: EFECTIVO | TARJETA | TRANSFERENCIA | YAPE | PLIN
```

**Errores:**

| Código | HTTP | Condición |
|---|---|---|
| `VENTA_STOCK_INSUFICIENTE` | 400 | RN-10 |
| `VENTA_NUMERACION_CONFLICTO` | 409 | RN-12 |
| `VENTA_FECHA_FUTURA` | 400 | RN-19 |
| `VENTA_TOTAL_INVALIDO` | 422 | Total recalculado ≠ 0 y consistente |
| `PAGO_EXCEDE_SALDO` | 400 | RN-16 |
| `VENTA_NO_ENCONTRADA` | 404 | — |

### 4.6 Inventario — `/inventory` (RF-08)

| Método | Ruta | Descripción | Roles | Código |
|---|---|---|---|:---:|
| GET | `/inventory` | Stock actual (paginado, `categoria_id`, `bajo_stock`) | **A G V Ana Alm** | 200 |
| GET | `/inventory/{product_id}` | Stock de un producto | **A G Alm** | 200 / 404 |
| GET | `/inventory/movements` | Historial de movimientos | **A G Alm** | 200 |
| POST | `/inventory/movements` | Registrar entrada / salida / merma / ajuste | **A G Alm** | 201 / 400 |
| GET | `/inventory/alerts` | Productos con `stock ≤ stock_minimo` | **A G Alm** | 200 |

```json
// InventoryMovementCreate
{
  "product_id": 1, "tipo": "ENTRADA", "cantidad": 48,
  "motivo": "Recepción de compra OC-0042"
}
// tipo: ENTRADA | SALIDA | DEVOLUCION | MERMA | AJUSTE

// InventoryMovementResponse
{
  "id": 88, "product_id": 1, "sku": "SKU-0001",
  "tipo": "ENTRADA", "cantidad": 48, "stock_resultante": 144,
  "motivo": "Recepción de compra OC-0042",
  "usuario": { "id": 3, "nombre": "Carlos Peña" },
  "fecha": "2026-10-01T16:00:00Z"
}
```

**Errores:** `INVENTARIO_STOCK_NEGATIVO` (400, RN-20), `INVENTARIO_MOVIMIENTO_INVALIDO` (400, RN-21/22), `VALIDACION_FALLIDA` (422 si falta `motivo`).

### 4.7 Dashboard — `/dashboard` (RF-09)

| Método | Ruta | Descripción | Roles | Código |
|---|---|---|---|:---:|
| ✅ GET | `/dashboard/summary` | Resumen ejecutivo (KPI-01…KPI-05) | **A G Ana** | 200 |
| GET | `/dashboard/sales-by-period` | Serie temporal de ventas | **A G Ana** | 200 |
| GET | `/dashboard/sales-by-product` | Ventas por producto | **A G Ana** | 200 |
| GET | `/dashboard/sales-by-vendedor` | Ventas por vendedor (RF-05) | **A G Ana** | 200 |
| GET | `/dashboard/stock-alerts` | Alertas de stock mínimo | **A G Alm** | 200 |

**Query string común:** `?desde=2026-09-01&hasta=2026-09-30&categoria_id=3&vendedor_id=4&sucursal_id=1`

```json
// GET /dashboard/summary → 200
{
  "periodo": { "desde": "2026-09-01", "hasta": "2026-09-30" },
  "ventas": 214, "ingresos": 38250.00, "transacciones": 214,
  "clientes_nuevos": 27, "ticket_promedio": 178.74,
  "media_venta": 166.32, "mediana_venta": 142.50,
  "productos_bajo_stock": 6, "anulaciones": 3,
  "variacion_vs_periodo_anterior": { "ingresos_pct": 8.4, "ventas_pct": 3.1 }
}
```

### 4.8 Estadística — `/statistics` (RF-10 a RF-14, RF-21)

| Método | Ruta | Descripción | Roles | Código |
|---|---|---|---|:---:|
| ✅ POST | `/statistics/mean` | Calcular media | **A G Ana** | 200 / 400 |
| ✅ POST | `/statistics/median` | Calcular mediana | **A G Ana** | 200 / 400 |
| ✅ POST | `/statistics/compare` | Comparar media vs. mediana | **A G Ana** | 200 / 400 |
| POST | `/statistics/variables` | Clasificar variables y frecuencias | **A G Ana** | 200 / 422 |
| GET | `/statistics/datasets` | Listar datasets | **A G Ana** | 200 |
| POST | `/statistics/datasets` | Crear dataset desde operación o archivo | **A G Ana** | 201 / 422 |
| GET | `/statistics/datasets/{id}` | Detalle con variables y observaciones | **A G Ana** | 200 / 404 |
| GET | `/statistics/history` | Historial de análisis (RF-21) | **A G Ana** | 200 |
| GET | `/statistics/history/{id}` | Resultado almacenado | **A G Ana** | 200 / 404 |

```json
// MeanRequest / MedianRequest (mismo contrato)
{
  "dataset_id": 5,
  "variable": "monto_venta",
  "guardar_historial": true
}
// Alternativa sin dataset (para pruebas / Semana 07):
{ "valores": [10, 20, 30, 40], "guardar_historial": false }

// MeanResponse
{
  "metrica": "media", "variable": "monto_venta",
  "valor": 25.0,
  "n": 4, "suma": 100.0,
  "minimo": 10.0, "maximo": 40.0,
  "periodo": { "desde": "2026-09-01", "hasta": "2026-09-30" },
  "analisis_id": 33,
  "fecha_calculo": "2026-10-01T17:10:00Z"
}

// CompareRequest / CompareResponse
// Request  { "dataset_id": 5, "variable": "monto_venta" }
{
  "media": 166.32, "mediana": 142.50,
  "diferencia_absoluta": 23.82, "diferencia_pct": 16.72,
  "interpretacion": "La media supera a la mediana: existe sesgo positivo por ventas atípicas altas.",
  "n": 214, "analisis_id": 34
}

// VariableAnalysisRequest / Response
// Request { "dataset_id": 5 }
{
  "variables": [
    { "nombre": "monto_venta", "tipo": "cuantitativa", "subtipo": "continua",
      "n": 214, "media": 166.32, "mediana": 142.50, "minimo": 12.0, "maximo": 980.0 },
    { "nombre": "categoria_producto", "tipo": "cualitativa", "subtipo": "nominal",
      "n": 214, "frecuencias": [ { "valor": "Bebidas", "n": 88, "pct": 41.12 } ] }
  ]
}
```

**Errores:** `ESTADISTICA_DATOS_INSUFICIENTES` (400, RN-40), `ESTADISTICA_VARIABLE_NO_DECLARADA` (422, RN-46), `RECURSO_NO_ENCONTRADO` (404).

### 4.9 Probabilidad y variables aleatorias — `/probability`, `/random-variables` (RF-15 a RF-17)

| Método | Ruta | Descripción | Roles | Código |
|---|---|---|---|:---:|
| POST | `/probability/calculate` | Probabilidad simple / conjunta / condicional | **A G Ana** | 200 / 422 |
| ✅ POST | `/probability/bayes` | Teorema de Bayes | **A G Ana** | 200 / 422 |
| POST | `/probability/events` | Crear evento sobre un dataset | **A G Ana** | 201 |
| GET | `/probability/events` | Listar eventos | **A G Ana** | 200 |
| ✅ POST | `/random-variables/analyze` | Analizar variable aleatoria | **A G Ana** | 200 / 422 |
| GET | `/random-variables` | Listar variables aleatorias | **A G Ana** | 200 |

```json
// ProbabilityRequest
{ "p_a": 0.30, "p_b": 0.50, "p_b_given_a": 0.80, "tipo": "condicional" }
// tipo: SIMPLE | CONJUNTA | CONDICIONAL

// ProbabilityResponse
{
  "tipo": "CONDICIONAL", "p_a": 0.30, "p_b": 0.50, "p_b_given_a": 0.80,
  "resultado": 0.48, "formula": "P(A|B) = P(B|A) * P(A) / P(B)",
  "explicacion": "Dados P(A)=0.30, P(B|A)=0.80 y P(B)=0.50, la probabilidad de A dado B es 0.48.",
  "analisis_id": 41
}

// BayesRequest  (mismo esquema que ProbabilityRequest con tipo CONDICIONAL)
// BayesResponse = ProbabilityResponse + {"regla": "bayes"}

// Error 422 cuando P(B) = 0  (RN-43)
{ "codigo": "BAYES_POR_CERO", "mensaje": "La probabilidad P(B) debe ser mayor que cero.",
  "detalle": { "p_b": 0.0 }, "trace_id": "cd34ef56ab12" }

// RandomVariableAnalyzeRequest
{
  "dataset_id": 5, "variable": "cantidad_unidades",
  "distribucion": "discreta", "guardar_historial": true
}
// distribucion: discreta | continua | binomial | poisson | normal | uniforme

// RandomVariableResponse
{
  "variable": "cantidad_unidades", "distribucion": "discreta",
  "n": 214, "valores_posibles": [1, 2, 3, 4, 5],
  "probabilidades": [0.18, 0.34, 0.27, 0.14, 0.07],
  "esperanza": 2.38, "varianza": 1.16,
  "resumen": "La cantidad promedio por venta es 2.38 unidades.",
  "analisis_id": 42
}
```

**Errores:** `BAYES_POR_CERO` (422, RN-43), `ESTADISTICA_DATOS_INSUFICIENTES` (400), `VALIDACION_FALLIDA` (422 si probabilidad fuera de `[0,1]`).

### 4.10 Insights — `/insights` (RF-19)

| Método | Ruta | Descripción | Roles | Código |
|---|---|---|---|:---:|
| ✅ GET | `/insights` | Consultar insights (`nivel`, `desde`, `hasta`) | **A G Ana** | 200 |
| GET | `/insights/{id}` | Detalle **con la evidencia numérica** (RN-47) | **A G Ana** | 200 / 404 |
| GET | `/insights/rules` | Reglas determinísticas vigentes | **A G Ana** | 200 |
| POST | `/insights/{id}/read` | Marcar como leído | **A G Ana** | 200 |

```json
// InsightResponse
{
  "id": 9,
  "titulo": "Caída del ticket promedio en Bebidas",
  "nivel": "ADVERTENCIA",
  "regla": "REG-07_VARIACION_TICKET",
  "mensaje": "El ticket promedio de Bebidas bajó 12.4% respecto al periodo anterior.",
  "evidencia": {
    "periodo_actual": { "ticket_promedio": 41.20, "n": 88 },
    "periodo_anterior": { "ticket_promedio": 47.03, "n": 92 },
    "variacion_pct": -12.40
  },
  "analisis_id": 34, "dataset_id": 5,
  "fecha": "2026-10-01T18:00:00Z", "leido": false
}
```

### 4.11 Reportes — `/reports` (RF-20)

| Método | Ruta | Descripción | Roles | Código |
|---|---|---|---|:---:|
| ✅ GET | `/reports` | Listar reportes | **A G Ana** | 200 |
| POST | `/reports` | Generar reporte | **A G Ana** | 201 |
| GET | `/reports/{id}` | Detalle | **A G Ana** | 200 / 404 |
| GET | `/reports/{id}/export` | Exportar (`?formato=pdf\|csv\|xlsx`) | **A G Ana** | 200 / 422 |

**Tipos de reporte:** `VENTAS` · `ESTADISTICO` · `PRODUCTOS` · `CLIENTES` · `VENDEDORES`.

```json
// ReportCreate
{ "tipo": "ESTADISTICO", "desde": "2026-09-01", "hasta": "2026-09-30",
  "parametros": { "categoria_id": 3, "metricas": ["media", "mediana"] } }

// ReportResponse
{
  "id": 12, "tipo": "ESTADISTICO",
  "titulo": "Reporte estadístico Bebidas — Septiembre 2026",
  "periodo": { "desde": "2026-09-01", "hasta": "2026-09-30" },
  "contenido": { "media": 166.32, "mediana": 142.50, "n": 214, "observaciones": [] },
  "estado": "DISPONIBLE",
  "creado_por": { "id": 5, "nombre": "Ana Torres" },
  "fecha": "2026-10-01T18:30:00Z"
}
```

---

## 5. Mapa de autorización (resumen)

| Recurso | A | G | V | Ana | Alm |
|---|:---:|:---:|:---:|:---:|:---:|
| `/auth/*`, `/users` | ✅ | — | — | — | — |
| `/customers` (CRUD) | ✅ | ✅ | ✅ | solo lectura | — |
| `/products`, `/categories` (CRUD) | ✅ | ✅ | solo lectura | solo lectura | solo lectura |
| `/employees` | ✅ | solo lectura | — | solo lectura | — |
| `/sales` (crear) | ✅ | ✅ | ✅ | solo lectura | solo lectura |
| `/sales/{id}/cancel` | ✅ | ✅ | — | — | — |
| `/sales/{id}/payments` | ✅ | ✅ | ✅ | — | — |
| `/inventory` (movimientos) | ✅ | solo lectura | solo lectura | solo lectura | ✅ |
| `/dashboard/*` | ✅ | ✅ | — | ✅ | solo alertas |
| `/statistics/*` | ✅ | ✅ | — | ✅ | — |
| `/probability/*`, `/random-variables` | ✅ | ✅ | — | ✅ | — |
| `/insights`, `/reports` (CRUD) | ✅ | ✅ | solo lectura | ✅ | — |
| `/audit-logs` | ✅ | — | — | — | — |

---

## 6. Mapeo requisito → endpoint

| RF | Endpoints | Fase |
|---|---|---|
| RF-01 Autenticación | `/auth/login`, `/auth/logout`, `/auth/refresh`, `/auth/me` | 05 |
| RF-02 Usuarios | `/users` | 05 |
| RF-03 Clientes | `/customers` | 07 |
| RF-04 Productos y categorías | `/products`, `/categories` | 07 |
| RF-05 Vendedores | `/employees` ⚠️ AR-04 | 07 |
| RF-06 Ventas | `/sales` | 08 |
| RF-07 Pagos | `/sales/{id}/payments` | 08 |
| RF-08 Inventario | `/inventory` | 08 |
| RF-09 Dashboard | `/dashboard/*` | 10 |
| RF-10 Datasets | `/statistics/datasets` | 09 |
| RF-11 Media | `/statistics/mean` | 09 |
| RF-12 Mediana | `/statistics/median` | 09 |
| RF-13 Comparación | `/statistics/compare` | 09 |
| RF-14 Variables | `/statistics/variables` | 09 |
| RF-15 Variables aleatorias | `/random-variables/analyze` | 09 |
| RF-16 Probabilidades | `/probability/calculate` | 09 |
| RF-17 Bayes | `/probability/bayes` | 09 |
| RF-18 Gráficos | consumo de `/dashboard/*` y `/statistics/*` | 10 |
| RF-19 Insights | `/insights` | 11 |
| RF-20 Reportes | `/reports` | 12 |
| RF-21 Historial | `/statistics/history` | 09 |
| RF-22 Auditoría | `/audit-logs` | 13 |

**Total: 66 operaciones — los 14 endpoints iniciales del plan (marcados ✅) + 52 adicionales necesarios para RF-01…RF-22.**

---

## 7. Criterios de aceptación del contrato

| ID | Criterio |
|---|---|
| CA5-01 | Los 14 endpoints iniciales del plan existen con su método, ruta y función exactos (§4). |
| CA5-02 | Toda operación declara roles permitidos y código de error (§5). |
| CA5-03 | Toda respuesta de error cumple `{ codigo, mensaje, detalle, trace_id }` (§1.5). |
| CA5-04 | Todo listado es paginado y ordenable (§1.3). |
| CA5-05 | Los nombres de campo son `snake_case` idénticos entre Pydantic y TypeScript (AR-05). |
| CA5-06 | OpenAPI generado en `/docs` sin errores de validación (RNF-05). |
| CA5-07 | Los 22 RF tienen al menos un endpoint asociado (§6). |
| CA5-08 | Ningún endpoint expone datos de otra `company_id` (aislamiento §2 de `02_arquitectura.md`). |

---

*SalesIA Enterprise — Contrato de API REST v1.0 · FASE 02 · Grupo 4 — SENATI*
