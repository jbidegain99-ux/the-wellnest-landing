import { describe, it, expect, beforeEach, vi } from 'vitest'

const { prismaMock, setupMock } = vi.hoisted(() => ({
  prismaMock: { user: { findFirst: vi.fn(), create: vi.fn() } },
  setupMock: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/passwordSetup', () => ({ sendPasswordSetupEmail: setupMock }))

import { POST } from './route'

const req = (body: unknown) =>
  new Request('http://x/api/auth/register', { method: 'POST', headers: { 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250)}` }, body: JSON.stringify(body) })

describe('register con cuenta creada por una entrada', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u1', email: 'ana@x.com', name: 'Ana', password: null })
  })
  it('si el correo sale, avisa que lo mandamos', async () => {
    setupMock.mockResolvedValue({ success: true })
    const res = await POST(req({ name: 'Ana', email: 'ana@x.com', password: '12345678' }))
    expect(res.status).toBe(200)
    expect((await res.json()).passwordSetupSent).toBe(true)
  })
  it('si el correo falla, no dice que lo mandamos', async () => {
    setupMock.mockResolvedValue({ success: false })
    const res = await POST(req({ name: 'Ana', email: 'ana@x.com', password: '12345678' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.passwordSetupSent).toBeUndefined()
    expect(body.error).toBe('Ya tenés una cuenta, pero no pudimos enviarte el correo. Probá de nuevo en unos minutos.')
  })
})
