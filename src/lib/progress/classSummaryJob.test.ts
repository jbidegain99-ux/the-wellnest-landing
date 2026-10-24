import { describe, it, expect, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  classSummaryDbFrom,
  RESERVATION_SELECT,
  runClassSummaryJob,
  type ClassSummaryDb,
  type LogQuery,
  type ReservationQuery,
  type ReservationRow,
  type SendFn,
} from './classSummaryJob'
import { unsubscribeUrl } from './emailOptOut'

// Sábado 24-oct-2026, 13:15 en El Salvador (corrida del mediodía)
const NOW = new Date('2026-10-24T19:15:00Z')
const HOUR = 3600 * 1000
const BASE = 'https://wellneststudio.net'
const SECRET = 'secreto'

interface FakeUser {
  id: string
  name: string
  email: string
}
interface FakeClass {
  id: string
  dateTime: Date
  duration: number
  classType: string | null
  discipline: { slug: string; name: string }
}
interface FakeReservation {
  id: string
  userId: string
  classId: string
  status: 'CONFIRMED' | 'CANCELLED' | 'ATTENDED' | 'NO_SHOW'
  isGuestReservation: boolean
}
interface FakeLog {
  id: string
  reservationId: string
  userId: string
}

/** Base en memoria con solo los métodos que usa el job. */
class FakeDb implements ClassSummaryDb {
  users = new Map<string, FakeUser>()
  classes = new Map<string, FakeClass>()
  reservations: FakeReservation[] = []
  logs: FakeLog[] = []
  optOuts = new Set<string>()
  /** Se ejecuta justo antes de cada createMany (simula otra corrida en paralelo). */
  beforeCreate: (() => void) | null = null

  reservation = {
    findMany: async (args: ReservationQuery): Promise<ReservationRow[]> => {
      const w = args.where
      return this.reservations
        .filter((r) => r.status === w.status && r.isGuestReservation === w.isGuestReservation)
        .filter((r) => !w.userId || w.userId.in.includes(r.userId))
        .filter((r) => {
          if (!w.class) return true
          const t = this.classes.get(r.classId)!.dateTime.getTime()
          return t > w.class.dateTime.gt.getTime() && t <= w.class.dateTime.lte.getTime()
        })
        .map((r) => {
          const c = this.classes.get(r.classId)!
          const u = this.users.get(r.userId)!
          return {
            id: r.id,
            userId: r.userId,
            class: { id: c.id, dateTime: c.dateTime, duration: c.duration, classType: c.classType, discipline: { ...c.discipline } },
            user: { name: u.name, email: u.email },
          }
        })
    },
  }

  progressEmailOptOut = {
    findMany: async (args: { where: { userId: { in: string[] } }; select: { userId: true } }) =>
      Array.from(this.optOuts)
        .filter((id) => args.where.userId.in.includes(id))
        .map((userId) => ({ userId })),
  }

  progressEmailLog = {
    findMany: async (args: LogQuery) => {
      const w = args.where
      return this.logs
        .filter((l) => ('id' in w ? w.id.in.includes(l.id) : w.reservationId.in.includes(l.reservationId)))
        .map((l) => ({ id: l.id, reservationId: l.reservationId }))
    },
    createMany: async (args: { data: FakeLog[]; skipDuplicates: true }) => {
      this.beforeCreate?.()
      let count = 0
      for (const row of args.data) {
        if (this.logs.some((l) => l.reservationId === row.reservationId || l.id === row.id)) continue
        this.logs.push({ ...row })
        count++
      }
      return { count }
    },
    deleteMany: async (args: { where: { id: { in: string[] } } }) => {
      const before = this.logs.length
      this.logs = this.logs.filter((l) => !args.where.id.in.includes(l.id))
      return { count: before - this.logs.length }
    },
  }

  addUser(id: string, name = 'Ana María López'): void {
    this.users.set(id, { id, name, email: `${id}@test.local` })
  }

  /** Clase asistida que empezó `startedHoursAgo` horas antes de NOW. */
  attend(
    userId: string,
    resId: string,
    startedHoursAgo: number,
    opts: { duration?: number; slug?: string; name?: string; guest?: boolean; status?: FakeReservation['status'] } = {}
  ): void {
    const classId = `c-${resId}`
    this.classes.set(classId, {
      id: classId,
      dateTime: new Date(NOW.getTime() - startedHoursAgo * HOUR),
      duration: opts.duration ?? 60,
      classType: null,
      discipline: { slug: opts.slug ?? 'pole', name: opts.name ?? 'Pole Fitness' },
    })
    this.reservations.push({
      id: resId,
      userId,
      classId,
      status: opts.status ?? 'ATTENDED',
      isGuestReservation: opts.guest ?? false,
    })
  }
}

