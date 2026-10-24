import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
// next/server solo exporta el tipo; la clase vive en dist.
import { NextFetchEvent } from 'next/dist/server/web/spec-extension/fetch-event'
import type { NextMiddlewareWithAuth, NextAuthMiddlewareOptions, NextRequestWithAuth } from 'next-auth/middleware'

// withAuth mockeado: guardamos el handler y las opciones que recibe y devolvemos
// un "middleware de auth" falso para saber si el request llegó hasta él.
const captured = vi.hoisted(() => ({
  handler: null as NextMiddlewareWithAuth | null,
  options: null as NextAuthMiddlewareOptions | null,
  authMiddleware: vi.fn(() => new Response('auth', { status: 299 })),
}))

vi.mock('next-auth/middleware', () => ({
  withAuth: (handler: NextMiddlewareWithAuth, options: NextAuthMiddlewareOptions) => {
    captured.handler = handler
    captured.options = options
    return captured.authMiddleware
  },
}))

import middleware, { config } from './middleware'

function run(path: string, headers: Record<string, string> = {}) {
  const req = new NextRequest(`http://localhost:3000${path}`, { headers })
  const event = new NextFetchEvent({ request: req, page: path })
  return middleware(req, event)
}

const basic = (pass: string): string => 'Basic ' + btoa(`adriana:${pass}`)

beforeEach(() => {
  captured.authMiddleware.mockClear()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('middleware en producción (sin APP_ENV)', () => {
  beforeEach(() => {
    vi.stubEnv('APP_ENV', '')
    vi.stubEnv('QA_ACCESS_PASSWORD', '')
  })

  it('GET / pasa sin pedir contraseña ni tocar withAuth', async () => {
    const res = await run('/')
    expect(res?.status).not.toBe(401)
    expect(res?.headers.get('WWW-Authenticate')).toBeNull()
    expect(captured.authMiddleware).not.toHaveBeenCalled()
  })

  it('rutas protegidas llegan al handler de withAuth', async () => {
    for (const path of ['/perfil', '/perfil/paquetes', '/reservar', '/carrito', '/checkout/pago', '/admin', '/admin/usuarios']) {
      captured.authMiddleware.mockClear()
      const res = await run(path)
      expect(res?.status, path).toBe(299)
      expect(captured.authMiddleware, path).toHaveBeenCalledTimes(1)
    }
  })

  it('rutas no protegidas (ni prefijos parecidos) no pasan por withAuth', async () => {
    for (const path of ['/paquetes', '/api/cron/sales-report', '/perfiles', '/administracion']) {
      const res = await run(path)
      expect(res?.status, path).not.toBe(401)
    }
    expect(captured.authMiddleware).not.toHaveBeenCalled()
  })

  it('el matcher cubre todo salvo los assets de Next', () => {
    expect(config.matcher).toEqual(['/((?!_next/static|_next/image|favicon.ico).*)'])
  })
})

describe('reglas de withAuth (idénticas a las de antes)', () => {
  const authorized = (path: string, token: Record<string, unknown> | null): boolean => {
    const req = new NextRequest(`http://localhost:3000${path}`)
    const fn = captured.options?.callbacks?.authorized
    if (!fn) throw new Error('sin callback authorized')
    return fn({ token: token as never, req }) as boolean
  }

  it('authorized exige token con id en rutas protegidas', () => {
    expect(authorized('/perfil', null)).toBe(false)
    expect(authorized('/perfil', { email: 'x@x.com' })).toBe(false)
    expect(authorized('/perfil', { id: 'u1' })).toBe(true)
    expect(authorized('/admin', { id: 'u1' })).toBe(true)
    expect(authorized('/', null)).toBe(true)
  })

  it('el handler redirige al inicio a quien no es ADMIN en /admin', async () => {
    const call = (path: string, role: string) => {
      const req = new NextRequest(`http://localhost:3000${path}`) as NextRequestWithAuth
      req.nextauth = { token: { id: 'u1', role } as never }
      const event = new NextFetchEvent({ request: req, page: path })
      if (!captured.handler) throw new Error('sin handler')
      return captured.handler(req, event)
    }
    const denied = await call('/admin/usuarios', 'USER')
    expect(denied?.status).toBe(307)
    expect(denied?.headers.get('location')).toBe('http://localhost:3000/')
    const ok = await call('/admin/usuarios', 'ADMIN')
    expect(ok?.headers.get('x-middleware-next')).toBe('1')
    const user = await call('/perfil', 'USER')
    expect(user?.headers.get('x-middleware-next')).toBe('1')
  })
})

describe('middleware en QA', () => {
  beforeEach(() => {
    vi.stubEnv('APP_ENV', 'qa')
    vi.stubEnv('QA_ACCESS_PASSWORD', 'secreta')
  })

  it('sin credenciales responde 401 con WWW-Authenticate', async () => {
    for (const path of ['/', '/perfil']) {
      const res = await run(path)
      expect(res?.status, path).toBe(401)
      expect(res?.headers.get('WWW-Authenticate'), path).toBe('Basic realm="Wellnest QA"')
    }
    expect(captured.authMiddleware).not.toHaveBeenCalled()
  })

  it('con la contraseña correcta deja pasar y aplica withAuth donde toca', async () => {
    const home = await run('/', { authorization: basic('secreta') })
    expect(home?.status).not.toBe(401)
    expect(captured.authMiddleware).not.toHaveBeenCalled()
    const perfil = await run('/perfil', { authorization: basic('secreta') })
    expect(perfil?.status).toBe(299)
  })

  it('rutas exentas pasan sin contraseña', async () => {
    const res = await run('/api/cron/sales-report')
    expect(res?.status).not.toBe(401)
  })
})
