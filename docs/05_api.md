# 05 · API REST

**SalesIA Enterprise** — Documento 05 de la serie de arquitectura · Versión 1.1 (fusión)

**Framework:** FastAPI · **Base:** `/api/v1` · **Documentación:** Swagger en `/docs` (OpenAPI) · **Fase:** FASE 02 (implementación en FASE 05)

> **Entregable FASE 02** — *"Definir DTO/schemas y contratos REST"*.
> Arquitectura y decisiones: [`02_arquitectura.md`](02_arquitectura.md) · Requisitos: [`01_requisitos.md`](01_requisitos.md)
>
> **v1.1** = fusión del contrato del equipo (v1.0) con el detalle DTO, el mapa de autorización y la
> trazabilidad RF → endpoint. Ninguna aportación original fue descartada.

---

## 1. Convenciones

| Aspecto | Regla |
|---|---|
| Versionado | Todo bajo `/api/v1/...` |
| Prefijo en las tablas | Las rutas se listan **con** el prefijo completo (`/api/v1/...`) |
| Formato | JSON (UTF-8) · fechas ISO 8601 UTC · montos numéricos con 2 decimales |
| Nombres de campo | `snake_case`, idéntico entre Pydantic y TypeScript (AR-05) |
| Autenticación | `Authorization: Bearer <access_token>` (excepto login, `refresh` y `/health`) |
| Listados | `{ "items": [...], "total": n, "page": n, "page_size": n, "pages": n }` |
| Paginación | `?page=1&page_size=20` (`page_size` máximo 100) |
| Orden y filtros | `?sort=campo_asc\|campo_desc` · `?q=` · `?date_from=` · `?date_to=` |
| Creación | `201` + objeto creado (+ cabecera `Location`) · `204` en DELETE exitoso |
| Errores | Ver §3 (formato estándar + DEC-00 pendiente) |
| Validación | `422` de Pydantic, traducido al formato de error estándar |
| Borrado | Lógico (`status = inactive`); los recursos con historial **nunca** se eliminan físicamente |

### 1.1 Códigos de estado usados

`200` OK · `201` Created · `204` No Content · `202` Accepted · `400` Bad Request · `401` No autenticado ·
`403` Sin permiso · `404` No existe · `409` Conflicto (duplicado) · `422` Validación · `429` Demasiadas
peticiones · `500` Error interno.

### 1.2 Tipos de datos

| Tipo | Formato | Ejemplo |
|---|---|---|
| Fecha y hora | ISO-8601 UTC | `2026-10-01T14:30:00Z` |
| Fecha | `YYYY-MM-DD` | `2026-10-01` |
| Moneda | decimal, 2 decimales, `PEN` | `149.90` |
| Porcentaje | decimal, 2 decimales | `18.50` |
| Opcional | `null` explícito | `"cancelled_at": null` |

---

## 2. Endpoints

### 2.1 Salud y autenticación (RF-01)

| Método | Endpoint | Función | Acceso |
|---|---|---|---|
| GET | `/health` | Health check del servicio | Público |
| POST | `/api/v1/auth/login` | Autenticación → JWT (RF-01) | Público |
| POST | `/api/v1/auth/refresh` | Renovar access token | Bearer |
| POST | `/api/v1/auth/logout` | Cerrar sesión | Bearer |
| POST | `/api/v1/auth/forgot-password` | Solicitar recuperación de clave | Público |
| POST | `/api/v1/auth/reset-password` | Restablecer clave | Público |
| GET | `/api/v1/auth/me` | Usuario de la sesión actual | Bearer |

```json
// POST /api/v1/auth/login  → 200
{ "email": "ana@salesia.pe", "password": "********" }

// Respuesta
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": { "id": 1, "name": "Ana Torres", "email": "ana@salesia.pe", "role": "Gerente" }
}
```

### 2.2 Usuarios y roles (RF-02)

| Método | Endpoint | Función | Acceso |
|---|---|---|---|
| GET | `/api/v1/users` | Listar usuarios | Admin |
| POST | `/api/v1/users` | Crear usuario | Admin |
| PUT | `/api/v1/users/{id}` | Actualizar usuario/rol | Admin |
| PATCH | `/api/v1/users/{id}/status` | Activar / desactivar | Admin |
| DELETE | `/api/v1/users/{id}` | Desactivar usuario | Admin |
| GET | `/api/v1/roles` | Listar roles | Admin |

> RN-33: un usuario **no** puede modificar su propio rol ni elevar sus permisos.

