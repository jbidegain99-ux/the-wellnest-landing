import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

// Error codes for specific error types
const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  CLASS_NOT_FOUND: 'CLASS_NOT_FOUND',
  CLASS_FULL: 'CLASS_FULL',
  CLASS_EXPIRED: 'CLASS_EXPIRED',
  ALREADY_RESERVED: 'ALREADY_RESERVED',
  NO_PACKAGE: 'NO_PACKAGE',
  PACKAGE_EXPIRED: 'PACKAGE_EXPIRED',
  TIME_CONFLICT: 'TIME_CONFLICT',
  UNIQUE_CONSTRAINT: 'UNIQUE_CONSTRAINT',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
}

export async function GET() {
  console.log('[RESERVATIONS API] GET request - fetching user reservations')

  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      console.log('[RESERVATIONS API] No authenticated user')
      return NextResponse.json({ error: 'No autorizado', code: ERROR_CODES.UNAUTHORIZED }, { status: 401 })
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
        purchase: {
          include: {
            package: true,
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
      { error: 'Error al obtener las reservas', code: ERROR_CODES.UNKNOWN_ERROR },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  console.log('[RESERVATIONS API] ========== POST REQUEST START ==========')
  console.log('[RESERVATIONS API] Timestamp:', new Date().toISOString())

  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      console.log('[RESERVATIONS API] ERROR: No authenticated user')
      return NextResponse.json({
        error: 'No autorizado',
        code: ERROR_CODES.UNAUTHORIZED
      }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()
    const { classId, purchaseId: requestedPurchaseId } = body

    console.log('[RESERVATIONS API] Request details:', {
      userId,
      userEmail: session.user.email,
      classId,
      requestedPurchaseId: requestedPurchaseId || 'auto-select'
    })

    // Validate classId
    if (!classId) {
      console.log('[RESERVATIONS API] ERROR: No classId provided')
      return NextResponse.json({
        error: 'ID de clase requerido',
        code: ERROR_CODES.CLASS_NOT_FOUND
      }, { status: 400 })
    }

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
      console.log('[RESERVATIONS API] ERROR: Class not found:', classId)
      return NextResponse.json({
        error: 'Clase no encontrada. Es posible que haya sido cancelada o eliminada.',
        code: ERROR_CODES.CLASS_NOT_FOUND
      }, { status: 404 })
    }

    // Check if class is cancelled
    if (classData.isCancelled) {
      console.log('[RESERVATIONS API] ERROR: Class is cancelled')
      return NextResponse.json({
        error: 'Esta clase ha sido cancelada.',
        code: ERROR_CODES.CLASS_NOT_FOUND
      }, { status: 400 })
    }

    const classDateTime = new Date(classData.dateTime)
    const now = new Date()

    console.log('[RESERVATIONS API] Class details:', {
      id: classData.id,
      discipline: classData.discipline.name,
      instructor: classData.instructor.name,
      dateTime: classDateTime.toISOString(),
      localTime: classDateTime.toLocaleString('es-SV'),
      maxCapacity: classData.maxCapacity,
      currentReservations: classData._count.reservations,
      spotsAvailable: classData.maxCapacity - classData._count.reservations,
      isCancelled: classData.isCancelled,
    })

    // Check if class is full
    if (classData._count.reservations >= classData.maxCapacity) {
      console.log('[RESERVATIONS API] ERROR: Class is full')
      return NextResponse.json({
        error: `La clase de ${classData.discipline.name} está llena. No hay cupos disponibles.`,
        code: ERROR_CODES.CLASS_FULL
      }, { status: 400 })
    }

    // Check if class is in the past
    if (classDateTime < now) {
      console.log('[RESERVATIONS API] ERROR: Class is in the past', {
        classTime: classDateTime.toISOString(),
        currentTime: now.toISOString(),
      })
      return NextResponse.json({
        error: 'No puedes reservar una clase que ya pasó.',
        code: ERROR_CODES.CLASS_EXPIRED
      }, { status: 400 })
    }

    // Check if user already has ANY reservation for THIS class (including cancelled)
    // This is important because of the unique constraint on [userId, classId]
    console.log('[RESERVATIONS API] Checking for existing reservations...')
    const existingReservation = await prisma.reservation.findFirst({
      where: {
        userId,
        classId,
      },
      include: {
        purchase: {
          include: { package: true }
        }
      }
    })

    if (existingReservation) {
      console.log('[RESERVATIONS API] Existing reservation found:', {
        id: existingReservation.id,
        status: existingReservation.status,
        purchaseId: existingReservation.purchaseId,
        packageName: existingReservation.purchase?.package?.name,
      })

      if (existingReservation.status === 'CONFIRMED') {
        console.log('[RESERVATIONS API] ERROR: User already has active reservation')
        return NextResponse.json({
          error: `Ya tienes una reserva activa para esta clase de ${classData.discipline.name} el ${classDateTime.toLocaleDateString('es-SV')} a las ${classDateTime.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}.`,
          code: ERROR_CODES.ALREADY_RESERVED,
          existingReservationId: existingReservation.id,
        }, { status: 400 })
      }

      // If user had a cancelled reservation, we need to reactivate it instead of creating new
      if (existingReservation.status === 'CANCELLED') {
        console.log('[RESERVATIONS API] Found cancelled reservation, will reactivate:', existingReservation.id)

        // Find purchase to use
        let purchase
        if (requestedPurchaseId) {
          console.log('[RESERVATIONS API] Looking for specific purchase:', requestedPurchaseId)
          purchase = await prisma.purchase.findFirst({
            where: {
              id: requestedPurchaseId,
              userId,
              status: { in: ['ACTIVE', 'DEPLETED'] }, // Allow depleted if we're re-adding
              classesRemaining: { gt: 0 },
              expiresAt: { gt: now },
            },
            include: { package: true },
          })
        } else {
          console.log('[RESERVATIONS API] Auto-selecting best available purchase')
          purchase = await prisma.purchase.findFirst({
            where: {
              userId,
              status: 'ACTIVE',
              classesRemaining: { gt: 0 },
              expiresAt: { gt: now },
            },
            orderBy: { expiresAt: 'asc' },
            include: { package: true },
          })
        }

        if (!purchase) {
          console.log('[RESERVATIONS API] ERROR: No valid purchase found for reactivation')
          // Get all user's purchases for debugging
          const allPurchases = await prisma.purchase.findMany({
            where: { userId },
            include: { package: true }
          })
          console.log('[RESERVATIONS API] User purchases:', allPurchases.map(p => ({
            id: p.id,
            package: p.package.name,
            status: p.status,
            remaining: p.classesRemaining,
            expires: p.expiresAt,
          })))

          return NextResponse.json({
            error: 'No tienes clases disponibles. Compra un paquete para reservar.',
            code: ERROR_CODES.NO_PACKAGE
          }, { status: 400 })
        }

        console.log('[RESERVATIONS API] Using purchase for reactivation:', {
          id: purchase.id,
          package: purchase.package.name,
          remaining: purchase.classesRemaining,
        })

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

        console.log('[RESERVATIONS API] Reservation reactivated successfully:', {
          reservationId: reactivatedReservation.id,
          newPurchaseId: purchase.id,
          remainingClasses: updatedPurchase.classesRemaining,
        })

        // Check if purchase is now depleted
        if (updatedPurchase.classesRemaining === 0) {
          await prisma.purchase.update({
            where: { id: purchase.id },
            data: { status: 'DEPLETED' },
          })
          console.log('[RESERVATIONS API] Purchase depleted after reactivation')
        }

        console.log('[RESERVATIONS API] ========== POST REQUEST SUCCESS (REACTIVATED) ==========')
        return NextResponse.json({
          ...reactivatedReservation,
          updatedPurchase: {
            id: updatedPurchase.id,
            classesRemaining: updatedPurchase.classesRemaining,
            status: updatedPurchase.classesRemaining === 0 ? 'DEPLETED' : updatedPurchase.status,
          }
        }, { status: 201 })
      }
    } else {
      console.log('[RESERVATIONS API] No existing reservation found, will create new')
    }

    // ANTI-DOUBLE-BOOKING: Check if user has another reservation at the same time
    console.log('[RESERVATIONS API] Checking for time conflicts...')
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
        console.log('[RESERVATIONS API] ERROR: Time conflict detected:', {
          newClass: {
            discipline: classData.discipline.name,
            start: classStartTime.toISOString(),
            end: classEndTime.toISOString()
          },
          existingClass: {
            discipline: conflictingReservation.class.discipline.name,
            start: otherClassStart.toISOString(),
            end: otherClassEnd.toISOString()
          },
        })
        return NextResponse.json({
          error: `Ya tienes una reserva a esa hora: ${conflictingReservation.class.discipline.name} a las ${otherClassStart.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}. No puedes reservar dos clases en horarios que se solapan.`,
          code: ERROR_CODES.TIME_CONFLICT,
          conflictingClass: {
            id: conflictingReservation.class.id,
            discipline: conflictingReservation.class.discipline.name,
            time: otherClassStart.toISOString(),
          }
        }, { status: 400 })
      }
    }
    console.log('[RESERVATIONS API] No time conflicts found')

    // Find the purchase to use - either the specified one or the best available
    console.log('[RESERVATIONS API] Finding purchase to use...')
    let purchase

    if (requestedPurchaseId) {
      console.log('[RESERVATIONS API] Looking for specific purchase:', requestedPurchaseId)
      purchase = await prisma.purchase.findFirst({
        where: {
          id: requestedPurchaseId,
          userId,
          status: 'ACTIVE',
          classesRemaining: { gt: 0 },
          expiresAt: { gt: now },
        },
        include: { package: true },
      })

      if (!purchase) {
        console.log('[RESERVATIONS API] ERROR: Requested purchase not valid')
        // Check why the purchase wasn't found
        const requestedPurchaseDetails = await prisma.purchase.findFirst({
          where: { id: requestedPurchaseId, userId },
          include: { package: true }
        })

        if (!requestedPurchaseDetails) {
          return NextResponse.json({
            error: 'El paquete seleccionado no existe o no te pertenece.',
            code: ERROR_CODES.NO_PACKAGE
          }, { status: 400 })
        }

        if (requestedPurchaseDetails.status !== 'ACTIVE') {
          return NextResponse.json({
            error: `El paquete "${requestedPurchaseDetails.package.name}" ya no está activo (estado: ${requestedPurchaseDetails.status}).`,
            code: ERROR_CODES.PACKAGE_EXPIRED
          }, { status: 400 })
        }

        if (requestedPurchaseDetails.classesRemaining <= 0) {
          return NextResponse.json({
            error: `El paquete "${requestedPurchaseDetails.package.name}" no tiene clases disponibles. Todas las clases fueron usadas.`,
            code: ERROR_CODES.NO_PACKAGE
          }, { status: 400 })
        }

        if (requestedPurchaseDetails.expiresAt <= now) {
          return NextResponse.json({
            error: `El paquete "${requestedPurchaseDetails.package.name}" venció el ${requestedPurchaseDetails.expiresAt.toLocaleDateString('es-SV')}.`,
            code: ERROR_CODES.PACKAGE_EXPIRED
          }, { status: 400 })
        }

        return NextResponse.json({
          error: 'El paquete seleccionado no está disponible.',
          code: ERROR_CODES.NO_PACKAGE
        }, { status: 400 })
      }
    } else {
      console.log('[RESERVATIONS API] Auto-selecting best available purchase (earliest expiration)')

      // Get all user's purchases for logging
      const allPurchases = await prisma.purchase.findMany({
        where: { userId },
        include: { package: true },
        orderBy: { expiresAt: 'asc' }
      })

      console.log('[RESERVATIONS API] All user purchases:', allPurchases.map(p => ({
        id: p.id,
        package: p.package.name,
        status: p.status,
        remaining: p.classesRemaining,
        expires: p.expiresAt.toISOString(),
        isValid: p.status === 'ACTIVE' && p.classesRemaining > 0 && p.expiresAt > now,
      })))

      purchase = await prisma.purchase.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
          classesRemaining: { gt: 0 },
          expiresAt: { gt: now },
        },
        orderBy: { expiresAt: 'asc' },
        include: { package: true },
      })

      if (!purchase) {
        console.log('[RESERVATIONS API] ERROR: No active purchase found')

        // Check if user has any purchases at all
        if (allPurchases.length === 0) {
          return NextResponse.json({
            error: 'No tienes ningún paquete. Compra un paquete de clases para poder reservar.',
            code: ERROR_CODES.NO_PACKAGE
          }, { status: 400 })
        }

        // Check if all purchases are depleted
        const depleted = allPurchases.filter(p => p.classesRemaining === 0)
        if (depleted.length === allPurchases.length) {
          return NextResponse.json({
            error: 'Todas tus clases han sido usadas. Compra un nuevo paquete para seguir reservando.',
            code: ERROR_CODES.NO_PACKAGE
          }, { status: 400 })
        }

        // Check if all purchases are expired
        const expired = allPurchases.filter(p => p.expiresAt <= now)
        if (expired.length === allPurchases.length) {
          return NextResponse.json({
            error: 'Todos tus paquetes han vencido. Compra un nuevo paquete para seguir reservando.',
            code: ERROR_CODES.PACKAGE_EXPIRED
          }, { status: 400 })
        }

        return NextResponse.json({
          error: 'No tienes clases disponibles. Compra un paquete para reservar.',
          code: ERROR_CODES.NO_PACKAGE
        }, { status: 400 })
      }
    }

    console.log('[RESERVATIONS API] Using purchase:', {
      id: purchase.id,
      packageName: purchase.package.name,
      classesRemaining: purchase.classesRemaining,
      expiresAt: purchase.expiresAt.toISOString(),
      afterReservation: purchase.classesRemaining - 1,
    })

    // Create reservation and update counts in a transaction
    console.log('[RESERVATIONS API] Creating reservation in transaction...')
    console.log('[RESERVATIONS API] Transaction data:', {
      userId,
      classId,
      purchaseId: purchase.id,
      className: classData.discipline.name,
      classTime: classDateTime.toISOString(),
    })

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
          purchase: {
            include: {
              package: true,
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
      className: reservation.class.discipline.name,
      classDateTime: reservation.class.dateTime,
      purchaseId: reservation.purchaseId,
      packageName: purchase.package.name,
      previousClassesRemaining: purchase.classesRemaining,
      newClassesRemaining: updatedPurchase.classesRemaining,
    })

    // Check if purchase is now depleted
    let finalPurchaseStatus = updatedPurchase.status
    if (updatedPurchase.classesRemaining === 0) {
      console.log('[RESERVATIONS API] Purchase depleted, updating status to DEPLETED')
      const depletedPurchase = await prisma.purchase.update({
        where: { id: purchase.id },
        data: { status: 'DEPLETED' },
      })
      finalPurchaseStatus = depletedPurchase.status
    }

    console.log('[RESERVATIONS API] ========== POST REQUEST SUCCESS ==========')

    return NextResponse.json({
      ...reservation,
      updatedPurchase: {
        id: updatedPurchase.id,
        packageName: purchase.package.name,
        classesRemaining: updatedPurchase.classesRemaining,
        status: finalPurchaseStatus,
      }
    }, { status: 201 })
  } catch (error: any) {
    console.error('[RESERVATIONS API] ========== ERROR ==========')
    console.error('[RESERVATIONS API] Error type:', error?.constructor?.name)
    console.error('[RESERVATIONS API] Error code:', error?.code)
    console.error('[RESERVATIONS API] Error message:', error?.message)
    console.error('[RESERVATIONS API] Full error:', error)

    // Handle specific Prisma errors
    if (error?.code === 'P2002') {
      // Unique constraint violation
      console.log('[RESERVATIONS API] Unique constraint violation - user already has reservation')
      return NextResponse.json({
        error: 'Ya tienes una reserva para esta clase. Es posible que acabes de reservarla. Revisa "Mis Reservas" para confirmar.',
        code: ERROR_CODES.UNIQUE_CONSTRAINT
      }, { status: 400 })
    }

    if (error?.code === 'P2025') {
      // Record not found
      console.log('[RESERVATIONS API] Record not found during transaction')
      return NextResponse.json({
        error: 'No se encontró la clase o el paquete. Es posible que hayan sido modificados. Intenta de nuevo.',
        code: ERROR_CODES.CLASS_NOT_FOUND
      }, { status: 404 })
    }

    // Return detailed error for debugging
    const errorMessage = error?.message || 'Error desconocido'

    return NextResponse.json({
      error: `Error al crear la reserva. Por favor intenta de nuevo. Si el problema persiste, contacta soporte. (${errorMessage})`,
      code: ERROR_CODES.UNKNOWN_ERROR,
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 })
  }
}
