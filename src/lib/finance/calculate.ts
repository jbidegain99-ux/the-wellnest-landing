/**
 * Financial calculation for Wellnest Studio purchases.
 *
 * Models the Banco Cuscatlán "Botón de Pago" fee structure from the contract
 * dated 2026-01-05 (see tasks/reports/Carta oferta Especial Banco Cuscatlán
 * POS y Boton de Pago - The Wellnest.pdf).
 *
 * Key rules confirmed with Jose 2026-04-09:
 *   - IVA (13%) is INCLUDED in package prices (extracción inversa).
 *   - Wellnest is NOT gran contribuyente → no retención.
 *   - Gateway commission: 2.95% + IVA on base imponible.
 *   - 3DS fee: $0.16 + IVA per transaction.
 *
 * The "neto" returned here is the money that reaches the bank account:
 *   neto = finalPrice - gatewayFee - 3dsFee
 *
 * IVA is NOT subtracted from neto (it was already inside the price the
 * customer paid). The IVA is a separate monthly obligation to the Ministerio
 * de Hacienda, computed as Σ ivaVentas - Σ ivaComisiones (crédito fiscal).
 */

export type FinancialConfig = {
  ivaRate: number
  /** true when the package price already includes IVA (Wellnest's case). */
  ivaIncludedInPrice: boolean
  /** Gateway commission rate applied on base imponible. */
  gatewayFeeRate: number
  /** When true, the gateway charges IVA on top of the commission. */
  gatewayFeeHasIva: boolean
  /** Per-transaction 3DS fee, before IVA. */
  tds3DsPerTransaction: number
  /** When true, 3DS fee has IVA added. */
  tds3DsHasIva: boolean
  /** When true, apply retention (only for grandes contribuyentes). */
  retencionEnabled: boolean
  retencionRate?: number
}

export type PaymentMethod = 'PAYWAY' | 'MANUAL' | 'TRIAL' | 'OFFLINE'

export type PurchaseFinancials = {
  bruto: number
  baseImponible: number
  iva: number
  feeBase: number
  feeIva: number
  tdsFee: number
  fee: number
  retencion: number
  neto: number
}

export type PurchaseInput = {
  finalPrice: number
  paymentProviderId: string | null
  // Modo B: persisted values from webhook parsing (authoritative when present).
  netAmount?: number | null
  ivaAmount?: number | null
  gatewayFeeAmount?: number | null
  retencionAmount?: number | null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Classifies a Purchase.paymentProviderId into a payment method.
 * Historical convention: providerId is a free-form string with prefixes.
 */
export function classifyPayment(providerId: string | null): PaymentMethod {
  if (!providerId) return 'OFFLINE'
  if (providerId.startsWith('payway_')) return 'PAYWAY'
  if (providerId === 'manual_payment') return 'MANUAL'
  if (providerId.startsWith('trial_')) return 'TRIAL'
  return 'OFFLINE'
}

export function calculateFinancials(
  purchase: PurchaseInput,
  config: FinancialConfig
): PurchaseFinancials {
  const bruto = round2(purchase.finalPrice)

  // Modo B: values already persisted by webhook parser — trust them.
  if (
    purchase.netAmount != null &&
    purchase.gatewayFeeAmount != null &&
    purchase.ivaAmount != null
  ) {
    const iva = round2(purchase.ivaAmount)
    const fee = round2(purchase.gatewayFeeAmount)
    const retencion = round2(purchase.retencionAmount ?? 0)
    return {
      bruto,
      baseImponible: round2(bruto - iva),
      iva,
      feeBase: 0,
      feeIva: 0,
      tdsFee: 0,
      fee,
      retencion,
      neto: round2(purchase.netAmount),
    }
  }

  // Modo A: compute from config.
  // IVA: extracción inversa when included in the listed price.
  const baseImponible = config.ivaIncludedInPrice
    ? round2(bruto / (1 + config.ivaRate))
    : bruto
  const iva = round2(bruto - baseImponible)

  const method = classifyPayment(purchase.paymentProviderId)
  const appliesGatewayFees = method === 'PAYWAY'

  let feeBase = 0
  let feeIva = 0
  let tdsFee = 0
  if (appliesGatewayFees) {
    feeBase = round2(baseImponible * config.gatewayFeeRate)
    feeIva = config.gatewayFeeHasIva ? round2(feeBase * config.ivaRate) : 0
    const tdsRaw = config.tds3DsPerTransaction
    tdsFee = round2(config.tds3DsHasIva ? tdsRaw * (1 + config.ivaRate) : tdsRaw)
  }
  const fee = round2(feeBase + feeIva + tdsFee)

  const retencion =
    config.retencionEnabled && appliesGatewayFees && config.retencionRate
      ? round2(baseImponible * config.retencionRate)
      : 0

  // Neto al banco: bruto - comisión total - retención.
  // IVA NO se resta (ya estaba incluido en el precio cobrado).
  const neto = round2(bruto - fee - retencion)

  return { bruto, baseImponible, iva, feeBase, feeIva, tdsFee, fee, retencion, neto }
}
