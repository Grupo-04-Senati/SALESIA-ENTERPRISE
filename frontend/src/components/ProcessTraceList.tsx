import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import ProcessTraceCard from '@/components/ProcessTraceCard'
import { getTraces } from '@/data/store'
import { useDataVersion } from '@/data/DataProvider'

/**
 * Historial de procesos ejecutados (trazabilidad de la sesión).
 * Cada operación de datos queda registrada con sus pasos, para que se vea
 * cómo se conectan los módulos entre sí.
 */

interface ProcessTraceListProps {
  /** Cantidad de procesos a mostrar. */
  limit?: number
  title?: string
}

export default function ProcessTraceList({ limit = 3, title = 'Procesos recientes' }: ProcessTraceListProps) {
  const version = useDataVersion()
  const [traces, setTraces] = useState(() => getTraces().slice(0, limit))

  useEffect(() => {
    setTraces(getTraces().slice(0, limit))
  }, [version, limit])

  if (traces.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <History aria-hidden="true" className="h-5 w-5 text-primary" />
        <h2 className="text-h3 text-gray-800">{title}</h2>
      </div>
      <div className="space-y-3">
        {traces.map((trace) => (
          <ProcessTraceCard key={trace.id} trace={trace} />
        ))}
      </div>
    </section>
  )
}
