// Enlace firmado para darse de baja del resumen por correo, sin iniciar sesión.
// La firma es HMAC-SHA256(secreto, "progress-email:" + userId) en hex.

import { createHmac, timingSafeEqual } from 'crypto'

const PURPOSE = 'progress-email:'
export const UNSUBSCRIBE_PATH = '/api/email/progress-unsubscribe'

export function unsubscribeToken(userId: string, secret: string): string {
  return createHmac('sha256', secret).update(PURPOSE + userId).digest('hex')
}

/** Comparación en tiempo constante; false si los largos no coinciden. */
export function verifyUnsubscribeToken(userId: string, token: string, secret: string): boolean {
  const expected = Buffer.from(unsubscribeToken(userId, secret))
  const given = Buffer.from(token)
  if (given.length !== expected.length) return false
  return timingSafeEqual(given, expected)
}

export function unsubscribeUrl(baseUrl: string, userId: string, secret: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  const params = new URLSearchParams({ u: userId, t: unsubscribeToken(userId, secret) })
  return `${base}${UNSUBSCRIBE_PATH}?${params.toString()}`
}
