import { useEffect, useMemo, useState } from 'react'
import { Eye, Plus } from 'lucide-react'
import Table, { TableRow, TableCell, TableStateRow } from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Input, Select } from '@/components/ui/form'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/states'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDateTime } from '@/utils/formatters'
import type { Sale, SaleInput } from '@/types/sale'
import { useSales } from '@/hooks/useSales'
import { createSale } from '../services/saleService'
import SaleForm from '../components/SaleForm'
import SaleDetailModal, { SALE_STATUS_LABELS } from '../components/SaleDetailModal'

/**
 * Página de Ventas (Fase 08 · RF-06, RF-07): historial de ventas,
 * registro de venta con carrito, estados y detalle.
 * TODO(Fase 05): conectar con /api/v1/sales.
 */

const PAGE_SIZE = 10

export default function SalesPage() {
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<Sale['status'] | ''>('')
  const [page, setPage] = useState(1)

  const [formOpen, setFormOpen] = useState(false)
  const [selected, setSelected] = useState<Sale | null>(null)

  const { sales, loading, error, reload } = useSales({ search: debouncedSearch, status })

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, status])

  const pageCount = Math.max(Math.ceil(sales.length / PAGE_SIZE), 1)
  const currentPage = Math.min(page, pageCount)
  const visible = useMemo(
    () => sales.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [sales, currentPage],
  )

  const totals = useMemo(
    () => ({
      ventas: sales.length,
      ingresos: sales
        .filter((sale) => sale.status !== 'cancelled')
        .reduce((total, sale) => total + sale.total, 0),
    }),
    [sales],
  )

  const handleSubmit = async (input: SaleInput) => {
    try {
      const sale = await createSale(input)
      toast.success('Venta registrada', `${sale.sale_number} por ${formatCurrency(sale.total)}.`)
      setFormOpen(false)
      reload()
    } catch (reason: unknown) {
      toast.error('No se pudo registrar la venta', reason instanceof Error ? reason.message : 'Error inesperado')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1>Ventas</h1>
          <p className="mt-1 text-body-sm text-gray-600">
            Registro de ventas, pagos y estados (RF-06, RF-07).
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Registrar venta
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card flex items-center justify-between">
          <span className="text-body-sm text-gray-600">Ventas en el filtro</span>
          <span className="text-h3 font-bold text-primary">{totals.ventas}</span>
        </div>
        <div className="card flex items-center justify-between">
          <span className="text-body-sm text-gray-600">Ingresos (sin anuladas)</span>
          <span className="text-h3 font-bold text-primary">{formatCurrency(totals.ingresos)}</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="card flex flex-col gap-3 md:flex-row md:items-end">
        <Input
          type="search"
          aria-label="Buscar ventas"
          placeholder="Buscar por número de venta o cliente…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="md:flex-1"
        />
        <Select
          aria-label="Filtrar por estado"
          value={status}
          onChange={(event) => setStatus(event.target.value as Sale['status'] | '')}
          className="md:w-44"
        >
          <option value="">Todos los estados</option>
          <option value="paid">Pagadas</option>
          <option value="partial">Parciales</option>
          <option value="pending">Pendientes</option>
          <option value="cancelled">Anuladas</option>
        </Select>
      </div>

      {/* Listado */}
      {error ? (
        <div className="card">
          <ErrorState
            description={error}
            action={
              <Button variant="outline" onClick={reload}>
                Reintentar
              </Button>
            }
          />
        </div>
      ) : loading && sales.length === 0 ? (
        <div className="card">
          <Table headers={['Venta', 'Cliente', 'Vendedor', 'Fecha', 'Total', 'Estado', '']}>
            <TableStateRow colSpan={7}>
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} className="text-loading" />
                Cargando ventas…
              </span>
            </TableStateRow>
          </Table>
        </div>
      ) : sales.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Sin ventas"
            description="No hay ventas que coincidan con el filtro."
            action={
              <Button onClick={() => setFormOpen(true)}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Registrar venta
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          <Table headers={['Venta', 'Cliente', 'Vendedor', 'Fecha', 'Total', 'Estado', '']}>
            {visible.map((sale) => {
              const statusLabel = SALE_STATUS_LABELS[sale.status]
              return (
                <TableRow key={sale.id} onClick={() => setSelected(sale)}>
                  <TableCell className="font-mono text-caption">{sale.sale_number}</TableCell>
                  <TableCell className="font-medium text-gray-900">{sale.customer.name}</TableCell>
                  <TableCell>{sale.seller.name}</TableCell>
                  <TableCell>{formatDateTime(sale.issued_at)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(sale.total)}</TableCell>
                  <TableCell>
                    <Badge variant={statusLabel.variant}>{statusLabel.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelected(sale)
                        }}
                        aria-label={`Ver detalle de ${sale.sale_number}`}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
                      >
                        <Eye aria-hidden="true" className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </Table>

          <Pagination
            page={currentPage}
            pageCount={pageCount}
            onPageChange={setPage}
            total={sales.length}
            pageSize={PAGE_SIZE}
          />
        </div>
      )}

      <SaleForm open={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleSubmit} />
      <SaleDetailModal sale={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
