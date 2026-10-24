import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Nunca un PrismaClient real: el cliente generado podría leer un .env de producción
const constructed = vi.fn()
vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    constructor(options: unknown) {
      constructed(options)
    }
  },
}))

const globalForPrisma = globalThis as unknown as { prisma: unknown }

describe('src/lib/prisma — candado WELLNEST_ENV=prod (I-3)', () => {
  beforeEach(() => {
    vi.resetModules()
    constructed.mockClear()
    globalForPrisma.prisma = undefined
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    globalForPrisma.prisma = undefined
  })

  it('sin WELLNEST_ENV (app en Vercel) crea el cliente como siempre', async () => {
    vi.stubEnv('WELLNEST_ENV', undefined)
    vi.stubEnv('WELLNEST_ENV_LOADED', undefined)
    const mod = await import('./prisma')
    expect(mod.prisma).toBeDefined()
    expect(constructed).toHaveBeenCalledTimes(1)
  })

  it('WELLNEST_ENV=prod sin loadEnv lanza antes de crear el cliente', async () => {
    vi.stubEnv('WELLNEST_ENV', 'prod')
    vi.stubEnv('WELLNEST_ENV_LOADED', undefined)
    await expect(import('./prisma')).rejects.toThrow('WELLNEST_ENV=prod requiere importar ./loadEnv primero')
    expect(constructed).not.toHaveBeenCalled()
  })

  it('WELLNEST_ENV=prod con loadEnv de prod crea el cliente', async () => {
    vi.stubEnv('WELLNEST_ENV', 'prod')
    vi.stubEnv('WELLNEST_ENV_LOADED', 'prod')
    await import('./prisma')
    expect(constructed).toHaveBeenCalledTimes(1)
  })
})
