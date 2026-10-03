# 07 · Manual de Usuario

**SalesIA Enterprise** — Documento 07 de la serie de arquitectura · Versión 1.0

---

## 1. Acceso al sistema

1. Abrir la URL de la aplicación en el navegador.
2. Ingresar **correo** y **contraseña**.
3. Presionar **Iniciar sesión**.
4. Si las credenciales son correctas, se redirige al **Dashboard**; si no, aparece un mensaje de error sin revelar cuál dato falló.

> El sistema recuerda la sesión mediante token. Al expirar, volverá a pedir inicio de sesión.

---

## 2. Estructura de la interfaz

- **Sidebar (izquierda):** menú de módulos. El ítem resaltado indica dónde estás.
- **Topbar (arriba):** búsqueda, notificaciones y menú de usuario (rol, cerrar sesión).
- **Contenido:** tarjetas KPI, tablas y formularios.
- **Estados que verás:**
  - ⏳ *Cargando* → esqueletos o spinner.
  - 📭 *Sin datos* → mensaje con botón para crear el primero.
  - ❌ *Error* → mensaje + botón **Reintentar**.
  - ✅ *Éxito* → notificación flotante verde.

---

## 3. Guía por rol

### 3.1 Administrador
- **Usuarios:** Configuración → *Usuarios y roles* muestra el listado con su rol y estado (solo lectura; el alta y los cambios de rol llegan con la Fase 13).
- **Productos, categorías y vendedores:** alta, edición y baja (SKU, precio, categoría, stock mínimo, vendedores).
- **Auditoría:** las operaciones sensibles quedan registradas en `registros_auditoria` y se consultan por la API (`GET /api/v1/audit-logs`); la pantalla de auditoría aún no está en el menú.

### 3.2 Gerente
- **Dashboard:** KPIs de ventas, ingresos, transacciones y clientes del periodo.
- **Analytics:** filtros por periodo/vendedor/categoría, media vs. mediana, gráficos.
- **Reportes:** generar y exportar reportes en CSV.

### 3.3 Vendedor
- **Clientes:** *Crear cliente* con nombre, documento, contacto y dirección.
- **Ventas:** *Nueva venta* →
  1. Seleccionar cliente.
  2. Agregar productos (cantidad y precio).
  3. Aplicar descuento si corresponde.
  4. Ver subtotal, impuestos y **total**.
  5. Elegir método de pago (efectivo / tarjeta / transferencia).
  6. **Confirmar** → la venta se registra y el stock se descuenta automáticamente.
- **Historial:** consultar ventas propias y estados.

### 3.4 Analista
- **Analytics:** elegir dataset y periodo → ejecutar **media**, **mediana** o **comparación**.
- **Probabilidad:** registrar P(A), P(B|A) y P(B) → el sistema calcula **P(A|B)** y explica el resultado en lenguaje claro.
- **Variables aleatorias:** analizar la distribución de una variable (p. ej. cantidad de productos por venta).
- **Historial de análisis:** los análisis se ejecutan sobre los datos actuales; todavía no se guardan para reabrirse.
- **Insights:** revisar observaciones con su evidencia numérica y el análisis que las originó.

### 3.5 Almacén
- **Inventario:** ver existencias por producto.
- **Movimientos:** registrar **entrada**, **salida** o **ajuste** indicando cantidad y motivo.
- **Kardex:** revisar el historial de movimientos de cada producto.
- ⚠️ El sistema **no permite** dejar el stock en negativo.

---

## 4. Módulo Analytics (Semana 07)

| Acción | Pasos |
|---|---|
| Calcular media | Analytics → elegir dataset → campo (p. ej. `total`) → **Calcular media** |
| Calcular mediana | Ídem → **Calcular mediana** |
| Comparar | Ídem → **Comparar** → verá media, mediana, diferencia e interpretación |
| Ver gráficos | El panel muestra evolución (línea), ranking (barras) y distribución (histograma) |
| Bayes | Probabilidad → llenar P(A), P(B\|A), P(B) → **Calcular** → resultado + explicación |

**Interpretar la comparación:**
- *Media ≈ mediana* → ventas estables.
- *Media > mediana* → hay ventas muy altas que suben el promedio (revisar esos clientes/pedidos).
- *Media < mediana* → predominan ventas pequeñas con algún pico bajo.

---

## 5. Reportes

1. Ir a **Reportes** → *Nuevo reporte*.
2. Elegir tipo: ventas, estadístico, productos, clientes o vendedores.
3. Seleccionar periodo y filtros.
4. **Generar** → el reporte queda en el historial.
5. **Exportar** en CSV o usar la vista imprimible.

---

## 6. Buenas prácticas

- Cierra sesión en equipos compartidos (menú de usuario → *Cerrar sesión*).
- Usa **filtros** antes de exportar: el reporte contendrá solo lo que ves.
- Si un formulario rechaza un dato, el error aparece junto al campo — revísalo antes de reintentar.
- Los montos se muestran con 2 decimales; el sistema calcula con precisión monetaria (nunca redondea a mitad de operación).
- Ante un error persistente, recarga la página; si continúa, reporta el mensaje mostrado.

---

## 7. Preguntas frecuentes

| Pregunta | Respuesta |
|---|---|
| No puedo iniciar sesión | Verifica correo/contraseña. Si el problema persiste, el administrador debe revisar que tu usuario esté activo. |
| No puedo ver o usar algo | El backend responde «Rol sin permiso» (403) si tu rol no está autorizado para esa operación (ver matriz de acceso en `02_arquitectura.md`). |
| La venta no guarda | Suele ser stock insuficiente o un campo obligatorio vacío; el mensaje lo indica. |
| ¿El promedio no coincide con lo esperado? | Compara media y mediana: valores extremos alteran la media (sección 4). |
| ¿Se pueden editar análisis ya guardados? | No; se re-ejecutan como un análisis nuevo para conservar el historial. |
