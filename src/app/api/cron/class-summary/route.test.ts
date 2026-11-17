import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { runMock, adapterMock } = vi.hoisted(() => ({
  runMock: vi.fn(),
  adapterMock: vi.fn((client: unknown) => ({ adapted: client })),
}))
vi.mock('@/lib/progress/classSummaryJob', () => ({ runClassSummaryJob: runMock, classSummaryDbFrom: adapterMock }))
vi.mock('@/lib/prisma', () => ({ prisma: { tag: 'prisma' } }))
vi.mock('@/lib/emailService', () => ({ sendEmail: vi.fn() }))

import { GET, dynamic, maxDuration } from './route'

function req(auth?: string): NextRequest {
  const headers = new Headers()
  if (auth !== undefined) headers.set('authorization', auth)
  return new NextRequest('https://wellneststudio.net/api/cron/class-summary', { headers })
}

const ENV_KEYS = ['CRON_SECRET', 'NEXTAUTH_URL', 'NEXTAUTH_SECRET'] as const
type EnvKey = (typeof ENV_KEYS)[number]

describe('GET /api/cron/class-summary', () => {
  const saved: Partial<Record<EnvKey, string | undefined>> = {}

  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of ENV_KEYS) saved[k] = process.env[k]
    process.env.CRON_SECRET = 'cron-secreto'
    process.env.NEXTAUTH_URL = 'https://wellneststudio.net/\n'
    process.env.NEXTAUTH_SECRET = 'auth-secreto'
    runMock.mockResolvedValue({ users: 2, sent: 2, failed: 0, deferred: 0 })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
    vi.restoreAllMocks()
  })

  it('es dinámica y con 300 s de duración máxima', () => {
    expect(dynamic).toBe('force-dynamic')
    expect(maxDuration).toBe(300)
  })

  it('401 sin header de autorización', async () => {
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(runMock).not.toHaveBeenCalled()
  })

  it('401 con un secreto incorrecto (mismo largo o distinto)', async () => {
    expect((await GET(req('Bearer cron-secretX'))).status).toBe(401)
    expect((await GET(req('Bearer otro'))).status).toBe(401)
    expect(runMock).not.toHaveBeenCalled()
  })

  it('500 si falta CRON_SECRET', async () => {
    delete process.env.CRON_SECRET
    expect((await GET(req('Bearer cron-secreto'))).status).toBe(500)
    expect(runMock).not.toHaveBeenCalled()
  })

  it('500 si falta NEXTAUTH_URL o NEXTAUTH_SECRET', async () => {
    delete process.env.NEXTAUTH_URL
    expect((await GET(req('Bearer cron-secreto'))).status).toBe(500)
    process.env.NEXTAUTH_URL = 'https://wellneststudio.net'
    delete process.env.NEXTAUTH_SECRET
    expect((await GET(req('Bearer cron-secreto'))).status).toBe(500)
    expect(runMock).not.toHaveBeenCalled()
  })

  it('con el secreto correcto corre el job con la URL limpia y devuelve el resumen', async () => {
    const res = await GET(req('Bearer cron-secreto'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ users: 2, sent: 2, failed: 0, deferred: 0 })
    expect(runMock).toHaveBeenCalledTimes(1)
    const deps = runMock.mock.calls[0][0] as { baseUrl: string; secret: string; now: Date; db: unknown }
    expect(deps.baseUrl).toBe('https://wellneststudio.net')
    expect(deps.secret).toBe('auth-secreto')
    expect(deps.now).toBeInstanceOf(Date)
    expect(deps.db).toEqual({ adapted: { tag: 'prisma' } })
  })

  it('500 genérico si el job lanza', async () => {
    runMock.mockRejectedValue(new Error('db caída'))
    const res = await GET(req('Bearer cron-secreto'))
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('db caída')
  })
})
