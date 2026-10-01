import type { Category, Product, ProductInput } from '@/types/product'

/**
 * Servicio de productos y categorías (RF-04) con datos en memoria.
 * TODO(Fase 05): sustituir por `apiFetch` contra FastAPI
 * (GET/POST/PUT/PATCH /api/v1/products — docs/05_api.md §2.4).
 * La forma de los datos es exactamente la de la API real.
 */

const CATEGORIES: Category[] = [
  { id: 1, name: 'Bebidas', status: 'active' },
  { id: 2, name: 'Abarrotes', status: 'active' },
  { id: 3, name: 'Panadería', status: 'active' },
  { id: 4, name: 'Frutas y Verduras', status: 'active' },
  { id: 5, name: 'Limpieza', status: 'active' },
  { id: 6, name: 'Snacks', status: 'active' },
  { id: 7, name: 'Lácteos', status: 'active' },
  { id: 8, name: 'Cuidado personal', status: 'active' },
]

interface SeedProduct extends ProductInput {
  id: number
  current_stock: number
  status: 'active' | 'inactive'
  created_at: string
}

const SEED: SeedProduct[] = [
  { id: 1, sku: 'SKU-0001', name: 'Gaseosa 500ml', category_id: 1, cost_price: 3.5, sale_price: 5.0, min_stock: 24, unit: 'UND', current_stock: 96, status: 'active', created_at: '2026-02-01T09:00:00Z' },
  { id: 2, sku: 'SKU-0002', name: 'Agua mineral 1L', category_id: 1, cost_price: 2.0, sale_price: 3.0, min_stock: 36, unit: 'UND', current_stock: 120, status: 'active', created_at: '2026-02-01T09:05:00Z' },
  { id: 3, sku: 'SKU-0003', name: 'Jugo de naranja 1L', category_id: 1, cost_price: 4.5, sale_price: 6.5, min_stock: 24, unit: 'UND', current_stock: 18, status: 'active', created_at: '2026-02-03T10:15:00Z' },
  { id: 4, sku: 'SKU-0004', name: 'Café molido 250g', category_id: 2, cost_price: 12.0, sale_price: 18.5, min_stock: 12, unit: 'UND', current_stock: 45, status: 'active', created_at: '2026-02-05T11:30:00Z' },
  { id: 5, sku: 'SKU-0005', name: 'Azúcar 1kg', category_id: 2, cost_price: 3.2, sale_price: 4.8, min_stock: 30, unit: 'UND', current_stock: 80, status: 'active', created_at: '2026-02-05T11:35:00Z' },
  { id: 6, sku: 'SKU-0006', name: 'Arroz premium 1kg', category_id: 2, cost_price: 4.1, sale_price: 5.9, min_stock: 30, unit: 'UND', current_stock: 22, status: 'active', created_at: '2026-02-08T08:20:00Z' },
  { id: 7, sku: 'SKU-0007', name: 'Aceite vegetal 1L', category_id: 2, cost_price: 6.5, sale_price: 9.2, min_stock: 18, unit: 'UND', current_stock: 40, status: 'active', created_at: '2026-02-10T14:00:00Z' },
  { id: 8, sku: 'SKU-0008', name: 'Pan de molde', category_id: 3, cost_price: 2.8, sale_price: 4.0, min_stock: 20, unit: 'UND', current_stock: 35, status: 'active', created_at: '2026-02-12T07:45:00Z' },
  { id: 9, sku: 'SKU-0009', name: 'Croissant', category_id: 3, cost_price: 1.5, sale_price: 2.5, min_stock: 24, unit: 'UND', current_stock: 12, status: 'active', created_at: '2026-02-12T07:50:00Z' },
  { id: 10, sku: 'SKU-0010', name: 'Manzana roja 1kg', category_id: 4, cost_price: 3.0, sale_price: 4.5, min_stock: 15, unit: 'UND', current_stock: 50, status: 'active', created_at: '2026-02-15T09:10:00Z' },
  { id: 11, sku: 'SKU-0011', name: 'Plátano 1kg', category_id: 4, cost_price: 2.2, sale_price: 3.2, min_stock: 20, unit: 'UND', current_stock: 0, status: 'active', created_at: '2026-02-15T09:15:00Z' },
  { id: 12, sku: 'SKU-0012', name: 'Detergente 1kg', category_id: 5, cost_price: 8.0, sale_price: 12.5, min_stock: 12, unit: 'UND', current_stock: 30, status: 'active', created_at: '2026-02-18T16:30:00Z' },
  { id: 13, sku: 'SKU-0013', name: 'Jabón de tocador x3', category_id: 5, cost_price: 4.5, sale_price: 6.8, min_stock: 18, unit: 'UND', current_stock: 25, status: 'active', created_at: '2026-02-18T16:35:00Z' },
  { id: 14, sku: 'SKU-0014', name: 'Papas fritas 100g', category_id: 6, cost_price: 2.5, sale_price: 3.8, min_stock: 30, unit: 'UND', current_stock: 60, status: 'active', created_at: '2026-02-20T10:00:00Z' },
  { id: 15, sku: 'SKU-0015', name: 'Chocolate 100g', category_id: 6, cost_price: 3.8, sale_price: 5.5, min_stock: 24, unit: 'UND', current_stock: 40, status: 'active', created_at: '2026-02-20T10:05:00Z' },
  { id: 16, sku: 'SKU-0016', name: 'Leche entera 1L', category_id: 7, cost_price: 3.6, sale_price: 4.9, min_stock: 36, unit: 'UND', current_stock: 70, status: 'active', created_at: '2026-02-22T08:00:00Z' },
  { id: 17, sku: 'SKU-0017', name: 'Queso fresco 500g', category_id: 7, cost_price: 9.0, sale_price: 13.5, min_stock: 10, unit: 'UND', current_stock: 8, status: 'active', created_at: '2026-02-22T08:05:00Z' },
  { id: 18, sku: 'SKU-0018', name: 'Shampoo 400ml', category_id: 8, cost_price: 11.0, sale_price: 16.9, min_stock: 12, unit: 'UND', current_stock: 28, status: 'active', created_at: '2026-02-25T13:20:00Z' },
  { id: 19, sku: 'SKU-0019', name: 'Pasta dental', category_id: 8, cost_price: 5.5, sale_price: 8.2, min_stock: 15, unit: 'UND', current_stock: 33, status: 'active', created_at: '2026-02-25T13:25:00Z' },
  { id: 20, sku: 'SKU-0020', name: 'Gaseosa cola 2L', category_id: 1, cost_price: 5.5, sale_price: 8.0, min_stock: 20, unit: 'UND', current_stock: 55, status: 'inactive', created_at: '2026-03-01T09:30:00Z' },
]

