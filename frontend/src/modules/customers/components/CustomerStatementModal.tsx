import { useEffect, useState } from 'react'
import type { Customer } from '@/types/customer'
import Modal from '@/components/ui/Modal'
import DataTable, { TableRow, TableCell } from '@/components/tables/DataTable'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Spinner } from '@/components/feedback/Loader'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { formatCurrency, formatDate } from '@/utils/formatters'
import { getAccountStatement } from '../services/customerService'
import type { AccountStatement } from '../services/customerService'
import { useLang } from '@/i18n/i18n'

/**
 * Estado de cuenta del cliente (RP · aging de saldos).
 * Muestra totales, antigüedad de la deuda y el detalle venta por venta.
 */

interface CustomerStatementModalProps {
  /** Cliente seleccionado (null = cerrado). */
  customer: Customer | null
  onClose: () => void
}

const AGING_KEYS: Record<string, string> = {
  vigente: 'customers.aging-vigente',
  '1-30': 'customers.aging-1-30',
  '31-60': 'customers.aging-31-60',
  '61-90': 'customers.aging-61-90',
  '90+': 'customers.aging-90-mas',
}

export default function CustomerStatementModal({ customer, onClose }: CustomerStatementModalProps) {
  const { t } = useLang()
  const [statement, setStatement] = useState<AccountStatement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!customer) {
      setStatement(null)
      setError(null)
      return
    }
    let cancelled = false
    setStatement(null)
    setError(null)
    getAccountStatement(customer.id)
      .then((result) => {
        if (!cancelled) setStatement(result)
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(
            reason instanceof Error ? reason.message : t('customers.no-se-pudo-cargar-el-estado'),
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
      title={customer ? `${t('customers.estado-de-cuenta')} — ${customer.name}` : t('customers.estado-de-cuenta')}
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
      ) : statement === null ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <Spinner className="text-loading" />
          <p className="text-body-sm text-gray-500">{t('customers.cargando-estado')}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Resumen */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-caption text-gray-500">{t('customers.total-comprado')}</p>
              <p className="text-body font-semibold text-gray-900">
                {formatCurrency(statement.total_purchased)}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-caption text-gray-500">{t('customers.total-pagado')}</p>
              <p className="text-body font-semibold text-success">
                {formatCurrency(statement.total_paid)}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-caption text-gray-500">{t('customers.saldo-pendiente')}</p>
              <p
                className={`text-body font-semibold ${
                  statement.balance > 0 ? 'text-error' : 'text-success'
                }`}
              >
                {formatCurrency(statement.balance)}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-caption text-gray-500">{t('customers.compras-total')}</p>
              <p className="text-body font-semibold text-gray-900">{statement.sales.length}</p>
            </div>
          </div>

          {/* Aging */}
          <div>
            <p className="mb-2 text-body-sm font-semibold text-gray-700">
              {t('customers.antiguedad-de-la-deuda')}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {Object.entries(statement.aging).map(([bucket, amount]) => (
                <div key={bucket} className="rounded-lg border border-gray-200 p-3 text-center">
                  <p className="text-caption text-gray-500">{t(AGING_KEYS[bucket] ?? bucket)}</p>
                  <p
                    className={`text-body-sm font-semibold ${
                      amount > 0 ? 'text-error' : 'text-gray-900'
                    }`}
                  >
                    {formatCurrency(amount)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Detalle por venta */}
          {statement.sales.length === 0 ? (
            <EmptyState
              title={t('customers.sin-compras')}
              description={t('customers.este-cliente-aun-no-tiene-compras-registradas')}
            />
          ) : (
            <DataTable
              headers={[
                t('customers.fecha'),
                t('customers.venta'),
                t('customers.total'),
                t('customers.total-pagado'),
                t('customers.saldo-pendiente'),
                t('customers.tramo'),
              ]}
            >
              {statement.sales.map((sale) => (
                <TableRow key={sale.sale_number}>
                  <TableCell>{formatDate(sale.issued_at)}</TableCell>
                  <TableCell className="font-mono text-caption">{sale.sale_number}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(sale.total)}</TableCell>
                  <TableCell>{formatCurrency(sale.paid)}</TableCell>
                  <TableCell
                    className={sale.balance > 0 ? 'font-semibold text-error' : 'text-success'}
                  >
                    {formatCurrency(sale.balance)}
                  </TableCell>
                  <TableCell>
                    {sale.balance > 0 ? (
                      <Badge variant={sale.aging_bucket === 'vigente' ? 'info' : 'warning'}>
                        {t(AGING_KEYS[sale.aging_bucket] ?? sale.aging_bucket)}
                      </Badge>
                    ) : (
                      <Badge variant="success">{t('customers.pagado')}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </DataTable>
          )}
        </div>
      )}
    </Modal>
  )
}
