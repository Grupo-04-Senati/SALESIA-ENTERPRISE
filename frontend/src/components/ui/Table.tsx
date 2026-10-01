import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

/**
 * Tabla estándar (txt §5.4):
 * - Header: fondo #F9FAFB, texto #374151 en 600, 14px
 * - Filas alternas #FFFFFF / #F9FAFB, hover #F3F4F6
 * - Borde inferior 1px #E5E7EB, celdas con padding 12px 16px
 * - Scroll horizontal en pantallas pequeñas (txt §9)
 */

interface TableProps {
  /** Títulos de columna. */
  headers: ReactNode[]
  /** Filas: usar `<TableRow>` con `<TableCell>` dentro. */
  children: ReactNode
  className?: string
}

export default function Table({ headers, children, className }: TableProps) {
  return (
    <div
      className={cn(
        'overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-subtle',
        className,
      )}
    >
      <table className="w-full min-w-[560px] border-collapse text-body-sm">
        <thead>
          <tr className="bg-gray-50 text-left">
            {headers.map((header, index) => (
              <th key={index} scope="col" className="px-4 py-3 font-semibold text-gray-700">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

interface TableRowProps {
  children: ReactNode
  /** Si se pasa, la fila se marca como clicable (cursor pointer). */
  onClick?: () => void
  className?: string
}

export function TableRow({ children, onClick, className }: TableRowProps) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'border-b border-gray-200 text-gray-700 transition-colors odd:bg-white even:bg-gray-50 hover:bg-gray-100',
        'last:border-b-0',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </tr>
  )
}

interface TableCellProps {
  children?: ReactNode
  colSpan?: number
  className?: string
}

export function TableCell({ children, colSpan, className }: TableCellProps) {
  return (
    <td colSpan={colSpan} className={cn('px-4 py-3', className)}>
      {children}
    </td>
  )
}

/**
 * Fila especial para estados dentro de la tabla (carga / vacío),
 * centrada a lo ancho de todas las columnas.
 */
export function TableStateRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-body-sm text-gray-500">
        {children}
      </td>
    </tr>
  )
}
