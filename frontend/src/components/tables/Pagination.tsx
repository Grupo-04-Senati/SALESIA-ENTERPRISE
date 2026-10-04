import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useLang } from '@/i18n/i18n'

/**
 * Paginación (txt §5.4): botones outline con hover cyan y
 * página activa en fondo azul corporativo con texto blanco.
 */

interface PaginationProps {
  /** Página actual (base 1). */
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  /** Total de registros — muestra "Mostrando X–Y de Z". */
  total?: number
  pageSize?: number
}

const OUTLINE =
  'border-gray-300 bg-white text-gray-600 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-300 disabled:hover:text-gray-600'
const ACTIVE = 'border-primary bg-primary text-white'

/** Ventana de números: 1 … p-1 p p+1 … n (máx. 7 elementos). */
function pageItems(page: number, pageCount: number): Array<number | '…'> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1)
  if (page <= 4) return [1, 2, 3, 4, 5, '…', pageCount]
  if (page >= pageCount - 4) return [1, '…', pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount]
  return [1, '…', page - 1, page, page + 1, '…', pageCount]
}

export default function Pagination({
  page,
  pageCount,
  onPageChange,
  total,
  pageSize = 10,
}: PaginationProps) {
  const { t } = useLang()

  if (pageCount <= 1 && total === undefined) return null

  const from = total === undefined ? 0 : (page - 1) * pageSize + 1
  const to = total === undefined ? 0 : Math.min(page * pageSize, total)

  return (
    <nav aria-label={t('common.paginacion')} className="flex flex-wrap items-center justify-between gap-3">
      {total !== undefined && (
        <p className="text-caption text-gray-500">
          {t('common.mostrando')} {from}–{to} {t('common.de')} {total}
        </p>
      )}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label={t('common.pagina-anterior')}
          className={cn('flex h-9 w-9 items-center justify-center rounded-md border transition-colors', OUTLINE)}
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </button>

        {pageItems(page, pageCount).map((item, index) =>
          item === '…' ? (
            <span key={`gap-${index}`} className="px-1 text-body-sm text-gray-400">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-label={`${t('common.pagina')} ${item}`}
              aria-current={item === page ? 'page' : undefined}
              className={cn(
                'flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-body-sm font-medium transition-colors',
                item === page ? ACTIVE : OUTLINE,
              )}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label={t('common.pagina-siguiente')}
          className={cn('flex h-9 w-9 items-center justify-center rounded-md border transition-colors', OUTLINE)}
        >
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </nav>
  )
}
