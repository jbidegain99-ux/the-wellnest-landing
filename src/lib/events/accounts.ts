import type { PrismaClient } from '@prisma/client'

// Acepta el cliente global o el `tx` de una transacción
export type DbClient = Pick<PrismaClient, 'user'>

/**
 * Busca la cuenta por correo (sin importar mayúsculas) o la crea sin
 * contraseña. Una cuenta existente no se modifica, salvo completar el
 * teléfono si no tenía: nunca cambia de dueño por comprar una entrada.
 */
export async function findOrCreateUserByEmail(
  db: DbClient,
  p: { name: string; email: string; phone: string }
): Promise<{ id: string; created: boolean }> {
  const email = p.email.trim().toLowerCase()
  const existing = await db.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, phone: true },
  })
  if (existing) {
    if (!existing.phone) {
      await db.user.update({ where: { id: existing.id }, data: { phone: p.phone } })
    }
    return { id: existing.id, created: false }
  }
  const user = await db.user.create({
    data: { name: p.name.trim(), email, phone: p.phone, password: null },
    select: { id: true },
  })
  return { id: user.id, created: true }
}
