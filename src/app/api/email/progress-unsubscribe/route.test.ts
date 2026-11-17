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

import { GET, POST, dynamic } from './route'

const SECRET = 'secreto-de-prueba'
const BASE = 'https://qa.wellneststudio.net/api/email/progress-unsubscribe'

function getReq(params: Record<string, string>): NextRequest {
  const url = new URL(BASE)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url)
}

/** POST como lo manda el `<form method="post">` de la página de confirmación. */
function postReq(fields: Record<string, string>): NextRequest {
  return new NextRequest(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  })
}

describe('/api/email/progress-unsubscribe', () => {
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

  describe('GET (enlaces viejos y escáneres de enlaces)', () => {
    it('con firma buena no guarda nada: redirige a la página de confirmación con u y t', async () => {
      const t = unsubscribeToken('u1', SECRET)
      const res = await GET(getReq({ u: 'u1', t }))
      expect(res.status).toBe(303)
      const location = new URL(res.headers.get('location') ?? '')
      expect(location.origin).toBe('https://qa.wellneststudio.net')
      expect(location.pathname).toBe('/correo/baja/confirmar')
      expect(location.searchParams.get('u')).toBe('u1')
      expect(location.searchParams.get('t')).toBe(t)
      expect(userFindUnique).not.toHaveBeenCalled()
      expect(optOutUpsert).not.toHaveBeenCalled()
    })

    it('sin parámetros tampoco toca la base', async () => {
      const res = await GET(getReq({}))
      expect(res.status).toBe(303)
      expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/correo/baja/confirmar')
      expect(userFindUnique).not.toHaveBeenCalled()
      expect(optOutUpsert).not.toHaveBeenCalled()
    })
  })

  describe('POST (botón "Confirmar baja")', () => {
    it('firma buena: guarda la baja una vez y redirige (303) a /correo/baja', async () => {
      const res = await POST(postReq({ u: 'u1', t: unsubscribeToken('u1', SECRET) }))
      expect(res.status).toBe(303)
      expect(res.headers.get('location')).toBe('https://qa.wellneststudio.net/correo/baja')
      expect(optOutUpsert).toHaveBeenCalledTimes(1)
      expect(optOutUpsert).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        create: { userId: 'u1' },
        update: {},
      })
    })

    it('firma mala: 400 con texto genérico y no toca la base', async () => {
      const res = await POST(postReq({ u: 'u1', t: unsubscribeToken('u1', 'otro-secreto') }))
      expect(res.status).toBe(400)
      const text = await res.text()
      expect(text).not.toContain('u1')
      expect(userFindUnique).not.toHaveBeenCalled()
      expect(optOutUpsert).not.toHaveBeenCalled()
    })

    it('sin campos: 400', async () => {
      const res = await POST(postReq({}))
      expect(res.status).toBe(400)
      expect(optOutUpsert).not.toHaveBeenCalled()
    })

    it('cuerpo que no es formulario: 400 y no toca la base', async () => {
      const res = await POST(
        new NextRequest(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"u":"u1"}' })
      )
      expect(res.status).toBe(400)
      expect(userFindUnique).not.toHaveBeenCalled()
      expect(optOutUpsert).not.toHaveBeenCalled()
    })

    it('usuaria inexistente: 400 con el mismo texto genérico y no guarda baja', async () => {
      userFindUnique.mockResolvedValue(null)
      const res = await POST(postReq({ u: 'u1', t: unsubscribeToken('u1', SECRET) }))
      expect(res.status).toBe(400)
      expect(await res.text()).toBe('Este enlace no es válido.')
      expect(optOutUpsert).not.toHaveBeenCalled()
    })

    it('sin NEXTAUTH_SECRET: 500 y no toca la base', async () => {
      delete process.env.NEXTAUTH_SECRET
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const res = await POST(postReq({ u: 'u1', t: 'x' }))
      expect(res.status).toBe(500)
      expect(optOutUpsert).not.toHaveBeenCalled()
    })
  })
})