### 2.3 Clientes (RF-03)

| Método | Endpoint | Función | Acceso |
|---|---|---|---|
| GET | `/api/v1/customers` | Listar (búsqueda, filtros, paginación) | Admin/Gerente/Vendedor/Analista |
| GET | `/api/v1/customers/{id}` | Ficha del cliente | idem |
| GET | `/api/v1/customers/{id}/history` | Historial de compras | idem |
| POST | `/api/v1/customers` | Crear cliente | Admin/Vendedor |
| PUT | `/api/v1/customers/{id}` | Editar cliente | Admin/Vendedor |
| DELETE | `/api/v1/customers/{id}` | Baja lógica | Admin |

```json
// CustomerCreate
{
  "document_type": "DNI",
  "document_number": "74125896",
  "name": "María Quispe",
  "email": "maria@correo.com",
  "phone": "+51987654321",
  "address": "Av. Los Olivos 123, Lima",
  "segment": "Recurrente"
}

// CustomerResponse
{
  "id": 12, "document_type": "DNI", "document_number": "74125896",
  "name": "María Quispe", "email": "maria@correo.com",
  "phone": "+51987654321", "address": "Av. Los Olivos 123, Lima",
  "segment": "Recurrente", "status": "active",
  "created_at": "2026-03-14T10:05:00Z",
  "purchase_count": 18, "total_purchased": 1450.50
}
```

**Errores:** `CONFLICT` 409 si el documento ya existe (RN-01) · `VALIDATION_ERROR` 422.

### 2.4 Productos y categorías (RF-04)

| Método | Endpoint | Función | Acceso |
|---|---|---|---|
| GET | `/api/v1/products` | Listar (filtro categoría, estado, texto, `low_stock`) | Admin/Gerente/Vendedor/Almacén |
| GET | `/api/v1/products/{id}` | Detalle de producto | idem |
| POST | `/api/v1/products` | Crear producto | Admin |
| PUT | `/api/v1/products/{id}` | Editar producto | Admin |
| PATCH | `/api/v1/products/{id}/status` | Activar / desactivar | Admin |
| DELETE | `/api/v1/products/{id}` | Baja lógica | Admin |
| GET/POST | `/api/v1/categories` | Categorías | Admin (escritura) |
| PUT/DELETE | `/api/v1/categories/{id}` | Editar / dar de baja categoría | Admin |

```json
// ProductCreate
{
  "sku": "SKU-0001", "name": "Gaseosa 500ml",
  "category_id": 3, "cost_price": 3.50, "sale_price": 5.00,
  "min_stock": 24, "unit": "UND"
}

// ProductResponse
{
  "id": 1, "sku": "SKU-0001", "name": "Gaseosa 500ml",
  "category": { "id": 3, "name": "Bebidas" },
  "cost_price": 3.50, "sale_price": 5.00,
  "min_stock": 24, "current_stock": 96, "unit": "UND",
  "status": "active", "created_at": "2026-02-01T09:00:00Z"
}
```

**Errores:** `CONFLICT` 409 si el SKU se repite (RN-03) · `VALIDATION_ERROR` 422 si `sale_price < cost_price` (RN-05).

### 2.5 Vendedores y empleados (RF-05)

| Método | Endpoint | Función | Acceso |
|---|---|---|---|
| GET | `/api/v1/employees` | Listar vendedores | Admin/Gerente/Analista |
| POST | `/api/v1/employees` | Crear vendedor | Admin |
| PUT | `/api/v1/employees/{id}` | Editar vendedor | Admin |
| GET | `/api/v1/employees/{id}/metrics` | Métricas: ventas, ingresos, promedio | Admin/Gerente/Analista |

> ⚠️ **AR-04 pendiente de aprobación** — ver `02_arquitectura.md` §15. El contrato ya está definido;
> la implementación es la brecha detectada en la FASE 01 (D-04).

```json
// EmployeeResponse
{
  "id": 4, "name": "Luis Ríos", "email": "luis@salesia.pe",
  "position": "Vendedor", "status": "active",
  "hired_at": "2026-01-15",
  "metrics": { "sales": 214, "revenue": 38250.00, "average_ticket": 178.74 }
}
```

### 2.6 Ventas, pagos e inventario (RF-06, RF-07, RF-08)

