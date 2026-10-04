import { Select } from '@/components/ui/form'
import { useLang } from '@/i18n/i18n'
import type { BayesScenario, PeriodMonths, StatisticalDataset } from '@/data/analytics'

/**
 * Formulario de filtros de Probabilidad: elige el periodo, la variable
 * numérica y el escenario de Bayes que se analizan (sin escribir datos).
 */

const PERIOD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '3', label: 'probability.ultimos-3-meses' },
  { value: '6', label: 'probability.ultimos-6-meses' },
  { value: '12', label: 'probability.ultimos-12-meses' },
]

interface BayesFormProps {
  months: PeriodMonths
  datasetId: string
  scenarioId: string
  datasets: StatisticalDataset[]
  scenarios: BayesScenario[]
  onMonthsChange: (months: PeriodMonths) => void
  onDatasetChange: (datasetId: string) => void
  onScenarioChange: (scenarioId: string) => void
}

export default function BayesForm({
  months,
  datasetId,
  scenarioId,
  datasets,
  scenarios,
  onMonthsChange,
  onDatasetChange,
  onScenarioChange,
}: BayesFormProps) {
  const { t } = useLang()
  return (
    <div className="card flex flex-col gap-3 md:flex-row md:items-end">
      <Select
        label={t('probability.periodo-analizado')}
        value={String(months)}
        onChange={(event) => onMonthsChange(Number(event.target.value) as PeriodMonths)}
        className="md:w-52"
      >
        {PERIOD_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.label)}
          </option>
        ))}
      </Select>
      <Select
        label={t('probability.variable-numerica-a-analizar')}
        value={datasetId}
        onChange={(event) => onDatasetChange(event.target.value)}
        className="md:w-64"
      >
        {datasets.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {t(entry.label)}
          </option>
        ))}
      </Select>
      <Select
        label={t('probability.escenario-de-bayes')}
        value={scenarioId}
        onChange={(event) => onScenarioChange(event.target.value)}
        className="md:w-72"
      >
        {scenarios.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {t(entry.eventA, { seller: entry.seller ?? '—' })} → {t(entry.eventB)}
          </option>
        ))}
      </Select>
    </div>
  )
}
