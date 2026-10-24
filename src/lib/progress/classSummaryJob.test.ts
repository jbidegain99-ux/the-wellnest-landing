import { describe, it, expect, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  classSummaryDbFrom,
  RESERVATION_SELECT,
  runClassSummaryJob,
  SEND_GAP_MS,
  TIME_BUDGET_MS,
  type ClassSummaryDb,
  type ClassSummaryJobDeps,
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
  /** Usuaria cuyo createMany falla (error de base). */
  failCreateFor: string | null = null
  /** Usuaria cuya relectura de reclamos falla, después de insertarlos. */
  failReadClaimsFor: string | null = null

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
      if ('id' in w && this.logs.some((l) => w.id.in.includes(l.id) && l.userId === this.failReadClaimsFor)) {
        throw new Error('timeout de la base')
      }
      return this.logs
        .filter((l) => ('id' in w ? w.id.in.includes(l.id) : w.reservationId.in.includes(l.reservationId)))
        .map((l) => ({ id: l.id, reservationId: l.reservationId }))
    },
    createMany: async (args: { data: FakeLog[]; skipDuplicates: true }) => {
      this.beforeCreate?.()
      if (args.data.some((row) => row.userId === this.failCreateFor)) throw new Error('conexiones agotadas')
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
    this.attendAt(userId, resId, new Date(NOW.getTime() - startedHoursAgo * HOUR), opts)
  }

  /** Clase asistida que empezó en `start`. */
  attendAt(
    userId: string,
    resId: string,
    start: Date,
    opts: { duration?: number; slug?: string; name?: string; guest?: boolean; status?: FakeReservation['status'] } = {}
  ): void {
    const classId = `c-${resId}`
    this.classes.set(classId, {
      id: classId,
      dateTime: start,
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

const noSleep = async (_ms: number): Promise<void> => {}

function run(db: FakeDb, send: SendFn, now = NOW, extra: Partial<ClassSummaryJobDeps> = {}) {
  return runClassSummaryJob({ db, send, now, baseUrl: BASE, secret: SECRET, sleep: noSleep, ...extra })
}

describe('runClassSummaryJob', () => {
  it('envía el resumen de una clase terminada y no lo repite en la siguiente corrida', async () => {
    const db = new FakeDb()
    db.addUser('u1')
    db.attend('u1', 'r1', 4)
    const send = okSend()

    expect(await run(db, send)).toEqual({ users: 1, sent: 1, failed: 0, deferred: 0 })
    expect(await run(db, send)).toEqual({ users: 0, sent: 0, failed: 0, deferred: 0 })
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
    expect(await run(db, failing)).toEqual({ users: 1, sent: 0, failed: 1, deferred: 0 })
    expect(db.logs).toEqual([])

    const send = okSend()
    expect(await run(db, send)).toEqual({ users: 1, sent: 1, failed: 0, deferred: 0 })
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
    expect(await run(db, throwing)).toEqual({ users: 1, sent: 0, failed: 1, deferred: 0 })
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
    expect(await run(db, send)).toEqual({ users: 1, sent: 1, failed: 0, deferred: 0 })
    expect(send.mock.calls[0][0].to).toBe('u2@test.local')
    expect(db.logs.map((l) => l.reservationId)).toEqual(['r2'])
  })

  it('una clase que terminó hace 25 h no se envía', async () => {
    const db = new FakeDb()
    db.addUser('u1')
    db.attend('u1', 'r1', 26) // empezó hace 26 h, terminó hace 25 h
    const send = okSend()
    expect(await run(db, send)).toEqual({ users: 0, sent: 0, failed: 0, deferred: 0 })
    expect(send).not.toHaveBeenCalled()
  })

  it('una clase que terminó hace 23 h sí se envía aunque empezó hace más de 24 h', async () => {
    const db = new FakeDb()
    db.addUser('u1')
    db.attend('u1', 'r1', 24.5, { duration: 90 }) // terminó hace 23 h
    const send = okSend()
    expect(await run(db, send)).toEqual({ users: 1, sent: 1, failed: 0, deferred: 0 })
  })

  it('una clase que aún no termina no se envía (y sí en la corrida siguiente)', async () => {
    const db = new FakeDb()
    db.addUser('u1')
    db.attend('u1', 'r1', 0.5) // empezó hace 30 min, dura 60
    const send = okSend()
    expect(await run(db, send)).toEqual({ users: 0, sent: 0, failed: 0, deferred: 0 })
    expect(db.logs).toEqual([])

    expect(await run(db, send, new Date(NOW.getTime() + HOUR))).toEqual({ users: 1, sent: 1, failed: 0, deferred: 0 })
  })

  it('dos clases de una usuaria: un solo correo, con la más reciente en el asunto', async () => {
    const db = new FakeDb()
    db.addUser('u1')
    db.attend('u1', 'r1', 10, { slug: 'yoga', name: 'Yoga' })
    db.attend('u1', 'r2', 3)
    const send = okSend()
    expect(await run(db, send)).toEqual({ users: 1, sent: 1, failed: 0, deferred: 0 })
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
    expect(await run(db, send)).toEqual({ users: 0, sent: 0, failed: 0, deferred: 0 })
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
    expect(await run(db, send)).toEqual({ users: 1, sent: 0, failed: 0, deferred: 0 })
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

  it('la semana del correo es la de la clase: clase del domingo 22:00, corrida del lunes', async () => {
    const db = new FakeDb()
    db.addUser('u1')
    // Domingo 25-oct-2026, 21:00–22:00 en El Salvador
    db.attendAt('u1', 'r1', new Date('2026-10-26T03:00:00Z'))
    const monday = new Date('2026-10-26T19:15:00Z') // lunes 13:15 SV
    const send = okSend()
    expect(await run(db, send, monday)).toEqual({ users: 1, sent: 1, failed: 0, deferred: 0 })
    const { html } = send.mock.calls[0][0]
    expect(html).toContain('60 de 150 min')
  })

  it('una clase en curso (ya marcada como asistida) no suma a la semana del correo', async () => {
    const db = new FakeDb()
    db.addUser('u1')
    db.attend('u1', 'r1', 3) // terminó hace 2 h
    db.attend('u1', 'r2', 0.5) // empezó hace 30 min, sigue en curso
    const send = okSend()
    expect(await run(db, send)).toEqual({ users: 1, sent: 1, failed: 0, deferred: 0 })
    const { html } = send.mock.calls[0][0]
    expect(html).toContain('60 de 150 min')
    expect(db.logs.map((l) => l.reservationId)).toEqual(['r1'])
  })

  it('un error de base con una usuaria se cuenta como fallo y sigue con las demás', async () => {
    const db = new FakeDb()
    db.addUser('u1')
    db.addUser('u2')
    db.attend('u1', 'r1', 4)
    db.attend('u2', 'r2', 4)
    db.failCreateFor = 'u1'
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const send = okSend()
    expect(await run(db, send)).toEqual({ users: 2, sent: 1, failed: 1, deferred: 0 })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].to).toBe('u2@test.local')
    expect(db.logs.map((l) => l.reservationId)).toEqual(['r2'])
    expect(error).toHaveBeenCalled()
  })

  it('si la base falla después de reclamar, libera el reclamo y la próxima corrida reintenta', async () => {
    const db = new FakeDb()
    db.addUser('u1')
    db.addUser('u2')
    db.attend('u1', 'r1', 4)
    db.attend('u2', 'r2', 4)
    db.failReadClaimsFor = 'u1'
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const send = okSend()
    expect(await run(db, send)).toEqual({ users: 2, sent: 1, failed: 1, deferred: 0 })
    expect(db.logs.map((l) => l.reservationId)).toEqual(['r2'])

    db.failReadClaimsFor = null
    const again = okSend()
    expect(await run(db, again)).toEqual({ users: 1, sent: 1, failed: 0, deferred: 0 })
    expect(again.mock.calls[0][0].to).toBe('u1@test.local')
  })

  it(`espera ${SEND_GAP_MS} ms entre envíos (no antes del primero)`, async () => {
    const db = new FakeDb()
    for (const id of ['u1', 'u2', 'u3']) {
      db.addUser(id)
      db.attend(id, `r-${id}`, 4)
    }
    const order: string[] = []
    const sleep = vi.fn(async (ms: number) => {
      order.push(`sleep ${ms}`)
    })
    const send = vi.fn(async (args: SendArgs) => {
      order.push(`send ${args.to}`)
      return { success: true }
    })
    expect(await run(db, send, NOW, { sleep })).toEqual({ users: 3, sent: 3, failed: 0, deferred: 0 })
    expect(order).toEqual([
      'send u1@test.local',
      `sleep ${SEND_GAP_MS}`,
      'send u2@test.local',
      `sleep ${SEND_GAP_MS}`,
      'send u3@test.local',
    ])
  })

  it(`deja de empezar usuarias pasados ${TIME_BUDGET_MS / 1000} s; las demás quedan para la próxima corrida`, async () => {
    const db = new FakeDb()
    for (const id of ['u1', 'u2', 'u3']) {
      db.addUser(id)
      db.attend(id, `r-${id}`, 4)
    }
    let t = 0
    const clock = () => t
    const slowSend = vi.fn(async (_args: SendArgs) => {
      t += 130_000 // cada envío "tarda" 130 s
      return { success: true }
    })
    expect(await run(db, slowSend, NOW, { clock })).toEqual({ users: 3, sent: 2, failed: 0, deferred: 1 })
    expect(db.logs.map((l) => l.reservationId)).toEqual(['r-u1', 'r-u2'])

    const send = okSend()
    expect(await run(db, send)).toEqual({ users: 1, sent: 1, failed: 0, deferred: 0 })
    expect(send.mock.calls[0][0].to).toBe('u3@test.local')
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
