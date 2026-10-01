# 04 · Modelo de Datos (Entidad-Relación)

**SalesIA Enterprise** — Documento 04 de la serie de arquitectura · Versión 1.0
**Motor:** PostgreSQL (Supabase) · **ORM:** SQLAlchemy · **Migraciones:** Alembic

---

## 1. Diagrama de relaciones

```
companies
  │
  ├── users ── roles
  ├── employees
  ├── customers
  ├── products ── categories
  ├── inventory ── inventory_movements
  │
  └── sales ── sale_details ── products
        │
        └── payments

  ────── base analítica ──────

sales / customers / products
        │
        ▼
     datasets
        │
   dataset_variables
        │
   observations
        │
        ▼
  statistical_analyses
        │
        ├── statistical_results
        ├── bayes_analyses
        ├── random_variables
        └── insights

  reports · audit_logs   (transversales)
```

**22 entidades** en total.

---

## 2. Inventario de entidades

### 2.1 Núcleo de operación comercial

| Entidad | Propósito |
|---|---|
| `companies` | Empresa propietaria de los datos (aislamiento multi-tenant). |
| `roles` | Roles del sistema (admin, gerente, vendedor, analista, almacén). |
| `users` | Usuarios del sistema (credenciales, rol, estado activo). |
| `employees` | Personal / vendedores con ficha y métricas comerciales. |
| `customers` | Clientes y su comportamiento comercial. |
| `categories` | Categorías de productos. |
| `products` | Catálogo de productos (precio, stock mínimo, estado). |
| `sales` | Cabecera de venta (fecha, totales, estado, vendedor). |
| `sale_details` | Líneas de venta (producto, cantidad, precio, subtotal). |
| `payments` | Pagos asociados a una venta (método, monto, fecha). |
| `inventory` | Existencias actuales por producto. |
| `inventory_movements` | Entradas y salidas de stock (trazabilidad). |

### 2.2 Núcleo analítico (Semana 07)

| Entidad | Propósito |
|---|---|
| `datasets` | Conjunto de datos derivado de las operaciones para análisis. |
| `dataset_variables` | Variables estadísticas del dataset (tipo, naturaleza, unidad). |
| `observations` | Filas/observaciones del dataset. |
| `statistical_analyses` | Historial de análisis ejecutados (parámetros, autor, fecha). |
| `statistical_results` | Resultados calculados (media, mediana, comparaciones). |
| `bayes_analyses` | Resultados de Bayes: P(A), P(B\|A), P(B), P(A\|B). |
| `random_variables` | Configuración de variables aleatorias analizadas. |
| `insights` | Conclusiones generadas por reglas, con evidencia numérica. |

### 2.3 Transversales

| Entidad | Propósito |
|---|---|
| `reports` | Reportes generados (tipo, filtros, autor, fecha). |
| `audit_logs` | Registro de operaciones críticas (RNF-07, RF-22). |

---

## 3. Detalle de atributos principales

### 3.1 Seguridad y organización

**roles**
| Campo | Tipo | Restricción |
|---|---|---|
| id | serial PK | |
| name | varchar(30) | UNIQUE, NOT NULL |
| description | text | |

**users**
| Campo | Tipo | Restricción |
|---|---|---|
| id | serial PK | |
| company_id | int | FK → companies, NOT NULL |
| role_id | int | FK → roles, NOT NULL |
| email | varchar(160) | UNIQUE, NOT NULL |
| password_hash | varchar(255) | NOT NULL |
| full_name | varchar(120) | NOT NULL |
| is_active | boolean | DEFAULT true |
| created_at | timestamptz | DEFAULT now() |

### 3.2 Comercial

**customers**
`id, company_id, name, document_type, document_number, email, phone, address, seller_id (FK employees), created_at, is_active`
→ UNIQUE `(company_id, document_number)`

**products**
`id, company_id, category_id (FK), sku, name, description, price (numeric 12,2 CHECK ≥ 0), unit, is_active, created_at`
→ UNIQUE `(company_id, sku)`

**sales**
`id, company_id, customer_id (FK), seller_id (FK employees), sale_number, sold_at, subtotal, discount, tax, total (numeric 12,2), status (pending|paid|cancelled|shipped), notes, created_at`
→ CHECK `total = subtotal - discount + tax` · INDEX `(company_id, sold_at)`

**sale_details**
`id, sale_id (FK CASCADE), product_id (FK), quantity (int > 0), unit_price (numeric 12,2), discount, subtotal`

