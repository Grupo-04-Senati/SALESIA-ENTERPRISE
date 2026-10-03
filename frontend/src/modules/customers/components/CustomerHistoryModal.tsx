import { useEffect, useState } from 'react'
import type { Customer } from '@/types/customer'
import type { SaleStatus } from '@/types/sale'
import Modal from '@/components/ui/Modal'
import DataTable, { TableRow, TableCell } from '@/components/tables/DataTable'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Spinner } from '@/components/feedback/Loader'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { getCustomerHistory } from '../services/customerService'
import type { CustomerPurchase } from '../services/customerService'

/**
 * Historial de compras del cliente (Fase 07 — RF-03).
 * TODO(Fase 05): GET /api/v1/customers/{id}/history.
 */

const STATUS_LABELS: Record<SaleStatus, { variant: 'success' | 'warning' | 'info' | 'error'; label: string }> = {
  paid: { variant: 'success', label: 'Pagado' },
  pending: { variant: 'warning', label: 'Pendiente' },
  partial: { variant: 'info', label: 'Parcial' },
  cancelled: { variant: 'error', label: 'Cancelado' },
}

interface CustomerHistoryModalProps {
  /** Cliente seleccionado (null = cerrado). */
  customer: Customer | null
  onClose: () => void
}

export default function CustomerHistoryModal({ customer, onClose }: CustomerHistoryModalProps) {
  const [purchases, setPurchases] = useState<CustomerPurchase[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!customer) {
      setPurchases(null)
      setError(null)
      return
    }
    let cancelled = false
    setPurchases(null)
    setError(null)
    getCustomerHistory(customer)
      .then((result) => {
        if (!cancelled) setPurchases(result)
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el historial')
      })
    return () => {
      cancelled = true
    }
  }, [customer, attempt])

  return (
    <Modal
      open={customer !== null}
      onClose={onClose}
      title={customer ? `Historial — ${customer.name}` : 'Historial'}
      size="lg"
    >
      {error ? (
        <ErrorState
          description={error}
          action={
            <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>
              Reintentar
            </Button>
          }
        />
      ) : purchases === null ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <Spinner className="text-loading" />
          <p className="text-body-sm text-gray-500">Cargando historial…</p>
        </div>
      ) : purchases.length === 0 ? (
        <EmptyState title="Sin compras" description="Este cliente aún no tiene compras registradas." />
      ) : (
        <div className="space-y-4">
          <DataTable headers={['Fecha', 'Venta', 'Total', 'Estado']}>
            {purchases.map((purchase) => {
              const status = STATUS_LABELS[purchase.status]
              return (
                <TableRow key={purchase.sale_number}>
                  <TableCell>{formatDate(purchase.issued_at)}</TableCell>
                  <TableCell className="font-mono text-caption">{purchase.sale_number}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(purchase.total)}</TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </DataTable>

          {customer && (
            <p className="text-right text-body-sm text-gray-600">
              <span className="font-semibold">{customer.purchase_count}</span> compras · total{' '}
              <span className="font-semibold">{formatCurrency(customer.total_purchased)}</span>
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