type SendArgs = Parameters<SendFn>[0]

function okSend() {
  return vi.fn(async (_args: SendArgs) => ({ success: true }))
}

function run(db: FakeDb, send: SendFn, now = NOW) {
  return runClassSummaryJob({ db, send, now, baseUrl: BASE, secret: SECRET })
}

describe('runClassSummaryJob', () => {
  it('envía el resumen de una clase terminada y no lo repite en la siguiente corrida', async () => {
    const db = new FakeDb()
    db.addUser('u1')
    db.attend('u1', 'r1', 4)
    const send = okSend()

    expect(await run(db, send)).toEqual({ users: 1, sent: 1, failed: 0 })
    expect(await run(db, send)).toEqual({ users: 0, sent: 0, failed: 0 })
    expect(send).toHaveBeenCalledTimes(1)
    expect(db.logs.map((l) => l.reservationId)).toEqual(['r1'])

    const args = send.mock.calls[0][0]
    expect(args.to).toBe('u1@test.local')
    expect(args.subject).toBe('Tu resumen de Pole Fitness')
    expect(args.html).toContain('Ana')
    expect(args.html).not.toContain('María')
    expect(args.html).toContain(`${BASE}/perfil/progreso`)
    expect(args.html).toContain(unsubscribeUrl(BASE, 'u1', SECRET).replace(/&/g, '&amp;'))
  })

  it('si el envío falla, borra el reclamo y la próxima corrida reintenta', async () => {
    const db = new FakeDb()
    db.addUser('u1')
    db.attend('u1', 'r1', 4)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const failing = vi.fn(async (_args: SendArgs) => ({ success: false, error: 'Graph 500' }))
    expect(await run(db, failing)).toEqual({ users: 1, sent: 0, failed: 1 })
    expect(db.logs).toEqual([])

    const send = okSend()
    expect(await run(db, send)).toEqual({ users: 1, sent: 1, failed: 0 })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('si el envío lanza, también borra el reclamo', async () => {
    const db = new FakeDb()
    db.addUser('u1')
    db.attend('u1', 'r1', 4)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const throwing = vi.fn(async (_args: SendArgs): Promise<{ success: boolean }> => {
      throw new Error('red')
    })
    expect(await run(db, throwing)).toEqual({ users: 1, sent: 0, failed: 1 })
    expect(db.logs).toEqual([])
  })

  it('una usuaria con baja no recibe nada', async () => {
    const db = new FakeDb()
    db.addUser('u1')
    db.addUser('u2')
    db.attend('u1', 'r1', 4)
    db.attend('u2', 'r2', 4)
    db.optOuts.add('u1')
    const send = okSend()
    expect(await run(db, send)).toEqual({ users: 1, sent: 1, failed: 0 })
    expect(send.mock.calls[0][0].to).toBe('u2@test.local')
    expect(db.logs.map((l) => l.reservationId)).toEqual(['r2'])
  })

  it('una clase que terminó hace 25 h no se envía', async () => {
    const db = new FakeDb()
    db.addUser('u1')
    db.attend('u1', 'r1', 26) // empezó hace 26 h, terminó hace 25 h
    const send = okSend()
    expect(await run(db, send)).toEqual({ users: 0, sent: 0, failed: 0 })
    expect(send).not.toHaveBeenCalled()
  })

  it('una clase que terminó hace 23 h sí se envía aunque empezó hace más de 24 h', async () => {
    const db = new FakeDb()
    db.addUser('u1')
    db.attend('u1', 'r1', 24.5, { duration: 90 }) // terminó hace 23 h
    const send = okSend()
    expect(await run(db, send)).toEqual({ users: 1, sent: 1, failed: 0 })
  })

  it('una clase que aún no termina no se envía (y sí en la corrida siguiente)', async () => {
    const db = new FakeDb()
    db.addUser('u1')
    db.attend('u1', 'r1', 0.5) // empezó hace 30 min, dura 60
    const send = okSend()
    expect(await run(db, send)).toEqual({ users: 0, sent: 0, failed: 0 })
    expect(db.logs).toEqual([])

    expect(await run(db, send, new Date(NOW.getTime() + HOUR))).toEqual({ users: 1, sent: 1, failed: 0 })
  })

  it('dos clases de una usuaria: un solo correo, con la más reciente en el asunto', async () => {
    const db = new FakeDb()
    db.addUser('u1')
    db.attend('u1', 'r1', 10, { slug: 'yoga', name: 'Yoga' })
    db.attend('u1', 'r2', 3)
    const send = okSend()
    expect(await run(db, send)).toEqual({ users: 1, sent: 1, failed: 0 })
    expect(send).toHaveBeenCalledTimes(1)
    const { subject, html } = send.mock.calls[0][0]
    expect(subject).toBe('Tu resumen de Pole Fitness')
    expect(html).toContain('Yoga')
    expect(db.logs.map((l) => l.reservationId).sort()).toEqual(['r1', 'r2'])
  })

  it('ignora reservas de invitada y no asistidas', async () => {
    const db = new FakeDb()
    db.addUser('u1')
    db.attend('u1', 'r1', 4, { guest: true })
    db.attend('u1', 'r2', 3, { status: 'CONFIRMED' })
    db.attend('u1', 'r3', 2, { status: 'NO_SHOW' })
    const send = okSend()
    expect(await run(db, send)).toEqual({ users: 0, sent: 0, failed: 0 })
  })

  it('solo envía lo que reclamó esta corrida (otra corrida en paralelo ganó el reclamo)', async () => {
    const db = new FakeDb()
    db.addUser('u1')
    db.attend('u1', 'r1', 4)
    db.beforeCreate = () => {
      db.logs.push({ id: 'otra-corrida', reservationId: 'r1', userId: 'u1' })
      db.beforeCreate = null
    }
    const send = okSend()
    expect(await run(db, send)).toEqual({ users: 1, sent: 0, failed: 0 })
    expect(send).not.toHaveBeenCalled()
    expect(db.logs.map((l) => l.id)).toEqual(['otra-corrida'])
  })

  it('logros: la primera clase celebra "1 clase" con su PNG absoluto', async () => {
    const db = new FakeDb()
    db.addUser('u1')
    db.attend('u1', 'r1', 4)
    const send = okSend()
    await run(db, send)
    const { html } = send.mock.calls[0][0]
    expect(html).toContain('1 clase')
    expect(html).toContain(`src="${BASE}/images/badges/clases-1.png"`)
  })

  it('logros: no vuelve a celebrar lo ganado con clases anteriores', async () => {
    const db = new FakeDb()
    db.addUser('u1')
    // Primera clase hace 3 días (fuera de la ventana); la del correo es la segunda
    db.attend('u1', 'r0', 72)
    db.attend('u1', 'r1', 4)
    const send = okSend()
    await run(db, send)
    const { html } = send.mock.calls[0][0]
    expect(html).not.toContain('clases-1.png')
    expect(html).not.toContain('Primera clase de Pole')
  })

  it('una usuaria sin nombre recibe el saludo genérico', async () => {
    const db = new FakeDb()
    db.addUser('u1', '   ')
    db.attend('u1', 'r1', 4)
    const send = okSend()
    await run(db, send)
    expect(send.mock.calls[0][0].html).toContain('¡Hola!')
  })
})

describe('classSummaryDbFrom', () => {
  it('reenvía cada llamada al método de Prisma con los mismos argumentos', async () => {
    const calls: Array<[string, unknown]> = []
    const method = (name: string) => async (args: unknown) => {
      calls.push([name, args])
      return name.endsWith('Many') && !name.includes('find') ? { count: 0 } : []
    }
    const client = {
      reservation: { findMany: method('reservation.findMany') },
      progressEmailOptOut: { findMany: method('optOut.findMany') },
      progressEmailLog: {
        findMany: method('log.findMany'),
        createMany: method('log.createMany'),
        deleteMany: method('log.deleteMany'),
      },
    } as unknown as PrismaClient
    const db = classSummaryDbFrom(client)

    const where = { status: 'ATTENDED' as const, isGuestReservation: false as const, userId: { in: ['u1'] } }
    await db.reservation.findMany({ where, select: RESERVATION_SELECT })
    await db.progressEmailOptOut.findMany({ where: { userId: { in: ['u1'] } }, select: { userId: true } })
    await db.progressEmailLog.findMany({ where: { id: { in: ['l1'] } }, select: { id: true, reservationId: true } })
    await db.progressEmailLog.createMany({ data: [{ id: 'l1', reservationId: 'r1', userId: 'u1' }], skipDuplicates: true })
    await db.progressEmailLog.deleteMany({ where: { id: { in: ['l1'] } } })

    expect(calls).toEqual([
      ['reservation.findMany', { where, select: RESERVATION_SELECT }],
      ['optOut.findMany', { where: { userId: { in: ['u1'] } }, select: { userId: true } }],
      ['log.findMany', { where: { id: { in: ['l1'] } }, select: { id: true, reservationId: true } }],
      ['log.createMany', { data: [{ id: 'l1', reservationId: 'r1', userId: 'u1' }], skipDuplicates: true }],
      ['log.deleteMany', { where: { id: { in: ['l1'] } } }],
    ])
  })
})
