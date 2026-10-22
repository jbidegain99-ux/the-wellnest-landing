import { NextResponse } from 'next/server'
import { getAdminId, listAdminOrders, type AdminTab } from '@/lib/events/admin'

const TABS: AdminTab[] = ['pendientes', 'pagados', 'otros']

/** GET /api/admin/eventos/pedidos?evento=<slug>&tab=pendientes|pagados|otros&q= */
export async function GET(request: Request) {
  if (!(await getAdminId())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const url = new URL(request.url)
  const tabParam = url.searchParams.get('tab') ?? 'pendientes'
  const tab: AdminTab = TABS.includes(tabParam as AdminTab) ? (tabParam as AdminTab) : 'pendientes'
  const slug = url.searchParams.get('evento')
  if (!slug) return NextResponse.json({ error: 'Falta el evento' }, { status: 400 })
  const data = await listAdminOrders(slug, tab, url.searchParams.get('q') ?? '')
  if (!data) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
  return NextResponse.json(data)
}