| Método | Endpoint | Función |
|---|---|---|
| POST | `/api/v1/sales` | Registrar venta (transaccional: detalle + pago + stock) |
| GET | `/api/v1/sales` | Consultar ventas (filtros por fecha, cliente, vendedor, estado) |
| GET | `/api/v1/sales/{id}` | Detalle de venta con líneas y pagos |
| PUT | `/api/v1/sales/{id}/status` | Cambiar estado (`pending`/`paid`/`partial`/`cancelled`) |
| POST | `/api/v1/sales/{id}/cancel` | Anular venta → devuelve stock (Admin/Gerente) |
| GET | `/api/v1/sales/{id}/payments` | Pagos de la venta |
| POST | `/api/v1/sales/{id}/payments` | Registrar pago adicional |
| GET | `/api/v1/inventory` | Existencias actuales |
| GET | `/api/v1/inventory/{product_id}` | Stock de un producto |
| GET | `/api/v1/inventory/{product_id}/movements` | Kardex del producto |
| GET | `/api/v1/inventory/movements` | Historial general de movimientos |
| POST | `/api/v1/inventory/movements` | Entrada / salida / merma / ajuste de stock |
| GET | `/api/v1/inventory/alerts` | Productos con `stock ≤ min_stock` |

**Ejemplo — crear venta:**

```json
POST /api/v1/sales
{
  "customer_id": 12,
  "seller_id": 3,
  "items": [
    { "product_id": 45, "quantity": 2, "unit_price": 149.90, "discount": 0 },
    { "product_id": 12, "quantity": 1, "unit_price": 59.50,  "discount": 5.00 }
  ],
  "payment": { "method": "cash", "amount": 364.30 },
  "tax_rate": 0.18
}
```

Respuesta `201` (el servidor recalcula todo — RN-11):

```json
{
  "id": 1001,
  "sale_number": "V-2026-000123",
  "subtotal": 359.30,
  "discount": 5.00,
  "tax": 42.52,
  "total": 396.82,
  "status": "paid",
  "inventory_updated": true
}
```

**Detalle completo de venta:**

```json
GET /api/v1/sales/1001 → 200
{
  "id": 1001, "sale_number": "V-2026-000123",
  "customer": { "id": 12, "name": "María Quispe" },
  "seller": { "id": 3, "name": "Luis Ríos" },
  "issued_at": "2026-10-01T15:42:00Z", "status": "paid",
  "items": [
    { "product_id": 45, "sku": "SKU-0045", "name": "Café 250g",
      "quantity": 2, "unit_price": 149.90, "discount": 0, "subtotal": 299.80 },
    { "product_id": 12, "sku": "SKU-0012", "name": "Azúcar 1kg",
      "quantity": 1, "unit_price": 59.50, "discount": 5.00, "subtotal": 54.50 }
  ],
  "subtotal": 359.30, "discount": 5.00, "tax": 42.52, "total": 396.82,
  "paid": 396.82, "balance": 0.00,
  "cancelled_at": null, "cancel_reason": null
}
```

**Movimiento de inventario:**

```json
POST /api/v1/inventory/movements
{ "product_id": 1, "type": "IN", "quantity": 48, "reason": "Recepción de compra OC-0042" }
// type: IN | OUT | RETURN | SHRINKAGE | ADJUSTMENT

// Respuesta 201
{
  "id": 88, "product_id": 1, "sku": "SKU-0001",
  "type": "IN", "quantity": 48, "resulting_stock": 144,
  "reason": "Recepción de compra OC-0042",
  "user": { "id": 3, "name": "Carlos Peña" },
  "created_at": "2026-10-01T16:00:00Z"
}
```

**Errores de este bloque:**

| code | HTTP | Condición |
|---|---|---|
| `BUSINESS_RULE_ERROR` | 400 | Stock insuficiente (RN-10) · stock negativo (RN-20) · pago excede saldo (RN-16) · fecha futura (RN-19) |
| `CONFLICT` | 409 | Conflicto de numeración correlativa (RN-12) |
| `NOT_FOUND` | 404 | Venta / producto inexistente |
| `VALIDATION_ERROR` | 422 | Falta `reason` obligatorio en merma/ajuste (RN-21) |

### 2.7 Dashboard (RF-09)

| Método | Endpoint | Función |
|---|---|---|
| GET | `/api/v1/dashboard/summary` | Ventas, ingresos, transacciones, clientes del periodo |
| GET | `/api/v1/dashboard/timeseries?period=day\|month` | Serie temporal de ventas |
| GET | `/api/v1/dashboard/top?entity=products\|sellers` | Ranking por producto/vendedor |
| GET | `/api/v1/dashboard/stock-alerts` | Alertas de stock mínimo |

