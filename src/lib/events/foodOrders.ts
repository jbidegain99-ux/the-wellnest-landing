// Acceso a la base de los pedidos de comida (solo servidor).
import type { EventFoodOrder, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizePhone } from './phone'
import { buildFoodItems, foodMenuFor, parseStoredItems, type FoodMenu, type FoodOrderInput, type FoodOrderPatch, type FoodOrderRow } from './food'

type Fail = { ok: false; status: number; error: string }

export function toFoodRow(o: EventFoodOrder): FoodOrderRow {
  return {
    id: o.id,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    items: parseStoredItems(o.items),
    totalCents: o.totalCents,
    note: o.note,
    paidAt: o.paidAt?.toISOString() ?? null,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
  }
}

/** Teléfono opcional: vacío = null; con texto debe ser válido. */
function phoneOrNull(phone: string): { ok: true; value: string | null } | Fail {
  if (!phone.trim()) return { ok: true, value: null }
  const r = normalizePhone(phone)
  return r.ok ? { ok: true, value: r.e164 } : { ok: false, status: 400, error: r.error }
}

async function eventWithMenu(slug: string): Promise<{ ok: true; event: { id: string; name: string }; menu: FoodMenu } | Fail> {
  const menu = foodMenuFor(slug)
  if (!menu) return { ok: false, status: 404, error: 'Este evento no tiene comida' }
  const event = await prisma.event.findUnique({ where: { slug }, select: { id: true, name: true } })
  if (!event) return { ok: false, status: 404, error: 'Evento no encontrado' }
  return { ok: true, event, menu }
}

export async function listFoodOrders(slug: string) {
  const ev = await eventWithMenu(slug)
  if (!ev.ok) return ev
  const orders = await prisma.eventFoodOrder.findMany({
    where: { eventId: ev.event.id },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  })
  return { ok: true as const, event: ev.event, menu: ev.menu, orders: orders.map(toFoodRow) }
}

export async function createFoodOrder(slug: string, input: FoodOrderInput, adminId: string) {
  const ev = await eventWithMenu(slug)
  if (!ev.ok) return ev
  const built = buildFoodItems(ev.menu, input.quantities)
  if (!built.ok) return { ok: false as const, status: 400, error: built.error }
  const phone = phoneOrNull(input.phone)
  if (!phone.ok) return phone
  const order = await prisma.eventFoodOrder.create({
    data: {
      eventId: ev.event.id,
      customerName: input.name,
      customerPhone: phone.value,
      items: built.items,
      totalCents: built.totalCents,
      note: input.note || null,
      paidAt: input.paid ? new Date() : null,
      createdById: adminId,
    },
  })
  return { ok: true as const, order: toFoodRow(order) }
}

export async function updateFoodOrder(id: string, patch: FoodOrderPatch) {
  const current = await prisma.eventFoodOrder.findUnique({ where: { id }, include: { event: { select: { slug: true } } } })
  if (!current) return { ok: false as const, status: 404, error: 'El pedido ya no existe. Recargá la lista.' }

  const data: Prisma.EventFoodOrderUpdateInput = {}
  if (patch.name !== undefined) data.customerName = patch.name
  if (patch.note !== undefined) data.note = patch.note || null
  if (patch.phone !== undefined) {
    const phone = phoneOrNull(patch.phone)
    if (!phone.ok) return phone
    data.customerPhone = phone.value
  }
  if (patch.quantities !== undefined) {
    const menu = foodMenuFor(current.event.slug)
    if (!menu) return { ok: false as const, status: 404, error: 'Este evento no tiene comida' }
    const built = buildFoodItems(menu, patch.quantities)
    if (!built.ok) return { ok: false as const, status: 400, error: built.error }
    data.items = built.items
    data.totalCents = built.totalCents
  }
  // Se conserva la hora original si ya estaba marcado (dos teléfonos marcando lo mismo).
  if (patch.paid !== undefined) data.paidAt = patch.paid ? (current.paidAt ?? new Date()) : null
  if (patch.delivered !== undefined) data.deliveredAt = patch.delivered ? (current.deliveredAt ?? new Date()) : null

  const order = await prisma.eventFoodOrder.update({ where: { id }, data })
  return { ok: true as const, order: toFoodRow(order) }
}

export async function deleteFoodOrder(id: string) {
  const { count } = await prisma.eventFoodOrder.deleteMany({ where: { id } })
  return count > 0
}
