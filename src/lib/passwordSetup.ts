import { randomBytes, createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendEmail, buildPasswordResetEmail } from '@/lib/emailService'
import { siteUrl } from '@/lib/events/config'

/**
 * Manda el correo para elegir (o restablecer) la contraseña. En BD se
 * guarda solo el hash del token; el enlace lleva el token crudo.
 */
export async function sendPasswordSetupEmail(
  user: { email: string; name: string },
  opts?: { subject?: string }
): Promise<{ success: boolean }> {
  const token = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hora

  await prisma.passwordResetToken.create({
    data: { email: user.email, token: tokenHash, expiresAt },
  })

  const baseUrl = siteUrl()
  const resetUrl = `${baseUrl}/reset-password?token=${token}`
  const result = await sendEmail({
    to: user.email,
    subject: opts?.subject ?? 'Restablecer contraseña - Wellnest',
    html: buildPasswordResetEmail(user.name, resetUrl),
  })

  if (!result.success) {
    console.error(`[PASSWORD SETUP] Error enviando email a ${user.email}: ${result.error}`)
    await prisma.passwordResetToken.deleteMany({ where: { token: tokenHash } }).catch(() => {})
    return { success: false }
  }

  // Invalidar tokens previos SOLO tras envío exitoso (excepto el nuevo)
  await prisma.passwordResetToken.updateMany({
    where: { email: user.email, used: false, token: { not: tokenHash }, expiresAt: { gt: new Date() } },
    data: { used: true },
  })
  return { success: true }
}
