import { NextResponse } from 'next/server'
import { getAdminId } from '@/lib/events/admin'
import { foodOrderInput } from '@/lib/events/food'
import { createFoodOrder, listFoodOrders } from '@/lib/events/foodOrders'

/** GET /api/admin/eventos/comida?evento=<slug>: menú y pedidos de comida del evento. */
export async function GET(request: Request) {
  if (!(await getAdminId())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const slug = new URL(request.url).searchParams.get('evento')
  if (!slug) return NextResponse.json({ error: 'Falta el evento' }, { status: 400 })
  const result = await listFoodOrders(slug)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ event: result.event, menu: result.menu, orders: result.orders })
}

/** POST /api/admin/eventos/comida?evento=<slug> { name, phone?, quantities, note?, paid? } */
export async function POST(request: Request) {
  const adminId = await getAdminId()
  if (!adminId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const slug = new URL(request.url).searchParams.get('evento')
  if (!slug) return NextResponse.json({ error: 'Falta el evento' }, { status: 400 })
  const parsed = foodOrderInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  const result = await createFoodOrder(slug, parsed.data, adminId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ order: result.order }, { status: 201 })
}
