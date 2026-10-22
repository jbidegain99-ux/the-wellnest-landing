import { NextResponse } from 'next/server'
import { getAdminId } from '@/lib/events/admin'
import { confirmEventOrder } from '@/lib/events/orders'
import { buildTicketsEmail } from '@/lib/events/emails'
import { ticketLabel } from '@/lib/events/codes'
import { ticketUrl } from '@/lib/events/whatsapp'
import { sendEmail } from '@/lib/emailService'

/** POST: confirmar el pago de un pedido (después de verlo en el banco). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getAdminId()
  if (!adminId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params

  const result = await confirmEventOrder(id, adminId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  let emailSent = false
  try {
    const sent = await sendEmail({
      to: result.order.buyerEmail,
      subject: 'Tu invitación a The Villains Ball',
      html: buildTicketsEmail({
        buyerName: result.order.buyerName,
        tickets: result.tickets.map((t) => ({ label: ticketLabel(result.order.code, t.seq), url: ticketUrl(t.token) })),
      }),
    })
    emailSent = sent.success
    if (!sent.success) console.error(`[EVENTO] Correo de entradas falló para ${result.order.code}: ${sent.error}`)
  } catch (e) {
    console.error(`[EVENTO] Correo de entradas falló para ${result.order.code}`, e)
  }

  return NextResponse.json({ whatsappUrl: result.whatsappUrl, overCapacity: result.overCapacity, emailSent })
}
