import { NextResponse } from 'next/server'
import { getAdminId } from '@/lib/events/admin'
import { cancelEventOrder } from '@/lib/events/orders'

/** POST { note?: string }: cancelar un pendiente o anular un pagado (nota obligatoria). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getAdminId()
  if (!adminId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const body: unknown = await request.json().catch(() => ({}))
  const note = typeof body === 'object' && body !== null && 'note' in body && typeof body.note === 'string' ? body.note : null
  const result = await cancelEventOrder(id, adminId, note)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true })
}
