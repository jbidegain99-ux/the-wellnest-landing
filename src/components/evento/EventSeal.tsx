import { eventTheme } from '@/lib/events/format'
import { WaxSeal } from './WaxSeal'

/** Sello sobre la tarjeta: lacre (noir) o un monograma (Wellnest). */
export function EventSeal({ theme, broken = false, className = '' }: { theme: string; broken?: boolean; className?: string }) {
  if (eventTheme(theme) === 'villains') return <WaxSeal broken={broken} className={className} />
  return (
    <div
      role="img"
      aria-label="Wellnest"
      className={`flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-[color:var(--ev-card)] bg-[color:var(--ev-accent)] text-[30px] font-semibold text-[color:var(--ev-on-accent)] shadow-md ${className}`}
    >
      W
    </div>
  )
}
