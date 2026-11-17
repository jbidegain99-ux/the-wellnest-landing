import { AXES, AXIS_LABELS, type Axis } from '@/lib/progress/profiles'

interface MixRadarProps {
  /** Valores 0–1 por eje (el eje mayor vale 1). */
  mix: Record<Axis, number>
}

const W = 340
const H = 280
const CX = W / 2
const CY = H / 2
const R = 92
const LABEL_R = R + 14
const RINGS = [0.25, 0.5, 0.75, 1]

/** Ángulo de cada eje: el primero arriba y en sentido horario. */
function angle(i: number): number {
  return -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length
}

function point(i: number, radius: number): [number, number] {
  const a = angle(i)
  return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)]
}

function polygon(radii: number[]): string {
  return radii
    .map((rad, i) => point(i, rad))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')
}

/** Radar hexagonal de la mezcla de práctica (SVG propio, sin librerías). */
export function MixRadar({ mix }: MixRadarProps) {
  const description = AXES.map((a) => `${AXIS_LABELS[a]} ${Math.round(mix[a] * 100)} %`).join(', ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Mezcla de los últimos 30 días, relativa al eje más trabajado: ${description}`}
      className="w-full max-w-[340px] h-auto mx-auto"
    >
      {RINGS.map((ring) => (
        <polygon
          key={ring}
          points={polygon(AXES.map(() => R * ring))}
          fill="none"
          className="stroke-beige-dark"
          strokeWidth={1}
        />
      ))}
      {AXES.map((a, i) => {
        const [x, y] = point(i, R)
        return <line key={a} x1={CX} y1={CY} x2={x} y2={y} className="stroke-beige-dark" strokeWidth={1} />
      })}
      <polygon
        points={polygon(AXES.map((a) => R * Math.min(Math.max(mix[a], 0), 1)))}
        className="fill-primary stroke-primary-600"
        fillOpacity={0.35}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {AXES.map((a, i) => {
        const [x, y] = point(i, R * Math.min(Math.max(mix[a], 0), 1))
        return <circle key={a} cx={x} cy={y} r={3} className="fill-primary-600" />
      })}
      {AXES.map((a, i) => {
        const [x, y] = point(i, LABEL_R)
        const cos = Math.cos(angle(i))
        const sin = Math.sin(angle(i))
        const anchor = cos > 0.1 ? 'start' : cos < -0.1 ? 'end' : 'middle'
        // Arriba la etiqueta sube; abajo baja, para no pisar el polígono.
        const dy = sin < -0.9 ? -4 : sin > 0.9 ? 12 : 4
        return (
          <text
            key={a}
            x={x}
            y={y + dy}
            textAnchor={anchor}
            className="fill-foreground"
            style={{ fontSize: 13 }}
          >
            {AXIS_LABELS[a]}
          </text>
        )
      })}
    </svg>
  )
}
