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
| Frontend (React + Vite + Tailwind) | **Vercel** | ✅ listo para publicar |
| API (FastAPI) | **Railway** | ⏳ Fase 05 |
| Base de datos (PostgreSQL 16) | **Supabase** | ⏳ Fase 04 |

Orden obligatorio de publicación (plan §12): **base de datos → backend con `/health` → frontend → integración**.

---

## 2. Frontend en Vercel (lo que se despliega hoy)

### 2.1 Configuración ya incluida en el repo

| Archivo | Para qué sirve |
|---|---|
| `frontend/vercel.json` | Framework `vite`, `npm run build`, salida `dist`, Node 20 y **rewrite SPA** |
| `frontend/.env.example` | Plantilla de variables (`VITE_API_BASE_URL`) |
| `.gitignore` → `.vercel/` | Evita versionar el enlace del proyecto |

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
3. En **Environment Variables** añadir (Fase 05, cuando exista la API):

   | Variable | Valor | Visible |
   |---|---|---|
   | `VITE_API_BASE_URL` | `https://<tu-api>.up.railway.app/api/v1` | pública |

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

## 3. Backend en Railway (Fase 05)

1. `railway init` y `railway up` desde `backend/`.
2. Variables (plan §11), **solo en Railway**:

   | Variable | Origen |
   |---|---|
   | `DATABASE_URL` | Supabase (usar el *pooler* en producción) |
   | `SECRET_KEY` | `openssl rand -hex 32` |
   | `ACCESS_TOKEN_EXPIRE_MINUTES` | `1800` |
   | `CORS_ORIGINS` | Dominio de Vercel (producción + previews) |

3. Verificar `GET /health` antes de tocar el frontend.

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
