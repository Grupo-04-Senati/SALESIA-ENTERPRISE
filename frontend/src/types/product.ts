/**
 * Tipos de productos y categorías (docs/05_api.md §2.4, RF-04).
 */

export interface Category {
  id: number
  name: string
  description?: string | null
  status?: 'active' | 'inactive'
}

/** Datos para crear/editar categoría (POST/PUT /api/v1/categories). */
export interface CategoryInput {
  name: string
  description?: string | null
}

export interface Product {
  id: number
  sku: string
  name: string
  category: Pick<Category, 'id' | 'name'>
  cost_price: number
  sale_price: number
  min_stock: number
  current_stock: number
  unit: string
  status: 'active' | 'inactive'
  created_at: string
}

/** Datos para crear/editar producto. */
export interface ProductInput {
  sku: string
  name: string
  category_id: number
  cost_price: number
  sale_price: number
  min_stock: number
  unit: string
}
