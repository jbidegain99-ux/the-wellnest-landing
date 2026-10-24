// Cron del resumen de clase: un correo por usuaria con las clases que
// terminaron en las últimas 24 horas y que aún no tienen correo.
//
// Para no duplicar, cada reserva se reclama insertando en ProgressEmailLog
// (único por reservationId, skipDuplicates) con ids generados aquí; solo se
// envían las reservas cuyos ids volvemos a leer. Si el envío falla se borran
// esos reclamos y la próxima corrida lo reintenta.
//
// Un error con una usuaria (base o envío) se registra, cuenta como fallo y
// libera sus reclamos; el resto sigue. Entre envíos se espera SEND_GAP_MS y,
// pasado TIME_BUDGET_MS, no se empieza ninguna usuaria más: como no se
// reclamaron, la próxima corrida las toma (la ventana es de 24 h).

import { randomUUID } from 'crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import type { sendEmail } from '@/lib/emailService'
import { evaluateBadges, nextBadges } from './badges/evaluate'
import { badgePngPath } from './badges/art'
import { withChallengeYear } from './badges/display'
import { buildClassSummaryEmail, newBadgesFrom, type ClassSummaryEmailData } from './classSummaryEmail'
import { unsubscribeUrl } from './emailOptOut'
import { getDisciplineProfile, isActiveMet } from './profiles'
import { buildProgressSummary, type AttendedClass } from './summary'
import { localParts } from './time'

const HOUR_MS = 3600 * 1000
/** Ventana: clases que terminaron en (now − 24 h, now]. */
const WINDOW_MS = 24 * HOUR_MS
/** Margen para buscar por inicio: ninguna clase dura más que esto. */
const MAX_CLASS_MS = 12 * HOUR_MS
/** Pausa entre un envío y el siguiente, para no saturar Microsoft Graph. */
export const SEND_GAP_MS = 2000
/** Tiempo tras el cual no se empieza otra usuaria (la función tiene maxDuration 300 s). */
export const TIME_BUDGET_MS = 240 * 1000

export const RESERVATION_SELECT = {
  id: true,
  userId: true,
  class: {
    select: {
      id: true,
      dateTime: true,
      duration: true,
      classType: true,
      discipline: { select: { slug: true, name: true } },
    },
  },
  user: { select: { name: true, email: true } },
} as const satisfies Prisma.ReservationSelect

export type ReservationRow = Prisma.ReservationGetPayload<{ select: typeof RESERVATION_SELECT }>

export interface ReservationQuery {
  where: {
    status: 'ATTENDED'
    isGuestReservation: false
    userId?: { in: string[] }
    class?: { dateTime: { gt: Date; lte: Date } }
  }
  select: typeof RESERVATION_SELECT
}

export interface LogQuery {
  where: { id: { in: string[] } } | { reservationId: { in: string[] } }
  select: { id: true; reservationId: true }
}

/** Lo mínimo de Prisma que usa el job (en producción, `classSummaryDbFrom(prisma)`; en tests, una base en memoria). */
export interface ClassSummaryDb {
  reservation: {
    findMany(args: ReservationQuery): Promise<ReservationRow[]>
  }
  progressEmailOptOut: {
    findMany(args: { where: { userId: { in: string[] } }; select: { userId: true } }): Promise<{ userId: string }[]>
  }
  progressEmailLog: {
    findMany(args: LogQuery): Promise<{ id: string; reservationId: string }[]>
    createMany(args: {
      data: { id: string; reservationId: string; userId: string }[]
      skipDuplicates: true
    }): Promise<{ count: number }>
    deleteMany(args: { where: { id: { in: string[] } } }): Promise<{ count: number }>
  }
}

/**
 * Adapta PrismaClient a ClassSummaryDb. Los métodos de Prisma son genéricos y
 * TypeScript no los asigna directo a firmas concretas; llamándolos aquí con
 * argumentos concretos sí infiere el tipo del resultado.
 */
export function classSummaryDbFrom(client: PrismaClient): ClassSummaryDb {
  return {
    reservation: { findMany: ({ where, select }) => client.reservation.findMany({ where, select }) },
    progressEmailOptOut: { findMany: (args) => client.progressEmailOptOut.findMany(args) },
    progressEmailLog: {
      findMany: (args) => client.progressEmailLog.findMany(args),
      createMany: (args) => client.progressEmailLog.createMany(args),
      deleteMany: (args) => client.progressEmailLog.deleteMany(args),
    },
  }
}

export type SendFn = typeof sendEmail

