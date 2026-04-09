/**
 * Admin endpoint to confirm or reject a private session request.
 *
 * PATCH body:
 *   action: "confirm" | "reject"
 *
 * confirm additional fields:
 *   instructorId, disciplineId, dateTime (ISO), duration (min, default 60),
 *   adminNotes (optional)
 *
 * reject additional fields:
 *   rejectedReason (optional)
 *
 * On confirm:
 *   - Creates a new Class (isPrivate=true, maxCapacity=1)
 *   - Creates a Reservation linking the user + class + purchase
 *   - Decrements purchase.classesRemaining (atomically)
 *   - Sets request status=CONFIRMED, confirmedClassId, confirmedAt, confirmedBy
 *   - Fires confirmation email to user
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  sendEmail,
  buildPrivateSessionConfirmationEmail,
  buildPrivateSessionRejectionEmail,
} from '@/lib/emailService'
import { formatDateTimeFull } from '@/lib/utils'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const confirmSchema = z.object({
  action: z.literal('confirm'),
  instructorId: z.string().min(1),
  disciplineId: z.string().min(1),
  dateTime: z.string().datetime(),
  duration: z.number().int().positive().default(60),
  adminNotes: z.string().max(2000).optional().nullable(),
})

const rejectSchema = z.object({
  action: z.literal('reject'),
  rejectedReason: z.string().max(2000).optional().nullable(),
  adminNotes: z.string().max(2000).optional().nullable(),
})

const patchSchema = z.discriminatedUnion('action', [confirmSchema, rejectSchema])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: requestId } = await params
    const body = await request.json()
    const validation = patchSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Datos inválidos' },
        { status: 400 }
      )
    }
    const data = validation.data

    const sessionRequest = await prisma.privateSessionRequest.findUnique({
      where: { id: requestId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        purchase: { include: { package: true } },
        preferredDiscipline: { select: { name: true } },
      },
    })
    if (!sessionRequest) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      )
    }
    if (sessionRequest.status !== 'PENDING') {
      return NextResponse.json(
        {
          error: `Esta solicitud ya está ${sessionRequest.status.toLowerCase()} y no puede modificarse.`,
        },
        { status: 400 }
      )
    }

    // ================= REJECT =================
    if (data.action === 'reject') {
      const updated = await prisma.privateSessionRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          rejectedReason: data.rejectedReason?.trim() || null,
          adminNotes: data.adminNotes?.trim() || null,
        },
      })

      // Fire-and-forget email to user
      sendEmail({
        to: sessionRequest.user.email,
        subject: 'No pudimos confirmar tu sesión privada',
        html: buildPrivateSessionRejectionEmail({
          userName: sessionRequest.user.name || null,
          reason: data.rejectedReason?.trim() || null,
        }),
      }).catch((err) =>
        console.error('[PRIVATE_SESSIONS] Rejection email failed:', err)
      )

      console.log('[PRIVATE_SESSIONS] Request rejected:', {
        requestId,
        adminId: session.user.id,
      })
      return NextResponse.json({ request: updated })
    }

    // ================= CONFIRM =================
    // Pre-flight validations
    const now = new Date()
    const scheduledAt = new Date(data.dateTime)
    if (scheduledAt <= now) {
      return NextResponse.json(
        { error: 'La fecha/hora debe ser a futuro' },
        { status: 400 }
      )
    }
    if (sessionRequest.purchase.classesRemaining <= 0) {
      return NextResponse.json(
        { error: 'El paquete de este usuario no tiene clases disponibles' },
        { status: 400 }
      )
    }
    if (sessionRequest.purchase.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: `El paquete del usuario está ${sessionRequest.purchase.status}` },
        { status: 400 }
      )
    }

    const [discipline, instructor] = await Promise.all([
      prisma.discipline.findUnique({ where: { id: data.disciplineId } }),
      prisma.instructor.findUnique({ where: { id: data.instructorId } }),
    ])
    if (!discipline) {
      return NextResponse.json(
        { error: 'Disciplina no encontrada' },
        { status: 400 }
      )
    }
    if (!instructor) {
      return NextResponse.json(
        { error: 'Instructor no encontrado' },
        { status: 400 }
      )
    }

    // Atomic: create Class + Reservation + decrement purchase + update request
    const result = await prisma.$transaction(async (tx) => {
      const createdClass = await tx.class.create({
        data: {
          disciplineId: data.disciplineId,
          instructorId: data.instructorId,
          dateTime: scheduledAt,
          duration: data.duration,
          maxCapacity: 1,
          currentCount: 0,
          isPrivate: true,
          classType: 'Sesión privada',
        },
      })

      const updatedPurchase = await tx.purchase.update({
        where: { id: sessionRequest.purchaseId },
        data: { classesRemaining: { decrement: 1 } },
      })
      if (updatedPurchase.classesRemaining < 0) {
        throw new Error('INSUFFICIENT_CREDITS')
      }

      const reservation = await tx.reservation.create({
        data: {
          userId: sessionRequest.userId,
          classId: createdClass.id,
          purchaseId: sessionRequest.purchaseId,
          status: 'CONFIRMED',
        },
      })

      const updatedRequest = await tx.privateSessionRequest.update({
        where: { id: requestId },
        data: {
          status: 'CONFIRMED',
          confirmedClassId: createdClass.id,
          confirmedAt: new Date(),
          confirmedBy: session.user.id,
          adminNotes: data.adminNotes?.trim() || null,
        },
      })

      if (updatedPurchase.classesRemaining === 0) {
        await tx.purchase.update({
          where: { id: sessionRequest.purchaseId },
          data: { status: 'DEPLETED' },
        })
      }

      return { createdClass, reservation, updatedRequest, updatedPurchase }
    })

    // Fire-and-forget confirmation email
    sendEmail({
      to: sessionRequest.user.email,
      subject: 'Tu sesión privada está confirmada',
      html: buildPrivateSessionConfirmationEmail({
        userName: sessionRequest.user.name || null,
        disciplineName: discipline.name,
        instructorName: instructor.name,
        dateTime: formatDateTimeFull(result.createdClass.dateTime),
        duration: result.createdClass.duration,
      }),
    }).catch((err) =>
      console.error('[PRIVATE_SESSIONS] Confirmation email failed:', err)
    )

    console.log('[PRIVATE_SESSIONS] Request confirmed:', {
      requestId,
      classId: result.createdClass.id,
      reservationId: result.reservation.id,
      adminId: session.user.id,
    })

    return NextResponse.json({
      request: result.updatedRequest,
      class: result.createdClass,
      reservation: result.reservation,
    })
  } catch (error) {
    console.error('[PRIVATE_SESSIONS] Error updating request:', error)
    if (error instanceof Error && error.message === 'INSUFFICIENT_CREDITS') {
      return NextResponse.json(
        { error: 'El paquete del usuario se quedó sin clases durante la transacción' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    )
  }
}