Query params comunes: `date_from`, `date_to`, `branch_id`, `seller_id`, `category_id`.

```json
GET /api/v1/dashboard/summary?date_from=2026-09-01&date_to=2026-09-30 → 200
{
  "period": { "from": "2026-09-01", "to": "2026-09-30" },
  "sales": 214, "revenue": 38250.00, "transactions": 214,
  "new_customers": 27, "average_ticket": 178.74,
  "mean_sale": 166.32, "median_sale": 142.50,
  "low_stock_products": 6, "cancellations": 3,
  "vs_previous_period": { "revenue_pct": 8.4, "sales_pct": 3.1 }
}
```

### 2.8 Estadística — Semana 07 (RF-10…RF-14, RF-21)

| Método | Endpoint | Función |
|---|---|---|
| POST | `/api/v1/statistics/mean` | Calcular media (RF-11) |
| POST | `/api/v1/statistics/median` | Calcular mediana (RF-12) |
| POST | `/api/v1/statistics/compare` | Comparar media vs. mediana (RF-13) |
| POST | `/api/v1/statistics/variables` | Clasificar/analizar variables (RF-14) |
| GET | `/api/v1/statistics/analyses` | Historial de análisis (RF-21) |
| GET | `/api/v1/statistics/analyses/{id}` | Resultado almacenado (RF-21) |
| GET | `/api/v1/statistics/datasets` | Datasets disponibles (RF-10) |
| POST | `/api/v1/statistics/datasets` | Crear dataset desde la operación o un archivo (RF-10) |
| GET | `/api/v1/statistics/datasets/{id}` | Detalle con variables y observaciones (RF-10) |

**Ejemplo — media:**

```json
POST /api/v1/statistics/mean
{ "dataset_id": 5, "field": "total" }
→ { "metric": "mean", "value": 356.87, "count": 128,
    "min": 12.0, "max": 980.0,
    "period": { "from": "2026-09-01", "to": "2026-09-30" },
    "analysis_id": 33, "calculated_at": "2026-10-01T17:10:00Z" }
```

*También admite valores directos para pruebas académicas:*
`{ "values": [10, 20, 30, 40], "save_history": false }` → `{ "metric": "mean", "value": 25.0, "count": 4 }`

**Ejemplo — comparación:**

```json
POST /api/v1/statistics/compare
{ "values_source": "dataset", "dataset_id": 5, "field": "total" }
→ {
    "mean": 356.87,
    "median": 298.40,
    "difference": 58.47,
    "difference_pct": 19.62,
    "interpretation": "La media supera a la mediana: la distribución tiene cola derecha (algunas ventas muy altas elevan el promedio)."
  }
```

**Ejemplo — clasificación de variables (RF-14):**

```json
POST /api/v1/statistics/variables
{ "dataset_id": 5 }
→ {
    "variables": [
      { "name": "total", "type": "quantitative", "subtype": "continuous",
        "count": 214, "mean": 166.32, "median": 142.50, "min": 12.0, "max": 980.0 },
      { "name": "category_name", "type": "qualitative", "subtype": "nominal",
        "count": 214,
        "frequencies": [ { "value": "Bebidas", "count": 88, "pct": 41.12 } ] }
    ]
  }
```

**Errores:** `DATOS_INSUFICIENTES` 400 con menos de 2 observaciones (RN-40) · `VALIDATION_ERROR` 422 si la variable no está declarada (RN-46) · `NOT_FOUND` 404.

### 2.9 Probabilidad y variables aleatorias (RF-15…RF-17)

| Método | Endpoint | Función |
|---|---|---|
| POST | `/api/v1/probability/bayes` | Teorema de Bayes (RF-17) |
| POST | `/api/v1/probability/basic` | Probabilidad simple / conjunta / condicional (RF-16) |
| POST | `/api/v1/probability/events` | Crear evento sobre un dataset |
| GET | `/api/v1/probability/events` | Listar eventos |
| POST | `/api/v1/random-variables/analyze` | Analizar variable aleatoria (RF-15) |
| GET | `/api/v1/random-variables` | Listar variables aleatorias |

**Ejemplo — Bayes:**

```json
POST /api/v1/probability/bayes
{
  "label": "Cliente repite compra dado que usó promoción",
  "p_a": 0.30,          // P(A)  — probabilidad previa
  "p_b_given_a": 0.80,  // P(B|A)
  "p_b": 0.50           // P(B)
}
→ {
    "p_a_given_b": 0.48,
    "formula": "P(A|B) = P(B|A)·P(A) / P(B)",
    "explanation": "Si ocurre B, la probabilidad de A pasa de 30% a 48%."
  }
```

