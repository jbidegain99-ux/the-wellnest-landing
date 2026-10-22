import { NextResponse } from 'next/server'
import { getAdminId, listAdminOrders, type AdminTab } from '@/lib/events/admin'
import { VILLAINS_BALL_SLUG } from '@/lib/events/config'

const TABS: AdminTab[] = ['pendientes', 'pagados', 'otros']

/** GET /api/admin/eventos/pedidos?tab=pendientes|pagados|otros&q= */
export async function GET(request: Request) {
  if (!(await getAdminId())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const url = new URL(request.url)
  const tabParam = url.searchParams.get('tab') ?? 'pendientes'
  const tab: AdminTab = TABS.includes(tabParam as AdminTab) ? (tabParam as AdminTab) : 'pendientes'
  const data = await listAdminOrders(VILLAINS_BALL_SLUG, tab, url.searchParams.get('q') ?? '')
  if (!data) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
  return NextResponse.json(data)
}
