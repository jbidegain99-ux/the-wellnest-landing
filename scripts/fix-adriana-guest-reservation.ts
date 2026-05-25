import { prisma } from '../src/lib/prisma'

const HOST_RESERVATION_ID = 'cmpkmrk8w00024jk3dvl68h55'

async function main() {
  const host = await prisma.reservation.findUnique({
    where: { id: HOST_RESERVATION_ID },
  })
  if (!host) {
    console.log('Host reservation not found — nada que migrar.')
    return
  }
  if (host.status === 'CANCELLED') {
    console.log('Host reservation está cancelada — no se migra.')
    return
  }
  if (!host.guestEmail) {
    console.log('La reserva host ya no tiene datos de invitado — probablemente ya migrada.')
    return
  }

  // ¿Ya existe una reserva de invitado para este user+class? (idempotencia)
  const existingGuest = await prisma.reservation.findFirst({
    where: {
      userId: host.userId,
      classId: host.classId,
      isGuestReservation: true,
      status: { not: 'CANCELLED' },
    },
  })
  if (existingGuest) {
    console.log('Ya existe reserva de invitado — no se duplica:', existingGuest.id)
    return
  }

  const guestEmail = host.guestEmail
  const guestName = host.guestName

  await prisma.$transaction(async (tx) => {
    // 1. Crear la reserva del invitado (auto-aceptada)
    await tx.reservation.create({
      data: {
        userId: host.userId,
        classId: host.classId,
        purchaseId: host.purchaseId,
        status: 'CONFIRMED',
        isGuestReservation: true,
        guestEmail,
        guestName,
        guestStatus: 'ACCEPTED',
      },
    })

    // 2. Limpiar los campos de invitado de la reserva host
    await tx.reservation.update({
      where: { id: host.id },
      data: {
        guestEmail: null,
        guestName: null,
        guestStatus: null,
        guestToken: null,
        isGuestReservation: false,
      },
    })

    // 3. Descontar 1 clase más del paquete (la del invitado que no se cobró)
    await tx.purchase.update({
      where: { id: host.purchaseId },
      data: { classesRemaining: { decrement: 1 } },
    })
  })

  const purchase = await prisma.purchase.findUnique({
    where: { id: host.purchaseId },
    select: { classesRemaining: true },
  })
  console.log('Migración OK. Trimestral classesRemaining ahora:', purchase?.classesRemaining)
}

main().finally(() => prisma.$disconnect())