export interface ClassSummaryJobDeps {
  db: ClassSummaryDb
  send: SendFn
  now: Date
  /** Origen del sitio sin barra final, p. ej. https://wellneststudio.net */
  baseUrl: string
  /** NEXTAUTH_SECRET, para firmar el enlace de baja. */
  secret: string
  /** Espera entre envíos (por defecto setTimeout; en tests, una que no espera). */
  sleep?: (ms: number) => Promise<void>
  /** Reloj en ms para el presupuesto de tiempo (por defecto Date.now). */
  clock?: () => number
}

export interface ClassSummaryJobResult {
  /** Usuarias con al menos una clase pendiente de resumen. */
  users: number
  sent: number
  failed: number
  /** Usuarias que quedaron para la próxima corrida por el presupuesto de tiempo. */
  deferred: number
}

function endsAt(row: ReservationRow): number {
  return row.class.dateTime.getTime() + Math.max(0, row.class.duration) * 60 * 1000
}

function endOfAttended(c: AttendedClass): number {
  return c.dateTime.getTime() + Math.max(0, c.durationMin) * 60 * 1000
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

function toAttended(row: ReservationRow): AttendedClass {
  return {
    classId: row.class.id,
    dateTime: row.class.dateTime,
    durationMin: row.class.duration,
    disciplineSlug: row.class.discipline.slug,
    disciplineName: row.class.discipline.name,
    classType: row.class.classType,
  }
}

function firstNameOf(name: string | null): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? ''
}

/**
 * Datos del correo: clases reclamadas (más reciente primero) y logros ganados con ellas.
 * Semana, racha y logros se calculan al momento en que terminó la última clase del
 * correo (no a la hora de la corrida): una clase del domingo enviada el lunes habla
 * de su semana, y una clase aún en curso no se cuela en los minutos.
 */
export function buildEmailData(
  claimed: ReservationRow[],
  history: AttendedClass[],
  deps: Pick<ClassSummaryJobDeps, 'baseUrl' | 'secret'>
): ClassSummaryEmailData {
  const { baseUrl, secret } = deps
  const userId = claimed[0].userId
  const emailClassIds = new Set(claimed.map((r) => r.class.id))
  const asOfMs = Math.max(...claimed.map(endsAt))
  const asOf = new Date(asOfMs)
  // La historia incluye las clases del correo; por si la consulta llegó sin ellas, se agregan.
  const all = history.filter((c) => endOfAttended(c) <= asOfMs)
  for (const r of claimed) {
    if (!all.some((c) => c.classId === r.class.id)) all.push(toAttended(r))
  }
  const before = all.filter((c) => !emailClassIds.has(c.classId))

  const year = localParts(asOf).year
  const after = evaluateBadges(all, asOf)
  const earned = newBadgesFrom(evaluateBadges(before, asOf), after).map((b) => withChallengeYear(b, year))
  const imageUrl = (b: Parameters<typeof badgePngPath>[0]): string | null => {
    const path = badgePngPath(b)
    return path ? `${baseUrl}${path}` : null
  }
  const next = earned.length === 0 ? (nextBadges(after, 1)[0] ?? null) : null

  const summary = buildProgressSummary(all, asOf)
  const classes = [...claimed]
    .sort((a, b) => b.class.dateTime.getTime() - a.class.dateTime.getTime())
    .map((r) => {
      const profile = getDisciplineProfile(r.class.discipline.slug, r.class.classType)
      return {
        disciplineName: r.class.discipline.name,
        classType: r.class.classType,
        startsAt: r.class.dateTime.toISOString(),
        minutes: Math.max(0, r.class.duration),
        intensity: profile.intensity,
        focus: profile.focus,
        calm: !isActiveMet(profile.met),
      }
    })

  return {
    firstName: firstNameOf(claimed[0].user.name),
    classes,
    week: { activeMinutes: summary.week.activeMinutes, targetMinutes: summary.week.targetMinutes },
    streakWeeks: summary.streak.weeks,
    newBadges: earned.map((b) => ({ title: b.title, imageUrl: imageUrl(b) })),
    nextBadge: next
      ? {
          title: withChallengeYear(next, year).title,
          current: next.current,
          target: next.target,
          imageUrl: imageUrl(next),
        }
      : null,
    progressUrl: `${baseUrl}/perfil/progreso`,
    unsubscribeUrl: unsubscribeUrl(baseUrl, userId, secret),
  }
}

