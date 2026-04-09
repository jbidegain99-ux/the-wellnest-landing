/**
 * Financial configuration loader.
 *
 * Fase 1: values are hardcoded defaults derived from the Banco Cuscatlán
 * "Botón de Pago" contract (2026-01-05). Env vars can override each value for
 * quick adjustments without a redeploy.
 *
 * Fase 2 will move these to a `FinancialConfig` DB table with `effectiveFrom`
 * ranges so historical calculations stay correct after a tariff change.
 */

import type { FinancialConfig } from './calculate'

function numFromEnv(key: string, fallback: number): number {
  const raw = process.env[key]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function boolFromEnv(key: string, fallback: boolean): boolean {
  const raw = process.env[key]
  if (raw == null) return fallback
  return raw === '1' || raw.toLowerCase() === 'true'
}

/**
 * Current financial config (valid from the Cuscatlán contract date 2026-01-05).
 *
 * Env overrides:
 *   FIN_IVA_RATE, FIN_IVA_INCLUDED, FIN_GATEWAY_FEE_RATE,
 *   FIN_GATEWAY_FEE_HAS_IVA, FIN_3DS_PER_TXN, FIN_3DS_HAS_IVA,
 *   FIN_RETENCION_ENABLED, FIN_RETENCION_RATE
 */
export function getCurrentFinancialConfig(): FinancialConfig {
  return {
    ivaRate: numFromEnv('FIN_IVA_RATE', 0.13),
    ivaIncludedInPrice: boolFromEnv('FIN_IVA_INCLUDED', true),
    gatewayFeeRate: numFromEnv('FIN_GATEWAY_FEE_RATE', 0.0295),
    gatewayFeeHasIva: boolFromEnv('FIN_GATEWAY_FEE_HAS_IVA', true),
    tds3DsPerTransaction: numFromEnv('FIN_3DS_PER_TXN', 0.16),
    tds3DsHasIva: boolFromEnv('FIN_3DS_HAS_IVA', true),
    retencionEnabled: boolFromEnv('FIN_RETENCION_ENABLED', false),
    retencionRate: numFromEnv('FIN_RETENCION_RATE', 0.01),
  }
}

/**
 * Fixed costs from the contract that don't scale per transaction.
 * Displayed separately in the dashboard reconciliation panel.
 */
export const CUSCATLAN_FIXED_COSTS = {
  annualBotonDePagoUSD: 59.99, // + IVA
  install3DsOneTimeUSD: 20.0, // + IVA
} as const
