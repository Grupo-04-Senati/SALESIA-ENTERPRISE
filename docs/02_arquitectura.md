# 02 · Arquitectura Técnica

**SalesIA Enterprise** — Documento 02 de la serie de arquitectura · Versión 1.0

---

## 1. Visión general

```
USUARIO
  │
  ▼
REACT + TYPESCRIPT          → Frontend (Vercel)
  │  HTTPS / REST
  ▼
FASTAPI                     → Backend (Railway)
  ├── Auth
  ├── Customers
  ├── Products
  ├── Sales
  ├── Inventory
  ├── Statistics
  ├── Probability
  ├── Insights
  └── Reports
  │
  ├──────────────► PYTHON / NUMPY / PANDAS / SCIPY
  │
  ▼
POSTGRESQL                  → Supabase (PostgreSQL gestionado)
  ├── Operación comercial
  ├── Datos analíticos
  ├── Resultados
  └── Auditoría
```

**Principio rector:** separación de presentación, lógica de negocio y persistencia (RNF-08). El frontend nunca accede directamente a la base de datos; todo pasa por la API.

---

## 2. Stack tecnológico y decisiones

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS | Tipado estricto, build rápido, sistema de utilidades para UI consistente. |
| Backend | Python + FastAPI | Validación automática con Pydantic, OpenAPI documentada (RNF-05), async. |
| Motor estadístico | NumPy / Pandas / SciPy | Librerías estándar para cálculo estadístico y pruebas (base académica). |
| Base de datos | PostgreSQL (Supabase) | Integridad referencial (RNF-03), SQL potente para consultas analíticas. |
| Migraciones | Alembic | Migraciones versionadas y reproducibles por ambiente. |
| Autenticación | JWT (Bearer) | Stateless, estándar REST, compatible con roles. |
| Despliegue | Vercel (frontend) · Railway (backend) · Supabase (DB) | CI automático por rama y previews por Pull Request. |

### 2.1 Decisiones clave

1. **API versionada** en `/api/v1` — permite evolucionar sin romper clientes.
2. **Contratos tipados en ambos lados** — schemas Pydantic (backend) y tipos TypeScript (frontend) espejan los mismos DTO.
3. **Errores centralizados** — un manejador único devuelve `{code, message, detail}` (RNF-11).
4. **Migraciones, nunca edición directa de BD** — todo cambio de esquema pasa por Alembic y queda en el repo.
5. **Configuración solo por variables de entorno** — cero secretos en el código (RNF-10).

---

## 3. Estructura del proyecto

```
SALESIA-ENTERPRISE/
├── frontend/                    # React + TypeScript (Vite)
│   └── src/
│       ├── app/                 # App, router, providers
│       ├── components/          # Componentes reutilizables
│       ├── layouts/             # Sidebar, topbar, layouts de página
│       ├── modules/             # Un módulo por dominio
│       │   ├── auth/            #   pages/ components/ services/
│       │   ├── dashboard/
│       │   ├── customers/
│       │   ├── products/
│       │   ├── sales/
│       │   ├── inventory/
│       │   ├── analytics/
│       │   ├── probability/
│       │   ├── insights/
│       │   └── reports/
│       ├── services/            # Cliente HTTP base, endpoints
│       ├── hooks/               # Hooks de datos
│       ├── types/               # Tipos TS (espejo de DTOs)
│       └── utils/               # Validadores, formatters, constantes
│
├── backend/                     # Python + FastAPI
│   ├── alembic/                 # Migraciones (versions/)
│   ├── app/
│   │   ├── api/v1/routers/      # Un router por dominio
│   │   ├── core/                # config, database, security, logging, exceptions
│   │   ├── models/              # Modelos SQLAlchemy (22 entidades)
│   │   ├── schemas/             # DTOs Pydantic (request/response)
│   │   ├── services/            # Lógica de negocio transaccional
│   │   ├── analytics/           # Motor estadístico (media, mediana, Bayes…)
│   │   └── utils/               # Validadores y helpers
│   ├── tests/                   # unit/ · api/ · integration/
│   ├── requirements.txt
│   └── Dockerfile
│
├── database/                    # SQL de referencia y seeds
├── docs/                        # Esta serie de documentos
├── docker-compose.yml           # Entorno local unificado
├── .env.example                 # Variables requeridas (sin valores)
└── .gitignore
```

### 3.1 Módulos por dominio (backend)

| Módulo | Responsabilidad |
|---|---|
| `auth` | Login, JWT, roles y permisos (RF-01, RF-02). |
| `customers` | CRUD clientes e historial (RF-03). |
| `products` | CRUD productos y categorías (RF-04). |
| `sales` | Venta, detalle, pagos — transaccional (RF-06, RF-07). |
| `inventory` | Stock y movimientos (RF-08). |
| `statistics` | Media, mediana, comparación, variables (RF-11…RF-14). |
| `probability` | Probabilidades y Teorema de Bayes (RF-16, RF-17). |
| `random_variables` | Análisis de variables aleatorias (RF-15). |
| `insights` | Reglas determinísticas y observaciones (RF-19). |
| `reports` | Generación y consulta de reportes (RF-20). |
| `dashboard` | Resumen ejecutivo de KPIs (RF-09). |

---

## 4. Contratos API (resumen)

