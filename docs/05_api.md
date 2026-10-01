# 05 · API REST

**SalesIA Enterprise** — Documento 05 de la serie de arquitectura · Versión 1.0
**Framework:** FastAPI · **Base:** `/api/v1` · **Documentación:** Swagger en `/docs` (OpenAPI)

---

## 1. Convenciones

| Aspecto | Regla |
|---|---|
| Versionado | Todo bajo `/api/v1/...` |
| Formato | JSON (UTF-8) · fechas ISO 8601 UTC · montos `numeric` con 2 decimales |
| Autenticación | `Authorization: Bearer <access_token>` (excepto login y `/health`) |
| Listados | `{ "items": [...], "total": n, "page": n, "page_size": n }` |
| Creación | `201` + objeto creado · `204` en DELETE exitoso |
| Errores | `{ "code": "...", "message": "...", "detail": [...] }` |
| Validación | 422 de Pydantic, traducido al formato de error estándar |

### 1.1 Códigos de estado usados

`200` OK · `201` Created · `204` No Content · `400` Bad Request · `401` No autenticado · `403` Sin permiso · `404` No existe · `409` Conflicto (duplicado) · `422` Validación · `500` Error interno.

---

## 2. Endpoints

### 2.1 Salud y autenticación

| Método | Endpoint | Función | Acceso |
|---|---|---|---|
| GET | `/health` | Health check del servicio | Público |
| POST | `/api/v1/auth/login` | Autenticación → JWT (RF-01) | Público |
| POST | `/api/v1/auth/refresh` | Renovar access token | Bearer |
| GET | `/api/v1/auth/me` | Usuario de la sesión actual | Bearer |

### 2.2 Usuarios y roles (RF-02)

| Método | Endpoint | Función | Acceso |
|---|---|---|---|
| GET | `/api/v1/users` | Listar usuarios | Admin |
| POST | `/api/v1/users` | Crear usuario | Admin |
| PUT | `/api/v1/users/{id}` | Actualizar usuario/rol | Admin |
| DELETE | `/api/v1/users/{id}` | Desactivar usuario | Admin |
| GET | `/api/v1/roles` | Listar roles | Admin |

### 2.3 Clientes (RF-03)

| Método | Endpoint | Función | Acceso |
|---|---|---|---|
| GET | `/api/v1/customers` | Listar (búsqueda, filtros, paginación) | Admin/Gerente/Vendedor/Analista |
| GET | `/api/v1/customers/{id}` | Ficha del cliente | idem |
| GET | `/api/v1/customers/{id}/history` | Historial de compras | idem |
| POST | `/api/v1/customers` | Crear cliente | Admin/Vendedor |
| PUT | `/api/v1/customers/{id}` | Editar cliente | Admin/Vendedor |
| DELETE | `/api/v1/customers/{id}` | Baja lógica | Admin |

### 2.4 Productos y categorías (RF-04)

| Método | Endpoint | Función | Acceso |
|---|---|---|---|
| GET | `/api/v1/products` | Listar (filtro categoría, estado, texto) | Admin/Gerente/Vendedor/Almacén |
| GET | `/api/v1/products/{id}` | Detalle de producto | idem |
| POST | `/api/v1/products` | Crear producto | Admin |
| PUT | `/api/v1/products/{id}` | Editar producto | Admin |
| DELETE | `/api/v1/products/{id}` | Baja lógica | Admin |
| GET/POST | `/api/v1/categories` | Categorías | Admin (escritura) |

### 2.5 Vendedores y empleados (RF-05)

| Método | Endpoint | Función |
|---|---|---|
| GET | `/api/v1/employees` | Listar vendedores |
| GET | `/api/v1/employees/{id}/metrics` | Métricas: ventas, ingresos, promedio |

### 2.6 Ventas, pagos e inventario (RF-06, RF-07, RF-08)

| Método | Endpoint | Función |
|---|---|---|
| POST | `/api/v1/sales` | Registrar venta (transaccional: detalle + pago + stock) |
| GET | `/api/v1/sales` | Consultar ventas (filtros por fecha, cliente, vendedor, estado) |
| GET | `/api/v1/sales/{id}` | Detalle de venta con líneas y pagos |
| PUT | `/api/v1/sales/{id}/status` | Cambiar estado (pending/paid/cancelled/shipped) |
| POST | `/api/v1/sales/{id}/payments` | Registrar pago adicional |
| GET | `/api/v1/inventory` | Existencias actuales |
| GET | `/api/v1/inventory/{product_id}/movements` | Kardex del producto |
| POST | `/api/v1/inventory/movements` | Entrada / salida / ajuste de stock |

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

