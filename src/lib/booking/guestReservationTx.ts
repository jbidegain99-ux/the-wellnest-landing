import type { Prisma } from '@prisma/client'

/**
 * Crea (o reactiva) la reserva de la titular y la de su invitado dentro de
 * una transacción ya abierta. No toca créditos ni cupos: eso lo hace quien
 * llama, antes, bajo el lock de la clase.
 *
 * Existe un único índice (userId, classId, isGuestReservation), así que si la
 * titular ya tuvo reserva en la clase y se canceló (ella misma o el admin),
 * hay que reutilizar esas filas: un create chocaría con el índice.
 */

const hostInclude = {
  class: { include: { discipline: true, instructor: true } },
  purchase: { include: { package: true } },
} satisfies Prisma.ReservationInclude

export type HostReservationWithClass = Prisma.ReservationGetPayload<{ include: typeof hostInclude }>

/** El invitado ya tiene una reserva viva en esta clase. */
export const GUEST_ALREADY_ACTIVE = 'GUEST_ALREADY_ACTIVE'
/** La reserva cancelada cambió de estado mientras reservábamos (doble clic, otra pestaña). */
export const RESERVATION_CHANGED_RACE = 'RESERVATION_CHANGED_RACE'

export interface GuestReservationParams {
  userId: string
  classId: string
  purchaseId: string
  guestEmail: string
  guestName: string | null
  /** id de la reserva propia CANCELADA que se reactiva, o null si no hay */
  cancelledHostId: string | null
}

type ReservationTx = Pick<Prisma.TransactionClient, 'reservation'>

const reactivatedFields = {
  status: 'CONFIRMED' as const,
  cancelledAt: null,
  checkedIn: false,
  checkedInAt: null,
  checkedInBy: null,
}

export async function confirmHostAndGuestInTx(
  tx: ReservationTx,
  params: GuestReservationParams
): Promise<HostReservationWithClass> {
  const { userId, classId, purchaseId, guestEmail, guestName, cancelledHostId } = params

  const existingGuest = await tx.reservation.findFirst({
    where: { userId, classId, isGuestReservation: true },
    select: { id: true, status: true },
  })
  if (existingGuest && existingGuest.status !== 'CANCELLED') {
    throw new Error(GUEST_ALREADY_ACTIVE)
  }

  let host: HostReservationWithClass
  if (cancelledHostId) {
    const claim = await tx.reservation.updateMany({
      where: { id: cancelledHostId, status: 'CANCELLED' },
      data: { ...reactivatedFields, purchaseId },
    })
    if (claim.count === 0) throw new Error(RESERVATION_CHANGED_RACE)
    host = await tx.reservation.findUniqueOrThrow({
      where: { id: cancelledHostId },
      include: hostInclude,
    })
  } else {
    host = await tx.reservation.create({
      data: { userId, classId, purchaseId, status: 'CONFIRMED', isGuestReservation: false },
      include: hostInclude,
    })
  }

  const guestFields = { guestEmail, guestName, guestStatus: 'ACCEPTED' }
  if (existingGuest) {
    const claim = await tx.reservation.updateMany({
      where: { id: existingGuest.id, status: 'CANCELLED' },
      data: { ...reactivatedFields, ...guestFields, purchaseId },
    })
    if (claim.count === 0) throw new Error(RESERVATION_CHANGED_RACE)
  } else {
    await tx.reservation.create({
      data: {
        userId,
        classId,
        purchaseId,
        status: 'CONFIRMED',
        isGuestReservation: true,
        ...guestFields,
      },
    })
  }

  return host
}
