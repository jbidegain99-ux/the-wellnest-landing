import { titleParts } from '@/lib/events/format'

/** Nombre del evento con la palabra más larga en cursiva y color de acento. */
export function EventTitle({ name, className = '', accentClass = 'text-[color:var(--ev-accent)]' }: { name: string; className?: string; accentClass?: string }) {
  const { before, accent, after } = titleParts(name)
  return (
    <h1 className={`ev-playfair m-0 font-normal ${className}`}>
      {before}<span className={`italic ${accentClass}`}>{accent}</span>{after}
    </h1>
  )
}
