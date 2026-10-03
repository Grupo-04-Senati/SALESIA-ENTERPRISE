# 04 · Modelo de Datos (Entidad-Relación)

**SalesIA Enterprise** — Documento 04 de la serie de arquitectura · Versión 1.0
**Motor:** PostgreSQL (Supabase) · **ORM:** SQLAlchemy · **Migraciones:** Alembic

---

## 1. Diagrama de relaciones

```
empresas
  │
  ├── usuarios ── roles
  ├── empleados
  ├── clientes
  ├── productos ── categorias
  ├── inventario ── movimientos_inventario
  │
  └── ventas ── detalle_ventas ── productos
        │
        └── pagos

  ────── base analítica ──────

ventas / clientes / productos
        │
        ▼
     conjuntos_datos
        │
   variables_conjunto
        │
   observaciones
        │
        ▼
  analisis_estadisticos
        │
        ├── resultados_estadisticos
        ├── analisis_bayes
        ├── variables_aleatorias
        └── hallazgos

  reportes · registros_auditoria   (transversales)
```

**54 entidades** en total (22 de la base + 32 extensiones de la migración `0002`).

---

## 2. Inventario de entidades

### 2.1 Núcleo de operación comercial

| Entidad | Propósito |
|---|---|
| `empresas` | Empresa propietaria de los datos (aislamiento multi-tenant). |
| `roles` | Roles del sistema (admin, gerente, vendedor, analista, almacén). |
| `usuarios` | Usuarios del sistema (credenciales, rol, estado activo). |
| `empleados` | Personal / vendedores con ficha y métricas comerciales. |
| `clientes` | Clientes y su comportamiento comercial. |
| `categorias` | Categorías de productos. |
| `productos` | Catálogo de productos (precio, stock mínimo, estado). |
| `ventas` | Cabecera de venta (fecha, totales, estado, vendedor). |
| `detalle_ventas` | Líneas de venta (producto, cantidad, precio, subtotal). |
| `pagos` | Pagos asociados a una venta (método, monto, fecha). |
| `inventario` | Existencias actuales por producto. |
| `movimientos_inventario` | Entradas y salidas de stock (trazabilidad). |

### 2.2 Núcleo analítico (Semana 07)

| Entidad | Propósito |
|---|---|
| `conjuntos_datos` | Conjunto de datos derivado de las operaciones para análisis. |
| `variables_conjunto` | Variables estadísticas del dataset (tipo, naturaleza, unidad). |
| `observaciones` | Filas/observaciones del dataset. |
| `analisis_estadisticos` | Historial de análisis ejecutados (parámetros, autor, fecha). |
| `resultados_estadisticos` | Resultados calculados (media, mediana, comparaciones). |
| `analisis_bayes` | Resultados de Bayes: P(A), P(B\|A), P(B), P(A\|B). |
| `variables_aleatorias` | Configuración de variables aleatorias analizadas. |
| `hallazgos` | Conclusiones generadas por reglas, con evidencia numérica. |

### 2.3 Transversales

| Entidad | Propósito |
|---|---|
| `reportes` | Reportes generados (tipo, filtros, autor, fecha). |
| `registros_auditoria` | Registro de operaciones críticas (RNF-07, RF-22). |

### 2.4 Extensiones — migración `0002` (32 tablas)

| Grupo | Entidades | Propósito |
|---|---|---|
| Operación | `sucursales`, `envios` | Sucursales y envíos de ventas. |
| Compras | `proveedores`, `ordenes_compra`, `detalle_ordenes_compra` | Proveedores y órdenes de compra con detalle. |
| Cotizaciones / devoluciones | `cotizaciones`, `detalle_cotizaciones`, `devoluciones`, `detalle_devoluciones` | Presupuestos y notas de crédito con líneas. |
| Precios y promociones | `unidades`, `listas_precios`, `detalle_listas_precios`, `promociones`, `productos_promociones` | Unidades de medida, listas de precios y promociones. |
| CRM | `segmentos_clientes`, `interacciones_clientes` | Segmentación y bitácora de interacciones. |
| Almacenes | `almacenes`, `stock_almacenes`, `conteos_stock`, `detalle_conteos` | Bodegas, stock por bodega y conteos cíclicos. |
| Seguridad | `permisos`, `roles_permisos`, `tokens_refresco`, `intentos_login`, `recuperaciones_password` | RBAC fino, sesiones renovables, intentos de login y recuperación. |
| Analítica y automatización | `instantaneas_kpi`, `reportes_programados`, `exportaciones_datos`, `reglas_automatizacion` | Fotografías de KPIs, reportes programados, exportaciones y reglas. |
| Sistema | `notificaciones`, `ajustes_sistema`, `eventos_app` | Notificaciones, configuración por clave y eventos de la app. |

---

## 3. Detalle de atributos principales

### 3.1 Seguridad y organización

**roles**
| Campo | Tipo | Restricción |
|---|---|---|
| id | serial PK | |
| name | varchar(30) | UNIQUE, NOT NULL |
| description | text | |

**usuarios**
| Campo | Tipo | Restricción |
|---|---|---|
| id | serial PK | |
| company_id | int | FK → empresas, NOT NULL |
| role_id | int | FK → roles, NOT NULL |
| email | varchar(160) | UNIQUE, NOT NULL |
| password_hash | varchar(255) | NOT NULL |
| full_name | varchar(120) | NOT NULL |
| is_active | boolean | DEFAULT true |
| created_at | timestamptz | DEFAULT now() |

