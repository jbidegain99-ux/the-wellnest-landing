interface MiniProgressRingProps {
  /** Avance 0–1 (se recorta a ese rango). */
  ratio: number
  size: number
  stroke?: number
  /** Color de la pista y del arco (hex o `var(--…)`). */
  trackColor?: string
  arcColor?: string
  className?: string
}

/**
 * Anillo fino sin texto (Navbar y franja de la home). Decorativo: el texto
 * accesible lo pone quien lo usa.
 *
 * Como `ProgressRing`, el arco es un <path> con extremos "butt" más dos puntos
 * como extremos redondeados: en Skia, <circle> con dash o `strokeLinecap="round"`
 * dejan líneas finas hacia el centro.
 */
export function MiniProgressRing({
  ratio,
  size,
  stroke = 2.5,
  trackColor = 'var(--color-beige-dark)',
  arcColor = 'var(--color-primary)',
  className,
}: MiniProgressRingProps) {
  const r = (size - stroke) / 2
  const c = size / 2
  const value = Number.isFinite(ratio) ? Math.min(Math.max(ratio, 0), 1) : 0
  const angle = value * 2 * Math.PI
  const endX = c + r * Math.sin(angle)
  const endY = c - r * Math.cos(angle)
  const arcPath = `M ${c} ${c - r} A ${r} ${r} 0 ${value > 0.5 ? 1 : 0} 1 ${endX} ${endY}`

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <circle cx={c} cy={c} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
      {value >= 1 ? (
        <circle cx={c} cy={c} r={r} fill="none" stroke={arcColor} strokeWidth={stroke} />
      ) : (
        value > 0 && (
          <>
            <path d={arcPath} fill="none" stroke={arcColor} strokeWidth={stroke} />
            <circle cx={c} cy={c - r} r={stroke / 2} fill={arcColor} />
            <circle cx={endX} cy={endY} r={stroke / 2} fill={arcColor} />
          </>
        )
      )}
    </svg>
  )
}
