import { useState } from 'react'
import { BadgeCheck, Check, PackageCheck, Undo2 } from 'lucide-react'
import type { Sale } from '@/types/sale'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import DataTable, { TableRow, TableCell } from '@/components/tables/DataTable'
import Badge from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { useLang } from '@/i18n/i18n'
import { formatCurrency, formatDateTime } from '@/utils/formatters'
import { registerPayment, resolveClaim, setSaleReceived } from '../services/saleService'

/**
 * Detalle de una venta (Fase 08 · RF-06): líneas, totales y pago.
 * Per registrar el pago del saldo (RN-16/RN-17) para avanzar el pedido.
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
  onUpdated?: (sale: Sale) => void
}

export default function SaleDetailModal({ sale, onClose, onUpdated }: SaleDetailModalProps) {
  const { t } = useLang()
  const toast = useToast()
  const [paying, setPaying] = useState(false)
  const [receiving, setReceiving] = useState(false)
  const [resolving, setResolving] = useState<number | null>(null)
  if (!sale) return null
  const status = SALE_STATUS_LABELS[sale.status]
  const canPay = sale.status !== 'cancelled' && sale.balance > 0

  const handlePayment = async () => {
    if (paying || !sale) return
    setPaying(true)
    try {
      const updated = await registerPayment(sale.id, {
        amount: sale.balance,
        method: 'cash',
      })
      toast.success(
        t('sales.pago-registrado'),
        `${updated.sale_number} · ${formatCurrency(updated.paid)} · ${t(updated.status === 'paid' ? 'sales.pagado' : 'sales.parcial')}`,
      )
      onUpdated?.(updated)
    } catch (reason: unknown) {
      toast.error(
        t('sales.no-se-pudo-registrar-el-pago'),
        reason instanceof Error ? reason.message : t('sales.error-inesperado'),
      )
    } finally {
      setPaying(false)
    }
  }

  const handleReceived = async () => {
    if (receiving || !sale) return
    setReceiving(true)
    try {
      const updated = await setSaleReceived(sale.id, !sale.received_at)
      toast.success(
        t(updated.received_at ? 'sales.recibido-registrado' : 'sales.recibido-deshecho'),
        updated.sale_number,
      )
      onUpdated?.(updated)
    } catch (reason: unknown) {
      toast.error(
        t('sales.no-se-pudo-actualizar-el-recibido'),
        reason instanceof Error ? reason.message : t('sales.error-inesperado'),
      )
    } finally {
      setReceiving(false)
    }
  }

  const handleResolveClaim = async (claimId: number) => {
    if (resolving !== null || !sale) return
    setResolving(claimId)
    try {
      const updated = await resolveClaim(claimId, sale.id)
      toast.success(t('sales.reclamo-atendido-toast'), updated.sale_number)
      onUpdated?.(updated)
    } catch (reason: unknown) {
      toast.error(
        t('sales.no-se-pudo-atender-el-reclamo'),
        reason instanceof Error ? reason.message : t('sales.error-inesperado'),
      )
    } finally {
      setResolving(null)
    }
  }

  return (
    <Modal
      open={sale !== null}
      onClose={onClose}
      title={`${t('sales.venta')} ${sale.sale_number}`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cerrar')}
          </Button>
          {canPay && (
            <Button onClick={() => void handlePayment()} loading={paying}>
              <BadgeCheck aria-hidden="true" className="h-4 w-4" />
              {t('sales.registrar-pago-del-saldo')}
            </Button>
          )}
          {sale.status !== 'cancelled' && !sale.received_at && (
            <Button onClick={() => void handleReceived()} loading={receiving}>
              <PackageCheck aria-hidden="true" className="h-4 w-4" />
              {t('sales.marcar-como-recibido')}
            </Button>
          )}
          {sale.status !== 'cancelled' && sale.received_at && (
            <Button variant="outline" onClick={() => void handleReceived()} loading={receiving}>
              <Undo2 aria-hidden="true" className="h-4 w-4" />
              {t('sales.deshacer-recibido')}
            </Button>
          )}
        </>
      }
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
            {sale.received_at && (
              <p className="mt-1 text-caption text-success">
                {t('sales.recibido')} · {formatDateTime(sale.received_at)}
              </p>
            )}
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

        {(sale.claims?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <p className="text-caption font-semibold uppercase text-gray-500">
              {t('sales.reclamaciones')}
            </p>
            {sale.claims?.map((claim) => (
              <div key={claim.id} className="rounded-lg border border-gray-200 p-3 text-body-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant={claim.status === 'pendiente' ? 'warning' : 'success'}>
                    {t(
                      claim.status === 'pendiente'
                        ? 'sales.reclamo-pendiente'
                        : 'sales.reclamo-atendido',
                    )}
                  </Badge>
                  <span className="text-caption text-gray-500">
                    {formatDateTime(claim.created_at)}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-gray-700">{claim.description}</p>
                {claim.resolved_at && (
                  <p className="mt-1 text-caption text-success">
                    {t('sales.atendido-el')} {formatDateTime(claim.resolved_at)}
                  </p>
                )}
                {claim.status === 'pendiente' && (
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      loading={resolving === claim.id}
                      onClick={() => void handleResolveClaim(claim.id)}
                    >
                      <Check aria-hidden="true" className="h-4 w-4" />
                      {t('sales.marcar-como-atendido')}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
