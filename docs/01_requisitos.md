# 01 · Requisitos del Sistema

**SalesIA Enterprise** — Documento 01 de la serie de arquitectura · Versión 1.0

---

## 1. Planteamiento del problema

Las empresas necesitan registrar sus operaciones comerciales y convertir los datos de ventas en información útil para el análisis. Un sistema que solo registra ventas no aprovecha completamente los datos generados.

SalesIA Enterprise propone integrar **gestión operativa** y **analítica** dentro de una misma plataforma: las ventas generan los datos y el módulo Analytics los convierte en estadísticas, gráficos e insights, en lugar de existir una calculadora estadística independiente desconectada de la operación.

**Base académica:** *Fundamentos y Algoritmia para Inteligencia Artificial — Semana 07 (estadística aplicada, variables estadísticas, media, mediana, Teorema de Bayes y variables aleatorias).*

---

## 2. Objetivos

### 2.1 Objetivo general

Diseñar y desarrollar un sistema web empresarial de gestión de ventas con arquitectura escalable, capaz de registrar operaciones comerciales y aplicar análisis estadístico sobre los datos mediante **React, Python y PostgreSQL**.

### 2.2 Objetivos específicos

- Gestionar clientes, productos, vendedores, ventas, pedidos y pagos.
- Centralizar la información comercial en PostgreSQL.
- Implementar una API empresarial con Python/FastAPI.
- Construir una interfaz web modular con React y TypeScript.
- Aplicar media, mediana, variables estadísticas, probabilidades y Teorema de Bayes.
- Visualizar resultados mediante gráficos estadísticos.
- Construir una página Analytics con KPIs e insights.
- Generar reportes y conservar el historial de análisis.
- Implementar seguridad, auditoría, validaciones y pruebas.

---

## 3. Alcance

| Área | Alcance inicial |
|---|---|
| Ventas | Registro, consulta, detalle, estados y seguimiento |
| Clientes | Ficha, historial y comportamiento comercial |
| Productos | Catálogo, categorías, precios y estado |
| Inventario | Stock y movimientos |
| Vendedores | Gestión y métricas comerciales |
| Analytics | KPIs, gráficos, media, mediana y análisis estadístico |
| Probabilidad | Módulo de probabilidad y Bayes |
| Insights | Reglas analíticas basadas en resultados |
| Reportes | Reportes estadísticos y comerciales |
| Seguridad | Roles, permisos, autenticación y auditoría |

**Fuera de alcance (versión 1.0):** comercio electrónico público, pasarela de pagos externa, aplicación móvil nativa, modelos predictivos de machine learning (posible evolución posterior).

---

## 4. Actores y roles

| Rol | Responsabilidades |
|---|---|
| **Administrador** | Configura el sistema, usuarios, roles y parámetros. |
| **Gerente** | Consulta indicadores, Analytics, reportes y resultados comerciales. |
| **Vendedor** | Registra clientes, pedidos y ventas autorizadas. |
| **Analista** | Ejecuta análisis estadísticos y genera insights/reportes. |
| **Almacén** | Gestiona stock y movimientos de inventario. |

---

## 5. Requisitos funcionales

| Código | Requisito |
|---|---|
| RF-01 | Autenticación y control de acceso por roles. |
| RF-02 | Gestión de usuarios. |
| RF-03 | Gestión de clientes. |
| RF-04 | Gestión de productos y categorías. |
| RF-05 | Gestión de vendedores. |
| RF-06 | Registro de ventas y detalle de venta. |
| RF-07 | Gestión de pagos y métodos de pago. |
| RF-08 | Gestión de inventario y movimientos. |
| RF-09 | Dashboard ejecutivo. |
| RF-10 | Gestión de datasets analíticos derivados de las operaciones. |
| RF-11 | Cálculo de media. |
| RF-12 | Cálculo de mediana. |
| RF-13 | Comparación media vs. mediana. |
| RF-14 | Análisis de variables estadísticas. |
| RF-15 | Análisis de variables aleatorias. |
| RF-16 | Cálculo de probabilidades. |
| RF-17 | Análisis mediante Teorema de Bayes. |
| RF-18 | Visualización mediante gráficos. |
| RF-19 | Generación de insights basados en reglas. |
| RF-20 | Generación y consulta de reportes. |
| RF-21 | Historial de análisis. |
| RF-22 | Registro de auditoría. |

---

## 6. Requisitos no funcionales

