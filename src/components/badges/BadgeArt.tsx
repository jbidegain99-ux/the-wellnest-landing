import { renderBadgeSvg } from '@/lib/progress/badges/art'
import type { BadgeState } from '@/lib/progress/badges/types'

interface BadgeArtProps {
  badge: BadgeState
  /** Por defecto: bloqueada si aún no se ganó. */
  locked?: boolean
  /** Avance 0–1 para el arco de las bloqueadas. */
  progress?: number
  size?: number
  className?: string
  /** Entrada con escala y destello (se desactiva con prefers-reduced-motion). */
  animate?: boolean
  /** Sufijo para los ids del SVG cuando la misma insignia aparece dos veces en la página (ej. `useId()`). */
  idSuffix?: string
}

/**
 * Medalla de un logro. El SVG lo genera `renderBadgeSvg` (contenido propio, sin datos de usuario).
 * Sin hooks: sirve en componentes de servidor y de cliente.
 */
export function BadgeArt({ badge, locked, progress, size = 96, className, animate = false, idSuffix }: BadgeArtProps) {
  const isLocked = locked ?? badge.earnedAt === null
  const svg = renderBadgeSvg(badge, { locked: isLocked, progress: isLocked ? progress : undefined, size, idSuffix })
  const classes = ['inline-block shrink-0 leading-none [&>svg]:block', animate ? 'badge-art-enter' : '', className ?? '']
    .filter(Boolean)
    .join(' ')

  return (
    <span
      role="img"
      aria-label={`${badge.title}, ${isLocked ? 'bloqueado' : 'ganado'}`}
      className={classes}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
