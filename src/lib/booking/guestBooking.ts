/**
 * Reglas para reservar llevando un invitado.
 *
 * Un invitado cuesta 2 clases del paquete (1 de la titular + 1 del invitado)
 * y ocupa 2 cupos en la clase (ambos asisten). Fuente única de verdad usada
 * por el POST de reservas y por la UI de /reservar.
 */
export type GuestBookingCheck = 'OK' | 'INSUFFICIENT_CREDITS' | 'INSUFFICIENT_CAPACITY'

/** Clases del paquete consumidas al reservar con invitado. */
export const GUEST_TOTAL_COST = 2
/** Cupos ocupados en la clase al reservar con invitado. */
export const GUEST_SEATS = 2

export function checkGuestBookingAllowed(
  classesRemaining: number,
  spotsAvailable: number
): GuestBookingCheck {
  if (classesRemaining < GUEST_TOTAL_COST) return 'INSUFFICIENT_CREDITS'
  if (spotsAvailable < GUEST_SEATS) return 'INSUFFICIENT_CAPACITY'
  return 'OK'
}
