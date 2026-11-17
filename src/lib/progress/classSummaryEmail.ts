// Correo "Tu resumen de …" que se envía después de cada clase asistida.
// HTML de tablas con estilos en línea, igual que los demás de emailService.ts.
// Sin calorías: en la web son opt-in y aquí nunca se muestran.

import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import { escapeHtml } from '@/lib/emailService'
import type { BadgeState } from './badges/types'
import type { Intensity } from './profiles'
import { TZ } from './time'

export interface ClassSummaryEmailClass {
  disciplineName: string
  classType: string | null
  /** ISO de inicio de la clase. */
  startsAt: string
  minutes: number
  intensity: Intensity
  focus: string[]
  /** Clase de calma (terapia de sonido): no suma minutos de actividad. */
  calm: boolean
}

export interface ClassSummaryEmailData {
  firstName: string
  /** Más reciente primero. */
  classes: ClassSummaryEmailClass[]
  week: { activeMinutes: number; targetMinutes: number }
  streakWeeks: number
  newBadges: { title: string; imageUrl: string | null }[]
  nextBadge: { title: string; current: number; target: number; imageUrl: string | null } | null
  progressUrl: string
  unsubscribeUrl: string
}

/** Logros ganados en `after` que no estaban ganados en `before`. */
export function newBadgesFrom(before: BadgeState[], after: BadgeState[]): BadgeState[] {
  const earnedBefore = new Set(before.filter((b) => b.earnedAt !== null).map((b) => b.id))
  return after.filter((b) => b.earnedAt !== null && !earnedBefore.has(b.id))
}

const COLORS = {
  page: '#F5F0EB',
  card: '#FFFFFF',
  title: '#1F2937',
  text: '#374151',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  panel: '#F9FAFB',
  green: '#86A889',
  greenDark: '#5A6E4E',
  greenSoft: '#F0F5F1',
  greenBorder: '#D4E5D7',
  track: '#E5E7EB',
}

/** Logros nuevos que se dibujan; el resto se resume en una línea. */
const MAX_BADGES_SHOWN = 6
const BADGES_PER_ROW = 3
const NEW_BADGE_PX = 88
const NEXT_BADGE_PX = 64

/** "sáb 24 oct · 9:00 a. m." en la hora de El Salvador. */
export function formatClassTime(iso: string): string {
  const d = new Date(iso)
  const day = formatInTimeZone(d, TZ, 'EEE d MMM', { locale: es })
  const [h, m] = formatInTimeZone(d, TZ, 'H:mm').split(':')
  const hour = Number(h)
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${day} · ${h12}:${m} ${hour < 12 ? 'a. m.' : 'p. m.'}`
}

function classTypeLabel(classType: string | null): string {
  if (!classType || classType === 'regular') return ''
  if (classType === 'test') return 'Clase de prueba'
  return classType
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function percent(current: number, target: number): number {
  if (target <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)))
}

/** Barra de avance en tablas (funciona en Outlook y Gmail). */
function bar(pct: number): string {
  const cells =
    pct <= 0
      ? `<td style="background-color: ${COLORS.track}; height: 8px; line-height: 8px; font-size: 0; border-radius: 4px;">&nbsp;</td>`
      : pct >= 100
        ? `<td style="background-color: ${COLORS.green}; height: 8px; line-height: 8px; font-size: 0; border-radius: 4px;">&nbsp;</td>`
        : `<td width="${pct}%" style="background-color: ${COLORS.green}; height: 8px; line-height: 8px; font-size: 0; border-radius: 4px 0 0 4px;">&nbsp;</td>` +
          `<td width="${100 - pct}%" style="background-color: ${COLORS.track}; height: 8px; line-height: 8px; font-size: 0; border-radius: 0 4px 4px 0;">&nbsp;</td>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 8px 0 0;"><tr>${cells}</tr></table>`
}

function badgeImg(url: string, title: string, px: number): string {
  return `<img src="${escapeHtml(url)}" width="${px}" height="${px}" alt="${escapeHtml(title)}" style="display: block; border: 0; outline: none; margin: 0 auto; width: ${px}px; height: ${px}px;">`
}

