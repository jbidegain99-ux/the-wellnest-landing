import { describe, it, expect, beforeEach, vi } from 'vitest'

const { prismaMock, setupMock } = vi.hoisted(() => ({
  prismaMock: { eventTicket: { findUnique: vi.fn() }, user: { findUnique: vi.fn() } },
  setupMock: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/passwordSetup', () => ({ sendPasswordSetupEmail: setupMock }))

import { activateFromTicket, maskEmail } from './activate'

describe('maskEmail', () => {
  it('enmascara', () => expect(maskEmail('ana.martinez@gmail.com')).toBe('a***@gmail.com'))
  it('sin @ no revienta', () => expect(maskEmail('raro')).toBe('***'))
})

describe('activateFromTicket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.eventTicket.findUnique.mockResolvedValue({ claimedAt: new Date(), holderUserId: 'u1' })
    prismaMock.user.findUnique.mockResolvedValue({ email: 'ana@gmail.com', name: 'Ana', password: null })
    setupMock.mockResolvedValue({ success: true })
  })
  it('sin contraseña: manda el correo de activación al titular', async () => {
    expect(await activateFromTicket('tok')).toEqual({ result: 'email-sent', maskedEmail: 'a***@gmail.com' })
    expect(setupMock).toHaveBeenCalledWith({ email: 'ana@gmail.com', name: 'Ana' }, { subject: 'Activá tu cuenta - Wellnest' })
  })
  it('con contraseña: va al login sin mandar nada', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ email: 'ana@gmail.com', name: 'Ana', password: 'hash' })
    expect(await activateFromTicket('tok')).toEqual({ result: 'has-password' })
    expect(setupMock).not.toHaveBeenCalled()
  })
  it('sin reclamar', async () => {
    prismaMock.eventTicket.findUnique.mockResolvedValue({ claimedAt: null, holderUserId: null })
    expect(await activateFromTicket('tok')).toEqual({ result: 'unclaimed' })
  })
  it('inexistente', async () => {
    prismaMock.eventTicket.findUnique.mockResolvedValue(null)
    expect(await activateFromTicket('tok')).toEqual({ result: 'not-found' })
  })
  it('si el correo falla lo dice', async () => {
    setupMock.mockResolvedValue({ success: false })
    expect(await activateFromTicket('tok')).toEqual({ result: 'email-failed' })
  })
})
