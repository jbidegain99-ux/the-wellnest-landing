import { NextResponse } from 'next/server'
import { getAdminId } from '@/lib/events/admin'
import { countInside, searchTickets } from '@/lib/events/checkin'

/** GET ?q= → entradas que coinciden (búsqueda manual en la puerta) + cuántos hay adentro. */
export async function GET(request: Request) {
  if (!(await getAdminId())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const url = new URL(request.url)
  const q = url.searchParams.get('q') ?? ''
  const evento = url.searchParams.get('evento') ?? undefined
  const [results, inside] = await Promise.all([searchTickets(q, evento), countInside(evento)])
  return NextResponse.json({ results, inside })
}
