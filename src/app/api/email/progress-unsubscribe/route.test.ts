import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { unsubscribeToken } from '@/lib/progress/emailOptOut'

const { userFindUnique, optOutUpsert } = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  optOutUpsert: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: userFindUnique },
    progressEmailOptOut: { upsert: optOutUpsert },
  },
}))

import { GET, dynamic } from './route'

const SECRET = 'secreto-de-prueba'
const BASE = 'https://qa.wellneststudio.net/api/email/progress-unsubscribe'

function req(params: Record<string, string>): NextRequest {
  const url = new URL(BASE)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url)
}

describe('GET /api/email/progress-unsubscribe', () => {
  const original = process.env.NEXTAUTH_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXTAUTH_SECRET = SECRET
    userFindUnique.mockResolvedValue({ id: 'u1' })
    optOutUpsert.mockResolvedValue({ userId: 'u1' })
  })

  afterEach(() => {
    process.env.NEXTAUTH_SECRET = original
  })

  it('es dinámica', () => {
    expect(dynamic).toBe('force-dynamic')
  })

  it('firma mala: 400 con texto genérico y no toca la base', async () => {
    const res = await GET(req({ u: 'u1', t: unsubscribeToken('u1', 'otro-secreto') }))
    expect(res.status).toBe(400)
    const text = await res.text()
    expect(text).not.toContain('u1')
    expect(userFindUnique).not.toHaveBeenCalled()
    expect(optOutUpsert).not.toHaveBeenCalled()
  })

  it('sin parámetros: 400', async () => {
    const res = await GET(req({}))
    expect(res.status).toBe(400)
    expect(optOutUpsert).not.toHaveBeenCalled()
  })

  it('usuaria inexistente: 400 y no guarda baja', async () => {
    userFindUnique.mockResolvedValue(null)
    const res = await GET(req({ u: 'u1', t: unsubscribeToken('u1', SECRET) }))
    expect(res.status).toBe(400)
    expect(optOutUpsert).not.toHaveBeenCalled()
  })

  it('firma buena: guarda la baja una vez y redirige a /correo/baja', async () => {
    const res = await GET(req({ u: 'u1', t: unsubscribeToken('u1', SECRET) }))
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://qa.wellneststudio.net/correo/baja')
    expect(optOutUpsert).toHaveBeenCalledTimes(1)
    expect(optOutUpsert).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      create: { userId: 'u1' },
      update: {},
    })
  })

  it('sin NEXTAUTH_SECRET: 500 y no toca la base', async () => {
    delete process.env.NEXTAUTH_SECRET
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await GET(req({ u: 'u1', t: 'x' }))
    expect(res.status).toBe(500)
    expect(optOutUpsert).not.toHaveBeenCalled()
  })
})
