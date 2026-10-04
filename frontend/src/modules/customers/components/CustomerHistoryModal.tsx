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
import { useLang } from '@/i18n/i18n'

/**
 * Historial de compras del cliente (Fase 07 — RF-03).
 * TODO(Fase 05): GET /api/v1/customers/{id}/history.
 */

interface CustomerHistoryModalProps {
  /** Cliente seleccionado (null = cerrado). */
  customer: Customer | null
  onClose: () => void
}

export default function CustomerHistoryModal({ customer, onClose }: CustomerHistoryModalProps) {
  const { t } = useLang()
  const [purchases, setPurchases] = useState<CustomerPurchase[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const STATUS_LABELS: Record<SaleStatus, { variant: 'success' | 'warning' | 'info' | 'error'; label: string }> = {
    paid: { variant: 'success', label: t('customers.pagado') },
    pending: { variant: 'warning', label: t('customers.pendiente') },
    partial: { variant: 'info', label: t('customers.parcial') },
    cancelled: { variant: 'error', label: t('customers.cancelado') },
  }

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
        if (!cancelled)
          setError(
            reason instanceof Error ? reason.message : t('customers.no-se-pudo-cargar-el-historial'),
          )
      })
    return () => {
      cancelled = true
    }
  }, [customer, attempt])

  return (
    <Modal
      open={customer !== null}
      onClose={onClose}
      title={customer ? `${t('customers.historial')} — ${customer.name}` : t('customers.historial')}
      size="lg"
    >
      {error ? (
        <ErrorState
          description={error}
          action={
            <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>
              {t('customers.reintentar')}
            </Button>
          }
        />
      ) : purchases === null ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <Spinner className="text-loading" />
          <p className="text-body-sm text-gray-500">{t('customers.cargando-historial')}</p>
        </div>
      ) : purchases.length === 0 ? (
        <EmptyState
          title={t('customers.sin-compras')}
          description={t('customers.este-cliente-aun-no-tiene-compras-registradas')}
        />
      ) : (
        <div className="space-y-4">
          <DataTable headers={[t('customers.fecha'), t('customers.venta'), t('customers.total'), t('customers.estado')]}>
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
              <span className="font-semibold">{customer.purchase_count}</span>{' '}
              {t('customers.compras-total')}{' '}
              <span className="font-semibold">{formatCurrency(customer.total_purchased)}</span>
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
