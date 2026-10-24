interface ProgressRingProps {
  value: number
  target: number
  /** Unidad para el texto central y la etiqueta accesible. */
  unit?: string
  size?: number
}

/** Anillo de progreso hacia una meta (se llena hasta el 100 %, el número sigue subiendo). */
export function ProgressRing({ value, target, unit = 'min', size = 148 }: ProgressRingProps) {
  const stroke = 12
  const r = (size - stroke) / 2
  const cx = size / 2
  const cy = size / 2
  const ratio = target > 0 ? Math.min(Math.max(value / target, 0), 1) : 0
  const reached = value >= target && target > 0
  // Clases completas (no interpoladas) para que Tailwind las detecte.
  const strokeClass = reached ? 'stroke-primary-600' : 'stroke-primary'
  const fillClass = reached ? 'fill-primary-600' : 'fill-primary'

  // El arco es un <path> de la longitud exacta, con extremos "butt" más dos puntos
  // rellenos como extremos redondeados. Ni <circle> con dash ni strokeLinecap="round":
  // en Skia (Chrome escritorio y Android) ambos dejan líneas finas del centro hacia
  // los extremos del arco a este tamaño.
  const angle = ratio * 2 * Math.PI
  const endX = cx + r * Math.sin(angle)
  const endY = cy - r * Math.cos(angle)
  const arcPath = `M ${cx} ${cy - r} A ${r} ${r} 0 ${ratio > 0.5 ? 1 : 0} 1 ${endX} ${endY}`

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${value} de ${target} ${unit}`}
      className="shrink-0"
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        strokeWidth={stroke}
        className="stroke-beige-dark"
      />
      {ratio >= 1 ? (
        <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={stroke} className={strokeClass} />
      ) : (
        ratio > 0 && (
          <>
            <path d={arcPath} fill="none" strokeWidth={stroke} className={strokeClass} />
            <circle cx={cx} cy={cy - r} r={stroke / 2} className={fillClass} />
            <circle cx={endX} cy={endY} r={stroke / 2} className={fillClass} />
          </>
        )
      )}
      <text
        x="50%"
        y="47%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-foreground font-semibold"
        style={{ fontSize: size * 0.22 }}
      >
        {value}
      </text>
      <text
        x="50%"
        y="66%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-gray-500"
        style={{ fontSize: size * 0.09 }}
      >
        de {target} {unit}
      </text>
    </svg>
  )
}
