/**
 * Admin endpoint to confirm or reject a private session request.
 *
 * PATCH body shape depends on the action AND on whether the request is
 * "legacy" (1 session, preferredSlot2 or preferredSlot3 null) or "new"
 * (3 sessions, all 3 slots set).
 *
 * action: "confirm" | "reject"
 *
 * Confirm — legacy (1 session):
 *   { action: "confirm", instructorId, disciplineId, dateTime (ISO),
 *     duration (min, default 60), adminNotes? }
 *
 * Confirm — new (3 sessions):
 *   { action: "confirm", disciplineId, adminNotes?,
 *     sessions: [{ dateTime (ISO), instructorId, duration (min, default 60) }] x3 }
 *
 * Reject:
 *   { action: "reject", rejectedReason?, adminNotes? }
 *
 * On confirm (legacy):
 *   - Creates 1 Class (isPrivate=true, maxCapacity=1, privateSessionRequestId=req.id)
 *   - Creates 1 Reservation linking user + class + purchase
 *   - Decrements purchase.classesRemaining by 1 (sets DEPLETED if 0)
 *   - Sets request status=CONFIRMED, confirmedClassId (legacy tag), confirmedAt, confirmedBy
 *
 * On confirm (new, 3 sessions):
 *   - Creates 3 Class + 3 Reservation atomically (each with privateSessionRequestId)
 *   - Decrements purchase.classesRemaining by 3 (sets DEPLETED if 0)
 *   - Sets request status=CONFIRMED, confirmedAt, confirmedBy. The 3 classes are
 *     discoverable via the confirmedClasses relation.
 *
 * Both flows fire a confirmation email listing the session(s) to the user.
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

// Reject: shared
const rejectSchema = z.object({
  action: z.literal('reject'),
  rejectedReason: z.string().max(2000).optional().nullable(),
  adminNotes: z.string().max(2000).optional().nullable(),
})

// Legacy confirm (1 sesión): for requests with slot2 OR slot3 null
const confirmSchemaLegacy = z.object({
  action: z.literal('confirm'),
  instructorId: z.string().min(1),
  disciplineId: z.string().min(1),
  dateTime: z.string().datetime(),
  duration: z.number().int().positive().default(60),
  adminNotes: z.string().max(2000).optional().nullable(),
})

// New confirm (3 sesiones): for requests with all 3 slots
const sessionEditSchema = z.object({
  dateTime: z.string().datetime(),
  instructorId: z.string().min(1),
  duration: z.number().int().positive().default(60),
})
const confirmSchemaNew = z.object({
  action: z.literal('confirm'),
  disciplineId: z.string().min(1),
  sessions: z.array(sessionEditSchema).length(3),
  adminNotes: z.string().max(2000).optional().nullable(),
})

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
    const action = body?.action

    // Load request first (we need slot2/slot3 to discriminate legacy vs new)
    const sessionRequest = await prisma.privateSessionRequest.findUnique({
      where: { id: requestId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        purchase: { include: { package: true } },
        preferredDiscipline: { select: { name: true } },
      },
    })
    if (!sessionRequest) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    }
    if (sessionRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Esta solicitud ya está ${sessionRequest.status.toLowerCase()} y no puede modificarse.` },
        { status: 400 }
      )
    }

    const isLegacy =
      sessionRequest.preferredSlot2 === null || sessionRequest.preferredSlot3 === null

    // ================= REJECT (shared) =================
    if (action === 'reject') {
      const rj = rejectSchema.safeParse(body)
      if (!rj.success) {
        return NextResponse.json(
          { error: rj.error.errors[0]?.message || 'Datos inválidos' },
          { status: 400 }
        )
      }
      const data = rj.data
      const updated = await prisma.privateSessionRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          rejectedReason: data.rejectedReason?.trim() || null,
          adminNotes: data.adminNotes?.trim() || null,
        },
      })

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

    if (action !== 'confirm') {
      return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
    }

    // ================= CONFIRM (legacy: 1 sesión) =================
    if (isLegacy) {
      const cv = confirmSchemaLegacy.safeParse(body)
      if (!cv.success) {
        return NextResponse.json(
          { error: cv.error.errors[0]?.message || 'Datos inválidos' },
          { status: 400 }
        )
      }
      const data = cv.data
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
        return NextResponse.json({ error: 'Disciplina no encontrada' }, { status: 400 })
      }
      if (!instructor) {
        return NextResponse.json({ error: 'Instructor no encontrado' }, { status: 400 })
      }

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
            privateSessionRequestId: sessionRequest.id,
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

      sendEmail({
        to: sessionRequest.user.email,
        subject: 'Tu sesión privada está confirmada',
        html: buildPrivateSessionConfirmationEmail({
          userName: sessionRequest.user.name || null,
          sessions: [
            {
              disciplineName: discipline.name,
              instructorName: instructor.name,
              dateTime: formatDateTimeFull(result.createdClass.dateTime),
              duration: result.createdClass.duration,
            },
          ],
        }),
      }).catch((err) =>
        console.error('[PRIVATE_SESSIONS] Confirmation email failed:', err)
      )

      console.log('[PRIVATE_SESSIONS] Request confirmed (legacy 1 sesión):', {
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
    }

    // ================= CONFIRM (new: 3 sesiones) =================
    const cv = confirmSchemaNew.safeParse(body)
    if (!cv.success) {
      return NextResponse.json(
        { error: cv.error.errors[0]?.message || 'Datos inválidos' },
        { status: 400 }
      )
    }
    const data = cv.data
    const now = new Date()
    const dateTimes = data.sessions.map((s) => new Date(s.dateTime))
    if (dateTimes.some((d) => d <= now)) {
      return NextResponse.json(
        { error: 'Todas las fechas deben ser a futuro' },
        { status: 400 }
      )
    }
    if (new Set(dateTimes.map((d) => d.toISOString())).size !== 3) {
      return NextResponse.json(
        { error: 'Las 3 fechas deben ser distintas' },
        { status: 400 }
      )
    }
    if (sessionRequest.purchase.classesRemaining < 3) {
      return NextResponse.json(
        { error: 'El paquete no tiene 3 sesiones disponibles' },
        { status: 400 }
      )
    }
    if (sessionRequest.purchase.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: `El paquete del usuario está ${sessionRequest.purchase.status}` },
        { status: 400 }
      )
    }

    const discipline = await prisma.discipline.findUnique({
      where: { id: data.disciplineId },
    })
    if (!discipline) {
      return NextResponse.json({ error: 'Disciplina no encontrada' }, { status: 400 })
    }
    const instructorIds = Array.from(new Set(data.sessions.map((s) => s.instructorId)))
    const instructors = await prisma.instructor.findMany({
      where: { id: { in: instructorIds } },
    })
    if (instructors.length !== instructorIds.length) {
      return NextResponse.json({ error: 'Instructor no encontrado' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const created: { id: string; dateTime: Date; duration: number; instructorId: string }[] = []
      for (const s of data.sessions) {
        const c = await tx.class.create({
          data: {
            disciplineId: data.disciplineId,
            instructorId: s.instructorId,
            dateTime: new Date(s.dateTime),
            duration: s.duration,
            maxCapacity: 1,
            currentCount: 0,
            isPrivate: true,
            classType: 'Sesión privada',
            privateSessionRequestId: sessionRequest.id,
          },
        })
        await tx.reservation.create({
          data: {
            userId: sessionRequest.userId,
            classId: c.id,
            purchaseId: sessionRequest.purchaseId,
            status: 'CONFIRMED',
          },
        })
        created.push({
          id: c.id,
          dateTime: c.dateTime,
          duration: c.duration,
          instructorId: c.instructorId,
        })
      }
      const updatedPurchase = await tx.purchase.update({
        where: { id: sessionRequest.purchaseId },
        data: { classesRemaining: { decrement: 3 } },
      })
      if (updatedPurchase.classesRemaining < 0) throw new Error('INSUFFICIENT_CREDITS')
      if (updatedPurchase.classesRemaining === 0) {
        await tx.purchase.update({
          where: { id: sessionRequest.purchaseId },
          data: { status: 'DEPLETED' },
        })
      }
      const updatedRequest = await tx.privateSessionRequest.update({
        where: { id: requestId },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          confirmedBy: session.user.id,
          adminNotes: data.adminNotes?.trim() || null,
        },
      })
      return { created, updatedRequest }
    })

    const instructorById = new Map(instructors.map((i) => [i.id, i.name]))
    sendEmail({
      to: sessionRequest.user.email,
      subject: 'Tus sesiones privadas están confirmadas',
      html: buildPrivateSessionConfirmationEmail({
        userName: sessionRequest.user.name || null,
        sessions: result.created.map((c) => ({
          disciplineName: discipline.name,
          instructorName: instructorById.get(c.instructorId) || '',
          dateTime: formatDateTimeFull(c.dateTime),
          duration: c.duration,
        })),
      }),
    }).catch((err) => console.error('[PRIVATE_SESSIONS] Confirmation email failed:', err))

    console.log('[PRIVATE_SESSIONS] Request confirmed (3 sesiones):', {
      requestId,
      classIds: result.created.map((c) => c.id),
      adminId: session.user.id,
    })

    return NextResponse.json({
      request: result.updatedRequest,
      classes: result.created,
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
