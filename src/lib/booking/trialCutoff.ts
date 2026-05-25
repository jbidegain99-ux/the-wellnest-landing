/**
 * Legacy trial package ("Clase de Prueba") date restriction.
 *
 * The trial package may not be used to book classes on/after the cutoff.
 * Shared by the reservations POST validator and GET /api/user/bookable-purchases
 * so the rule cannot drift between what the selector offers and what the
 * server accepts.
 */
export const TRIAL_PACKAGE_ID = 'cmm78xhwt0000bfage9rlmp2m'
// March 9, 2026 midnight in El Salvador (UTC-6) = 06:00 UTC
export const TRIAL_CUTOFF_UTC = new Date('2026-03-09T06:00:00Z')

export function isTrialBlockedForClass(
  packageId: string,
  classDateTime: Date
): boolean {
  return packageId === TRIAL_PACKAGE_ID && classDateTime >= TRIAL_CUTOFF_UTC
}
