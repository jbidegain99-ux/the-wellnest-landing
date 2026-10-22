import { NextResponse } from 'next/server'
import { checkRateLimit, requestIp } from '@/lib/rateLimit'
import { activateFromTicket } from '@/lib/events/activate'

/** POST: "Activar mi cuenta" desde la carta de después del show. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const rl = checkRateLimit(`evento-activar:${requestIp(request)}`, 5, 15 * 60 * 1000)
  if (!rl.allowed) return NextResponse.json({ error: 'Demasiados intentos. Probá de nuevo en unos minutos.' }, { status: 429 })
  const { token } = await params
  const r = await activateFromTicket(token)
  if (r.result === 'not-found') return NextResponse.json(r, { status: 404 })
  if (r.result === 'email-failed') return NextResponse.json(r, { status: 502 })
  return NextResponse.json(r)
}