### 3.2 Comercial

**clientes**
`id, company_id, name, document_type, document_number, email, phone, address, seller_id (FK empleados), created_at, is_active`
→ UNIQUE `(company_id, document_number)`

**productos**
`id, company_id, category_id (FK), sku, name, description, price (numeric 12,2 CHECK ≥ 0), unit, is_active, created_at`
→ UNIQUE `(company_id, sku)`

**ventas**
`id, company_id, customer_id (FK), seller_id (FK empleados), sale_number, sold_at, subtotal, discount, tax, total (numeric 12,2), status (pending|paid|cancelled|shipped), notes, created_at`
→ CHECK `total = subtotal - discount + tax` · INDEX `(company_id, sold_at)`

**detalle_ventas**
`id, sale_id (FK CASCADE), product_id (FK), quantity (int > 0), unit_price (numeric 12,2), discount, subtotal`

**pagos**
`id, sale_id (FK), method (cash|card|transfer), amount (numeric 12,2 > 0), paid_at, reference, created_at`

**inventario**
`id, company_id, product_id (FK UNIQUE), stock (int ≥ 0), min_stock (int), updated_at`
→ CHECK `stock >= 0`

**movimientos_inventario**
`id, product_id (FK), movement_type (in|out|adjustment), quantity (> 0), reason, reference_id, created_by (FK usuarios), created_at`
→ INDEX `(product_id, created_at)`

### 3.3 Analítico

**conjuntos_datos**
`id, company_id, name, source (sales|customers|products|custom), filters (jsonb), row_count, created_by, created_at`

**variables_conjunto**
`id, dataset_id (FK), name, label, stat_type (qualitative|quantitative), scale (nominal|ordinal|discrete|continuous), unit, is_random_variable (bool)`

**observaciones**
`id, dataset_id (FK), data (jsonb), created_at`

**analisis_estadisticos**
`id, dataset_id (FK), analysis_type (mean|median|compare|variables|random|probability), parameters (jsonb), executed_by (FK usuarios), executed_at`

**resultados_estadisticos**
`id, analysis_id (FK), metric (varchar), value (numeric), summary (jsonb)`

**analisis_bayes**
`id, company_id, label, p_a, p_b_given_a, p_b (numeric 10,6), p_a_given_b (numeric 10,6), explanation (text), created_by, created_at`
→ CHECK todos en rango `[0,1]`

**variables_aleatorias**
`id, analysis_id (FK), variable_name, distribution (discrete|continuous), values (jsonb), expected_value, variance (nullable fase posterior)`

**hallazgos**
`id, company_id, analysis_id (FK NULL), rule_code, severity (info|warning|opportunity), title, message, evidence (jsonb), created_at`

### 3.4 Transversales

**reportes**
`id, company_id, report_type, title, parameters (jsonb), generated_by, generated_at`

**registros_auditoria**
`id, company_id, user_id (FK NULL), action, entity, entity_id, detail (jsonb), ip, created_at`
→ INDEX `(company_id, created_at)`

---

## 4. Restricciones e integridad (RNF-03)

1. **Claves foráneas** en todas las relaciones; `ON DELETE CASCADE` solo en `detalle_ventas` respecto a `ventas`.
2. **CHECKs** para rangos: precios ≥ 0, stock ≥ 0, probabilidades ∈ [0,1], totales coherentes.
3. **UNIQUE** compuestos por `company_id` para evitar duplicados entre empresas.
4. **NOT NULL** en campos financieros y de identidad.
5. **Tipos monetarios:** `numeric(12,2)` — jamás `float` para dinero.
6. **Fechas:** `timestamptz`, almacenamiento en UTC.

---

## 5. Índices

| Tabla | Índice | Motivo |
|---|---|---|
| ventas | `(company_id, sold_at)` | Filtros por periodo (dashboard, reportes). |
| ventas | `(company_id, customer_id)` | Historial del cliente. |
| detalle_ventas | `(sale_id)` | Detalle rápido de venta. |
| pagos | `(sale_id)` | Pagos por venta. |
| movimientos_inventario | `(product_id, created_at)` | Kardex de producto. |
| registros_auditoria | `(company_id, created_at)` | Consulta de auditoría por fecha. |
| clientes | `(company_id, document_number)` UNIQUE | Búsqueda e inserción sin duplicados. |
| productos | `(company_id, sku)` UNIQUE | Idem. |
| observaciones | GIN sobre `data (jsonb)` | Consultas analíticas sobre datos. |

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
| usuarios demo | 1 por rol (credenciales documentadas en `docs/07`) |
| categorias | p. ej. Electrónica, Oficina, Hogar, Servicios |
| productos | ~20 productos con precios y stock |
| clientes | ~10 clientes de prueba |
| ventas | ~50 ventas históricas para poblar Analytics |
| extensiones 0002 | 2 sucursales, 3 proveedores, 2 OC, 3 cotizaciones, 1 devolución, 4 unidades, 1 lista de precios, 2 promociones, 3 segmentos, 4 interacciones, 2 almacenes (12 stocks), 1 conteo, 2 envíos, 9 permisos + 34 asignaciones, intentos de login/tokens, 9 KPIs, 2 reportes, 2 exportaciones, 6 reglas de automatización, 4 notificaciones, 4 ajustes del sistema, 6 eventos (~153 filas). |

> El seed es **opcional y controlado**: existe para desarrollo y demos; no se ejecuta en producción sin validación.
