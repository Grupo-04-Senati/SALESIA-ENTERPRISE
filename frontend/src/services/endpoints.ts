/**
 * Rutas de la API (docs/05_api.md §2).
 * Todas las rutas son relativas a API_BASE (services/api.ts).
 */

export const ENDPOINTS = {
  health: '/health',

  // §2.1 Autenticación
  auth: {
    login: '/api/v1/auth/login',
    refresh: '/api/v1/auth/refresh',
    logout: '/api/v1/auth/logout',
    me: '/api/v1/auth/me',
    profile: '/api/v1/auth/profile',
    password: '/api/v1/auth/password',
    forgotPassword: '/api/v1/auth/forgot-password',
    resetPassword: '/api/v1/auth/reset-password',
  },

  // §2.2 Usuarios y roles
  users: '/api/v1/users',
  userStatus: (id: number) => `/api/v1/users/${id}/status`,
  roles: '/api/v1/roles',

  // §2.3 Clientes
  customers: '/api/v1/customers',
  customerHistory: (id: number) => `/api/v1/customers/${id}/history`,

  // §2.4 Productos y categorías
  products: '/api/v1/products',
  productStatus: (id: number) => `/api/v1/products/${id}/status`,
  categories: '/api/v1/categories',

  // §2.5 Vendedores
  employees: '/api/v1/employees',

  // §2.6 Ventas, pagos e inventario
  sales: '/api/v1/sales',
  saleStatus: (id: number) => `/api/v1/sales/${id}/status`,
  saleCancel: (id: number) => `/api/v1/sales/${id}/cancel`,
  salePayments: (id: number) => `/api/v1/sales/${id}/payments`,
  saleReceived: (id: number) => `/api/v1/sales/${id}/received`,
  claimResolve: (id: number) => `/api/v1/claims/${id}/resolve`,
  inventory: '/api/v1/inventory',
  inventoryProduct: (id: number) => `/api/v1/inventory/${id}`,
  inventoryMovements: '/api/v1/inventory/movements',
  inventoryProductMovements: (id: number) => `/api/v1/inventory/${id}/movements`,
  inventoryAlerts: '/api/v1/inventory/alerts',

  // §2.4 Compras, cotizaciones, devoluciones y precios
  suppliers: '/api/v1/suppliers',
  purchaseOrders: '/api/v1/purchase-orders',
  shipments: '/api/v1/shipments',
  quotes: '/api/v1/quotes',
  returns: '/api/v1/returns',
  priceLists: '/api/v1/price-lists',
  promotions: '/api/v1/promotions',

  // §2.5 CRM: segmentos e interacciones
  segments: '/api/v1/customer-segments',
  interactions: '/api/v1/customer-interactions',

  // §2.6 Almacén: unidades, sucursales, almacenes, stock y conteos
  units: '/api/v1/units',
  branches: '/api/v1/branches',
  warehouses: '/api/v1/warehouses',
  warehouseStock: '/api/v1/warehouse-stock',
  stockCounts: '/api/v1/stock-counts',

  // §2.7 Sistema: notificaciones, exportaciones, reportes, reglas y KPIs
  notifications: '/api/v1/notifications',
  dataExports: '/api/v1/data-exports',
  scheduledReports: '/api/v1/scheduled-reports',
  automationRules: '/api/v1/automation-rules',
  kpiSnapshots: '/api/v1/kpi-snapshots',

  // §2.8 Estadística (Semana 07)
  statistics: {
    mean: '/api/v1/statistics/mean',
    median: '/api/v1/statistics/median',
    compare: '/api/v1/statistics/compare',
    variables: '/api/v1/statistics/variables',
    analyses: '/api/v1/statistics/analyses',
    datasets: '/api/v1/statistics/datasets',
  },

  // §2.9 Probabilidad
  probability: {
    basic: '/api/v1/probability/basic',
    bayes: '/api/v1/probability/bayes',
    events: '/api/v1/probability/events',
  },
  randomVariables: '/api/v1/random-variables',

  // §2.7 Dashboard, insights, reportes y auditoría
  dashboard: {
    summary: '/api/v1/dashboard/summary',
    timeseries: '/api/v1/dashboard/timeseries',
    top: '/api/v1/dashboard/top',
    stockAlerts: '/api/v1/dashboard/stock-alerts',
  },
  insights: '/api/v1/insights',
  insightRules: '/api/v1/insights/rules',
  reports: '/api/v1/reports',
  reportExport: (id: number) => `/api/v1/reports/${id}/export`,
  reportPrint: (id: number) => `/api/v1/reports/${id}/print`,
  audit: '/api/v1/audit-logs',
} as const
