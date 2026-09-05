/**
 * Selección de fechas para crear clases desde el admin de horarios.
 *
 * Todo se maneja como string 'YYYY-MM-DD' en el calendario de El Salvador.
 * Nunca se usa `new Date(dateStr)` a secas: eso parsea como UTC medianoche y
 * en El Salvador (UTC-6) se corre al día anterior.
 */

/** Tope de clases que se pueden crear en una sola operación. */
export const MAX_DATES_PER_BATCH = 100

const DAY_NAMES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DAY_NAMES_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTH_NAMES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MONTH_NAMES_LONG = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** Construye 'YYYY-MM-DD' desde componentes (month es 0-indexado, como Date). */
export function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Parsea 'YYYY-MM-DD' como fecha local (mediodía, para inmunizar contra DST). */
function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

/** Suma (o resta) días a un 'YYYY-MM-DD'. */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const date = parseDateStr(dateStr)
  date.setDate(date.getDate() + days)
  return toDateStr(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Día de la semana (0=Dom .. 6=Sáb) de un 'YYYY-MM-DD'. */
export function getDayOfWeek(dateStr: string): number {
  return parseDateStr(dateStr).getDay()
}

/** Hoy en el calendario de El Salvador, como 'YYYY-MM-DD'. */
export function getTodaySV(): string {
  // en-CA da el formato YYYY-MM-DD directamente.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/El_Salvador',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/**
 * Expande un patrón semanal a fechas concretas.
 *
 * @param weekdays Días de la semana marcados (0=Dom .. 6=Sáb).
 * @param fromDateStr Primer día del rango, inclusivo.
 * @param toDateStr Último día del rango, inclusivo.
 */
export function expandWeekdayPattern(
  weekdays: number[],
  fromDateStr: string,
  toDateStr: string
): string[] {
  if (weekdays.length === 0) return []
  if (fromDateStr > toDateStr) return []

  const wanted = new Set(weekdays)
  const dates: string[] = []
  let cursor = fromDateStr

  while (cursor <= toDateStr && dates.length < MAX_DATES_PER_BATCH) {
    if (wanted.has(getDayOfWeek(cursor))) {
      dates.push(cursor)
    }
    cursor = addDaysToDateStr(cursor, 1)
  }

  return dates
}

/**
 * Fusiona las fechas del patrón con las elegidas a mano: dedupe, orden
 * cronológico y descarte de fechas ya pasadas.
 */
export function mergeDateSelection(
  patternDates: string[],
  explicitDates: string[],
  todayStr: string = getTodaySV()
): string[] {
  const all = new Set([...patternDates, ...explicitDates])
  return Array.from(all)
    .filter((d) => d >= todayStr)
    .sort()
}

/** "Lun 7 Sep" */
export function formatDateShort(dateStr: string): string {
  const date = parseDateStr(dateStr)
  return `${DAY_NAMES_SHORT[date.getDay()]} ${date.getDate()} ${MONTH_NAMES_SHORT[date.getMonth()]}`
}

/** "Lunes 7 de septiembre" */
export function formatDateLong(dateStr: string): string {
  const date = parseDateStr(dateStr)
  return `${DAY_NAMES_LONG[date.getDay()]} ${date.getDate()} de ${MONTH_NAMES_LONG[date.getMonth()]}`
}

export { DAY_NAMES_SHORT, DAY_NAMES_LONG, MONTH_NAMES_LONG }
