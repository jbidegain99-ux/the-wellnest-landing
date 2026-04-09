import { describe, it, expect } from 'vitest'
import { aggregatePurchases, groupByDaySV } from './aggregate'
import type { FinancialConfig } from './calculate'

const CFG: FinancialConfig = {
  ivaRate: 0.13,
  ivaIncludedInPrice: true,
  gatewayFeeRate: 0.0295,
  gatewayFeeHasIva: true,
  tds3DsPerTransaction: 0.16,
  tds3DsHasIva: true,
  retencionEnabled: false,
}

describe('aggregatePurchases', () => {
  it('sums bruto, iva, fee and neto across purchases', () => {
    const purchases = [
      { id: 'a', finalPrice: 113, paymentProviderId: 'payway_1', createdAt: new Date('2026-03-05T15:00:00Z') },
      { id: 'b', finalPrice: 226, paymentProviderId: 'payway_2', createdAt: new Date('2026-03-06T15:00:00Z') },
      { id: 'c', finalPrice: 113, paymentProviderId: 'manual_payment', createdAt: new Date('2026-03-07T15:00:00Z') },
    ]

    const result = aggregatePurchases(purchases, CFG)

    expect(result.count).toBe(3)
    expect(result.bruto).toBeCloseTo(113 + 226 + 113, 2)
    // Each $113 contributes $13 IVA; $226 contributes $26
    expect(result.iva).toBeCloseTo(13 + 26 + 13, 2)
    // Only PayWay contributes gateway fees
    expect(result.fee).toBeGreaterThan(0)
    // Manual's neto equals its bruto
    expect(result.neto).toBeLessThan(result.bruto)
  })

  it('returns zero metrics for empty array', () => {
    const result = aggregatePurchases([], CFG)
    expect(result.count).toBe(0)
    expect(result.bruto).toBe(0)
    expect(result.iva).toBe(0)
    expect(result.fee).toBe(0)
    expect(result.neto).toBe(0)
  })

  it('splits totals by payment method', () => {
    const purchases = [
      { id: 'a', finalPrice: 113, paymentProviderId: 'payway_1', createdAt: new Date('2026-03-05T15:00:00Z') },
      { id: 'b', finalPrice: 50, paymentProviderId: 'manual_payment', createdAt: new Date('2026-03-06T15:00:00Z') },
      { id: 'c', finalPrice: 0, paymentProviderId: 'trial_x', createdAt: new Date('2026-03-07T15:00:00Z') },
    ]
    const result = aggregatePurchases(purchases, CFG)
    expect(result.byMethod.PAYWAY.count).toBe(1)
    expect(result.byMethod.PAYWAY.bruto).toBe(113)
    expect(result.byMethod.MANUAL.count).toBe(1)
    expect(result.byMethod.MANUAL.bruto).toBe(50)
    expect(result.byMethod.TRIAL.count).toBe(1)
    expect(result.byMethod.TRIAL.bruto).toBe(0)
  })

  it('counts POS purchases in financial totals with no 3DS fee', () => {
    const purchases = [
      { id: 'pos1', finalPrice: 49.99, paymentProviderId: 'pos_manual', createdAt: new Date('2026-04-08T15:00:00Z') },
    ]
    const result = aggregatePurchases(purchases, CFG)
    expect(result.count).toBe(1)
    expect(result.byMethod.POS.count).toBe(1)
    expect(result.byMethod.POS.bruto).toBe(49.99)
    // tdsFee total should be 0 because the only txn is POS, not PAYWAY
    expect(result.tdsFee).toBe(0)
    // Commission still applies (2.95% + IVA on base imponible)
    expect(result.feeBase).toBeGreaterThan(0)
  })

  it('excludes GIFT and TRIAL from financial totals but keeps them in byMethod', () => {
    const purchases = [
      { id: 'pay1', finalPrice: 113, paymentProviderId: 'payway_1', createdAt: new Date('2026-04-01T15:00:00Z') },
      { id: 'gift1', finalPrice: 49.99, paymentProviderId: 'gift_manual', createdAt: new Date('2026-04-02T15:00:00Z') },
      { id: 'gift2', finalPrice: 15, paymentProviderId: 'gift_manual', createdAt: new Date('2026-04-03T15:00:00Z') },
      { id: 'trial1', finalPrice: 0, paymentProviderId: 'trial_abc', createdAt: new Date('2026-04-04T15:00:00Z') },
    ]
    const result = aggregatePurchases(purchases, CFG)

    // Financial totals: only the 1 PAYWAY counts
    expect(result.count).toBe(1)
    expect(result.bruto).toBe(113)

    // byMethod: all 4 buckets populated
    expect(result.byMethod.PAYWAY.count).toBe(1)
    expect(result.byMethod.GIFT.count).toBe(2)
    expect(result.byMethod.TRIAL.count).toBe(1)

    // GIFT bruto is 0 even though finalPrice was >0, because
    // calculateFinancials zeros it out for GIFT.
    expect(result.byMethod.GIFT.bruto).toBe(0)
  })

  it('POS + PAYWAY both count toward financial totals', () => {
    const purchases = [
      { id: 'p1', finalPrice: 113, paymentProviderId: 'payway_1', createdAt: new Date('2026-04-01T15:00:00Z') },
      { id: 'p2', finalPrice: 49.99, paymentProviderId: 'pos_manual', createdAt: new Date('2026-04-02T15:00:00Z') },
    ]
    const result = aggregatePurchases(purchases, CFG)
    expect(result.count).toBe(2)
    expect(result.bruto).toBeCloseTo(113 + 49.99, 2)
  })
})

describe('groupByDaySV', () => {
  it('groups purchases by El Salvador day (UTC-6)', () => {
    // A purchase at 2026-03-05 23:30 UTC is 2026-03-05 17:30 SV
    // A purchase at 2026-03-06 04:00 UTC is 2026-03-05 22:00 SV (still March 5 SV)
    // A purchase at 2026-03-06 07:00 UTC is 2026-03-06 01:00 SV (March 6 SV)
    const purchases = [
      { id: 'a', finalPrice: 100, paymentProviderId: null, createdAt: new Date('2026-03-05T23:30:00Z') },
      { id: 'b', finalPrice: 100, paymentProviderId: null, createdAt: new Date('2026-03-06T04:00:00Z') },
      { id: 'c', finalPrice: 100, paymentProviderId: null, createdAt: new Date('2026-03-06T07:00:00Z') },
    ]
    const days = groupByDaySV(purchases, CFG)
    const map = new Map(days.map((d) => [d.day, d]))
    expect(map.get('2026-03-05')?.count).toBe(2)
    expect(map.get('2026-03-06')?.count).toBe(1)
  })

  it('returns days sorted ascending', () => {
    const purchases = [
      { id: 'a', finalPrice: 100, paymentProviderId: null, createdAt: new Date('2026-03-10T18:00:00Z') },
      { id: 'b', finalPrice: 100, paymentProviderId: null, createdAt: new Date('2026-03-01T18:00:00Z') },
      { id: 'c', finalPrice: 100, paymentProviderId: null, createdAt: new Date('2026-03-05T18:00:00Z') },
    ]
    const days = groupByDaySV(purchases, CFG)
    expect(days.map((d) => d.day)).toEqual(['2026-03-01', '2026-03-05', '2026-03-10'])
  })
})