export async function runClassSummaryJob(deps: ClassSummaryJobDeps): Promise<ClassSummaryJobResult> {
  const { db, send, now } = deps
  const sleep = deps.sleep ?? defaultSleep
  const clock = deps.clock ?? Date.now
  const startedAt = clock()
  const nowMs = now.getTime()
  const windowStart = nowMs - WINDOW_MS

  // 1. Reservas asistidas cuya clase terminó en (now − 24 h, now]
  const recent = await db.reservation.findMany({
    where: {
      status: 'ATTENDED',
      isGuestReservation: false,
      class: { dateTime: { gt: new Date(windowStart - MAX_CLASS_MS), lte: now } },
    },
    select: RESERVATION_SELECT,
  })
  let candidates = recent.filter((r) => {
    const end = endsAt(r)
    return end > windowStart && end <= nowMs
  })
  if (candidates.length === 0) return { users: 0, sent: 0, failed: 0, deferred: 0 }

  // 2. Sin correo previo y de usuarias sin baja
  const logged = await db.progressEmailLog.findMany({
    where: { reservationId: { in: candidates.map((r) => r.id) } },
    select: { id: true, reservationId: true },
  })
  const loggedIds = new Set(logged.map((l) => l.reservationId))
  const candidateUsers = Array.from(new Set(candidates.map((r) => r.userId)))
  const optOuts = await db.progressEmailOptOut.findMany({
    where: { userId: { in: candidateUsers } },
    select: { userId: true },
  })
  const optedOut = new Set(optOuts.map((o) => o.userId))
  candidates = candidates.filter((r) => !loggedIds.has(r.id) && !optedOut.has(r.userId))

  const byUser = new Map<string, ReservationRow[]>()
  for (const r of candidates) {
    const list = byUser.get(r.userId) ?? []
    list.push(r)
    byUser.set(r.userId, list)
  }
  if (byUser.size === 0) return { users: 0, sent: 0, failed: 0, deferred: 0 }

  // 3. Historia completa de esas usuarias, para semana, racha y logros
  const historyRows = await db.reservation.findMany({
    where: { status: 'ATTENDED', isGuestReservation: false, userId: { in: Array.from(byUser.keys()) } },
    select: RESERVATION_SELECT,
  })
  const history = new Map<string, AttendedClass[]>()
  for (const r of historyRows) {
    const list = history.get(r.userId) ?? []
    list.push(toAttended(r))
    history.set(r.userId, list)
  }

  let sent = 0
  let failed = 0
  let deferred = 0
  let attemptedSend = false
  const entries = Array.from(byUser.entries())
  for (let i = 0; i < entries.length; i++) {
    const [userId, rows] = entries[i]
    // Presupuesto de tiempo: lo que no se empieza queda sin reclamar para la próxima corrida
    if (clock() - startedAt > TIME_BUDGET_MS) {
      deferred = entries.length - i
      console.warn(`[CLASS_SUMMARY] Presupuesto de tiempo agotado; ${deferred} usuaria(s) quedan para la próxima corrida`)
      break
    }

    // 4. Reclamo: solo se envía lo que esta corrida insertó
    const idFor = new Map(rows.map((r) => [r.id, randomUUID()]))
    const ourIds = Array.from(idFor.values())
    let ok = false
    try {
      await db.progressEmailLog.createMany({
        data: rows.map((r) => ({ id: idFor.get(r.id)!, reservationId: r.id, userId })),
        skipDuplicates: true,
      })
      const mine = await db.progressEmailLog.findMany({
        where: { id: { in: ourIds } },
        select: { id: true, reservationId: true },
      })
      if (mine.length === 0) continue
      const claimedReservations = new Set(mine.map((l) => l.reservationId))
      const claimed = rows.filter((r) => claimedReservations.has(r.id))

      // 5. Envío, con pausa desde el anterior
      const { subject, html } = buildClassSummaryEmail(buildEmailData(claimed, history.get(userId) ?? [], deps))
      if (attemptedSend) await sleep(SEND_GAP_MS)
      attemptedSend = true
      const result = await send({ to: claimed[0].user.email, subject, html })
      ok = result.success
      if (!ok) console.error(`[CLASS_SUMMARY] Envío fallido para ${userId}:`, result.error)
    } catch (error) {
      console.error(`[CLASS_SUMMARY] Error con el resumen de ${userId}:`, error)
    }

    if (ok) {
      sent++
    } else {
      // Se liberan los reclamos por los ids de esta corrida (si no llegaron a insertarse, no borra nada)
      failed++
      await db.progressEmailLog
        .deleteMany({ where: { id: { in: ourIds } } })
        .catch((error: unknown) => console.error(`[CLASS_SUMMARY] No se pudo liberar el reclamo de ${userId}:`, error))
    }
  }

  return { users: byUser.size, sent, failed, deferred }
}
