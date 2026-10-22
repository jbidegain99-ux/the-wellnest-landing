import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminId } from '@/lib/events/admin'

/** POST: registrar que el admin abrió el WhatsApp con la invitación. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminId())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const r = await prisma.eventOrder.updateMany({ where: { id, status: 'PAID' }, data: { whatsappSentAt: new Date() } })
  if (r.count === 0) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
