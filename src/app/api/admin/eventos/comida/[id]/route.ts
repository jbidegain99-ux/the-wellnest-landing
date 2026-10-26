import { NextResponse } from 'next/server'
import { getAdminId } from '@/lib/events/admin'
import { foodOrderPatch } from '@/lib/events/food'
import { deleteFoodOrder, updateFoodOrder } from '@/lib/events/foodOrders'

/** PATCH { name?, phone?, quantities?, note?, paid?, delivered? }: editar o marcar pago/entrega. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminId())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const parsed = foodOrderPatch.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  const result = await updateFoodOrder(id, parsed.data)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ order: result.order })
}

/** DELETE: borrar un pedido mal registrado. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminId())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  if (!(await deleteFoodOrder(id))) return NextResponse.json({ error: 'El pedido ya no existe' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
