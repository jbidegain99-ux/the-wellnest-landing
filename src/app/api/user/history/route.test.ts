import { describe, it, expect, beforeEach, afterEach, onTestFinished, vi } from 'vitest'

const { prismaMock, sessionMock } = vi.hoisted(() => ({
  prismaMock: { reservation: { findMany: vi.fn() } },
  sessionMock: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next-auth', () => ({ getServerSession: sessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { GET } from './route'

// Jueves 22-oct-2026, 12:00 en El Salvador
const NOW = new Date('2026-10-22T18:00:00Z')

interface FindManyArgs {
  where: { status?: string }
}

interface HistoryRow {
  id: string
  status: string
  checkedIn: boolean
  class: {
    dateTime: Date
    duration: number
    discipline: { name: string; slug: string }
    instructor: { name: string }
  }
}

function historyRow(id: string, iso: string, status = 'ATTENDED', checkedIn = false): HistoryRow {
  return {
    id,
    status,
    checkedIn,
    class: {
      dateTime: new Date(iso),
      duration: 60,
      discipline: { name: 'Pole Fitness', slug: 'pole' },
      instructor: { name: 'Ana' },
    },
  }
}

// Mismas clases con la forma que pide loadAttendedClasses
function attendedRow(r: HistoryRow) {
  return {
    class: {
      id: `c-${r.id}`,
      dateTime: r.class.dateTime,
      duration: r.class.duration,
      classType: null,
      discipline: { slug: r.class.discipline.slug, name: r.class.discipline.name },
    },
  }
}

function mockRows(rows: HistoryRow[]) {
  prismaMock.reservation.findMany.mockImplementation(async (args: FindManyArgs) =>
    args.where.status === 'ATTENDED'
      ? rows.filter((r) => r.status === 'ATTENDED').map(attendedRow)
      : rows
  )
}

describe('GET /api/user/history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    sessionMock.mockResolvedValue({ user: { id: 'u1' } })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sin sesión responde 401', async () => {
    sessionMock.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('la racha no se corta a 0 si esta semana aún no hay clase (igual que Mi progreso)', async () => {
    mockRows([
      historyRow('r1', '2026-10-14T15:00:00Z'), // semana anterior
      historyRow('r2', '2026-10-07T15:00:00Z'), // dos semanas atrás
    ])
    const body = await (await GET()).json()
    expect(body.stats.streak).toBe(2)
  })

  it('la racha usa semanas de El Salvador aunque el servidor esté en UTC', async () => {
    // Vercel corre en UTC; forzamos la zona del proceso para reproducirlo.
    const originalTz = process.env.TZ
    process.env.TZ = 'UTC'
    onTestFinished(() => {
      if (originalTz === undefined) delete process.env.TZ
      else process.env.TZ = originalTz
    })
    // Domingo 18-oct 20:00 SV = lunes 19-oct 02:00 UTC → semana del 12-oct en SV
    mockRows([
      historyRow('r1', '2026-10-21T15:00:00Z'), // semana actual
      historyRow('r2', '2026-10-19T02:00:00Z'), // semana anterior en SV
    ])
    const body = await (await GET()).json()
    expect(body.stats.streak).toBe(2)
  })

  it('mantiene el contrato JSON y la regla de asistencia (ATTENDED o checkedIn)', async () => {
    mockRows([
      historyRow('r1', '2026-10-21T15:00:00Z'),
      historyRow('r2', '2026-10-20T15:00:00Z', 'CONFIRMED', true),
      historyRow('r3', '2026-10-19T15:00:00Z', 'NO_SHOW'),
    ])
    const body = await (await GET()).json()

    expect(Object.keys(body).sort()).toEqual(['reservations', 'stats'])
    expect(Object.keys(body.stats).sort()).toEqual(
      ['classesPerDiscipline', 'favoriteDiscipline', 'streak', 'thisMonth', 'totalClasses'].sort()
    )
    expect(body.stats.totalClasses).toBe(2)
    expect(body.stats.thisMonth).toBe(2)
    expect(body.stats.favoriteDiscipline).toBe('Pole Fitness')
    expect(body.stats.classesPerDiscipline).toEqual({ 'Pole Fitness': 2 })
    expect(body.reservations[0]).toEqual({
      id: 'r1',
      status: 'ATTENDED',
      checkedIn: false,
      className: 'Pole Fitness',
      disciplineSlug: 'pole',
      instructor: 'Ana',
      dateTime: '2026-10-21T15:00:00.000Z',
      duration: 60,
    })
  })

  it('si falla la base responde 500', async () => {
    prismaMock.reservation.findMany.mockRejectedValue(new Error('db'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
