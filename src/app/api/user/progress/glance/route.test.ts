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

// Sábado 24-oct-2026, 12:00 en El Salvador
const NOW = new Date('2026-10-24T18:00:00Z')

function cls(id: string, iso: string, slug = 'pilates'): AttendedClass {
  return { classId: id, dateTime: new Date(iso), durationMin: 60, disciplineSlug: slug, disciplineName: slug, classType: null }
}

describe('GET /api/user/progress/glance', () => {
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

  it('devuelve el vistazo de la usuaria', async () => {
    loadMock.mockResolvedValue([cls('c1', '2026-10-22T15:00:00Z')])
    const res = await GET()
    expect(res.status).toBe(200)
    expect(loadMock).toHaveBeenCalledWith('u1')
    const body = (await res.json()) as Record<string, unknown> & { totalClasses: number; recentBadges: { id: string }[] }
    expect(Object.keys(body).sort()).toEqual(['nextBadge', 'recentBadges', 'streakWeeks', 'totalClasses', 'week'])
    expect(body.totalClasses).toBe(1)
    expect(body.recentBadges.map((b) => b.id)).toContain('clases-1')
  })

  it('si falla la carga responde 500', async () => {
    loadMock.mockRejectedValue(new Error('db'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