function mainClassCard(c: ClassSummaryEmailClass): string {
  const type = classTypeLabel(c.classType)
  const chips = [`${c.minutes} min`, c.calm ? 'Clase de calma' : c.intensity]
  const contribution = c.calm
    ? `Clase de calma: ${c.minutes} min para bajar el ritmo y respirar.`
    : `+${c.minutes} min activos a tu semana`
  return `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td style="background-color: ${COLORS.panel}; border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 20px;">
                    <p style="margin: 0 0 6px; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: ${COLORS.greenDark}; font-weight: 600;">Tu clase</p>
                    <p style="margin: 0; font-size: 18px; font-weight: 600; color: ${COLORS.title}; line-height: 1.3;">${escapeHtml(c.disciplineName)}</p>
                    ${type ? `<p style="margin: 2px 0 0; font-size: 14px; color: ${COLORS.muted}; line-height: 1.4;">${escapeHtml(type)}</p>` : ''}
                    <p style="margin: 8px 0 0; font-size: 13px; color: ${COLORS.muted}; line-height: 1.4;">${escapeHtml(formatClassTime(c.startsAt))}</p>
                    <p style="margin: 12px 0 0; font-size: 13px; color: ${COLORS.text}; line-height: 1.6;">
                      ${chips
                        .map(
                          (chip) =>
                            `<span style="display: inline-block; background-color: ${COLORS.card}; border: 1px solid ${COLORS.border}; border-radius: 999px; padding: 2px 10px; margin: 0 4px 4px 0;">${escapeHtml(chip)}</span>`
                        )
                        .join('')}
                    </p>
                    ${
                      c.focus.length > 0
                        ? `<p style="margin: 4px 0 0; font-size: 13px; color: ${COLORS.muted}; line-height: 1.5;"><strong style="color: ${COLORS.text}; font-weight: 600;">Foco:</strong> ${c.focus.map(escapeHtml).join(' · ')}</p>`
                        : ''
                    }
                    <p style="margin: 12px 0 0; font-size: 14px; color: ${COLORS.greenDark}; font-weight: 600; line-height: 1.4;">${escapeHtml(contribution)}</p>
                  </td>
                </tr>
              </table>`
}

function otherClasses(classes: ClassSummaryEmailClass[]): string {
  if (classes.length === 0) return ''
  const rows = classes
    .map(
      (c) => `
                <tr>
                  <td style="padding: 6px 0; border-top: 1px solid ${COLORS.border};">
                    <p style="margin: 0; font-size: 14px; color: ${COLORS.text}; line-height: 1.4;"><strong style="font-weight: 600;">${escapeHtml(c.disciplineName)}</strong>${
                      c.calm ? ' · Clase de calma' : ''
                    }</p>
                    <p style="margin: 2px 0 0; font-size: 13px; color: ${COLORS.muted}; line-height: 1.4;">${escapeHtml(formatClassTime(c.startsAt))} · ${c.minutes} min</p>
                  </td>
                </tr>`
    )
    .join('')
  return `
              <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: ${COLORS.text};">También sumaste</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">${rows}
              </table>`
}

function weekSection(week: ClassSummaryEmailData['week'], streakWeeks: number): string {
  const reached = week.activeMinutes >= week.targetMinutes
  const note = reached
    ? '¡Llegaste a la referencia de la semana!'
    : `La OMS recomienda ${week.targetMinutes} min de actividad a la semana.`
  const streak =
    streakWeeks >= 2
      ? `Racha: <strong style="color: ${COLORS.text}; font-weight: 600;">${plural(streakWeeks, 'semana seguida', 'semanas seguidas')}</strong> con clase`
      : 'Esta semana ya cuenta para tu racha.'
  return `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td style="background-color: ${COLORS.greenSoft}; border: 1px solid ${COLORS.greenBorder}; border-radius: 8px; padding: 16px 20px;">
                    <p style="margin: 0; font-size: 14px; color: ${COLORS.text}; line-height: 1.4;">Tu semana: <strong style="font-weight: 600;">${week.activeMinutes} de ${week.targetMinutes} min</strong></p>
                    ${bar(percent(week.activeMinutes, week.targetMinutes))}
                    <p style="margin: 8px 0 0; font-size: 13px; color: ${COLORS.muted}; line-height: 1.5;">${note}</p>
                    <p style="margin: 8px 0 0; font-size: 13px; color: ${COLORS.muted}; line-height: 1.5;">${streak}</p>
                  </td>
                </tr>
              </table>`
}

function newBadgesSection(badges: ClassSummaryEmailData['newBadges']): string {
  const shown = badges.slice(0, MAX_BADGES_SHOWN)
  const heading = badges.length === 1 ? '¡Ganaste un logro!' : `¡Ganaste ${badges.length} logros!`
  const rows: string[] = []
  for (let i = 0; i < shown.length; i += BADGES_PER_ROW) {
    const cells = shown
      .slice(i, i + BADGES_PER_ROW)
      .map(
        (b) => `
                  <td align="center" valign="top" width="${Math.floor(100 / BADGES_PER_ROW)}%" style="padding: 8px 4px;">
                    ${b.imageUrl ? badgeImg(b.imageUrl, b.title, NEW_BADGE_PX) : ''}
                    <p style="margin: 8px 0 0; font-size: 13px; font-weight: 600; color: ${COLORS.text}; line-height: 1.3;">${escapeHtml(b.title)}</p>
                  </td>`
      )
      .join('')
    rows.push(`<tr>${cells}
                </tr>`)
  }
  const more =
    badges.length > shown.length
      ? `<p style="margin: 4px 0 0; font-size: 13px; color: ${COLORS.muted}; text-align: center;">y ${badges.length - shown.length} más en Mi progreso</p>`
      : ''
  return `
              <p style="margin: 0 0 4px; font-size: 16px; font-weight: 600; color: ${COLORS.title}; text-align: center;">${heading}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 8px;">
                ${rows.join('\n                ')}
              </table>
              ${more}`
}