**payments**
`id, sale_id (FK), method (cash|card|transfer), amount (numeric 12,2 > 0), paid_at, reference, created_at`

**inventory**
`id, company_id, product_id (FK UNIQUE), stock (int ≥ 0), min_stock (int), updated_at`
→ CHECK `stock >= 0`

**inventory_movements**
`id, product_id (FK), movement_type (in|out|adjustment), quantity (> 0), reason, reference_id, created_by (FK users), created_at`
→ INDEX `(product_id, created_at)`

### 3.3 Analítico

**datasets**
`id, company_id, name, source (sales|customers|products|custom), filters (jsonb), row_count, created_by, created_at`

**dataset_variables**
`id, dataset_id (FK), name, label, stat_type (qualitative|quantitative), scale (nominal|ordinal|discrete|continuous), unit, is_random_variable (bool)`

**observations**
`id, dataset_id (FK), data (jsonb), created_at`

**statistical_analyses**
`id, dataset_id (FK), analysis_type (mean|median|compare|variables|random|probability), parameters (jsonb), executed_by (FK users), executed_at`

**statistical_results**
`id, analysis_id (FK), metric (varchar), value (numeric), summary (jsonb)`

**bayes_analyses**
`id, company_id, label, p_a, p_b_given_a, p_b (numeric 10,6), p_a_given_b (numeric 10,6), explanation (text), created_by, created_at`
→ CHECK todos en rango `[0,1]`

**random_variables**
`id, analysis_id (FK), variable_name, distribution (discrete|continuous), values (jsonb), expected_value, variance (nullable fase posterior)`

**insights**
`id, company_id, analysis_id (FK NULL), rule_code, severity (info|warning|opportunity), title, message, evidence (jsonb), created_at`

### 3.4 Transversales

**reports**
`id, company_id, report_type, title, parameters (jsonb), generated_by, generated_at`

**audit_logs**
`id, company_id, user_id (FK NULL), action, entity, entity_id, detail (jsonb), ip, created_at`
→ INDEX `(company_id, created_at)`

---

## 4. Restricciones e integridad (RNF-03)

1. **Claves foráneas** en todas las relaciones; `ON DELETE CASCADE` solo en `sale_details` respecto a `sales`.
2. **CHECKs** para rangos: precios ≥ 0, stock ≥ 0, probabilidades ∈ [0,1], totales coherentes.
3. **UNIQUE** compuestos por `company_id` para evitar duplicados entre empresas.
4. **NOT NULL** en campos financieros y de identidad.
5. **Tipos monetarios:** `numeric(12,2)` — jamás `float` para dinero.
6. **Fechas:** `timestamptz`, almacenamiento en UTC.

---

## 5. Índices

| Tabla | Índice | Motivo |
|---|---|---|
| sales | `(company_id, sold_at)` | Filtros por periodo (dashboard, reportes). |
| sales | `(company_id, customer_id)` | Historial del cliente. |
| sale_details | `(sale_id)` | Detalle rápido de venta. |
| payments | `(sale_id)` | Pagos por venta. |
| inventory_movements | `(product_id, created_at)` | Kardex de producto. |
| audit_logs | `(company_id, created_at)` | Consulta de auditoría por fecha. |
| customers | `(company_id, document_number)` UNIQUE | Búsqueda e inserción sin duplicados. |
| products | `(company_id, sku)` UNIQUE | Idem. |
| observations | GIN sobre `data (jsonb)` | Consultas analíticas sobre datos. |

---

## 6. Convenciones

- Tablas en **snake_case** plural; PK `id` serial; FKs `xxx_id`.
- Auditoría de modificación: columnas `created_at` / `updated_at` con `DEFAULT now()`.
- Ningún dato de ejemplo con datos reales de personas.
- Los cambios de esquema se hacen **solo** con migraciones Alembic (`backend/alembic/versions/NNN_*.py`); los `.sql` de `database/` son referencia legible y seeds idempotentes.

---

## 7. Datos semilla (seed)

| Grupo | Contenido |
|---|---|
| roles | administrador, gerente, vendedor, analista, almacen |
| users demo | 1 por rol (credenciales documentadas en `docs/07`) |
| categories | p. ej. Electrónica, Oficina, Hogar, Servicios |
| products | ~20 productos con precios y stock |
| customers | ~10 clientes de prueba |
| ventas | ~50 ventas históricas para poblar Analytics |

> El seed es **opcional y controlado**: existe para desarrollo y demos; no se ejecuta en producción sin validación.
