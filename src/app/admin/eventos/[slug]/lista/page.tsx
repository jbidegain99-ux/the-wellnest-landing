import { prisma } from '@/lib/prisma'
import { ticketLabel } from '@/lib/events/codes'
import { PrintButton } from './PrintButton'
import { sortByLastName } from '@/lib/events/guestList'

export const dynamic = 'force-dynamic'

/** Lista de invitados para imprimir (respaldo si falla la señal en la puerta). */
export default async function ListaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = await prisma.event.findUnique({ where: { slug }, select: { name: true } })
  const raw = await prisma.eventTicket.findMany({
    where: { order: { status: 'PAID' }, event: { slug } },
    orderBy: [{ order: { buyerName: 'asc' } }, { seq: 'asc' }],
    select: { seq: true, holderName: true, order: { select: { code: true, buyerName: true, buyerPhone: true } } },
  })
  // Por apellido del comprador; las entradas de un mismo pedido quedan juntas
  const tickets = sortByLastName(raw.map((t) => ({ ...t, buyerName: t.order.buyerName })))
  return (
    <div className="space-y-4">
      <style>{`@media print { aside, nav, header, .no-print { display: none !important; } main { padding: 0 !important; margin: 0 !important; } body { background: #fff !important; } }`}</style>
      <div className="no-print flex items-center justify-between">
        <h1 className="font-serif text-3xl font-semibold">Lista de invitados · {event?.name ?? slug}</h1>
        <PrintButton />
      </div>
      <p className="text-sm text-gray-600">{tickets.length} entradas pagadas · generada {new Date().toLocaleString('es-SV', { timeZone: 'America/El_Salvador' })}</p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="w-10 p-2">✓</th><th className="p-2">Comprador</th><th className="p-2">Titular</th><th className="p-2">Entrada</th><th className="p-2">Teléfono</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={`${t.order.code}-${t.seq}`} className="border-b border-gray-300">
              <td className="p-2"><span className="inline-block h-4 w-4 border border-black" /></td>
              <td className="p-2">{t.order.buyerName}</td>
              <td className="p-2">{t.holderName ?? '—'}</td>
              <td className="p-2 font-mono">{ticketLabel(t.order.code, t.seq)}</td>
              <td className="p-2">{t.order.buyerPhone}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
