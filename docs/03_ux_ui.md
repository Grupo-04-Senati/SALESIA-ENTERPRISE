# 03 · Diseño UX / UI Empresarial

**SalesIA Enterprise** — Documento 03 de la serie de arquitectura · Versión 1.0

---

## 1. Principios de diseño

1. **Legibilidad por encima de decoración** — jerarquía visual clara, tipografía y espaciado consistentes.
2. **Consistencia** — patrones idénticos entre módulos (misma tabla, mismo formulario, mismos estados).
3. **Orientado a tarea** — cada pantalla responde a una pregunta: ¿qué vendí?, ¿qué tengo en stock?, ¿qué me dice la estadística?
4. **Estados explícitos** — toda carga de datos muestra *loading*, *empty*, *error* y *success*.

---

## 2. Sistema de diseño (design tokens)

### 2.1 Paleta

| Token | Uso | Color |
|---|---|---|
| `primary` | Azul corporativo — botones primarios, sidebar activo, links | Azul #1E3A8A / #2563EB |
| `accent` | Cyan — métricas destacadas, series de gráficos | Cyan #06B6D4 |
| `surface` | Fondo de tarjetas y paneles | Blanco #FFFFFF |
| `background` | Fondo general de la app | Gris claro #F8FAFC |
| `border` | Bordes de tablas y tarjetas | Gris #E2E8F0 |
| `text` | Texto principal / secundario | Gris #0F172A / #64748B |
| `success` | Confirmaciones, estados OK | Verde #16A34A |
| `warning` | Alertas de stock, datos faltantes | Ámbar #D97706 |
| `danger` | Errores, eliminaciones | Rojo #DC2626 |

### 2.2 Tipografía y espaciado

- **Títulos:** semibold; tamaños 24 / 20 / 16 px. **Cuerpo:** 14 px regular.
- **Espaciado base:** escala 4 / 8 / 12 / 16 / 24 / 32 px.
- **Bordes:** radios de 8 px en tarjetas y botones, 6 px en inputs.
- **Sombras:** solo en modales y tarjetas elevadas (una sombra sutil, nunca excesiva).

### 2.3 Iconografía

- Set único (Lucide/Feather) para acciones: ✏️ editar, 🗑️ eliminar, 🔍 buscar, ➕ crear, ↩️ volver.
- Iconos siempre acompañados de *tooltip* o *aria-label*.

---

## 3. Layout general

```
┌──────────────────────────────────────────────────────────────┐
│ SIDEBAR (240px)          │  TOPBAR                            │
│ ─────────────            │  ────────────────────────────────  │
│ 🏠 Dashboard             │  🔍 Buscar   🔔   👤 Rol · Usuario │
│ 📁 Clientes              │  ────────────────────────────────  │
│ 📦 Productos             │                                    │
│ 🛒 Ventas                │  CONTENIDO                         │
│ 📥 Inventario            │  ┌─────────┐ ┌─────────┐          │
│ 📊 Analytics             │  │ KPI     │ │ KPI     │  ...     │
│ 🎲 Probabilidad          │  └─────────┘ └─────────┘          │
│ 💡 Insights              │                                    │
│ 📄 Reportes              │  ┌──────────────────────────┐      │
│ ⚙️ Configuración         │  │ Tabla / Formulario /      │      │
│                          │  │ Gráfico                   │      │
│                          │  └──────────────────────────┘      │
└──────────────────────────────────────────────────────────────┘
```

- **Sidebar:** agrupa módulos por bloque (Operación · Analítica · Sistema); ítem activo resaltado en azul; colapsable en tablet.
- **Topbar:** búsqueda global, centro de notificaciones y menú de usuario (perfil, rol, cerrar sesión).
- **Área de contenido:** tarjetas sobre fondo gris claro; ancho máximo ilimitado en tablas y gráficos.

---

## 4. Componentes del sistema

