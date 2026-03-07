import { toZonedTime, fromZonedTime, format } from 'date-fns-tz'
import type { Locale } from 'date-fns'

export const TZ = 'America/El_Salvador'

/**
 * Convierte cualquier Date (UTC) a su equivalente en hora El Salvador.
 * Úsalo para MOSTRAR fechas/horas al usuario.
 */
export function toSVTime(date: Date): Date {
  return toZonedTime(date, TZ)
}

/**
 * Devuelve la fecha/hora actual en El Salvador.
 */
export function getNowInSV(): Date {
  return toZonedTime(new Date(), TZ)
}

/**
 * Formatea una fecha UTC como string legible en hora El Salvador.
 * @param date - Date en UTC (como viene de Prisma)
 * @param fmt  - Patrón de date-fns, ej: 'dd/MM/yyyy' o 'hh:mm a' o 'EEEE d de MMMM'
 * @param options - Opcional, para español usar { locale: es } de date-fns/locale
 */
export function formatInSV(date: Date, fmt: string, options?: { locale?: Locale }): string {
  return format(toZonedTime(date, TZ), fmt, { timeZone: TZ, ...options })
}

/**
 * Retorna el inicio del día actual en El Salvador, convertido a UTC.
 * Úsalo en filtros de Prisma (gte).
 */
export function getStartOfTodaySV(): Date {
  const now = toZonedTime(new Date(), TZ)
  return fromZonedTime(
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
    TZ
  )
}

/**
 * Retorna el fin del día actual en El Salvador, convertido a UTC.
 * Úsalo en filtros de Prisma (lte).
 */
export function getEndOfTodaySV(): Date {
  const now = toZonedTime(new Date(), TZ)
  return fromZonedTime(
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
    TZ
  )
}

/**
 * Retorna inicio de la semana actual (lunes) en El Salvador, convertido a UTC.
 */
export function getStartOfWeekSV(): Date {
  const now = toZonedTime(new Date(), TZ)
  const dayOfWeek = now.getDay() // 0=dom, 1=lun...
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToMonday, 0, 0, 0, 0)
  return fromZonedTime(monday, TZ)
}

/**
 * Retorna inicio del mes actual en El Salvador, convertido a UTC.
 */
export function getStartOfMonthSV(): Date {
  const now = toZonedTime(new Date(), TZ)
  return fromZonedTime(
    new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
    TZ
  )
}

/**
 * Convierte una hora local de El Salvador (HH:MM) y fecha a UTC Date.
 * Úsalo para crear clases con hora SV.
 */
export function svLocalToUTC(year: number, month: number, day: number, hour = 0, min = 0, sec = 0, ms = 0): Date {
  return fromZonedTime(new Date(year, month, day, hour, min, sec, ms), TZ)
}

/**
 * Formatea un Date UTC como hora El Salvador (HH:MM formato 24h).
 */
export function getTimeInSV(utcDate: Date): string {
  return formatInSV(utcDate, 'HH:mm')
}

/**
 * Formatea un Date UTC como hora El Salvador con AM/PM.
 */
export function getTimeInSV12h(utcDate: Date): string {
  return formatInSV(utcDate, 'hh:mm a')
}
