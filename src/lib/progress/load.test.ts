import { describe, it, expect, beforeEach, vi } from 'vitest'

const { prismaMock, sessionMock } = vi.hoisted(() => ({
  prismaMock: { reservation: { findMany: vi.fn() } },
  sessionMock: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('next-auth', () => ({ getServerSession: sessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { loadAttendedClasses } from './load'
import { GET } from '@/app/api/user/progress/route'

const row = {
  class: {
    id: 'c1',
    dateTime: new Date('2026-10-01T15:00:00Z'),
    duration: 55,
    classType: 'Pilates - Core',
    discipline: { slug: 'pilates', name: 'Pilates' },
  },
}

describe('loadAttendedClasses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.reservation.findMany.mockResolvedValue([row])
  })

  it('consulta solo asistencias propias y no de invitadas', async () => {
    await loadAttendedClasses('u1')
    const arg = prismaMock.reservation.findMany.mock.calls[0][0]
    expect(arg.where).toEqual({ userId: 'u1', status: 'ATTENDED', isGuestReservation: false })
  })

  it('mapea filas a AttendedClass', async () => {
    expect(await loadAttendedClasses('u1')).toEqual([
      {
        classId: 'c1',
        dateTime: row.class.dateTime,
        durationMin: 55,
        disciplineSlug: 'pilates',
        disciplineName: 'Pilates',
        classType: 'Pilates - Core',
      },
    ])
  })
})

describe('GET /api/user/progress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.reservation.findMany.mockResolvedValue([row])
  })

  it('sin sesión devuelve 401 y no consulta la BD', async () => {
    sessionMock.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'No autorizado' })
    expect(prismaMock.reservation.findMany).not.toHaveBeenCalled()
  })

  it('con sesión consulta solo el id de la sesión', async () => {
    sessionMock.mockResolvedValue({ user: { id: 'u1' } })
    const res = await GET()
    expect(res.status).toBe(200)
    expect(prismaMock.reservation.findMany.mock.calls[0][0].where.userId).toBe('u1')
  })

  it('error interno devuelve 500', async () => {
    sessionMock.mockResolvedValue({ user: { id: 'u1' } })
    prismaMock.reservation.findMany.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await GET()).status).toBe(500)
  })
})