### 4.1 Tabla de datos (estándar en todos los módulos)

| Propiedad | Definición |
|---|---|
| Columnas | Encabezado en gris medio, texto 14 px, alineación numérica a la derecha. |
| Búsqueda | Campo arriba-izquierda con icono; filtro en vivo. |
| Filtros | Chips/selects (periodo, categoría, vendedor, estado). |
| Paginación | Inferior: «Anterior / Siguiente», total de registros. |
| Acciones | Iconos por fila (ver, editar, eliminar) con confirmación en destructive. |
| Estados | *Loading* (esqueleto), *empty* (ilustración + CTA), *error* (mensaje + reintentar). |

### 4.2 Formulario

- Labels siempre visibles arriba del campo (nunca solo *placeholder*).
- Validación en tiempo real: error en rojo bajo el campo + resumen general al enviar.
- Botones: **Guardar** (primario), **Cancelar** (secundario); deshabilitados mientras se envía.
- Campos monetarios y numéricos con formato (S/ o moneda local, 2 decimales).

### 4.3 Tarjeta KPI

```
┌─────────────────────────┐
│ Ventas del mes      ▲8% │   ← label + variación vs periodo anterior
│ S/ 45,280.00             │   ← valor grande, bold
│ 128 transacciones        │   ← contexto secundario
└─────────────────────────┘
```

### 4.4 Gráficos

| Gráfico | Uso |
|---|---|
| Línea | Evolución temporal de ventas / ingresos. |
| Barras | Ventas por producto, vendedor o categoría. |
| Torta/donut | Participación de categorías. |
| Histograma | Distribución de montos o cantidades. |
| Comparativo (media/mediana) | Barras lado a lado con línea de referencia. |

- Cada gráfico lleva: título, leyenda, tooltip con valores y periodo visible.
- Paleta derivada del design system (azul → cyan → grises).

### 4.5 Panel de insights

- Cada insight = **título claro + explicación + evidencia numérica** + vínculo al análisis que lo originó.
- Icono por tipo: 📈 tendencia, ⚠️ alerta, 💡 oportunidad.

---

## 5. Estados de interfaz

| Estado | Comportamiento |
|---|---|
| **Loading** | Esqueleto (tabla/tarjeta) o spinner pequeño en botón; nunca pantalla en blanco. |
| **Empty** | Mensaje amable + CTA («No hay clientes todavía — Crear cliente»). |
| **Error** | Mensaje entendible + botón «Reintentar»; error técnico solo en consola. |
| **Success** | *Toast* de confirmación («Venta registrada»), 3–4 s, esquina superior derecha. |
| **Optimistic** | Solo en operaciones seguras (filtros); las ventas siempre confirman con el servidor. |

---

## 6. Responsive (RNF-06)

| Breakpoint | Comportamiento |
|---|---|
| ≥ 1280 px (desktop) | Layout completo, sidebar fija, tablas con todas las columnas. |
| 768–1279 px (tablet) | Sidebar colapsable a iconos; tablas con columnas prioritarias; KPIs en 2 columnas. |
| < 768 px | *Mobile only* para consulta rápida: KPIs apilados, tablas en tarjetas. |

---

## 7. Accesibilidad

- Contraste mínimo 4.5:1 en texto (WCAG AA).
- Navegación completa por teclado; foco visible.
- Labels asociados a inputs; errores anunciados con `aria-live`.
- Nunca comunicar estado **solo** con color (siempre icono o texto).

---

## 8. Pantallas priorizadas (por fase)

1. **Login** → 2. **Dashboard** → 3. **Clientes** → 4. **Productos** → 5. **Ventas** → 6. **Inventario** → 7. **Analytics** → 8. **Probabilidad/Bayes** → 9. **Insights** → 10. **Reportes** → 11. **Configuración/usuarios**.

Cada pantalla se implementa con sus 4 estados (sección 5) antes de pasar a la siguiente.
