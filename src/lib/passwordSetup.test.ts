import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createHash } from 'crypto'

const { prismaMock, sendEmailMock } = vi.hoisted(() => ({
  prismaMock: {
    passwordResetToken: { create: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
  },
  sendEmailMock: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/emailService', () => ({
  sendEmail: sendEmailMock,
  buildPasswordResetEmail: (name: string, url: string) => `<p>${name}</p><a href="${url}">x</a>`,
}))

import { sendPasswordSetupEmail } from './passwordSetup'

const sha = (t: string) => createHash('sha256').update(t).digest('hex')

describe('sendPasswordSetupEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.passwordResetToken.create.mockResolvedValue({})
    prismaMock.passwordResetToken.deleteMany.mockResolvedValue({ count: 1 })
    prismaMock.passwordResetToken.updateMany.mockResolvedValue({ count: 0 })
  })

  it('guarda el hash del token (no el crudo) y manda el enlace con el crudo', async () => {
    sendEmailMock.mockResolvedValue({ success: true, messageId: 'm' })
    const r = await sendPasswordSetupEmail({ email: 'ana@x.com', name: 'Ana' }, { subject: 'Activá tu cuenta - Wellnest' })
    expect(r).toEqual({ success: true })
    const stored = prismaMock.passwordResetToken.create.mock.calls[0][0].data.token as string
    const html = sendEmailMock.mock.calls[0][0].html as string
    const raw = /token=([0-9a-f]{64})/.exec(html)?.[1] as string
    expect(raw).toBeDefined()
    expect(stored).toBe(sha(raw))
    expect(sendEmailMock.mock.calls[0][0].subject).toBe('Activá tu cuenta - Wellnest')
    expect(prismaMock.passwordResetToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ email: 'ana@x.com', token: { not: stored } }),
    }))
  })

  it('si falla el correo borra el token nuevo por su hash y no invalida los previos', async () => {
    sendEmailMock.mockResolvedValue({ success: false, error: 'graph down' })
    const r = await sendPasswordSetupEmail({ email: 'ana@x.com', name: 'Ana' })
    expect(r).toEqual({ success: false })
    const stored = prismaMock.passwordResetToken.create.mock.calls[0][0].data.token as string
    expect(prismaMock.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { token: stored } })
    expect(prismaMock.passwordResetToken.updateMany).not.toHaveBeenCalled()
  })
})