Respuesta `201`:

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

### 2.7 Dashboard (RF-09)

| Método | Endpoint | Función |
|---|---|---|
| GET | `/api/v1/dashboard/summary` | Ventas, ingresos, transacciones, clientes del periodo |
| GET | `/api/v1/dashboard/timeseries?period=day\|month` | Serie temporal de ventas |
| GET | `/api/v1/dashboard/top?entity=products\|sellers` | Ranking por producto/vendedor |

Query params comunes: `date_from`, `date_to`, `branch_id`, `seller_id`, `category_id`.

### 2.8 Estadística — Semana 07 (RF-11…RF-14)

| Método | Endpoint | Función |
|---|---|---|
| POST | `/api/v1/statistics/mean` | Calcular media (RF-11) |
| POST | `/api/v1/statistics/median` | Calcular mediana (RF-12) |
| POST | `/api/v1/statistics/compare` | Comparar media vs. mediana (RF-13) |
| POST | `/api/v1/statistics/variables` | Clasificar/analizar variables (RF-14) |
| GET | `/api/v1/statistics/analyses` | Historial de análisis (RF-21) |
| GET | `/api/v1/statistics/datasets` | Datasets disponibles (RF-10) |

**Ejemplo — media:**

```json
POST /api/v1/statistics/mean
{ "dataset_id": 5, "field": "total" }
→ { "metric": "mean", "value": 356.87, "count": 128 }
```

**Ejemplo — comparación:**

```json
POST /api/v1/statistics/compare
{ "values_source": "dataset", "dataset_id": 5, "field": "total" }
→ {
    "mean": 356.87,
    "median": 298.40,
    "difference": 58.47,
    "interpretation": "La media supera a la mediana: la distribución tiene cola derecha (algunas ventas muy altas elevan el promedio)."
  }
```

### 2.9 Probabilidad y variables aleatorias (RF-15…RF-17)

| Método | Endpoint | Función |
|---|---|---|
| POST | `/api/v1/probability/bayes` | Teorema de Bayes (RF-17) |
| POST | `/api/v1/probability/basic` | Probabilidad de un evento (RF-16) |
| POST | `/api/v1/random-variables/analyze` | Analizar variable aleatoria (RF-15) |

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

### 2.10 Insights y reportes (RF-18…RF-20)

| Método | Endpoint | Función |
|---|---|---|
| GET | `/api/v1/insights` | Consultar insights (filtro severidad, fecha) |
| GET | `/api/v1/insights/{id}` | Insight con su evidencia y análisis origen |
| GET | `/api/v1/reports` | Listar reportes generados |
| POST | `/api/v1/reports` | Generar reporte (ventas / estadístico / productos / clientes / vendedores) |
| GET | `/api/v1/reports/{id}/export?format=csv\|pdf` | Exportación |

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

| code | HTTP | Caso |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Falla de schema/Pydantic |
| `UNAUTHENTICATED` | 401 | Token ausente o expirado |
| `FORBIDDEN` | 403 | Rol sin permiso |
| `NOT_FOUND` | 404 | Recurso inexistente |
| `CONFLICT` | 409 | Duplicado (SKU, email, documento) |
| `BUSINESS_RULE_ERROR` | 400 | Regla de negocio (stock, totales, estados) |
| `INTERNAL_ERROR` | 500 | No controlado (trace_id en logs) |

---

## 4. Endpoints de la Fase 05 — estado inicial

Los siguientes son los definidos en el plan maestro como **primera entrega** y deben existir desde el inicio:

`POST /auth/login` · `GET /customers` · `POST /customers` · `GET /products` · `POST /sales` · `GET /sales` · `GET /dashboard/summary` · `POST /statistics/mean` · `POST /statistics/median` · `POST /statistics/compare` · `POST /probability/bayes` · `POST /random-variables/analyze` · `GET /insights` · `GET /reports`
