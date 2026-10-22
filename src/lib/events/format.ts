import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'

export const EVENT_TZ = 'America/El_Salvador'

/** "Viernes 30 de octubre · 6:30 p. m." en hora de El Salvador. */
export function eventDateSentence(startsAt: Date): string {
  const day = formatInTimeZone(startsAt, EVENT_TZ, "EEEE d 'de' MMMM", { locale: es })
  const time = formatInTimeZone(startsAt, EVENT_TZ, 'h:mm aaaa', { locale: es })
    .replace(/\s*(a|p)\.?\s*m\.?$/i, (_m, ap: string) => ` ${ap.toLowerCase()}. m.`)
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${time}`
}

/** "VIERNES 30 DE OCTUBRE · 6:30 P. M." (estilo invitación). */
export function eventDateLine(startsAt: Date): string {
  return eventDateSentence(startsAt).toUpperCase()
}

export function eventHref(e: { slug: string; pagePath: string | null }): string {
  return e.pagePath ?? `/eventos/${e.slug}`
}

export function partitionEvents<T extends { startsAt: Date; endsAt: Date }>(events: T[], now: Date): { upcoming: T[]; past: T[] } {
  const upcoming = events.filter((e) => e.endsAt.getTime() > now.getTime()).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  const past = events.filter((e) => e.endsAt.getTime() <= now.getTime()).sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
  return { upcoming, past }
}

export type EventTheme = 'villains' | 'wellnest'

export function eventTheme(theme: string): EventTheme {
  return theme === 'villains' ? 'villains' : 'wellnest'
}
