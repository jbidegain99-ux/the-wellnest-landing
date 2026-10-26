// Pedidos de comida de un evento (los registra el equipo a mano desde WhatsApp).
// Sin imports de servidor: lo usa también el cliente.
import { z } from 'zod'

export type FoodMenuItem = { id: string; name: string; priceCents: number }
export type FoodMenu = { vendor: string; items: FoodMenuItem[] }

/** Menú por slug de evento. Un evento sin menú no muestra la pestaña Comida. */
const FOOD_MENUS: Record<string, FoodMenu> = {
  'villains-ball': {
    vendor: 'Carne Calle',
    items: [
      { id: 'la-primera', name: 'La Primera', priceCents: 699 },
      { id: 'melcocha', name: 'Melcocha', priceCents: 699 },
    ],
  },
}

export function foodMenuFor(slug: string): FoodMenu | null {
  return FOOD_MENUS[slug] ?? null
}

/** Línea guardada en el pedido: copia del menú al momento de registrar. */
export type FoodItem = FoodMenuItem & { qty: number }

const MAX_QTY = 50

export type BuildItemsResult = { ok: true; items: FoodItem[]; totalCents: number } | { ok: false; error: string }

export function buildFoodItems(menu: FoodMenu, quantities: Record<string, number>): BuildItemsResult {
  for (const [id, qty] of Object.entries(quantities)) {
    if (!menu.items.some((i) => i.id === id)) return { ok: false, error: 'Ese tipo de hamburguesa no está en el menú' }
    if (!Number.isInteger(qty) || qty < 0 || qty > MAX_QTY) return { ok: false, error: `Cantidad inválida (0 a ${MAX_QTY})` }
  }
  const items = menu.items
    .map((i) => ({ ...i, qty: quantities[i.id] ?? 0 }))
    .filter((i) => i.qty > 0)
  if (items.length === 0) return { ok: false, error: 'Agregá al menos una hamburguesa' }
  return { ok: true, items, totalCents: items.reduce((sum, i) => sum + i.qty * i.priceCents, 0) }
}

const storedItems = z.array(
  z.object({ id: z.string(), name: z.string(), priceCents: z.number().int(), qty: z.number().int() })
)

export function parseStoredItems(value: unknown): FoodItem[] {
  const parsed = storedItems.safeParse(value)
  return parsed.success ? parsed.data : []
}

const nameField = z.string().trim().min(2, 'Escribí el nombre').max(100, 'Nombre muy largo')
const phoneField = z.string().trim().max(30)
const quantitiesField = z.record(z.string(), z.number())
const noteField = z.string().trim().max(300, 'Nota muy larga')

export const foodOrderInput = z.object({
  name: nameField,
  phone: phoneField.default(''),
  quantities: quantitiesField,
  note: noteField.default(''),
  paid: z.boolean().default(false),
})
export type FoodOrderInput = z.infer<typeof foodOrderInput>

/** PATCH: solo cambia lo que llega (sin valores por defecto); paid/delivered con el valor final, no "alternar". */
export const foodOrderPatch = z.object({
  name: nameField.optional(),
  phone: phoneField.optional(),
  quantities: quantitiesField.optional(),
  note: noteField.optional(),
  paid: z.boolean().optional(),
  delivered: z.boolean().optional(),
})
export type FoodOrderPatch = z.infer<typeof foodOrderPatch>

export type FoodOrderRow = {
  id: string
  customerName: string
  customerPhone: string | null
  items: FoodItem[]
  totalCents: number
  note: string | null
  paidAt: string | null
  deliveredAt: string | null
  createdAt: string
}

export type FoodSummary = {
  byItem: { id: string; name: string; qty: number }[]
  burgers: number
  orders: number
  totalCents: number
  paidCents: number
  unpaidCents: number
  deliveredOrders: number
}

export function summarizeFoodOrders(menu: FoodMenu, orders: FoodOrderRow[]): FoodSummary {
  const qty = new Map<string, number>()
  let totalCents = 0
  let paidCents = 0
  let deliveredOrders = 0
  for (const o of orders) {
    for (const i of o.items) qty.set(i.id, (qty.get(i.id) ?? 0) + i.qty)
    totalCents += o.totalCents
    if (o.paidAt) paidCents += o.totalCents
    if (o.deliveredAt) deliveredOrders++
  }
  const byItem = menu.items.map((i) => ({ id: i.id, name: i.name, qty: qty.get(i.id) ?? 0 }))
  return {
    byItem,
    burgers: Array.from(qty.values()).reduce((a, b) => a + b, 0),
    orders: orders.length,
    totalCents,
    paidCents,
    unpaidCents: totalCents - paidCents,
    deliveredOrders,
  }
}

export type FoodFilter = 'todos' | 'sin-pagar' | 'por-entregar' | 'entregados'

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function filterFoodOrders(orders: FoodOrderRow[], filter: FoodFilter, q: string): FoodOrderRow[] {
  const term = fold(q.trim())
  const digits = q.replace(/\D/g, '')
  return orders.filter((o) => {
    if (filter === 'sin-pagar' && o.paidAt) return false
    if (filter === 'por-entregar' && o.deliveredAt) return false
    if (filter === 'entregados' && !o.deliveredAt) return false
    if (!term) return true
    if (fold(o.customerName).includes(term)) return true
    return digits.length >= 4 && !!o.customerPhone && o.customerPhone.includes(digits)
  })
}

export const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`

/** +50377923957 → 7792-3957; otros países quedan en E.164. */
export function phoneLabel(e164: string): string {
  const sv = /^\+503(\d{4})(\d{4})$/.exec(e164)
  return sv ? `${sv[1]}-${sv[2]}` : e164
}

export function itemsLabel(items: FoodItem[]): string {
  return items.map((i) => `${i.qty} ${i.name}`).join(' y ')
}

export function foodOrderMessage(menu: FoodMenu, order: FoodOrderRow, eventName: string): string {
  const firstName = order.customerName.trim().split(/\s+/)[0]
  return `Hola ${firstName}, tu pedido de ${menu.vendor} para ${eventName}: ${itemsLabel(order.items)}. Total: ${usd(order.totalCents)}.`
}
