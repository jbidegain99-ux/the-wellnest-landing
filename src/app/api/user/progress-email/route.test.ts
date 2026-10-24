import { describe, it, expect, beforeEach, vi } from 'vitest'

const { sessionMock, findUnique, upsert, deleteMany } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
}))
vi.mock('next-auth', () => ({ getServerSession: sessionMock }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: { progressEmailOptOut: { findUnique, upsert, deleteMany } },
}))

import { GET, PUT } from './route'

function put(body: unknown): Request {
  return new Request('http://localhost/api/user/progress-email', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/user/progress-email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMock.mockResolvedValue({ user: { id: 'u1' } })
    findUnique.mockResolvedValue(null)
    upsert.mockResolvedValue({ userId: 'u1' })
    deleteMany.mockResolvedValue({ count: 1 })
  })

  it('sin sesión: 401 en GET y PUT', async () => {
    sessionMock.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
    expect((await PUT(put({ enabled: false }))).status).toBe(401)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('GET: encendido por defecto, apagado si hay baja', async () => {
    expect(await (await GET()).json()).toEqual({ enabled: true })
    findUnique.mockResolvedValue({ userId: 'u1' })
    expect(await (await GET()).json()).toEqual({ enabled: false })
  })

  it('PUT false crea la baja; PUT true la borra', async () => {
    expect(await (await PUT(put({ enabled: false }))).json()).toEqual({ enabled: false })
    expect(upsert).toHaveBeenCalledWith({ where: { userId: 'u1' }, create: { userId: 'u1' }, update: {} })
    expect(await (await PUT(put({ enabled: true }))).json()).toEqual({ enabled: true })
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } })
  })

  it('PUT sin booleano: 400', async () => {
    expect((await PUT(put({ enabled: 'no' }))).status).toBe(400)
    expect(upsert).not.toHaveBeenCalled()
    expect(deleteMany).not.toHaveBeenCalled()
  })
})
