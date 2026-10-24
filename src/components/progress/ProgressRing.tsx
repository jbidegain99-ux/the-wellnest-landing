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
  const c = 2 * Math.PI * r
  const ratio = target > 0 ? Math.min(Math.max(value / target, 0), 1) : 0
  const reached = value >= target && target > 0

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
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        className="stroke-beige-dark"
      />
      {ratio > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={
            (reached ? 'stroke-primary-600' : 'stroke-primary') +
            ' transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none'
          }
        />
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
