import type { Sale } from '@/types/sale'
import Modal from '@/components/ui/Modal'
import DataTable, { TableRow, TableCell } from '@/components/tables/DataTable'
import Badge from '@/components/ui/Badge'
import { useLang } from '@/i18n/i18n'
import { formatCurrency, formatDateTime } from '@/utils/formatters'

/**
 * Detalle de una venta (Fase 08 · RF-06): líneas, totales y pago.
 */

export const SALE_STATUS_LABELS: Record<
  Sale['status'],
  { variant: 'success' | 'warning' | 'info' | 'error'; label: string }
> = {
  paid: { variant: 'success', label: 'sales.pagado' },
  pending: { variant: 'warning', label: 'sales.pendiente' },
  partial: { variant: 'info', label: 'sales.parcial' },
  cancelled: { variant: 'error', label: 'sales.cancelado' },
}

interface SaleDetailModalProps {
  sale: Sale | null
  onClose: () => void
}

export default function SaleDetailModal({ sale, onClose }: SaleDetailModalProps) {
  const { t } = useLang()
  if (!sale) return null
  const status = SALE_STATUS_LABELS[sale.status]

  return (
    <Modal
      open={sale !== null}
      onClose={onClose}
      title={`${t('sales.venta')} ${sale.sale_number}`}
      size="lg"
    >
      <div className="space-y-5">
        <div className="grid gap-3 text-body-sm sm:grid-cols-2">
          <div>
            <p className="text-caption text-gray-500">{t('sales.cliente')}</p>
            <p className="font-medium text-gray-900">{sale.customer.name}</p>
          </div>
          <div>
            <p className="text-caption text-gray-500">{t('sales.vendedor')}</p>
            <p className="font-medium text-gray-900">{sale.seller.name}</p>
          </div>
          <div>
            <p className="text-caption text-gray-500">{t('sales.fecha')}</p>
            <p className="font-medium text-gray-900">{formatDateTime(sale.issued_at)}</p>
          </div>
          <div>
            <p className="text-caption text-gray-500">{t('sales.estado')}</p>
            <Badge variant={status.variant}>{t(status.label)}</Badge>
          </div>
        </div>

        <DataTable
          headers={[
            t('sales.producto'),
            t('sales.cantidad'),
            t('sales.precio'),
            t('sales.descuento'),
            t('sales.subtotal'),
          ]}
        >
          {sale.items.map((item) => (
            <TableRow key={item.product_id}>
              <TableCell>
                <div className="font-medium text-gray-900">{item.name}</div>
                <div className="font-mono text-caption text-gray-500">{item.sku}</div>
              </TableCell>
              <TableCell>{item.quantity}</TableCell>
              <TableCell>{formatCurrency(item.unit_price)}</TableCell>
              <TableCell>{item.discount > 0 ? `− ${formatCurrency(item.discount)}` : '—'}</TableCell>
              <TableCell className="font-medium">
                {formatCurrency(item.subtotal ?? item.quantity * item.unit_price - item.discount)}
              </TableCell>
            </TableRow>
          ))}
        </DataTable>

        <div className="rounded-lg bg-gray-50 p-4 text-body-sm">
          <div className="flex justify-between py-1">
            <span className="text-gray-600">{t('sales.subtotal')}</span>
            <span className="font-medium">{formatCurrency(sale.subtotal)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-gray-600">{t('sales.descuento')}</span>
            <span className="font-medium text-error">− {formatCurrency(sale.discount)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-gray-600">{t('sales.impuesto')}</span>
            <span className="font-medium">{formatCurrency(sale.tax)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-gray-200 pt-2">
            <span className="font-semibold text-gray-900">{t('sales.total')}</span>
            <span className="text-h4 font-bold text-primary">{formatCurrency(sale.total)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-gray-200 pt-2">
            <span className="text-gray-600">{t('sales.pagado-saldo')}</span>
            <span className="font-medium">
              {formatCurrency(sale.paid)} · {formatCurrency(sale.balance)}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  )
}
