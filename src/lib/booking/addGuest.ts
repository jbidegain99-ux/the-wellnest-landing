import type { Prisma } from '@prisma/client'

/**
 * Agregar un invitado a una reserva que ya existe (desde "Mis Reservas").
 *
 * El invitado usa 1 clase del MISMO paquete con que la titular reservó (igual
 * que al reservar con invitado desde /reservar) y ocupa 1 cupo más en la clase.
 */

export type AddGuestError =
  | 'NOT_FOUND'
  | 'NOT_ACTIVE'
  | 'CLASS_UNAVAILABLE'
  | 'CLASS_STARTED'
  | 'NOT_SHAREABLE'
  | 'PACKAGE_EXPIRED'
  | 'NO_CREDITS'
  | 'SAME_EMAIL'
  | 'GUEST_ALREADY_ACTIVE'
  | 'CLASS_FULL'

export const ADD_GUEST_MESSAGES: Record<AddGuestError, string> = {
  NOT_FOUND: 'No encontramos esta reserva.',
  NOT_ACTIVE: 'Esta reserva ya no está activa.',
  CLASS_UNAVAILABLE: 'Esta clase no admite invitados.',
  CLASS_STARTED: 'La clase ya empezó; no se pueden agregar invitados.',
  NOT_SHAREABLE: 'El paquete con que reservaste esta clase no permite llevar invitados.',
  PACKAGE_EXPIRED: 'El paquete con que reservaste esta clase ya venció.',
  NO_CREDITS: 'Tu paquete no tiene clases disponibles para el invitado.',
  SAME_EMAIL: 'El correo del invitado debe ser distinto al tuyo.',
  GUEST_ALREADY_ACTIVE: 'Ya tienes un invitado en esta clase.',
  CLASS_FULL: 'La clase está llena; no queda cupo para tu invitado.',
}

/** Error de negocio lanzado dentro de la transacción. */
export class AddGuestFailure extends Error {
  constructor(public readonly reason: AddGuestError) {
    super(reason)
    this.name = 'AddGuestFailure'
  }
}

export interface HostReservationForGuest {
  userId: string
  isGuestReservation: boolean
  status: string
  class: { dateTime: Date; isCancelled: boolean; isPrivate: boolean }
  purchase: {
    status: string
    classesRemaining: number
    expiresAt: Date
    package: { isShareable: boolean; maxShares: number }
  }
}

/** Reglas que no dependen de la concurrencia. null = se puede agregar. */
export function checkAddGuestEligibility(
  reservation: HostReservationForGuest | null,
  sessionUserId: string,
  sessionEmail: string | null | undefined,
  guestEmail: string,
  now: Date
): AddGuestError | null {
  if (!reservation || reservation.userId !== sessionUserId || reservation.isGuestReservation) {
    return 'NOT_FOUND'
  }
  if (reservation.status !== 'CONFIRMED') return 'NOT_ACTIVE'
  if (reservation.class.isCancelled || reservation.class.isPrivate) return 'CLASS_UNAVAILABLE'
  if (reservation.class.dateTime <= now) return 'CLASS_STARTED'

  const { purchase } = reservation
  if (!purchase.package.isShareable || purchase.package.maxShares < 1) return 'NOT_SHAREABLE'
  if (purchase.expiresAt <= now) return 'PACKAGE_EXPIRED'
  if (purchase.status !== 'ACTIVE' || purchase.classesRemaining < 1) return 'NO_CREDITS'

  if (sessionEmail && sessionEmail.trim().toLowerCase() === guestEmail.trim().toLowerCase()) {
    return 'SAME_EMAIL'
  }
  return null
}

export interface AddGuestTxParams {
  hostReservationId: string
  userId: string
  classId: string
  maxCapacity: number
  purchaseId: string
  guestEmail: string
  guestName: string | null
}

type AddGuestTx = Pick<Prisma.TransactionClient, '$queryRaw' | 'reservation' | 'purchase'>

/**
 * Bajo lock de la clase: verifica cupo, que la titular siga confirmada y que
 * no haya invitado vivo; crea (o reactiva) la fila del invitado y descuenta 1
 * clase del paquete. Lanza AddGuestFailure ante cualquier regla rota, así la
 * transacción se revierte entera.
 */
export async function addGuestToReservationInTx(
  tx: AddGuestTx,
  p: AddGuestTxParams
): Promise<{ guestReservationId: string; classesRemaining: number }> {
  const rows = await tx.$queryRaw<Array<{ isCancelled: boolean }>>`
    SELECT "isCancelled" FROM "Class" WHERE id = ${p.classId} FOR UPDATE`
  if (rows.length === 0 || rows[0].isCancelled) throw new AddGuestFailure('CLASS_UNAVAILABLE')

  const host = await tx.reservation.findFirst({
    where: { id: p.hostReservationId, status: 'CONFIRMED' },
    select: { id: true },
  })
  if (!host) throw new AddGuestFailure('NOT_ACTIVE')

  const activeCount = await tx.reservation.count({
    where: { classId: p.classId, status: { not: 'CANCELLED' } },
  })
  if (activeCount + 1 > p.maxCapacity) throw new AddGuestFailure('CLASS_FULL')

  const existingGuest = await tx.reservation.findFirst({
    where: { userId: p.userId, classId: p.classId, isGuestReservation: true },
    select: { id: true, status: true },
  })
  if (existingGuest && existingGuest.status !== 'CANCELLED') {
    throw new AddGuestFailure('GUEST_ALREADY_ACTIVE')
  }

  const purchase = await tx.purchase.update({
    where: { id: p.purchaseId },
    data: { classesRemaining: { decrement: 1 } },
  })
  if (purchase.classesRemaining < 0) throw new AddGuestFailure('NO_CREDITS')
  if (purchase.classesRemaining === 0) {
    await tx.purchase.update({ where: { id: p.purchaseId }, data: { status: 'DEPLETED' } })
  }

  const guestFields = {
    status: 'CONFIRMED' as const,
    purchaseId: p.purchaseId,
    guestEmail: p.guestEmail,
    guestName: p.guestName,
    guestStatus: 'ACCEPTED',
  }

  let guestReservationId: string
  if (existingGuest) {
    // Fila cancelada de un invitado anterior: el índice único
    // (userId, classId, isGuestReservation) impide crear otra.
    const claim = await tx.reservation.updateMany({
      where: { id: existingGuest.id, status: 'CANCELLED' },
      data: {
        ...guestFields,
        cancelledAt: null,
        checkedIn: false,
        checkedInAt: null,
        checkedInBy: null,
      },
    })
    if (claim.count === 0) throw new AddGuestFailure('GUEST_ALREADY_ACTIVE')
    guestReservationId = existingGuest.id
  } else {
    const created = await tx.reservation.create({
      data: { userId: p.userId, classId: p.classId, isGuestReservation: true, ...guestFields },
      select: { id: true },
    })
    guestReservationId = created.id
  }

  return { guestReservationId, classesRemaining: purchase.classesRemaining }
}
