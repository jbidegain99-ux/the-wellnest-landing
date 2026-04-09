import { describe, it, expect } from 'vitest'
import { calculateFinancials, type FinancialConfig } from './calculate'

// Cuscatlán "Botón de Pago" tariffs from contract dated 2026-01-05.
// File: tasks/reports/Carta oferta Especial Banco Cuscatlán POS y Boton de Pago - The Wellnest.pdf
const CUSCATLAN_CONFIG: FinancialConfig = {
  ivaRate: 0.13,
  ivaIncludedInPrice: true,
  gatewayFeeRate: 0.0295, // 2.95% on base imponible
  gatewayFeeHasIva: true, // "+ IVA"
  tds3DsPerTransaction: 0.16, // $0.16 per txn
  tds3DsHasIva: true, // "+ IVA"
  retencionEnabled: false, // Wellnest no es gran contribuyente
}

describe('calculateFinancials', () => {
  describe('IVA included in price (extracción inversa)', () => {
    it('extracts IVA from a $113 price as $13 base $100', () => {
      const result = calculateFinancials(
        { finalPrice: 113, paymentProviderId: null },
        CUSCATLAN_CONFIG
      )
      expect(result.bruto).toBe(113)
      expect(result.baseImponible).toBe(100)
      expect(result.iva).toBe(13)
    })

    it('extracts IVA correctly for non-round amounts', () => {
      // finalPrice = 50, base = 50/1.13 = 44.2478, iva = 5.75
      const result = calculateFinancials(
        { finalPrice: 50, paymentProviderId: null },
        CUSCATLAN_CONFIG
      )
      expect(result.baseImponible).toBeCloseTo(44.25, 2)
      expect(result.iva).toBeCloseTo(5.75, 2)
    })
  })

  describe('Manual payments (no gateway)', () => {
    it('charges no commission or 3DS for manual_payment', () => {
      const result = calculateFinancials(
        { finalPrice: 113, paymentProviderId: 'manual_payment' },
        CUSCATLAN_CONFIG
      )
      expect(result.feeBase).toBe(0)
      expect(result.feeIva).toBe(0)
      expect(result.tdsFee).toBe(0)
      expect(result.fee).toBe(0)
      expect(result.neto).toBe(113) // bruto - 0 = 113
    })

    it('charges no fees for null providerId (offline)', () => {
      const result = calculateFinancials(
        { finalPrice: 113, paymentProviderId: null },
        CUSCATLAN_CONFIG
      )
      expect(result.fee).toBe(0)
      expect(result.neto).toBe(113)
    })

    it('charges no fees for trial_ purchases even with finalPrice', () => {
      const result = calculateFinancials(
        { finalPrice: 10, paymentProviderId: 'trial_abc' },
        CUSCATLAN_CONFIG
      )
      expect(result.fee).toBe(0)
    })
  })

  describe('PayWay (Cuscatlán) payments', () => {
    it('applies 2.95% commission on base imponible plus IVA on commission', () => {
      // finalPrice 113, base 100
      // feeBase = 100 * 0.0295 = 2.95
      // feeIva  = 2.95 * 0.13  = 0.3835
      // tdsFee  = 0.16 * 1.13  = 0.1808
      // fee     = 2.95 + 0.3835 + 0.1808 = 3.5143 → 3.51
      const result = calculateFinancials(
        { finalPrice: 113, paymentProviderId: 'payway_xyz' },
        CUSCATLAN_CONFIG
      )
      expect(result.feeBase).toBeCloseTo(2.95, 2)
      expect(result.feeIva).toBeCloseTo(0.38, 2)
      expect(result.tdsFee).toBeCloseTo(0.18, 2)
      expect(result.fee).toBeCloseTo(3.51, 2)
    })

    it('neto = bruto - fee (IVA is NOT subtracted)', () => {
      // IVA ya estaba incluido en el precio → no se resta del neto bancario
      const result = calculateFinancials(
        { finalPrice: 113, paymentProviderId: 'payway_xyz' },
        CUSCATLAN_CONFIG
      )
      expect(result.neto).toBeCloseTo(113 - 3.51, 2)
    })
  })

  describe('March 2026 fixture (plan §9.3)', () => {
    // Simplified: treat the $3,848.30 PayWay total as a single aggregated
    // transaction to validate the formula produces the expected neto range.
    // Real aggregation by transaction will happen in aggregateByPeriod.
    it('computes expected components for a single large PayWay total', () => {
      const result = calculateFinancials(
        { finalPrice: 3848.30, paymentProviderId: 'payway_march_total' },
        CUSCATLAN_CONFIG
      )

      // base = 3848.30 / 1.13 = 3405.58
      expect(result.baseImponible).toBeCloseTo(3405.58, 1)
      // iva débito = 442.72
      expect(result.iva).toBeCloseTo(442.72, 1)
      // feeBase = 3405.58 * 0.0295 = 100.46
      expect(result.feeBase).toBeCloseTo(100.46, 1)
      // feeIva  = 100.46 * 0.13   = 13.06
      expect(result.feeIva).toBeCloseTo(13.06, 1)
    })

    it('retencion is zero when disabled', () => {
      const result = calculateFinancials(
        { finalPrice: 1000, paymentProviderId: 'payway_x' },
        CUSCATLAN_CONFIG
      )
      expect(result.retencion).toBe(0)
    })
  })

  describe('Retención enabled (future-proofing)', () => {
    it('applies retention when enabled', () => {
      const configWithRet: FinancialConfig = {
        ...CUSCATLAN_CONFIG,
        retencionEnabled: true,
        retencionRate: 0.01,
      }
      const result = calculateFinancials(
        { finalPrice: 1130, paymentProviderId: 'payway_x' },
        configWithRet
      )
      // base = 1000, retention = 1000 * 0.01 = 10
      expect(result.retencion).toBeCloseTo(10, 2)
    })
  })

  describe('Modo B: persisted values take precedence', () => {
    it('uses pre-computed netAmount when present (from webhook parser)', () => {
      const result = calculateFinancials(
        {
          finalPrice: 113,
          paymentProviderId: 'payway_real',
          netAmount: 109.42, // real net from settlement report
          ivaAmount: 13,
          gatewayFeeAmount: 3.58,
        },
        CUSCATLAN_CONFIG
      )
      expect(result.neto).toBe(109.42)
      expect(result.iva).toBe(13)
      expect(result.fee).toBe(3.58)
    })
  })

  describe('Rounding consistency', () => {
    it('all amounts rounded to 2 decimals', () => {
      const result = calculateFinancials(
        { finalPrice: 77.77, paymentProviderId: 'payway_x' },
        CUSCATLAN_CONFIG
      )
      for (const value of [
        result.bruto,
        result.baseImponible,
        result.iva,
        result.feeBase,
        result.feeIva,
        result.tdsFee,
        result.fee,
        result.neto,
      ]) {
        expect(Number.isFinite(value)).toBe(true)
        // at most 2 decimals
        expect(Math.round(value * 100) / 100).toBe(value)
      }
    })
  })
})

describe('classifyPayment', () => {
  it('is exported from the calculate module or config', async () => {
    const mod = await import('./calculate')
    expect(typeof mod.classifyPayment).toBe('function')
    expect(mod.classifyPayment(null)).toBe('OFFLINE')
    expect(mod.classifyPayment('payway_abc')).toBe('PAYWAY')
    expect(mod.classifyPayment('manual_payment')).toBe('MANUAL')
    expect(mod.classifyPayment('trial_xyz')).toBe('TRIAL')
  })
})
