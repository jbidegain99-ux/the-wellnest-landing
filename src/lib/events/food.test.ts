import { describe, it, expect } from 'vitest'
import { buildFoodItems, filterFoodOrders, foodMenuFor, foodOrderInput, foodOrderMessage, foodOrderPatch, parseStoredItems, phoneLabel, summarizeFoodOrders, type FoodOrderRow } from './food'

const menu = foodMenuFor('villains-ball')!

const row = (over: Partial<FoodOrderRow>): FoodOrderRow => ({
  id: 'o1',
  customerName: 'Ana López',
  customerPhone: null,
  items: [{ id: 'la-primera', name: 'La Primera', priceCents: 699, qty: 1 }],
  totalCents: 699,
  note: null,
  paidAt: null,
  deliveredAt: null,
  createdAt: '2026-10-26T15:00:00.000Z',
  ...over,
})

describe('foodMenuFor', () => {
  it('The Villains Ball tiene La Primera y Melcocha a $6.99', () => {
    expect(menu.items.map((i) => [i.name, i.priceCents])).toEqual([['La Primera', 699], ['Melcocha', 699]])
  })
  it('un evento sin menú no tiene comida', () => expect(foodMenuFor('otro')).toBeNull())
})

describe('buildFoodItems', () => {
  it('varias hamburguesas de los dos tipos en un pedido', () => {
    const r = buildFoodItems(menu, { 'la-primera': 2, melcocha: 1 })
    expect(r).toEqual({
      ok: true,
      totalCents: 2097,
      items: [
        { id: 'la-primera', name: 'La Primera', priceCents: 699, qty: 2 },
        { id: 'melcocha', name: 'Melcocha', priceCents: 699, qty: 1 },
      ],
    })
  })
  it('omite los tipos en 0', () => {
    const r = buildFoodItems(menu, { 'la-primera': 0, melcocha: 3 })
    expect(r.ok && r.items.map((i) => i.id)).toEqual(['melcocha'])
  })
  it('pedido vacío es error', () => expect(buildFoodItems(menu, { 'la-primera': 0 }).ok).toBe(false))
  it('tipo que no está en el menú es error', () => expect(buildFoodItems(menu, { pizza: 1 }).ok).toBe(false))
  it('cantidades negativas o con decimales son error', () => {
    expect(buildFoodItems(menu, { melcocha: -1 }).ok).toBe(false)
    expect(buildFoodItems(menu, { melcocha: 1.5 }).ok).toBe(false)
  })
})

describe('parseStoredItems', () => {
  it('lee lo guardado', () =>
    expect(parseStoredItems([{ id: 'melcocha', name: 'Melcocha', priceCents: 699, qty: 2 }])).toEqual([
      { id: 'melcocha', name: 'Melcocha', priceCents: 699, qty: 2 },
    ]))
  it('basura → lista vacía', () => expect(parseStoredItems('x')).toEqual([]))
})

describe('summarizeFoodOrders', () => {
  it('cuenta hamburguesas por tipo, cobrado, por cobrar y entregas', () => {
    const s = summarizeFoodOrders(menu, [
      row({ id: 'a', items: [{ id: 'la-primera', name: 'La Primera', priceCents: 699, qty: 2 }], totalCents: 1398, paidAt: '2026-10-26T16:00:00.000Z' }),
      row({ id: 'b', items: [{ id: 'melcocha', name: 'Melcocha', priceCents: 699, qty: 1 }], totalCents: 699, deliveredAt: '2026-10-31T02:00:00.000Z' }),
    ])
    expect(s).toEqual({
      byItem: [
        { id: 'la-primera', name: 'La Primera', qty: 2 },
        { id: 'melcocha', name: 'Melcocha', qty: 1 },
      ],
      burgers: 3,
      orders: 2,
      totalCents: 2097,
      paidCents: 1398,
      unpaidCents: 699,
      deliveredOrders: 1,
    })
  })
})

describe('filterFoodOrders', () => {
  const orders = [
    row({ id: 'a', customerName: 'Ana López', paidAt: 'x' }),
    row({ id: 'b', customerName: 'Beatriz Núñez', customerPhone: '+50377923957', deliveredAt: 'x' }),
  ]
  it('pago pendiente', () => expect(filterFoodOrders(orders, 'sin-pagar', '').map((o) => o.id)).toEqual(['b']))
  it('por entregar', () => expect(filterFoodOrders(orders, 'por-entregar', '').map((o) => o.id)).toEqual(['a']))
  it('entregados', () => expect(filterFoodOrders(orders, 'entregados', '').map((o) => o.id)).toEqual(['b']))
  it('busca por nombre sin tildes ni mayúsculas', () =>
    expect(filterFoodOrders(orders, 'todos', 'nunez').map((o) => o.id)).toEqual(['b']))
  it('busca por teléfono con 4+ dígitos', () =>
    expect(filterFoodOrders(orders, 'todos', '7792-3957').map((o) => o.id)).toEqual(['b']))
})

describe('foodOrderMessage', () => {
  it('resume el pedido para WhatsApp', () => {
    const m = foodOrderMessage(menu, row({
      customerName: 'Ana López',
      items: [
        { id: 'la-primera', name: 'La Primera', priceCents: 699, qty: 2 },
        { id: 'melcocha', name: 'Melcocha', priceCents: 699, qty: 1 },
      ],
      totalCents: 2097,
    }), 'The Villains Ball')
    expect(m).toBe('Hola Ana, tu pedido de Carne Calle para The Villains Ball: 2 La Primera y 1 Melcocha. Total: $20.97.')
  })
})

describe('esquemas', () => {
  it('marcar pagado no toca nombre, teléfono ni nota', () =>
    expect(foodOrderPatch.parse({ paid: true })).toEqual({ paid: true }))
  it('registrar sin teléfono ni nota', () =>
    expect(foodOrderInput.parse({ name: ' Ana ', quantities: { melcocha: 1 } })).toEqual({
      name: 'Ana', phone: '', quantities: { melcocha: 1 }, note: '', paid: false,
    }))
})

describe('phoneLabel', () => {
  it('SV con guion', () => expect(phoneLabel('+50377923957')).toBe('7792-3957'))
  it('otro país tal cual', () => expect(phoneLabel('+15551234567')).toBe('+15551234567'))
})
