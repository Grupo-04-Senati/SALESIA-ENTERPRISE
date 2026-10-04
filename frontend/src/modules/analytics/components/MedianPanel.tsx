import { Link } from 'react-router-dom'
import { formatCurrency } from '@/utils/formatters'
import { median } from '../services/statisticsService'
import MedianChart from '@/components/charts/MedianChart'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useLang } from '@/i18n/i18n'

/**
 * Panel de la mediana (Fase 09 · RF-12).
 * MedianChart del sistema de diseño: línea #06B6D4 (txt §6.2).
 */

interface MedianPanelProps {
  values: number[]
}

export default function MedianPanel({ values }: MedianPanelProps) {
  const { t } = useLang()

  if (values.length === 0) {
    return (
      <div className="card">
        <h3 className="text-h4 text-gray-800">{t('analytics.mediana')}</h3>
        <EmptyState
          title={t('analytics.sin-ventas-en-el-periodo')}
          description={t(
            'analytics.la-mediana-se-calcula-con-los-tickets-reales-registra-ventas-para-verla',
          )}
          action={
            <Link to="/ventas" className="btn-primary">
              {t('analytics.registrar-venta')}
            </Link>
          }
        />
      </div>
    )
  }

  const value = median(values)

  return (
    <div className="card">
      <h3 className="text-h4 text-gray-800">{t('analytics.mediana')}</h3>
      <p className="mt-1 text-kpi font-bold text-accent">{formatCurrency(value)}</p>
      <p className="text-caption text-gray-500">
        {t('analytics.valor-central-de-n-tickets-ordenados', { n: values.length })}
      </p>

      <div className="mt-4">
        <MedianChart values={values} />
      </div>
      <p className="mt-2 text-caption text-gray-500">
        {t('analytics.mediana-marcada-en-cyan-corporativo')}
      </p>
    </div>
  )
}
