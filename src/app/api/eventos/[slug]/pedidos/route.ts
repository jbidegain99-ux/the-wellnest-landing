import { NextResponse } from 'next/server'
import { checkRateLimit, requestIp } from '@/lib/rateLimit'
import { sendEmail } from '@/lib/emailService'
import { createOrderInput } from '@/lib/events/schemas'
import { createEventOrder } from '@/lib/events/orders'
import { buildPaymentInstructionsEmail } from '@/lib/events/emails'
import { siteUrl } from '@/lib/events/config'

/** POST /api/eventos/[slug]/pedidos — crea un pedido PENDING (pago por transferencia). */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const rl = checkRateLimit(`evento-pedido:${requestIp(request)}`, 5, 10 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiados intentos. Probá de nuevo en unos minutos.' }, { status: 429 })
  }

  const { slug } = await params
  const body: unknown = await request.json().catch(() => null)
  const parsed = createOrderInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  }

  const result = await createEventOrder(slug, parsed.data)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const orderUrl = `${siteUrl()}/eventos/pedido/${result.accessToken}`
  try {
    const sent = await sendEmail({
      to: parsed.data.email.trim().toLowerCase(),
      subject: `Tu pedido ${result.code} · ${result.event.name}`,
      html: buildPaymentInstructionsEmail({
        buyerName: parsed.data.name.trim(),
        code: result.code,
        amountCents: result.amountCents,
        quantity: parsed.data.quantity,
        orderUrl,
        event: result.event,
      }),
    })
    if (!sent.success) console.error(`[EVENTO] Correo de instrucciones falló para ${result.code}: ${sent.error}`)
  } catch (e) {
    console.error(`[EVENTO] Correo de instrucciones falló para ${result.code}`, e)
  }

  return NextResponse.json({ accessToken: result.accessToken, code: result.code }, { status: 201 })
}
