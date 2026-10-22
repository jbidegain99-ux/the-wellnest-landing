import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminId } from '@/lib/events/admin'
import { setEventFlags, updateEvent } from '@/lib/events/adminEvents'
import { eventFormInput, eventFormToData } from '@/lib/events/eventForm'

type Ctx = { params: Promise<{ id: string }> }

/** GET: un evento (para el formulario de edición). */
export async function GET(_request: Request, { params }: Ctx) {
  if (!(await getAdminId())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const event = await prisma.event.findUnique({ where: { id } })
  if (!event) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
  return NextResponse.json({ event })
}

/** PUT: guardar el formulario completo. */
export async function PUT(request: Request, { params }: Ctx) {
  if (!(await getAdminId())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const parsed = eventFormInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  const r = await updateEvent(id, eventFormToData(parsed.data))
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ ok: true })
}

/** PATCH { isActive?, salesOpen? }: interruptores de la lista. */
export async function PATCH(request: Request, { params }: Ctx) {
  if (!(await getAdminId())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const body: unknown = await request.json().catch(() => null)
  const obj = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  const flags = {
    ...(typeof obj.isActive === 'boolean' ? { isActive: obj.isActive } : {}),
    ...(typeof obj.salesOpen === 'boolean' ? { salesOpen: obj.salesOpen } : {}),
  }
  if (Object.keys(flags).length === 0) return NextResponse.json({ error: 'Nada que cambiar' }, { status: 400 })
  const r = await setEventFlags(id, flags)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ ok: true })
}
