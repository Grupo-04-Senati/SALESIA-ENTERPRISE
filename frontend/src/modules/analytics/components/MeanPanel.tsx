import { Link } from 'react-router-dom'
import { formatCurrency } from '@/utils/formatters'
import { mean } from '../services/statisticsService'
import MediaChart from '@/components/charts/MediaChart'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useLang } from '@/i18n/i18n'

/**
 * Panel de la media aritmética (Fase 09 · RF-11).
 * MeanChart del sistema de diseño: línea #1E3A8A (txt §6.2).
 */

interface MeanPanelProps {
  values: number[]
}

export default function MeanPanel({ values }: MeanPanelProps) {
  const { t } = useLang()

  if (values.length === 0) {
    return (
      <div className="card">
        <h3 className="text-h4 text-gray-800">{t('analytics.media-aritmetica')}</h3>
        <EmptyState
          title={t('analytics.sin-ventas-en-el-periodo')}
          description={t(
            'analytics.la-media-se-calcula-con-los-tickets-reales-registra-ventas-para-verla',
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

  const value = mean(values)

  return (
    <div className="card">
      <h3 className="text-h4 text-gray-800">{t('analytics.media-aritmetica')}</h3>
      <p className="mt-1 text-kpi font-bold text-primary">{formatCurrency(value)}</p>
      <p className="text-caption text-gray-500">
        {t('analytics.suma-de-n-tickets', { n: values.length })}{' '}
        {t('analytics.dividido-entre-n', { n: values.length })}
      </p>

      <div className="mt-4">
        <MediaChart values={values} />
      </div>
      <p className="mt-2 text-caption text-gray-500">
        {t('analytics.eje-de-datos')} <span className="text-gray-500">#6B7280</span> ·{' '}
        {t('analytics.media-marcada-en-azul-corporativo')}
      </p>
    </div>
  )
}
