const FLEUR_PATH =
  'M12 2c-1.5 2-2 4-1 6.5-.8-.9-2.2-1.3-3.5-.8-1.8.7-2.3 3-.8 4.3 1 .9 2.6.8 3.3-.2-.3 1.1-1.3 1.7-2.5 1.7h9c-1.2 0-2.2-.6-2.5-1.7.7 1 2.3 1.1 3.3.2 1.5-1.3 1-3.6-.8-4.3-1.3-.5-2.7-.1-3.5.8 1-2.5.5-4.5-1-6.5zM8 15.6h8v1.2H8zM11.2 16.8h1.6V22h-1.6z'

export function FleurDeLis({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path fill="currentColor" d={FLEUR_PATH} />
    </svg>
  )
}

/** Línea – flor de lis – línea, en carmesí. */
export function OrnamentDivider({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-[10px] text-[#8E1A24] ${className}`}>
      <div className="h-px flex-1 bg-[rgba(142,26,36,0.5)]" />
      <FleurDeLis />
      <div className="h-px flex-1 bg-[rgba(142,26,36,0.5)]" />
    </div>
  )
}
