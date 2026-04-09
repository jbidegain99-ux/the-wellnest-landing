/**
 * Aggregation helpers for the finanzas dashboard.
 * Pure — no I/O. Takes purchase rows (already fetched from DB) and produces
 * totals / daily breakdowns using calculateFinancials under the hood.
 */

import { formatInTimeZone } from 'date-fns-tz'
import {
  calculateFinancials,
  classifyPayment,
  type FinancialConfig,
  type PaymentMethod,
  type PurchaseFinancials,
} from './calculate'

const TZ = 'America/El_Salvador'

export type RawPurchase = {
  id: string
  finalPrice: number
  paymentProviderId: string | null
  createdAt: Date
  // Modo B fields (optional — when backfilled)
  netAmount?: number | null
  ivaAmount?: number | null
  gatewayFeeAmount?: number | null
  retencionAmount?: number | null
}

export type MethodTotals = {
  count: number
  bruto: number
  iva: number
  fee: number
  neto: number
}

export type AggregateTotals = {
  count: number
  bruto: number
  baseImponible: number
  iva: number
  feeBase: number
  feeIva: number
  tdsFee: number
  fee: number
  retencion: number
  neto: number
  /** IVA débito (ventas) menos IVA crédito (comisión pagada al banco) */
  ivaToPayMinistry: number
  byMethod: Record<PaymentMethod, MethodTotals>
}

export type DailyBreakdown = {
  day: string // YYYY-MM-DD in SV tz
} & AggregateTotals

function emptyMethodTotals(): MethodTotals {
  return { count: 0, bruto: 0, iva: 0, fee: 0, neto: 0 }
}

function emptyAggregate(): AggregateTotals {
  return {
    count: 0,
    bruto: 0,
    baseImponible: 0,
    iva: 0,
    feeBase: 0,
    feeIva: 0,
    tdsFee: 0,
    fee: 0,
    retencion: 0,
    neto: 0,
    ivaToPayMinistry: 0,
    byMethod: {
      PAYWAY: emptyMethodTotals(),
      POS: emptyMethodTotals(),
      MANUAL: emptyMethodTotals(),
      TRIAL: emptyMethodTotals(),
      GIFT: emptyMethodTotals(),
      OFFLINE: emptyMethodTotals(),
    },
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Non-revenue payment methods — these are tracked in `byMethod` for
 * operational visibility but do NOT contribute to the financial totals
 * (count, bruto, iva, fee, neto). Trial classes and gift courtesies
 * don't represent money and inflate the totals if counted.
 */
const NON_REVENUE_METHODS: ReadonlyArray<PaymentMethod> = ['TRIAL', 'GIFT']

function isRevenueMethod(method: PaymentMethod): boolean {
  return !NON_REVENUE_METHODS.includes(method)
}

function accumulate(
  agg: AggregateTotals,
  purchase: RawPurchase,
  computed: PurchaseFinancials
) {
  const method = classifyPayment(purchase.paymentProviderId)

  // Always track in byMethod so the breakdown table can show
  // trial / gift counts for operational visibility.
  const m = agg.byMethod[method]
  m.count += 1
  m.bruto += computed.bruto
  m.iva += computed.iva
  m.fee += computed.fee
  m.neto += computed.neto

  // Only add to the financial totals if this method represents revenue.
  if (!isRevenueMethod(method)) return

  agg.count += 1
  agg.bruto += computed.bruto
  agg.baseImponible += computed.baseImponible
  agg.iva += computed.iva
  agg.feeBase += computed.feeBase
  agg.feeIva += computed.feeIva
  agg.tdsFee += computed.tdsFee
  agg.fee += computed.fee
  agg.retencion += computed.retencion
  agg.neto += computed.neto
}

function finalizeRounding(agg: AggregateTotals): AggregateTotals {
  agg.bruto = round2(agg.bruto)
  agg.baseImponible = round2(agg.baseImponible)
  agg.iva = round2(agg.iva)
  agg.feeBase = round2(agg.feeBase)
  agg.feeIva = round2(agg.feeIva)
  agg.tdsFee = round2(agg.tdsFee)
  agg.fee = round2(agg.fee)
  agg.retencion = round2(agg.retencion)
  agg.neto = round2(agg.neto)
  // IVA neto al Ministerio = IVA débito (ventas) - IVA crédito (comisiones)
  agg.ivaToPayMinistry = round2(agg.iva - agg.feeIva)
  for (const method of Object.keys(agg.byMethod) as PaymentMethod[]) {
    const m = agg.byMethod[method]
    m.bruto = round2(m.bruto)
    m.iva = round2(m.iva)
    m.fee = round2(m.fee)
    m.neto = round2(m.neto)
  }
  return agg
}

export function aggregatePurchases(
  purchases: RawPurchase[],
  config: FinancialConfig
): AggregateTotals {
  const agg = emptyAggregate()
  for (const p of purchases) {
    const computed = calculateFinancials(p, config)
    accumulate(agg, p, computed)
  }
  return finalizeRounding(agg)
}

/** Returns YYYY-MM-DD in El Salvador timezone for a UTC Date. */
function svDayKey(d: Date): string {
  return formatInTimeZone(d, TZ, 'yyyy-MM-dd')
}

export function groupByDaySV(
  purchases: RawPurchase[],
  config: FinancialConfig
): DailyBreakdown[] {
  const byDay = new Map<string, AggregateTotals>()
  for (const p of purchases) {
    const day = svDayKey(p.createdAt)
    let agg = byDay.get(day)
    if (!agg) {
      agg = emptyAggregate()
      byDay.set(day, agg)
    }
    const computed = calculateFinancials(p, config)
    accumulate(agg, p, computed)
  }
  const days: DailyBreakdown[] = []
  byDay.forEach((agg, day) => {
    days.push({ day, ...finalizeRounding(agg) })
  })
  days.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
  return days
}
