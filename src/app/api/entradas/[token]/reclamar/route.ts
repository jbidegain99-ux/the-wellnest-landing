import { NextResponse } from 'next/server'
import { checkRateLimit, requestIp } from '@/lib/rateLimit'
import { claimTicketInput } from '@/lib/events/schemas'
import { claimTicket } from '@/lib/events/orders'

/** POST: un acompañante reclama su invitación con sus datos. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const rl = checkRateLimit(`evento-reclamar:${requestIp(request)}`, 10, 10 * 60 * 1000)
  if (!rl.allowed) return NextResponse.json({ error: 'Demasiados intentos. Probá de nuevo en unos minutos.' }, { status: 429 })
  const { token } = await params
  const body: unknown = await request.json().catch(() => null)
  const parsed = claimTicketInput.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  const result = await claimTicket(token, parsed.data)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true })
}