function nextBadgeSection(next: NonNullable<ClassSummaryEmailData['nextBadge']>): string {
  const image = next.imageUrl
    ? `<td width="${NEXT_BADGE_PX + 16}" valign="middle" style="padding-right: 16px;">${badgeImg(next.imageUrl, next.title, NEXT_BADGE_PX)}</td>`
    : ''
  return `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 8px;">
                <tr>
                  <td style="border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 16px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        ${image}
                        <td valign="middle">
                          <p style="margin: 0; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: ${COLORS.greenDark}; font-weight: 600;">Tu próximo logro</p>
                          <p style="margin: 4px 0 0; font-size: 15px; font-weight: 600; color: ${COLORS.title}; line-height: 1.3;">${escapeHtml(next.title)}</p>
                          <p style="margin: 4px 0 0; font-size: 13px; color: ${COLORS.muted}; line-height: 1.4;">Llevas ${next.current} de ${next.target}</p>
                          ${bar(percent(next.current, next.target))}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`
}

export function buildClassSummaryEmail(data: ClassSummaryEmailData): { subject: string; html: string } {
  const [latest, ...others] = data.classes
  const subject = latest ? `Tu resumen de ${latest.disciplineName}` : 'Tu resumen de clase'
  const name = data.firstName.trim()
  const greeting = name ? `¡Hola, ${escapeHtml(name)}!` : '¡Hola!'
  const intro =
    data.classes.length > 1
      ? 'Gracias por venir. Esto es lo que sumaste con tus clases:'
      : 'Gracias por venir. Esto es lo que sumaste con tu clase:'
  const preheader = latest
    ? latest.calm
      ? 'Tu clase de calma quedó registrada.'
      : `Sumaste ${latest.minutes} min a tu semana.`
    : 'Tu progreso en Wellnest.'
  const year = latest ? formatInTimeZone(new Date(latest.startsAt), TZ, 'yyyy') : formatInTimeZone(new Date(), TZ, 'yyyy')

  const badges =
    data.newBadges.length > 0
      ? newBadgesSection(data.newBadges)
      : data.nextBadge
        ? nextBadgeSection(data.nextBadge)
        : ''

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)} - Wellnest</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${COLORS.page}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', system-ui, sans-serif;">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${COLORS.page};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width: 480px; width: 100%; background-color: ${COLORS.card}; border-radius: 12px;">
          <tr>
            <td style="padding: 32px;">

              <h1 style="color: ${COLORS.title}; margin: 0 0 8px; font-size: 20px; font-weight: 600; line-height: 1.2; text-align: center;">Tu resumen de clase</h1>
              <p style="color: ${COLORS.muted}; margin: 0 0 32px; font-size: 16px; line-height: 1.5; text-align: center;">Wellnest</p>

              <p style="color: ${COLORS.text}; font-size: 16px; font-weight: 500; margin: 0 0 8px; line-height: 1.4;">${greeting}</p>
              <p style="color: ${COLORS.muted}; margin: 0 0 24px; font-size: 14px; line-height: 1.5;">${intro}</p>
${latest ? mainClassCard(latest) : ''}
${otherClasses(others)}
${weekSection(data.week, data.streakWeeks)}
${badges}

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color: ${COLORS.green}; border-radius: 8px;">
                          <a href="${escapeHtml(data.progressUrl)}"
                             target="_blank"
                             style="display: inline-block; background-color: ${COLORS.green}; color: #FFFFFF; padding: 12px 32px; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 8px; line-height: 1.4;">
                            Ver mi progreso
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px;">
                <tr>
                  <td style="border-top: 1px solid ${COLORS.border}; padding-top: 16px; text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 12px; color: ${COLORS.faint}; line-height: 1.5;">
                      Recibes este resumen porque asististe a una clase en Wellnest.<br>
                      <a href="${escapeHtml(data.unsubscribeUrl)}" target="_blank" style="color: ${COLORS.muted}; text-decoration: underline;">Ya no quiero estos resúmenes</a>
                    </p>
                    <p style="margin: 0; font-size: 12px; color: ${COLORS.faint};">
                      Wellnest &copy; ${year} &bull; contact@wellneststudio.net
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, html }
}