**Errores:** `BAYES_POR_CERO` 422 cuando `p_b = 0` (RN-43) · `VALIDATION_ERROR` 422 si alguna probabilidad está fuera de `[0, 1]`.

**Ejemplo — variable aleatoria:**

```json
POST /api/v1/random-variables/analyze
{ "dataset_id": 5, "field": "quantity", "distribution": "discrete", "save_history": true }
// distribution: discrete | continuous | binomial | poisson | normal | uniform
→ {
    "field": "quantity", "distribution": "discrete",
    "count": 214,
    "possible_values": [1, 2, 3, 4, 5],
    "probabilities": [0.18, 0.34, 0.27, 0.14, 0.07],
    "expected_value": 2.38, "variance": 1.16,
    "summary": "La cantidad promedio por venta es 2.38 unidades.",
    "analysis_id": 42
  }
```

### 2.10 Insights y reportes (RF-18…RF-20)

| Método | Endpoint | Función |
|---|---|---|
| GET | `/api/v1/insights` | Consultar insights (filtro severidad, fecha) |
| GET | `/api/v1/insights/{id}` | Insight con su evidencia y análisis origen |
| GET | `/api/v1/insights/rules` | Reglas determinísticas vigentes |
| GET | `/api/v1/reports` | Listar reportes generados |
| POST | `/api/v1/reports` | Generar reporte (ventas / estadístico / productos / clientes / vendedores) |
| GET | `/api/v1/reports/{id}` | Detalle de reporte |
| GET | `/api/v1/reports/{id}/export?format=csv\|pdf\|xlsx` | Exportación |
| GET | `/api/v1/reports/{id}/print` | Vista imprimible |

```json
// InsightResponse — RN-47: toda insight muestra su evidencia numérica
GET /api/v1/insights/9 → 200
{
  "id": 9,
  "title": "Caída del ticket promedio en Bebidas",
  "severity": "WARNING",
  "rule": "REG-07_VARIACION_TICKET",
  "message": "El ticket promedio de Bebidas bajó 12.4% respecto al periodo anterior.",
  "evidence": {
    "current_period": { "average_ticket": 41.20, "count": 88 },
    "previous_period": { "average_ticket": 47.03, "count": 92 },
    "change_pct": -12.40
  },
  "analysis_id": 34, "dataset_id": 5,
  "created_at": "2026-10-01T18:00:00Z", "read": false
}
```

### 2.11 Auditoría (RF-22)

| Método | Endpoint | Función | Acceso |
|---|---|---|---|
| GET | `/api/v1/audit-logs` | Consulta de auditoría (fecha, usuario, acción) | Admin |

---

## 3. Formato de error (estándar)

```json
{
  "code": "BUSINESS_RULE_ERROR",
  "message": "El stock disponible es insuficiente.",
  "detail": [
    { "field": "items[0].quantity", "issue": "Disponible: 3, solicitado: 5" }
  ]
}
```

> ⚠️ **DEC-00 — pendiente de decisión del Product Owner.** El criterio **CA-48 de `01_requisitos.md`
> (FASE 01 aprobada)** define `{ codigo, mensaje, detalle }` (claves en español) y añade `trace_id`.
> Ver `02_arquitectura.md` §9.1.

| code | HTTP | Caso |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Falla de schema/Pydantic |
| `UNAUTHENTICATED` | 401 | Token ausente o expirado |
| `FORBIDDEN` | 403 | Rol sin permiso |
| `NOT_FOUND` | 404 | Recurso inexistente |
| `CONFLICT` | 409 | Duplicado (SKU, email, documento) |
| `BUSINESS_RULE_ERROR` | 400 | Regla de negocio (stock, totales, estados) |
| `RATE_LIMITED` | 429 | 5 intentos fallidos de login (RN-31) |
| `BAYES_POR_CERO` | 422 | `P(B) = 0` (RN-43) |
| `DATOS_INSUFICIENTES` | 400 | Menos de 2 observaciones (RN-40) |
| `INTERNAL_ERROR` | 500 | No controlado (`trace_id` en logs) |

---

## 4. Endpoints de la Fase 05 — estado inicial

Los siguientes son los definidos en el plan maestro como **primera entrega** y deben existir desde el inicio:

