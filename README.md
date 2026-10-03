# SalesIA Enterprise

Sistema web empresarial de **gestión de ventas y analítica estadística**.
Las ventas generan los datos; el módulo Analytics los convierte en estadísticas, gráficos e insights.

**Base académica:** Fundamentos y Algoritmia para IA — Semana 07 (estadística aplicada, media, mediana, Teorema de Bayes, variables aleatorias).

---

## Arquitectura

```
React + TypeScript (Vercel)
        │  HTTPS / REST
        ▼
Python + FastAPI (Railway)  ──►  NumPy / Pandas / SciPy
        │
        ▼
PostgreSQL (Supabase)
```

| Capa | Tecnología |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | Python + FastAPI + SQLAlchemy + Alembic |
| Motor estadístico | NumPy / Pandas / SciPy |
| Base de datos | PostgreSQL (Supabase) |
| Despliegue | Vercel · Railway · Supabase |

---

## Estructura del repositorio

```
SALESIA-ENTERPRISE/
├── frontend/    React + TypeScript (módulos por dominio)
├── backend/     FastAPI (api/ · core/ · models/ · schemas/ · services/ · analytics/ · tests/)
├── database/    SQL de referencia y seeds
├── docs/        Documentación de arquitectura (01…07)
├── docker-compose.yml
├── .env.example
└── .gitignore
```

---

## Documentación

| Doc | Contenido |
|---|---|
| [01_requisitos.md](docs/01_requisitos.md) | Problema, objetivos, alcance, roles, RF/RNF, criterios de aceptación |
| [02_arquitectura.md](docs/02_arquitectura.md) | Arquitectura, estructura, contratos, seguridad, ambientes, despliegue |
| [03_ux_ui.md](docs/03_ux_ui.md) | Sistema de diseño, layout, componentes, estados, responsive |
| [04_modelo_er.md](docs/04_modelo_er.md) | Modelo de datos (54 entidades), restricciones, índices, seed |
| [05_api.md](docs/05_api.md) | API REST: endpoints, formatos, ejemplos, errores |
| [06_motor_estadistico.md](docs/06_motor_estadistico.md) | Media, mediana, variables, probabilidad, Bayes, pruebas |
| [07_manual_usuario.md](docs/07_manual_usuario.md) | Manual de usuario por rol |

---

## Plan de desarrollo (16 fases)

| Fase | Entregable | Fase | Entregable |
|---|---|---|---|
| 01 | Requisitos y casos de uso | 09 | Motor estadístico (Semana 07) |
| 02 | Arquitectura técnica | 10 | Dashboard Analytics |
| 03 | UX/UI empresarial | 11 | Insights empresariales |
| 04 | Base de datos PostgreSQL | 12 | Reportes |
| 05 | Backend/API FastAPI | 13 | Seguridad y auditoría |
| 06 | Frontend React | 14 | Pruebas y calidad |
| 07 | Clientes y productos | 15 | Despliegue |
| 08 | Ventas, pagos e inventario | 16 | Cierre y documentación |

> **Regla del proyecto:** cada fase cierra con sus entregables, criterios de aceptación y evidencias antes de avanzar a la siguiente.

---

## Estado actual

- ✅ Estructura del repositorio
- ✅ Documentación de arquitectura (`docs/01…07`)
- ⬜ Código backend / frontend (pendiente por fases)
- ⬜ Despliegues (Vercel · Railway · Supabase)

---

## Trabajo en equipo

1. Un **commit = un cambio pequeño y verificable**; mensaje en formato `tipo(ámbito): descripción`
   (`docs:`, `feat(backend):`, `feat(frontend):`, `db:`, `chore:`, `fix:`).
2. El código se verifica antes de subir: `pytest` (backend) · `npm run build` (frontend).
3. **Nunca** subir secrets: solo `.env.example` con nombres de variables.
4. Si algo falla, se revierte **ese** commit, no el trabajo anterior.
