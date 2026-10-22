import { NextResponse } from 'next/server'
import { getAdminId } from '@/lib/events/admin'
import { countInside, searchTickets } from '@/lib/events/checkin'

/** GET ?q= → entradas que coinciden (búsqueda manual en la puerta) + cuántos hay adentro. */
export async function GET(request: Request) {
  if (!(await getAdminId())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const q = new URL(request.url).searchParams.get('q') ?? ''
  const [results, inside] = await Promise.all([searchTickets(q), countInside()])
  return NextResponse.json({ results, inside })
}
