// Textos del vistazo al progreso (franja de la home y Navbar). Puros, sin React.
// Solo importa tipos: se usa en componentes de cliente.

import type { GlanceBadge, ProgressGlance } from './glance'
import type { BadgeState } from './badges/types'

function weekText(g: ProgressGlance): string {
  return `${g.week.activeMinutes} de ${g.week.targetMinutes} min esta semana`
}

/** "105 de 150 min esta semana", "Racha de 9 semanas", "Próximo logro: 50 clases (faltan 8)". */
export function glanceStripParts(g: ProgressGlance): string[] {
  const parts = [weekText(g)]
  if (g.streakWeeks > 0) {
    parts.push(`Racha de ${g.streakWeeks} ${g.streakWeeks === 1 ? 'semana' : 'semanas'}`)
  }
  if (g.nextBadge) {
    const left = Math.max(0, g.nextBadge.target - g.nextBadge.current)
    parts.push(`Próximo logro: ${g.nextBadge.title} (${left === 1 ? 'falta 1' : `faltan ${left}`})`)
  }
  return parts
}

/** Texto para lectores de pantalla del anillo del Navbar. */
export function navbarProgressLabel(g: ProgressGlance, unseenCount: number): string {
  if (unseenCount <= 0) return weekText(g)
  return `${weekText(g)}. Tienes ${unseenCount} ${unseenCount === 1 ? 'logro nuevo' : 'logros nuevos'}`
}

/** Un logro del vistazo como `BadgeState` ganado, para dibujarlo con `BadgeArt`. */
export function glanceBadgeState(b: GlanceBadge): BadgeState {
  return { ...b, target: 1, current: 1 }
}
