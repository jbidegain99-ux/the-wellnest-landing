import type { EventOrderStatus } from '@prisma/client'

export type TicketPhase = 'cancelled' | 'unclaimed' | 'ready' | 'after-attended' | 'after-missed'

/** Qué muestra /entrada/[token] según el estado de la entrada y la hora. */
export function ticketPhase(
  t: { orderStatus: EventOrderStatus; claimedAt: Date | null; checkedInAt: Date | null },
  event: { endsAt: Date },
  now: Date
): TicketPhase {
  if (t.orderStatus === 'CANCELLED') return 'cancelled'
  if (now.getTime() > event.endsAt.getTime()) return t.checkedInAt ? 'after-attended' : 'after-missed'
  if (!t.claimedAt) return 'unclaimed'
  return 'ready'
}
