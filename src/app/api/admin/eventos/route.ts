import { NextResponse } from 'next/server'
import { getAdminId } from '@/lib/events/admin'
import { createEvent, listEventsWithCounts } from '@/lib/events/adminEvents'
import { eventFormInput, eventFormToData } from '@/lib/events/eventForm'

/** GET: eventos con conteos. POST: crear evento. */
export async function GET() {
  if (!(await getAdminId())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  return NextResponse.json({ events: await listEventsWithCounts() })
}

export async function POST(request: Request) {
  if (!(await getAdminId())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const parsed = eventFormInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  const r = await createEvent(eventFormToData(parsed.data))
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ id: r.id, slug: r.slug }, { status: 201 })
}
