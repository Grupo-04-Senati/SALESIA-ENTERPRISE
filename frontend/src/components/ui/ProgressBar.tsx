import { cn } from '@/utils/cn'

/**
 * Barra de progreso delgada (txt §5.5): franja cyan `#06B6D4`
 * bajo el topbar durante las cargas. Estado indeterminado.
 */
export default function ProgressBar({ active, className }: { active: boolean; className?: string }) {
  return (
    <div
      aria-hidden={!active}
      className={cn(
        'absolute inset-x-0 bottom-0 h-0.5 overflow-hidden transition-opacity duration-200',
        active ? 'opacity-100' : 'opacity-0',
        className,
      )}
    >
      <div className="h-full w-1/3 animate-progress rounded-full bg-accent" />
    </div>
  )
}
