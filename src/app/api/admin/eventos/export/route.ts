import { prisma } from '@/lib/prisma'
import { getAdminId } from '@/lib/events/admin'
import { buildPaidOrdersCsv } from '@/lib/events/orders'
import { VILLAINS_BALL_SLUG } from '@/lib/events/config'

/** GET: CSV de pedidos pagados (conciliación bancaria). */
export async function GET() {
  if (!(await getAdminId())) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const orders = await prisma.eventOrder.findMany({
    where: { status: 'PAID', event: { slug: VILLAINS_BALL_SLUG } },
    orderBy: { paidAt: 'asc' },
  })
  const adminIds = Array.from(new Set(orders.map((o) => o.confirmedById).filter((x): x is string => !!x)))
  const admins = await prisma.user.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true } })
  const names = new Map(admins.map((a) => [a.id, a.name]))
  const csv = buildPaidOrdersCsv(
    orders.map((o) => ({
      code: o.code,
      buyerName: o.buyerName,
      buyerEmail: o.buyerEmail,
      buyerPhone: o.buyerPhone,
      quantity: o.quantity,
      amountCents: o.amountCents,
      paidAt: o.paidAt ?? o.updatedAt,
      confirmedBy: (o.confirmedById && names.get(o.confirmedById)) || '',
    }))
  )
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="villains-ball-pagados.csv"',
    },
  })
}
