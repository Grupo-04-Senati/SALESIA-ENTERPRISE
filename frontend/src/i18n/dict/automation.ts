/** Diccionario del modulo Automation (claves prefijadas con `automation.`). */
import type { ModuleDict } from '../i18n'

export const dictAutomation: ModuleDict = {
  es: {
    'automation.ventas': 'Ventas',
    'automation.inventario': 'Inventario',
    'automation.clientes': 'Clientes',
    'automation.productos': 'Productos',
    'automation.analitica': 'Analítica',
    'automation.probabilidad': 'Probabilidad',
    'automation.guardadas': 'Guardadas',
    'automation.todas': 'Todas',
    'automation.alertas-de-stock-activas': 'Alertas de stock activas',
    'automation.n-productos': '{n} producto(s)',
    'automation.umbral-n-del-stock-minimo': 'umbral {n}% del stock mínimo',
    'automation.igv-en-nuevas-ventas': 'IGV en nuevas ventas',
    'automation.se-usa-en-el-total-y-en-los-reportes': 'se usa en el total y en los reportes',
    'automation.alerta-de-concentracion': 'Alerta de concentración',
    'automation.desactivada-2': 'desactivada',
    'automation.participacion-de-un-vendedor-sobre-el-periodo':
      'participación de un vendedor sobre el periodo',
    'automation.minimo-para-estadistica': 'Mínimo para estadística',
    'automation.n-datos': '{n} datos',
    'automation.controla-media-mediana-y-clasificacion-de-variables':
      'controla media, mediana y clasificación de variables',
    'automation.regla-desactivada': 'Regla desactivada',
    'automation.regla-activada': 'Regla activada',
    'automation.el-sistema-dejara-de-aplicar-este-comportamiento':
      'el sistema dejará de aplicar este comportamiento.',
    'automation.se-aplicara-automaticamente-en-las-proximas-operaciones':
      'se aplicará automáticamente en las próximas operaciones.',
    'automation.automatizaciones': 'Automatizaciones',
    'automation.disena-el-comportamiento-automatico-del-sistema-activa-o-desactiva-reglas-de-negocio-y-ajusta-sus-umbrales-los-cambios-se-aplican-de-inmediato-en-todos-los-modulos':
      'Diseña el comportamiento automático del sistema: activa o desactiva reglas de negocio y ajusta sus umbrales. Los cambios se aplican de inmediato en todos los módulos.',
    'automation.restablecer-reglas': 'Restablecer reglas',
    'automation.configuracion-restablecida': 'Configuración restablecida',
    'automation.las-reglas-volvieron-a-sus-valores-por-defecto':
      'Las reglas volvieron a sus valores por defecto.',
    'automation.reglas-automaticas': 'Reglas automáticas',
    'automation.de-n-activas': 'de {n} activas',
    'automation.efecto-actual-de-la-configuracion': 'Efecto actual de la configuración',
    'automation.desactivada': 'Desactivada',
    'automation.activa': 'Activa',
    'automation.inactiva': 'Inactiva',
    'automation.desactivar': 'Desactivar',
    'automation.activar': 'Activar',
    'automation.estas-preferencias-se-guardan-en-tu-navegador-localstorage-y-rigen-la-simulacion-de-este-modulo-el-backend-no-las-ejecuta-cuando-el-api-gestione-las-reglas-quedaran-registradas-en-la-auditoria-del-sistema-rf-22':
      'Estas preferencias se guardan en tu navegador (localStorage) y rigen la simulación de este módulo. El backend no las ejecuta: cuando el API gestione las reglas, quedarán registradas en la auditoría del sistema (RF-22).',
    'automation.debe-ser-un-objeto-json': 'Debe ser un objeto JSON, p. ej. {"umbral": 10}.',
    'automation.el-json-no-es-valido-revisa-comas-y-comillas':
      'El JSON no es válido: revisa comas y comillas.',
    'automation.el-codigo-debe-tener-entre-1-y-50-caracteres':
      'El código debe tener entre 1 y 50 caracteres.',
    'automation.el-nombre-debe-tener-al-menos-3-caracteres':
      'El nombre debe tener al menos 3 caracteres.',
    'automation.no-se-pudieron-cargar-las-reglas': 'No se pudieron cargar las reglas',
    'automation.regla-actualizada': 'Regla actualizada',
    'automation.se-guardo-correctamente': 'se guardó correctamente.',
    'automation.regla-creada': 'Regla creada',
    'automation.ya-esta-registrada-en-el-backend': 'ya está registrada en el backend.',
    'automation.no-se-pudo-guardar-la-regla': 'No se pudo guardar la regla.',
    'automation.regla-eliminada': 'Regla eliminada',
    'automation.se-quito-del-listado': 'se quitó del listado.',
    'automation.no-se-pudo-eliminar-la-regla': 'No se pudo eliminar la regla.',
    'automation.reglas-guardadas-en-el-backend-codigo-severidad-condicion-y-accion-en-json':
      'Reglas guardadas en el backend: código, severidad, condición y acción en JSON.',
    'automation.nueva-regla': 'Nueva regla',
    'automation.reintentar': 'Reintentar',
    'automation.cargando-reglas': 'Cargando reglas…',
    'automation.codigo': 'Código',
    'automation.nombre': 'Nombre',
    'automation.severidad': 'Severidad',
    'automation.estado': 'Estado',
    'automation.acciones': 'Acciones',
    'automation.sin-reglas-guardadas': 'Sin reglas guardadas',
    'automation.crea-la-primera-regla-para-que-el-backend-automatice-decisiones-de-negocio':
      'Crea la primera regla para que el backend automatice decisiones de negocio.',
    'automation.editar': 'Editar',
    'automation.eliminar': 'Eliminar',
    'automation.editar-regla': 'Editar regla',
    'automation.eliminar-regla': 'Eliminar regla',
    'automation.cancelar': 'Cancelar',
    'automation.guardar-cambios': 'Guardar cambios',
    'automation.crear-regla': 'Crear regla',
    'automation.descripcion': 'Descripción',
    'automation.ej-alerta-stock-critico': 'Ej. ALERTA_STOCK_CRITICO',
    'automation.ej-alerta-de-stock-critico': 'Ej. Alerta de stock crítico',
    'automation.opcional-que-hace-esta-regla': 'Opcional. Qué hace esta regla.',
    'automation.ej-avisa-cuando-un-producto-baje-del-stock-minimo':
      'Ej. Avisa cuando un producto baje del stock mínimo',
    'automation.condicion-json': 'Condición (JSON)',
    'automation.opcional-se-valida-como-objeto-json': 'Opcional. Se valida como objeto JSON.',
    'automation.accion-json': 'Acción (JSON)',
    'automation.eliminar-la-regla': '¿Eliminar la regla',
    'automation.regla-bloquear-venta-sin-stock': 'Bloquear venta sin stock',
    'automation.regla-bloquear-venta-sin-stock-desc':
      'Antes de registrar la venta verifica que exista stock suficiente de cada producto y rechaza la operación si no alcanza.',
    'automation.regla-calcular-totales-igv': 'Calcular totales e IGV automático',
    'automation.regla-calcular-totales-igv-desc':
      'Calcula subtotal, descuento, impuesto y total de cada venta con la tasa configurada, sin intervención manual.',
    'automation.regla-impedir-pago-mayor': 'Impedir pago mayor al total',
    'automation.regla-impedir-pago-mayor-desc':
      'Rechaza el pago cuando el monto cobrado supera el total de la venta.',
    'automation.regla-descontar-stock-kardex': 'Descontar stock y generar kardex',
    'automation.regla-descontar-stock-kardex-desc':
      'Al confirmar la venta descuenta el stock de cada línea y registra el movimiento de salida en el kardex.',
    'automation.regla-actualizar-historial-cliente': 'Actualizar historial del cliente',
    'automation.regla-actualizar-historial-cliente-desc':
      'Suma la venta al historial y al total acumulado del cliente, y clasifica su estado de pago.',
    'automation.regla-recalcular-indicadores': 'Recalcular indicadores',
    'automation.regla-recalcular-indicadores-desc':
      'Actualiza Dashboard, Analytics, Insights y Reportes con la venta recién registrada.',
    'automation.regla-nunca-stock-negativo': 'Nunca permitir stock negativo',
    'automation.regla-nunca-stock-negativo-desc':
      'Bloquea salidas, mermas y ajustes que dejen el stock por debajo de cero.',
    'automation.regla-exigir-motivo-merma': 'Exigir motivo en merma y ajuste',
    'automation.regla-exigir-motivo-merma-desc':
      'No permite registrar mermas ni ajustes sin un motivo escrito.',
    'automation.regla-alerta-stock-bajo': 'Alerta de stock bajo',
    'automation.regla-alerta-stock-bajo-desc':
      'Marca los productos cuyo stock iguala o supera por poco el mínimo, y los muestra en el panel de alertas.',
    'automation.regla-documento-unico': 'Documento único por cliente',
    'automation.regla-documento-unico-desc':
      'Impide registrar dos clientes con el mismo número de documento.',
    'automation.regla-sku-unico': 'SKU único de producto',
    'automation.regla-sku-unico-desc': 'Impide registrar dos productos con el mismo SKU.',
    'automation.regla-precio-venta-costo': 'Precio de venta ≥ costo',
    'automation.regla-precio-venta-costo-desc':
      'Rechaza productos cuyo precio de venta sea menor al costo.',
    'automation.regla-alerta-concentracion-ventas': 'Alerta de concentración de ventas',
    'automation.regla-alerta-concentracion-ventas-desc':
      'Genera un insight de alerta cuando un vendedor concentra demasiados ingresos del periodo.',
    'automation.regla-alerta-variacion-mensual': 'Alerta de variación mensual',
    'automation.regla-alerta-variacion-mensual-desc':
      'Genera un insight cuando la variación de ingresos de un mes supera el margen definido.',
    'automation.regla-insight-stock-bajo': 'Insight de stock bajo',
    'automation.regla-insight-stock-bajo-desc':
      'Genera el insight de productos agotados o por debajo del mínimo.',
    'automation.regla-minimo-observaciones': 'Mínimo de observaciones',
    'automation.regla-minimo-observaciones-desc':
      'Exige al menos esta cantidad de datos para calcular media, mediana o clasificar una variable.',
    'automation.regla-bloquear-bayes-pb0': 'Bloquear Bayes con P(B) = 0',
    'automation.regla-bloquear-bayes-pb0-desc':
      'No permite calcular el posterior cuando la evidencia es cero (resultado indefinido).',
    'automation.regla-registrar-historial-analisis': 'Registrar historial de análisis',
    'automation.regla-registrar-historial-analisis-desc':
      'Guarda cada cálculo realizado en el módulo para poder consultarlo después.',
    'automation.severidad-informativa': 'Informativa',
    'automation.severidad-advertencia': 'Advertencia',
    'automation.severidad-critica': 'Crítica',
  },
  en: {
    'automation.ventas': 'Sales',
    'automation.inventario': 'Inventory',
    'automation.clientes': 'Customers',
    'automation.productos': 'Products',
    'automation.analitica': 'Analytics',
    'automation.probabilidad': 'Probability',
    'automation.guardadas': 'Saved',
    'automation.todas': 'All',
    'automation.alertas-de-stock-activas': 'Active stock alerts',
    'automation.n-productos': '{n} product(s)',
    'automation.umbral-n-del-stock-minimo': 'threshold {n}% of the minimum stock',
    'automation.igv-en-nuevas-ventas': 'IGV on new sales',
    'automation.se-usa-en-el-total-y-en-los-reportes': 'used in the total and in reports',
    'automation.alerta-de-concentracion': 'Concentration alert',
    'automation.desactivada-2': 'disabled',
    'automation.participacion-de-un-vendedor-sobre-el-periodo':
      'share of one seller over the period',
    'automation.minimo-para-estadistica': 'Minimum for statistics',
    'automation.n-datos': '{n} data points',
    'automation.controla-media-mediana-y-clasificacion-de-variables':
      'controls mean, median and variable classification',
    'automation.regla-desactivada': 'Rule disabled',
    'automation.regla-activada': 'Rule enabled',
    'automation.el-sistema-dejara-de-aplicar-este-comportamiento':
      'the system will stop applying this behavior.',
    'automation.se-aplicara-automaticamente-en-las-proximas-operaciones':
      'it will be applied automatically in future operations.',
    'automation.automatizaciones': 'Automation',
    'automation.disena-el-comportamiento-automatico-del-sistema-activa-o-desactiva-reglas-de-negocio-y-ajusta-sus-umbrales-los-cambios-se-aplican-de-inmediato-en-todos-los-modulos':
      'Design the automatic behavior of the system: enable or disable business rules and tune their thresholds. Changes apply immediately across all modules.',
    'automation.restablecer-reglas': 'Reset rules',
    'automation.configuracion-restablecida': 'Settings reset',
    'automation.las-reglas-volvieron-a-sus-valores-por-defecto':
      'The rules went back to their default values.',
    'automation.reglas-automaticas': 'Automatic rules',
    'automation.de-n-activas': 'of {n} active',
    'automation.efecto-actual-de-la-configuracion': 'Current effect of the settings',
    'automation.desactivada': 'Disabled',
    'automation.activa': 'Active',
    'automation.inactiva': 'Inactive',
    'automation.desactivar': 'Disable',
    'automation.activar': 'Enable',
    'automation.estas-preferencias-se-guardan-en-tu-navegador-localstorage-y-rigen-la-simulacion-de-este-modulo-el-backend-no-las-ejecuta-cuando-el-api-gestione-las-reglas-quedaran-registradas-en-la-auditoria-del-sistema-rf-22':
      'These preferences are stored in your browser (localStorage) and drive this module’s simulation. The backend does not run them: when the API manages the rules, they will be recorded in the system audit (RF-22).',
    'automation.debe-ser-un-objeto-json': 'It must be a JSON object, e.g. {"umbral": 10}.',
    'automation.el-json-no-es-valido-revisa-comas-y-comillas':
      'The JSON is not valid: check commas and quotes.',
    'automation.el-codigo-debe-tener-entre-1-y-50-caracteres':
      'The code must be between 1 and 50 characters.',
    'automation.el-nombre-debe-tener-al-menos-3-caracteres':
      'The name must be at least 3 characters long.',
    'automation.no-se-pudieron-cargar-las-reglas': 'Could not load the rules',
    'automation.regla-actualizada': 'Rule updated',
    'automation.se-guardo-correctamente': 'was saved successfully.',
    'automation.regla-creada': 'Rule created',
    'automation.ya-esta-registrada-en-el-backend': 'is already registered in the backend.',
    'automation.no-se-pudo-guardar-la-regla': 'Could not save the rule.',
    'automation.regla-eliminada': 'Rule deleted',
    'automation.se-quito-del-listado': 'was removed from the list.',
    'automation.no-se-pudo-eliminar-la-regla': 'Could not delete the rule.',
    'automation.reglas-guardadas-en-el-backend-codigo-severidad-condicion-y-accion-en-json':
      'Rules saved in the backend: code, severity, condition and action in JSON.',
    'automation.nueva-regla': 'New rule',
    'automation.reintentar': 'Try again',
    'automation.cargando-reglas': 'Loading rules…',
    'automation.codigo': 'Code',
    'automation.nombre': 'Name',
    'automation.severidad': 'Severity',
    'automation.estado': 'Status',
    'automation.acciones': 'Actions',
    'automation.sin-reglas-guardadas': 'No saved rules',
    'automation.crea-la-primera-regla-para-que-el-backend-automatice-decisiones-de-negocio':
      'Create the first rule so the backend can automate business decisions.',
    'automation.editar': 'Edit',
    'automation.eliminar': 'Delete',
    'automation.editar-regla': 'Edit rule',
    'automation.eliminar-regla': 'Delete rule',
    'automation.cancelar': 'Cancel',
    'automation.guardar-cambios': 'Save changes',
    'automation.crear-regla': 'Create rule',
    'automation.descripcion': 'Description',
    'automation.ej-alerta-stock-critico': 'e.g. ALERTA_STOCK_CRITICO',
    'automation.ej-alerta-de-stock-critico': 'e.g. Critical stock alert',
    'automation.opcional-que-hace-esta-regla': 'Optional. What this rule does.',
    'automation.ej-avisa-cuando-un-producto-baje-del-stock-minimo':
      'e.g. Notify when a product drops below the minimum stock',
    'automation.condicion-json': 'Condition (JSON)',
    'automation.opcional-se-valida-como-objeto-json': 'Optional. Validated as a JSON object.',
    'automation.accion-json': 'Action (JSON)',
    'automation.eliminar-la-regla': 'Delete the rule',
    'automation.regla-bloquear-venta-sin-stock': 'Block sale without stock',
    'automation.regla-bloquear-venta-sin-stock-desc':
      'Before recording the sale, it checks that each product has enough stock and rejects the operation if it does not.',
    'automation.regla-calcular-totales-igv': 'Calculate totals and IGV automatically',
    'automation.regla-calcular-totales-igv-desc':
      'Calculates subtotal, discount, tax and total of each sale with the configured rate, with no manual work.',
    'automation.regla-impedir-pago-mayor': 'Prevent payment above the total',
    'automation.regla-impedir-pago-mayor-desc':
      'Rejects the payment when the amount charged exceeds the sale total.',
    'automation.regla-descontar-stock-kardex': 'Deduct stock and generate kardex',
    'automation.regla-descontar-stock-kardex-desc':
      'When the sale is confirmed it deducts the stock of each line and records the outgoing movement in the kardex.',
    'automation.regla-actualizar-historial-cliente': 'Update customer history',
    'automation.regla-actualizar-historial-cliente-desc':
      'Adds the sale to the customer history and cumulative total, and classifies their payment status.',
    'automation.regla-recalcular-indicadores': 'Recalculate indicators',
    'automation.regla-recalcular-indicadores-desc':
      'Updates Dashboard, Analytics, Insights and Reports with the newly recorded sale.',
    'automation.regla-nunca-stock-negativo': 'Never allow negative stock',
    'automation.regla-nunca-stock-negativo-desc':
      'Blocks write-offs, shrinkage and adjustments that would leave stock below zero.',
    'automation.regla-exigir-motivo-merma': 'Require a reason for shrinkage and adjustment',
    'automation.regla-exigir-motivo-merma-desc':
      'Does not allow shrinkage or adjustments without a written reason.',
    'automation.regla-alerta-stock-bajo': 'Low stock alert',
    'automation.regla-alerta-stock-bajo-desc':
      'Flags products whose stock is just at or slightly above the minimum, and shows them in the alerts panel.',
    'automation.regla-documento-unico': 'Unique document per customer',
    'automation.regla-documento-unico-desc':
      'Prevents recording two customers with the same document number.',
    'automation.regla-sku-unico': 'Unique product SKU',
    'automation.regla-sku-unico-desc': 'Prevents recording two products with the same SKU.',
    'automation.regla-precio-venta-costo': 'Sale price ≥ cost',
    'automation.regla-precio-venta-costo-desc':
      'Rejects products whose sale price is lower than the cost.',
    'automation.regla-alerta-concentracion-ventas': 'Sales concentration alert',
    'automation.regla-alerta-concentracion-ventas-desc':
      'Generates an alert insight when a seller concentrates too much of the period’s revenue.',
    'automation.regla-alerta-variacion-mensual': 'Monthly change alert',
    'automation.regla-alerta-variacion-mensual-desc':
      'Generates an insight when a month’s revenue change exceeds the defined margin.',
    'automation.regla-insight-stock-bajo': 'Low stock insight',
    'automation.regla-insight-stock-bajo-desc':
      'Generates the insight for out-of-stock products or products below the minimum.',
    'automation.regla-minimo-observaciones': 'Minimum observations',
    'automation.regla-minimo-observaciones-desc':
      'Requires at least this amount of data to calculate mean, median or classify a variable.',
    'automation.regla-bloquear-bayes-pb0': 'Block Bayes with P(B) = 0',
    'automation.regla-bloquear-bayes-pb0-desc':
      'Does not allow calculating the posterior when the evidence is zero (undefined result).',
    'automation.regla-registrar-historial-analisis': 'Record analysis history',
    'automation.regla-registrar-historial-analisis-desc':
      'Saves each calculation made in the module so it can be consulted later.',
    'automation.severidad-informativa': 'Info',
    'automation.severidad-advertencia': 'Warning',
    'automation.severidad-critica': 'Critical',
  },
}
