import { describe, it, expect, beforeEach, vi } from 'vitest'
import { findOrCreateUserByEmail, type DbClient } from './accounts'

const db = {
  user: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
}
const client = db as unknown as DbClient

describe('findOrCreateUserByEmail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('vincula usuario existente sin importar mayúsculas y solo completa teléfono vacío', async () => {
    db.user.findFirst.mockResolvedValue({ id: 'u1', phone: null })
    const r = await findOrCreateUserByEmail(client, { name: 'Otro Nombre', email: 'Ana@Gmail.com ', phone: '+50377923957' })
    expect(db.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { email: { equals: 'ana@gmail.com', mode: 'insensitive' } } }))
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { phone: '+50377923957' } })
    expect(db.user.create).not.toHaveBeenCalled()
    expect(r).toEqual({ id: 'u1', created: false })
  })

  it('no pisa un teléfono existente', async () => {
    db.user.findFirst.mockResolvedValue({ id: 'u1', phone: '+50322223333' })
    await findOrCreateUserByEmail(client, { name: 'A', email: 'a@b.c', phone: '+50377923957' })
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it('crea usuario sin contraseña', async () => {
    db.user.findFirst.mockResolvedValue(null)
    db.user.create.mockResolvedValue({ id: 'u2' })
    const r = await findOrCreateUserByEmail(client, { name: 'Ana', email: 'ANA@x.com', phone: '+50377923957' })
    expect(r).toEqual({ id: 'u2', created: true })
    expect(db.user.create).toHaveBeenCalledWith({ data: { name: 'Ana', email: 'ana@x.com', phone: '+50377923957', password: null }, select: { id: true } })
  })
})