- **Base:** `GET|POST|PUT|DELETE /api/v1/<recurso>`
- **Formato:** JSON (UTF-8), fechas ISO 8601 en UTC, montos numéricos con 2 decimales.
- **Autenticación:** `Authorization: Bearer <token>` salvo endpoints públicos (`/auth/login`, `/health`).
- **Respuesta de lista:** `{ "items": [...], "total": n, "page": n, "page_size": n }`.
- **Respuesta de error:** `{ "code": "VALIDATION_ERROR", "message": "...", "detail": [...] }`.
- **Códigos:** 200 OK · 201 Created · 204 No Content · 400 · 401 · 403 · 404 · 409 · 422 · 500.

Detalle completo en [`05_api.md`](05_api.md).

---

## 5. Autenticación y autorización

1. `POST /api/v1/auth/login` → valida credenciales → devuelve `access_token` (JWT) + `refresh_token`.
2. El JWT incluye `sub` (user id), `role` y `exp`.
3. El decorator/dependencia `get_current_user` resuelve el usuario; `require_role(...)` restringe por rol.
4. Contraseñas con hash (bcrypt/argon2), jamás en texto plano.
5. La auditoría registra: `user_id`, `acción`, `entidad`, `fecha`, `ip`, `detalle`.

### 5.1 Matriz de acceso por módulo

| Módulo | Admin | Gerente | Vendedor | Analista | Almacén |
|---|:-:|:-:|:-:|:-:|:-:|
| Usuarios / configuración | ✅ | ❌ | ❌ | ❌ | ❌ |
| Clientes | ✅ | 👁️ | ✅ | 👁️ | ❌ |
| Productos | ✅ | 👁️ | 👁️ | ❌ | 👁️ |
| Ventas / pagos | ✅ | 👁️ | ✅ | 👁️ | ❌ |
| Inventario | ✅ | 👁️ | ❌ | ❌ | ✅ |
| Dashboard / Analytics | ✅ | ✅ | 👁️ | ✅ | ❌ |
| Reportes / insights | ✅ | ✅ | ❌ | ✅ | ❌ |

✅ acceso total · 👁️ solo lectura · ❌ sin acceso

---

## 6. Manejo de errores

- Excepciones de negocio se declaran en `core/exceptions.py` (`NotFound`, `Forbidden`, `Conflict`, `BusinessRuleError`).
- Un middleware global captura excepciones no manejadas y las traduce al formato de error estándar (RNF-11).
- En producción la respuesta **nunca** expone stack traces; el detalle queda en logs (RNF-07).
- El frontend distingue: error de red (reintento), 401 (refrescar sesión), 403 (mensaje de permiso), 422/400 (mostrar validación campo a campo).

---

## 7. Estrategia de migraciones y ambientes

| Ambiente | Rama | Backend | Frontend | BD |
|---|---|---|---|---|
| **local** | cualquier | `uvicorn` local | `npm run dev` | Postgres local (docker-compose) o Supabase |
| **preview** | Pull Request | build Railway | Preview Vercel | BD de desarrollo |
| **producción** | `main` | Railway | Vercel | Supabase (producción) |

Reglas:

1. Migraciones en `backend/alembic/versions/` con nombre `NNN_descripcion.py`.
2. Nunca editar datos ni esquema manualmente en el panel de Supabase.
3. Los seeds (`database/seeds/`) son idempotentes: se pueden ejecutar más de una vez.
4. Las variables de entorno se definen en `.env.example` y se configuran en cada plataforma (nunca en el repo).

---

## 8. Variables de entorno

Definidas en [`.env.example`](../.env.example):

| Variable | Uso | Dónde se define |
|---|---|---|
| `DATABASE_URL` | Conexión PostgreSQL | Railway (backend) |
| `SECRET_KEY` | Firma JWT | Railway (backend) |
| `CORS_ORIGINS` | Orígenes permitidos (Vercel) | Railway (backend) |
| `API_BASE_URL` | URL pública de la API | Vercel (frontend) |
| `VITE_API_BASE_URL` | URL de la API para el cliente HTTP | Vercel (solo con prefijo `VITE_`) |
| `ENVIRONMENT` | `development` / `production` | ambas |

---

## 9. Estrategia de despliegue

```
PRODUCCIÓN

React / Vite  ──►  Vercel  ──HTTPS──►  FastAPI (Railway)  ──►  PostgreSQL (Supabase)
```

- **Un servicio por paso:** primero DB, luego backend con `/health`, luego frontend, luego integración.
- Cada Pull Request genera una **preview** (Vercel) sin afectar producción.
- CORS se configura con los orígenes exactos de Vercel (producción + previews).
- Health checks: `GET /health` (backend) permite verificar el deploy de forma automática.
- Logs y monitoreo desde el panel de Railway; errores de aplicación con trace id.

---

## 10. Estrategia de pruebas (RNF-09)

| Nivel | Ejemplos | Ubicación |
|---|---|---|
| Unitarias | Media, mediana, Bayes, validadores | `backend/tests/unit/` |
| API | Status codes, schemas, permisos | `backend/tests/api/` |
| Integración | Venta → inventario → persistencia | `backend/tests/integration/` |
| Frontend | Formularios, rutas, filtros, estados | manuales / E2E (fase 14) |
| Datos | Constraints, duplicados, nulos | SQL de verificación |
| Aceptación | Flujo completo de venta y análisis | fase 14 |

---

## 11. Evolución (Semana 08 en adelante)

La arquitectura permite incorporar sin reescritura: varianza y desviación estándar, distribuciones, pruebas de hipótesis, p-valor, esperanza matemática y, si el alcance académico lo permite, modelos predictivos.
