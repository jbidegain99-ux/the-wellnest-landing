/**
 * Reintentos ante fallas de conexión a la BD.
 *
 * Producción se ha quedado sin conexiones (FATAL: too many connections) en
 * ráfagas de ~2 minutos. Sin reintento, un callback de pago que cae en esa
 * ventana deja la tarjeta cobrada y la orden sin acreditar.
 *
 * Solo se reintentan errores donde la query nunca llegó a ejecutarse (o su
 * transacción hizo rollback), así que reintentar es seguro para operaciones
 * idempotentes.
 */

import { Prisma } from '@prisma/client'

const TRANSIENT_CODES = new Set([
  'P1001', // Can't reach database server
  'P1002', // Database server timed out
  'P1008', // Operations timed out
  'P1017', // Server has closed the connection
  'P2024', // Timed out fetching a connection from the pool
  'P2037', // Too many database connections opened
])

export function isTransientDbError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true
  if (error instanceof Prisma.PrismaClientKnownRequestError) return TRANSIENT_CODES.has(error.code)
  return false
}

/**
 * Ejecuta `fn`; si falla con un error transitorio espera `delaysMs[i]` y
 * reintenta. Hace como máximo `delaysMs.length` reintentos.
 */
export async function withDbRetry<T>(fn: () => Promise<T>, delaysMs: readonly number[]): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (!isTransientDbError(error) || attempt >= delaysMs.length) throw error
      console.warn(`[DB RETRY] Transient DB error, retrying in ${delaysMs[attempt]}ms (attempt ${attempt + 1})`)
      await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]))
    }
  }
}