| Código | Requisito |
|---|---|
| RNF-01 | Arquitectura modular y mantenible. |
| RNF-02 | Validación de datos en frontend y backend. |
| RNF-03 | Integridad referencial en PostgreSQL. |
| RNF-04 | Autenticación segura y autorización por rol. |
| RNF-05 | API documentada. |
| RNF-06 | Diseño responsive para escritorio y tablet. |
| RNF-07 | Trazabilidad de operaciones críticas. |
| RNF-08 | Separación de presentación, lógica de negocio y persistencia. |
| RNF-09 | Pruebas unitarias, integración y aceptación. |
| RNF-10 | Configuración por variables de entorno. |
| RNF-11 | Manejo centralizado de errores. |
| RNF-12 | Rendimiento adecuado para consultas analíticas. |

---

## 7. Flujo de negocio y reglas

### 7.1 Flujo principal

```
CLIENTE → PEDIDO → VENTA → PAGO → ACTUALIZACIÓN DE INVENTARIO
   → POSTGRESQL → DATASET ANALÍTICO
   → MEDIA / MEDIANA / VARIABLES / PROBABILIDAD / BAYES
   → GRÁFICOS → INSIGHTS → DASHBOARD / REPORTES
```

### 7.2 Reglas de negocio

1. Toda venta requiere al menos un cliente y un detalle de venta (producto + cantidad).
2. El total de una venta se calcula desde el detalle: subtotal − descuentos + impuestos.
3. Registrar una venta actualiza el inventario (salida de stock) de forma transaccional.
4. Todo pago queda asociado a una venta y a un método de pago.
5. El inventario no puede quedar negativo; las entradas y salidas quedan en `inventory_movements`.
6. Cada análisis estadístico ejecutado se persiste con su dataset, parámetros y resultado (RF-21).
7. Las operaciones críticas (login, ventas, cambios de stock, accesos a reportes) se registran en auditoría (RF-22).
8. Un usuario solo accede a los módulos permitidos por su rol (RF-01).

---

## 8. Casos de uso principales

| Caso | Actor | Descripción |
|---|---|---|
| CU-01 Iniciar sesión | Todos | Autenticarse y obtener sesión con rol. |
| CU-02 Registrar cliente | Vendedor | Crear ficha de cliente y asignarle vendedor. |
| CU-03 Registrar producto | Administrador | Alta de producto con categoría, precio y stock inicial. |
| CU-04 Registrar venta | Vendedor | Seleccionar cliente, agregar productos, calcular total y confirmar. |
| CU-05 Registrar pago | Vendedor | Asociar pago (efectivo/tarjeta/transferencia) a una venta. |
| CU-06 Ajustar inventario | Almacén | Registrar entrada o salida manual con motivo. |
| CU-07 Ver dashboard | Gerente | Consultar KPIs del periodo. |
| CU-08 Calcular media/mediana | Analista | Ejecutar cálculo sobre un dataset y ver comparación. |
| CU-09 Ejecutar Bayes | Analista | Registrar P(A), P(B|A), P(B) y obtener P(A|B) explicada. |
| CU-10 Generar insights | Analista/Gerente | Consultar observaciones con su evidencia numérica. |
| CU-11 Exportar reporte | Gerente/Analista | Generar y descargar reporte de ventas o estadístico. |
| CU-12 Gestionar usuarios | Administrador | Crear usuarios y asignar roles. |

---

## 9. Criterios de aceptación (versión 1.0)

- Un usuario autorizado puede iniciar sesión y acceder únicamente a sus módulos.
- Una venta puede registrarse con sus detalles y actualizar el inventario.
- Los datos de ventas pueden consultarse desde Analytics.
- El sistema calcula correctamente media y mediana.
- El sistema permite identificar variables estadísticas.
- El sistema puede analizar variables aleatorias definidas.
- El módulo de Bayes devuelve un resultado reproducible con los datos introducidos.
- Los resultados aparecen en gráficos y KPIs.
- Los insights muestran el resultado que los origina.
- Los análisis quedan almacenados y pueden consultarse posteriormente.
- Las operaciones críticas quedan registradas en auditoría.
- El sistema supera las pruebas definidas antes del despliegue.

---

## 10. Relación con el documento académico (Semana 07)

| Contenido Semana 07 | Aplicación en SalesIA |
|---|---|
| Estadística aplicada en IA | Módulo Analytics y motor de análisis comercial |
| Variables estadísticas | Variables de ventas, clientes, productos e inventario |
| Media aritmética | Ticket promedio, venta promedio y métricas por producto/vendedor |
| Mediana | Venta central y análisis de concentración de valores |
| Python para cálculos | Backend/motor estadístico con Python |
| Teorema de Bayes | Análisis de probabilidades comerciales |
| Variables aleatorias | Cantidad de productos, monto de venta y otras variables cuantitativas |
