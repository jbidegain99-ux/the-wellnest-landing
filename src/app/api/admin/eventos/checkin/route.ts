import { NextResponse } from 'next/server'
import { getAdminId } from '@/lib/events/admin'
import { checkInTicket, countInside, extractTicketToken, undoCheckIn } from '@/lib/events/checkin'

function str(body: unknown, key: string): string | null {
  if (typeof body !== 'object' || body === null || !(key in body)) return null
  const v = (body as Record<string, unknown>)[key]
  return typeof v === 'string' ? v : null
}

/** POST { scanned?: string; ticketId?: string } → resultado del check-in (los rechazos son 200). */
export async function POST(request: Request) {
  const adminId = await getAdminId()
  if (!adminId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body: unknown = await request.json().catch(() => null)
  const ticketId = str(body, 'ticketId')
  const scanned = str(body, 'scanned')
  const evento = str(body, 'evento') ?? undefined

  let result
  if (ticketId) result = await checkInTicket({ ticketId }, adminId, new Date(), evento)
  else {
    const token = scanned ? extractTicketToken(scanned) : null
    result = token ? await checkInTicket({ token }, adminId, new Date(), evento) : { kind: 'unknown' as const }
  }
  return NextResponse.json({ result, inside: await countInside(evento) })
}

/** DELETE { ticketId } → deshacer un check-in de hace menos de 30 s. */
export async function DELETE(request: Request) {
  if (!(await getAdminId())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body: unknown = await request.json().catch(() => null)
  const ticketId = str(body, 'ticketId')
  if (!ticketId) return NextResponse.json({ error: 'Falta ticketId' }, { status: 400 })
  const undone = await undoCheckIn(ticketId)
  return NextResponse.json({ undone, inside: await countInside(str(body, 'evento') ?? undefined) })
}
