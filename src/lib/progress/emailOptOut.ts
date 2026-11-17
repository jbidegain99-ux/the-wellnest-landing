// Enlace firmado para darse de baja del resumen por correo, sin iniciar sesión.
// La firma es HMAC-SHA256(secreto, "progress-email:" + userId) en hex.
// El enlace del correo abre una página de confirmación (GET, no escribe nada:
// los escáneres de enlaces como Outlook Safe Links abren los GET); la baja se
// guarda solo con el POST de su botón "Confirmar baja".

import { createHmac, timingSafeEqual } from 'crypto'

const PURPOSE = 'progress-email:'
/** Destino del POST que guarda la baja. */
export const UNSUBSCRIBE_PATH = '/api/email/progress-unsubscribe'
/** Página del enlace del correo, con el botón que confirma la baja. */
export const UNSUBSCRIBE_CONFIRM_PATH = '/correo/baja/confirmar'

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

/** Enlace del correo: la página de confirmación con `u` y `t`. */
export function unsubscribeUrl(baseUrl: string, userId: string, secret: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  const params = new URLSearchParams({ u: userId, t: unsubscribeToken(userId, secret) })
  return `${base}${UNSUBSCRIBE_CONFIRM_PATH}?${params.toString()}`
}

export interface UnsubscribeLink {
  userId: string
  token: string
}

type ParamValue = string | string[] | null | undefined

/** `u` y `t` (de la URL o del formulario) solo si son textos sueltos con firma válida. */
export function validUnsubscribeLink(u: ParamValue, t: ParamValue, secret: string): UnsubscribeLink | null {
  if (typeof u !== 'string' || typeof t !== 'string' || !u || !t) return null
  if (!verifyUnsubscribeToken(u, t, secret)) return null
  return { userId: u, token: t }
}
