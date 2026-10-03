# 08 · Guía de despliegue

> SalesIA Enterprise · Plan Integral de Desarrollo · Fase 15
> Referencia técnica: `docs/02_arquitectura.md` §2.1, §11 y §12.

---

## 1. Arquitectura de despliegue

```
React + Vite (frontend)  →  Vercel  ──HTTPS──►  FastAPI (Railway)  ──►  PostgreSQL (Supabase)
```

| Capa | Servicio | Estado |
|---|---|---|
| Frontend (React + Vite + Tailwind) | **Vercel** | ✅ publicado: https://salesia-frontend.vercel.app |
| API (FastAPI) | **Railway** | ✅ publicado: https://api-production-60ffe.up.railway.app |
| Base de datos (PostgreSQL 16) | **Supabase** | ✅ conectada (pooler `aws-0-us-east-2`) |

Orden obligatorio de publicación (plan §12): **base de datos → backend con `/health` → frontend → integración**.

---

## 2. Frontend en Vercel (lo que se despliega hoy)

### 2.1 Configuración ya incluida en el repo

| Archivo | Para qué sirve |
|---|---|
| `frontend/vercel.json` | Framework `vite`, `npm run build`, salida `dist`, `npm ci` y **rewrite SPA** |
| `frontend/package.json` → `engines` | Versión de Node (`>=20.19`) — Vercel la lee de `package.json`, **no** de `vercel.json` |
| `frontend/.env.example` | Plantilla de variables (`VITE_API_URL`) |
| `.gitignore` → `.vercel/` · `.env.local` | Evita versionar el enlace del proyecto y los tokens |

El **rewrite SPA** es lo que permite que rutas como `/clientes`, `/ventas` o
`/automatizaciones` funcionen al recargar la página: Vercel sirve
`index.html` en lugar de un 404.

### 2.2 Publicación con la CLI (equipo)

```powershell
# 1. Iniciar sesión una sola vez (abre el navegador)
npx vercel login

# 2. Vincular el proyecto (solo la primera vez; elige el nombre del proyecto)
cd frontend
npx vercel

# 3. Publicar a producción
npx vercel --prod
```

O bien, en un solo paso: doble clic en **`Desplegar-Frontend.bat`** de la raíz
(compila y publica; la primera vez Vercel pide iniciar sesión).

### 2.3 Publicación automática desde GitHub (recomendado)

1. Vercel → **Add New… → Project** → importar
   `Grupo-04-Senati/SALESIA-ENTERPRISE`.
2. Configurar:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm ci`
3. En **Environment Variables** añadir:

   | Variable | Valor | Visible |
   |---|---|---|
   | `VITE_API_URL` | `https://api-production-60ffe.up.railway.app` (**sin** `/api/v1`) | pública |

   > El nombre debe coincidir con `frontend/src/services/api.ts`; los endpoints
   > de `frontend/src/services/endpoints.ts` ya llevan el prefijo `/api/v1`.

   Proyecto actual: `salesia-frontend` (team `grupo-4-5c32`), ya vinculado con
   `vercel link`; variable dada de alta para *Production* y *Preview*.

4. Cada `push` a `main` publica automáticamente; cada **Pull Request** genera
   una *preview* con URL propia, sin afectar producción (plan §12).

### 2.4 Verificación tras publicar

- [ ] La URL raíz carga el **login** con el fondo azul y las partículas.
- [ ] Recargar en `/clientes`, `/ventas`, `/analytics` y `/automatizaciones`:
      deben cargar la página y **no** dar 404 (prueba del rewrite SPA).
- [ ] El menú lateral abre los 11 módulos y el usuario demo aparece arriba.
- [ ] Registrar una venta: la traza de proceso aparece y el stock baja.
- [ ] `Automatizaciones`: desactivar una regla y comprobar que el efecto cambia.
- [ ] En el navegador, consola sin errores y pestaña *Network* sin 404 de assets.

> **Nota WebGPU:** el fondo de partículas requiere un navegador con WebGPU
> (Chrome/Edge actuales). Si no está disponible, el login muestra el azul
> corporativo como respaldo, sin romper nada.

