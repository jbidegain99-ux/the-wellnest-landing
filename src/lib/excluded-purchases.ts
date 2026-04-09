/**
 * Helpers para excluir purchases de los reportes financieros.
 *
 * Las purchases en la tabla `ExcludedPurchase` son ventas registradas en el
 * sistema pero que NO representan dinero recibido (paquetes fake del flujo de
 * compartir mal hecho, trueques, ventas no cobradas, etc.).
 *
 * Estas exclusiones SOLO afectan reportes financieros — las clases y
 * reservas asociadas a cada Purchase siguen activas.
 */

import { prisma } from '@/lib/prisma'

/**
 * Devuelve el set de purchaseIds excluidos de los reportes financieros.
 * Cachear en memoria del request es responsabilidad del caller si se llama
 * múltiples veces en el mismo handler.
 */
export async function getExcludedPurchaseIds(): Promise<string[]> {
  const rows = await prisma.excludedPurchase.findMany({
    select: { purchaseId: true },
  })
  return rows.map((r) => r.purchaseId)
}

/**
 * Devuelve un fragmento `where` de Prisma listo para combinar con `AND`:
 *   { id: { notIn: [...] } }
 *
 * Si no hay exclusiones, devuelve `{}` para no agregar filtro inútil.
 */
export async function buildExcludedPurchaseWhere(): Promise<{
  id?: { notIn: string[] }
}> {
  const ids = await getExcludedPurchaseIds()
  if (ids.length === 0) return {}
  return { id: { notIn: ids } }
}
