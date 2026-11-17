import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { AttendedClass } from '@/lib/progress/summary'

const { loadMock, sessionMock } = vi.hoisted(() => ({
  loadMock: vi.fn(),
  sessionMock: vi.fn(),
}))
vi.mock('@/lib/progress/load', () => ({ loadAttendedClasses: loadMock }))
vi.mock('next-auth', () => ({ getServerSession: sessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { GET, dynamic } from './route'

// Jueves 22-oct-2026, 12:00 en El Salvador
const NOW = new Date('2026-10-22T18:00:00Z')

function cls(id: string, iso: string, slug = 'pole'): AttendedClass {
  return {
    classId: id,
    dateTime: new Date(iso),
    durationMin: 60,
    disciplineSlug: slug,
    disciplineName: slug,
    classType: null,
  }
}

interface BadgeJson {
  id: string
  category: string
  earnedAt: string | null
  current: number
  target: number
}

describe('GET /api/user/badges', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    sessionMock.mockResolvedValue({ user: { id: 'u1' } })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('es dinámica', () => {
    expect(dynamic).toBe('force-dynamic')
  })

  it('sin sesión responde 401 y no consulta clases', async () => {
    sessionMock.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
    expect(loadMock).not.toHaveBeenCalled()
  })

  it('devuelve los logros, el conteo de ganados y el reto del mes', async () => {
    loadMock.mockResolvedValue([
      cls('c1', '2026-10-05T15:00:00Z'),
      cls('c2', '2026-10-07T15:00:00Z'),
      cls('c3', '2026-10-14T15:00:00Z', 'yoga'),
      cls('c4', '2026-10-21T15:00:00Z'),
    ])
    const res = await GET()
    expect(res.status).toBe(200)
    expect(loadMock).toHaveBeenCalledWith('u1')
    const body = (await res.json()) as { badges: BadgeJson[]; challenge: BadgeJson & { daysLeft: number }; earnedCount: number }

    expect(Object.keys(body).sort()).toEqual(['badges', 'challenge', 'earnedCount'])
    expect(body.earnedCount).toBe(body.badges.filter((b) => b.earnedAt !== null).length)
    const ids = body.badges.filter((b) => b.earnedAt !== null).map((b) => b.id)
    // 1 clase, 1 pole, 1 yoga, racha de 2 semanas (3 seguidas), reto de octubre (meta 4, 4 clases)
    expect(ids).toEqual(
      expect.arrayContaining(['clases-1', 'disciplina-pole-1', 'disciplina-yoga-1', 'racha-2', 'reto-2026-10'])
    )
    expect(body.challenge.id).toBe('reto-2026-10')
    expect(body.challenge.target).toBe(4)
    expect(body.challenge.current).toBe(4)
    expect(body.challenge.earnedAt).not.toBeNull()
    // 22-oct al 31-oct, contando hoy
    expect(body.challenge.daysLeft).toBe(10)
  })

  it('los retos de otros años llevan el año en el título; los de este año no', async () => {
    loadMock.mockResolvedValue([
      cls('a1', '2025-10-06T15:00:00Z'),
      cls('a2', '2025-10-08T15:00:00Z'),
      cls('a3', '2025-10-10T15:00:00Z'),
      cls('a4', '2025-10-13T15:00:00Z'),
    ])
    const body = (await (await GET()).json()) as { badges: (BadgeJson & { title: string })[]; challenge: BadgeJson & { title: string } }
    const old = body.badges.find((b) => b.id === 'reto-2025-10')
    expect(old?.title).toBe('Reto de octubre 2025')
    expect(body.challenge.title).toBe('Reto de octubre')
  })

  it('sin clases: cero ganados y reto con meta 4', async () => {
    loadMock.mockResolvedValue([])
    const body = (await (await GET()).json()) as { badges: BadgeJson[]; challenge: BadgeJson & { daysLeft: number }; earnedCount: number }
    expect(body.earnedCount).toBe(0)
    expect(body.badges.length).toBeGreaterThan(0)
    expect(body.challenge).toMatchObject({ id: 'reto-2026-10', target: 4, current: 0, earnedAt: null })
  })

  it('si falla la carga responde 500', async () => {
    loadMock.mockRejectedValue(new Error('db'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
