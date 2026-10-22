import { prisma } from '@/lib/prisma'
import { sendPasswordSetupEmail } from '@/lib/passwordSetup'

export type ActivateResult =
  | { result: 'email-sent'; maskedEmail: string }
  | { result: 'email-failed' }
  | { result: 'has-password' }
  | { result: 'unclaimed' }
  | { result: 'not-found' }

export function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at < 1) return '***'
  return `${email[0]}***${email.slice(at)}`
}

/**
 * "Activar mi cuenta" desde la carta de después del show. Nunca fija la
 * contraseña desde el enlace de la entrada (el comprador conoce los enlaces de
 * sus acompañantes): manda el correo para elegirla al dueño de la cuenta.
 */
export async function activateFromTicket(token: string): Promise<ActivateResult> {
  const ticket = await prisma.eventTicket.findUnique({ where: { token }, select: { claimedAt: true, holderUserId: true } })
  if (!ticket) return { result: 'not-found' }
  if (!ticket.claimedAt || !ticket.holderUserId) return { result: 'unclaimed' }

  const user = await prisma.user.findUnique({
    where: { id: ticket.holderUserId },
    select: { email: true, name: true, password: true },
  })
  if (!user) return { result: 'not-found' }
  if (user.password) return { result: 'has-password' }

  const sent = await sendPasswordSetupEmail({ email: user.email, name: user.name }, { subject: 'Activá tu cuenta - Wellnest' })
  return sent.success ? { result: 'email-sent', maskedEmail: maskEmail(user.email) } : { result: 'email-failed' }
}