`POST /auth/login` · `GET /customers` · `POST /customers` · `GET /products` · `POST /sales` ·
`GET /sales` · `GET /dashboard/summary` · `POST /statistics/mean` · `POST /statistics/median` ·
`POST /statistics/compare` · `POST /probability/bayes` · `POST /random-variables/analyze` ·
`GET /insights` · `GET /reports`

> **14 endpoints del plan** ✔️ — todos presentes en §2. **Total del contrato: 72 operaciones.**

---

## 5. Mapa de autorización (resumen)

| Recurso | Admin | Gerente | Vendedor | Analista | Almacén |
|---|:---:|:---:|:---:|:---:|:---:|
| `/health` | público | público | público | público | público |
| `/auth/login`, `/auth/refresh`, `/auth/forgot-password` | público | público | público | público | público |
| `/users`, `/roles` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/customers` (CRUD) | ✅ | 👁️ | ✅ | 👁️ | ❌ |
| `/customers/{id}/history` | ✅ | 👁️ | 👁️ | 👁️ | ❌ |
| `/products`, `/categories` (CRUD) | ✅ | 👁️ | 👁️ | ❌ | 👁️ |
| `/employees` (CRUD) | ✅ | 👁️ | ❌ | 👁️ | ❌ |
| `/sales` (crear) | ✅ | ✅ | ✅ | 👁️ | 👁️ |
| `/sales/{id}/cancel` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/sales/{id}/payments` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/inventory` (lectura) | ✅ | 👁️ | 👁️ | 👁️ | ✅ |
| `/inventory/movements` (escritura) | ✅ | ❌ | ❌ | ❌ | ✅ |
| `/dashboard/*` | ✅ | ✅ | ❌ | ✅ | 👁️ |
| `/statistics/*` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `/probability/*`, `/random-variables` | ✅ | ✅ | ❌ | ✅ | ❌ |
| `/insights`, `/reports` (CRUD) | ✅ | ✅ | 👁️ | ✅ | ❌ |
| `/audit-logs` | ✅ | ❌ | ❌ | ❌ | ❌ |

✅ acceso total · 👁️ solo lectura · ❌ sin acceso

> La autoridad **siempre** es del backend (`require_role`); el frontend solo oculta la interfaz.
> Además, cada petición filtra por `company_id` del token (aislamiento multiempresa).

---

## 6. Trazabilidad RF → endpoint → fase

| RF | Endpoints | Fase |
|---|---|---|
| RF-01 Autenticación | `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/auth/forgot-password`, `/auth/reset-password` | 05 |
| RF-02 Usuarios | `/users`, `/roles` | 05 |
| RF-03 Clientes | `/customers` | 07 |
| RF-04 Productos y categorías | `/products`, `/categories` | 07 |
| RF-05 Vendedores ⚠️ AR-04 | `/employees`, `/employees/{id}/metrics` | 07 |
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
| RF-16 Probabilidades | `/probability/basic` | 09 |
| RF-17 Bayes | `/probability/bayes` | 09 |
| RF-18 Gráficos | consumo de `/dashboard/*` y `/statistics/*` | 10 |
| RF-19 Insights | `/insights` | 11 |
| RF-20 Reportes | `/reports` | 12 |
| RF-21 Historial | `/statistics/analyses` | 09 |
| RF-22 Auditoría | `/audit-logs` | 13 |

**Los 22 RF tienen al menos un endpoint asociado.**

---

## 7. Criterios de aceptación del contrato

| ID | Criterio |
|---|---|
| CA5-01 | Los 14 endpoints iniciales del plan existen con su método, ruta y función exactos (§4). |
| CA5-02 | Toda operación declara roles permitidos y código de error (§2, §5). |
| CA5-03 | Toda respuesta de error cumple el formato estándar (§3) y DEC-00 queda resuelta antes de la FASE 05. |
| CA5-04 | Todo listado es paginado y ordenable (§1). |
| CA5-05 | Los nombres de campo son `snake_case` idénticos entre Pydantic y TypeScript (AR-05). |
| CA5-06 | OpenAPI generado en `/docs` sin errores de validación (RNF-05). |
| CA5-07 | Los 22 RF tienen al menos un endpoint asociado (§6). |
| CA5-08 | Ningún endpoint expone datos de otra `company_id` (aislamiento multiempresa). |
| CA5-09 | Ningún endpoint del frontend usa la `service_role` key de Supabase (§13.3 de `02_arquitectura.md`). |

---

*SalesIA Enterprise — API REST v1.1 (fusión) · FASE 02 · Grupo 4 — SENATI*
