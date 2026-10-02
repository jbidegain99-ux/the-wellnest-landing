/**
 * Datos mínimos para acreditar a mano un pago PayWay cuyo callback falló.
 *
 * Si el callback revienta (p. ej. la BD sin conexiones), lo único que prueba
 * el cobro es el form data que mandó PayWay. El callback lo envía por correo
 * a los admins en este formato y scripts/recover-lost-payway-callback.ts lo
 * consume para acreditar la orden.
 */

import type { MarkOrderPaidParams } from './markOrderPaid'

const RECOVERY_FIELDS = [
  'oid',
  'pwoAuthorizationNumber',
  'pwoReferenceNumber',
  'pwoPayWayNumber',
  'pwoTransactionDate',
  'pwoPaymentNumber',
  'pwoCustomerCCBrand',
  'pwoCustomerCCLastD',
] as const

export type PaywayRecoveryPayload = Partial<Record<(typeof RECOVERY_FIELDS)[number], string>>

export function pickRecoveryPayload(formData: Record<string, string>): PaywayRecoveryPayload {
  const payload: PaywayRecoveryPayload = {}
  for (const field of RECOVERY_FIELDS) {
    if (formData[field] !== undefined) payload[field] = formData[field]
  }
  return payload
}

export function recoveryTransactionData(
  payload: PaywayRecoveryPayload
): NonNullable<MarkOrderPaidParams['transactionData']> {
  return {
    authorizationNumber: payload.pwoAuthorizationNumber,
    referenceNumber: payload.pwoReferenceNumber,
    paywayNumber: payload.pwoPayWayNumber,
    transactionDate: payload.pwoTransactionDate,
    paymentNumber: payload.pwoPaymentNumber,
    cardBrand: payload.pwoCustomerCCBrand,
    cardLastDigits: payload.pwoCustomerCCLastD,
  }
}