/** Categorías para filtros y formulario. */
export const PRODUCT_CATEGORIES = CATEGORIES

let products: Product[] = SEED.map((seed) => {
  const category = CATEGORIES.find((cat) => cat.id === seed.category_id) ?? CATEGORIES[0]
  return { ...seed, category: { id: category.id, name: category.name } }
})

/** Latencia simulada para ver los estados de carga (txt §8). */
const delay = (ms = 400): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export interface ProductFilters {
  search?: string
  category_id?: number | ''
  status?: 'active' | 'inactive' | ''
  /** Solo productos con stock ≤ mínimo (RF-04 low_stock). */
  low_stock?: boolean
}

export async function listProducts(filters: ProductFilters = {}): Promise<Product[]> {
  await delay()
  const search = filters.search?.trim().toLowerCase() ?? ''
  return products.filter(
    (product) =>
      (!filters.status || product.status === filters.status) &&
      (!filters.category_id || product.category.id === filters.category_id) &&
      (!filters.low_stock || product.current_stock <= product.min_stock) &&
      (search === '' ||
        product.name.toLowerCase().includes(search) ||
        product.sku.toLowerCase().includes(search)),
  )
}

export async function createProduct(input: ProductInput): Promise<Product> {
  await delay()
  // RN-03: SKU único.
  if (products.some((product) => product.sku === input.sku)) {
    throw new Error('Ya existe un producto con ese SKU.')
  }
  // RN-05: precio de venta ≥ costo.
  if (input.sale_price < input.cost_price) {
    throw new Error('El precio de venta no puede ser menor al costo.')
  }
  const category = CATEGORIES.find((cat) => cat.id === input.category_id) ?? CATEGORIES[0]
  const product: Product = {
    id: Math.max(...products.map((existing) => existing.id), 0) + 1,
    ...input,
    category: { id: category.id, name: category.name },
    current_stock: 0,
    status: 'active',
    created_at: new Date().toISOString(),
  }
  products = [...products, product]
  return product
}

export async function updateProduct(id: number, input: ProductInput): Promise<Product> {
  await delay()
  if (
    products.some((product) => product.id !== id && product.sku === input.sku)
  ) {
    throw new Error('Ya existe un producto con ese SKU.')
  }
  if (input.sale_price < input.cost_price) {
    throw new Error('El precio de venta no puede ser menor al costo.')
  }
  const existing = products.find((product) => product.id === id)
  if (!existing) throw new Error('Producto no encontrado.')
  const category = CATEGORIES.find((cat) => cat.id === input.category_id) ?? CATEGORIES[0]
  const updated: Product = { ...existing, ...input, category: { id: category.id, name: category.name } }
  products = products.map((product) => (product.id === id ? updated : product))
  return updated
}

/** Activar / desactivar (PATCH /products/{id}/status). */
export async function toggleProductStatus(id: number): Promise<Product> {
  await delay()
  const existing = products.find((product) => product.id === id)
  if (!existing) throw new Error('Producto no encontrado.')
  const updated: Product = { ...existing, status: existing.status === 'active' ? 'inactive' : 'active' }
  products = products.map((product) => (product.id === id ? updated : product))
  return updated
}