---

## 3. Backend en Railway

### 3.1 Despliegue con la CLI (así se publicó)

```powershell
# Desde backend/ (la CLI enlaza el directorio actual al proyecto)
railway init --name salesia-api     # crea proyecto y lo enlaza
railway variable set KEY=value --service api   # ver §3.2
railway up -y -d                    # sube el código y construye con el Dockerfile
railway domain -s api               # genera la URL pública
```

- Railway **detecta automáticamente** `backend/Dockerfile` (builder: Dockerfile),
  así que no hace falta configurar build ni start: el `CMD` corre
  `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT}`.
- **Opcional:** en *Service → Settings → Healthcheck Path* poner `/health` para
  que Railway solo enrute tráfico cuando la API responda. (La Config as Code
  `railway.json` está deprecada y **no** se aplica a servicios nuevos.)
- Redesplegar tras un `git push` o un cambio de código: `railway up -y -d`.

### 3.2 Variables (solo en Railway)

| Variable | Valor |
|---|---|
| `ENVIRONMENT` | `production` |
| `DEBUG` | `false` (**obligatorio** con `ENVIRONMENT=production`, ver `config.py`) |
| `DATABASE_URL` | Supabase por **pooler** (`postgresql+psycopg://…:5432/postgres`) |
| `SECRET_KEY` | `openssl rand -hex 32` (nunca en el repo ni en Vercel) |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` |
| `CORS_ORIGINS` | `https://salesia-frontend.vercel.app` (+ localhost en dev) |
| `CORS_ORIGIN_REGEX` | `https://salesia-frontend-.*\.vercel\.app` (previews de Vercel) |
| `API_BASE_URL` | `https://api-production-60ffe.up.railway.app` |

> `DATABASE_URL` y `SECRET_KEY` **no tienen valor por defecto**: si faltan, la
> app muere al importar `app/core/config.py`. `CORS_ORIGINS` es por coincidencia
> exacta; para las previews se usa `CORS_ORIGIN_REGEX` (soportado por
> `allow_origin_regex` en `app/main.py`).

### 3.3 Seed de la base de datos

Las migraciones crean las 54 tablas pero **no usuarios**. La primera vez:

```powershell
python -m app.seeds.seed --login    # mínimo: empresa + roles + admin
python -m app.seeds.seed            # demo completa (si la base está vacía)
python -m app.seeds.seed --force    # limpia y vuelve a sembrar
```

Acceso: `admin@salesia.com` / `admin123`.

### 3.4 Verificación

1. `GET /health` → `{"status":"ok", …, "environment":"production"}`.
2. `POST /api/v1/auth/login` con `admin@salesia.com` → `200`.
3. Preflight `OPTIONS` con `Origin: https://salesia-frontend.vercel.app` →
   `Access-Control-Allow-Origin` presente (y **ausente** para orígenes ajenos).

## 4. Base de datos en Supabase (Fase 04)

1. Crear el proyecto y copiar la URL de conexión.
2. Aplicar migraciones con Alembic desde `backend/alembic/versions/` — nunca
   editando el esquema a mano (M-07).
3. En producción usar siempre el **pooler** (M-08 / plan §13).
4. Habilitar PITR y probar una restauración antes de la Fase 15 (CA-37).

---

## 5. Seguridad

- Ningún archivo `.env` real se versiona (`.gitignore` + `.env.example`).
- `VITE_*` es público por diseño: **solo** URLs y claves `anon`.
- `SUPABASE_SERVICE_ROLE_KEY` y `SECRET_KEY` viven **únicamente** en Railway.
- HTTPS lo aporta Vercel y Railway; CORS se limita a los orígenes exactos.

## 6. Reversión (rollback)

- **Frontend:** en Vercel, *Deployments → ⋯ → Promote to Production* con el
  build anterior.
- **Backend:** `railway rollback` a la revisión previa.
- **Base de datos:** restaurar desde el respaldo de Supabase (PITR).
