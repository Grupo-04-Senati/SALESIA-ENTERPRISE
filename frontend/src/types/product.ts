/**
 * Tipos de productos y categorías (docs/05_api.md §2.4, RF-04).
 */

export interface Category {
  id: number
  name: string
  description?: string | null
  status?: 'active' | 'inactive'
  image_url?: string | null
}

/** Datos para crear/editar categoría (POST/PUT /api/v1/categories). */
export interface CategoryInput {
  name: string
  description?: string | null
  image_url?: string | null
}

export interface Product {
  id: number
  sku: string
  name: string
  category: Pick<Category, 'id' | 'name'>
  description?: string | null
  cost_price: number
  sale_price: number
  wholesale_price?: number | null
  brand?: string | null
  image_url?: string | null
  is_featured?: boolean
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
  description?: string | null
  cost_price: number
  sale_price: number
  wholesale_price?: number | null
  brand?: string | null
  image_url?: string | null
  is_featured?: boolean
  min_stock: number
  unit: string
}
