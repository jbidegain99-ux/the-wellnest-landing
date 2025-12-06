import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

export async function GET() {
  console.log('[RESERVATIONS API] GET request - fetching user reservations')

  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      console.log('[RESERVATIONS API] No authenticated user')
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    console.log('[RESERVATIONS API] Fetching reservations for user:', session.user.id)

    const reservations = await prisma.reservation.findMany({
      where: {
        userId: session.user.id,
        status: 'CONFIRMED',
        class: {
          dateTime: { gte: new Date() },
        },
      },
      include: {
        class: {
          include: {
            discipline: true,
            instructor: true,
          },
        },
      },
      orderBy: {
        class: {
          dateTime: 'asc',
        },
      },
    })

    console.log('[RESERVATIONS API] Found reservations:', reservations.length)

    return NextResponse.json(reservations)
  } catch (error) {
    console.error('[RESERVATIONS API] Error fetching reservations:', error)
    return NextResponse.json(
      { error: 'Error al obtener las reservas' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  console.log('[RESERVATIONS API] POST request - creating reservation')

  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      console.log('[RESERVATIONS API] No authenticated user')
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()
    const { classId, purchaseId: requestedPurchaseId } = body

    console.log('[RESERVATIONS API] Request:', { userId, classId, requestedPurchaseId })

    // Check if class exists and has capacity
    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        _count: { select: { reservations: { where: { status: 'CONFIRMED' } } } },
        discipline: true,
        instructor: true,
      },
    })

    if (!classData) {
      console.log('[RESERVATIONS API] Class not found:', classId)
      return NextResponse.json(
        { error: 'Clase no encontrada' },
        { status: 404 }
      )
    }

    console.log('[RESERVATIONS API] Class found:', {
      id: classData.id,
      discipline: classData.discipline.name,
      dateTime: classData.dateTime,
      maxCapacity: classData.maxCapacity,
      currentReservations: classData._count.reservations,
    })

    // Check if class is full
    if (classData._count.reservations >= classData.maxCapacity) {
      console.log('[RESERVATIONS API] Class is full')
      return NextResponse.json(
        { error: 'La clase está llena' },
        { status: 400 }
      )
    }

    // Check if class is in the past
    if (new Date(classData.dateTime) < new Date()) {
      console.log('[RESERVATIONS API] Class is in the past')
      return NextResponse.json(
        { error: 'No puedes reservar una clase que ya pasó' },
        { status: 400 }
      )
    }

    // Check if user already has ANY reservation for THIS class (including cancelled)
    // This is important because of the unique constraint on [userId, classId]
    const existingReservation = await prisma.reservation.findFirst({
      where: {
        userId,
        classId,
      },
    })

    if (existingReservation) {
      if (existingReservation.status === 'CONFIRMED') {
        console.log('[RESERVATIONS API] User already has active reservation for this class')
        return NextResponse.json(
          { error: 'Ya tienes una reserva activa para esta clase' },
          { status: 400 }
        )
      }

      // If user had a cancelled reservation, we need to reactivate it instead of creating new
      if (existingReservation.status === 'CANCELLED') {
        console.log('[RESERVATIONS API] Reactivating cancelled reservation:', existingReservation.id)

        // Find purchase to use
        let purchase
        if (requestedPurchaseId) {
          purchase = await prisma.purchase.findFirst({
            where: {
              id: requestedPurchaseId,
              userId,
              status: { in: ['ACTIVE', 'DEPLETED'] }, // Allow depleted if we're re-adding
              classesRemaining: { gt: 0 },
              expiresAt: { gt: new Date() },
            },
            include: { package: true },
          })
        } else {
          purchase = await prisma.purchase.findFirst({
            where: {
              userId,
              status: 'ACTIVE',
              classesRemaining: { gt: 0 },
              expiresAt: { gt: new Date() },
            },
            orderBy: { expiresAt: 'asc' },
            include: { package: true },
          })
        }

        if (!purchase) {
          return NextResponse.json(
            { error: 'No tienes clases disponibles. Compra un paquete para reservar.' },
            { status: 400 }
          )
        }

        // Reactivate the reservation
        const [reactivatedReservation, updatedPurchase] = await prisma.$transaction([
          prisma.reservation.update({
            where: { id: existingReservation.id },
            data: {
              status: 'CONFIRMED',
              purchaseId: purchase.id,
              cancelledAt: null,
            },
            include: {
              class: {
                include: {
                  discipline: true,
                  instructor: true,
                },
              },
            },
          }),
          prisma.purchase.update({
            where: { id: purchase.id },
            data: { classesRemaining: { decrement: 1 } },
          }),
          prisma.class.update({
            where: { id: classId },
            data: { currentCount: { increment: 1 } },
          }),
        ])

        console.log('[RESERVATIONS API] Reservation reactivated:', reactivatedReservation.id)

        // Check if purchase is now depleted
        if (updatedPurchase.classesRemaining === 0) {
          await prisma.purchase.update({
            where: { id: purchase.id },
            data: { status: 'DEPLETED' },
          })
        }

        return NextResponse.json(reactivatedReservation, { status: 201 })
      }
    }

    // ANTI-DOUBLE-BOOKING: Check if user has another reservation at the same time
    const classStartTime = new Date(classData.dateTime)
    const classEndTime = new Date(classStartTime.getTime() + classData.duration * 60000)

    const conflictingReservation = await prisma.reservation.findFirst({
      where: {
        userId,
        status: 'CONFIRMED',
        class: {
          AND: [
            // Class starts before our class ends
            { dateTime: { lt: classEndTime } },
            // Class ends after our class starts (we calculate this differently)
          ],
        },
      },
      include: {
        class: {
          include: {
            discipline: true,
          },
        },
      },
    })

    // Check if there's actually a time conflict
    if (conflictingReservation) {
      const otherClassStart = new Date(conflictingReservation.class.dateTime)
      const otherClassEnd = new Date(otherClassStart.getTime() + conflictingReservation.class.duration * 60000)

      // Check if times overlap
      if (classStartTime < otherClassEnd && classEndTime > otherClassStart) {
        console.log('[RESERVATIONS API] Time conflict detected:', {
          newClass: { start: classStartTime, end: classEndTime },
          existingClass: { start: otherClassStart, end: otherClassEnd },
        })
        return NextResponse.json(
          {
            error: `Ya tienes una reserva a esa hora: ${conflictingReservation.class.discipline.name} a las ${otherClassStart.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}`
          },
          { status: 400 }
        )
      }
    }

    // Find the purchase to use - either the specified one or the best available
    let purchase

    if (requestedPurchaseId) {
      console.log('[RESERVATIONS API] Using requested purchase:', requestedPurchaseId)
      purchase = await prisma.purchase.findFirst({
        where: {
          id: requestedPurchaseId,
          userId,
          status: 'ACTIVE',
          classesRemaining: { gt: 0 },
          expiresAt: { gt: new Date() },
        },
        include: { package: true },
      })

      if (!purchase) {
        console.log('[RESERVATIONS API] Requested purchase not valid')
        return NextResponse.json(
          { error: 'El paquete seleccionado no está disponible o no tiene clases restantes' },
          { status: 400 }
        )
      }
    } else {
      console.log('[RESERVATIONS API] Finding best available purchase')
      purchase = await prisma.purchase.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
          classesRemaining: { gt: 0 },
          expiresAt: { gt: new Date() },
        },
        orderBy: { expiresAt: 'asc' },
        include: { package: true },
      })

      if (!purchase) {
        console.log('[RESERVATIONS API] No active purchase found')
        return NextResponse.json(
          { error: 'No tienes clases disponibles. Compra un paquete para reservar.' },
          { status: 400 }
        )
      }
    }

    console.log('[RESERVATIONS API] Using purchase:', {
      id: purchase.id,
      packageName: purchase.package.name,
      classesRemaining: purchase.classesRemaining,
      expiresAt: purchase.expiresAt,
    })

    // Create reservation and update counts in a transaction
    console.log('[RESERVATIONS API] Creating reservation in transaction...')

    const [reservation, updatedPurchase] = await prisma.$transaction([
      prisma.reservation.create({
        data: {
          userId,
          classId,
          purchaseId: purchase.id,
          status: 'CONFIRMED',
        },
        include: {
          class: {
            include: {
              discipline: true,
              instructor: true,
            },
          },
        },
      }),
      prisma.purchase.update({
        where: { id: purchase.id },
        data: { classesRemaining: { decrement: 1 } },
      }),
      prisma.class.update({
        where: { id: classId },
        data: { currentCount: { increment: 1 } },
      }),
    ])

    console.log('[RESERVATIONS API] Reservation created successfully:', {
      reservationId: reservation.id,
      classId: reservation.classId,
      purchaseClassesRemaining: updatedPurchase.classesRemaining,
    })

    // Check if purchase is now depleted
    if (updatedPurchase.classesRemaining === 0) {
      console.log('[RESERVATIONS API] Purchase depleted, updating status')
      await prisma.purchase.update({
        where: { id: purchase.id },
        data: { status: 'DEPLETED' },
      })
    }

    return NextResponse.json(reservation, { status: 201 })
  } catch (error: any) {
    console.error('[RESERVATIONS API] Error creating reservation:', error)

    // Handle specific Prisma errors
    if (error?.code === 'P2002') {
      // Unique constraint violation
      console.log('[RESERVATIONS API] Unique constraint violation - user already has reservation')
      return NextResponse.json(
        { error: 'Ya tienes una reserva para esta clase. Por favor, revisa tus reservas.' },
        { status: 400 }
      )
    }

    if (error?.code === 'P2025') {
      // Record not found
      console.log('[RESERVATIONS API] Record not found during transaction')
      return NextResponse.json(
        { error: 'No se encontró la clase o el paquete. Intenta de nuevo.' },
        { status: 404 }
      )
    }

    // Return detailed error for debugging (in production, hide details)
    const errorMessage = error?.message || 'Error desconocido'
    console.error('[RESERVATIONS API] Full error:', errorMessage)

    return NextResponse.json(
      { error: `Error al crear la reserva: ${errorMessage}` },
      { status: 500 }
    )
  }
}
