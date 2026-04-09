/**
 * User-facing API for private session requests.
 *
 * POST — Submit a new request (requires an active Private Flow purchase)
 * GET  — List the authenticated user's own requests
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail, buildAdminPrivateSessionNotification } from '@/lib/emailService'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createRequestSchema = z.object({
  purchaseId: z.string().min(1),
  preferredDisciplineId: z.string().min(1, 'Selecciona una disciplina'),
  preferredInstructorId: z.string().optional().nullable(),
  preferredSlot1: z.string().datetime({ message: 'Primera opción de fecha/hora requerida' }),
  preferredSlot2: z.string().datetime().optional().nullable(),
  preferredSlot3: z.string().datetime().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const requests = await prisma.privateSessionRequest.findMany({
    where: { userId: session.user.id },
    include: {
      purchase: { include: { package: { select: { name: true } } } },
      preferredDiscipline: { select: { name: true, slug: true } },
      preferredInstructor: { select: { name: true } },
      confirmedClass: {
        include: {
          discipline: { select: { name: true } },
          instructor: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ requests })
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validation = createRequestSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Datos inválidos' },
        { status: 400 }
      )
    }

    const data = validation.data
    const userId = session.user.id
    const now = new Date()

    // Validate purchase belongs to user, is active, has credits, not expired, and is Private Flow
    const purchase = await prisma.purchase.findFirst({
      where: {
        id: data.purchaseId,
        userId,
        status: 'ACTIVE',
        classesRemaining: { gt: 0 },
        expiresAt: { gt: now },
      },
      include: { package: true },
    })
    if (!purchase) {
      return NextResponse.json(
        { error: 'Paquete no válido, vencido o sin clases disponibles' },
        { status: 400 }
      )
    }
    if (!purchase.package.isPrivate) {
      return NextResponse.json(
        { error: 'Este paquete no es de sesión privada' },
        { status: 400 }
      )
    }

    // Block duplicate PENDING requests for the same purchase
    const existingPending = await prisma.privateSessionRequest.findFirst({
      where: {
        purchaseId: purchase.id,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    })
    if (existingPending) {
      const msg =
        existingPending.status === 'PENDING'
          ? 'Ya tienes una solicitud pendiente para este paquete. Espera la confirmación.'
          : 'Este paquete ya tiene una sesión confirmada.'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // Validate slot dates are in the future
    const slot1 = new Date(data.preferredSlot1)
    const slot2 = data.preferredSlot2 ? new Date(data.preferredSlot2) : null
    const slot3 = data.preferredSlot3 ? new Date(data.preferredSlot3) : null
    if (slot1 <= now) {
      return NextResponse.json(
        { error: 'La primera fecha debe ser a futuro' },
        { status: 400 }
      )
    }
    if (slot2 && slot2 <= now) {
      return NextResponse.json(
        { error: 'La segunda fecha debe ser a futuro' },
        { status: 400 }
      )
    }
    if (slot3 && slot3 <= now) {
      return NextResponse.json(
        { error: 'La tercera fecha debe ser a futuro' },
        { status: 400 }
      )
    }

    // Validate referenced discipline + instructor exist
    const discipline = await prisma.discipline.findUnique({
      where: { id: data.preferredDisciplineId },
    })
    if (!discipline) {
      return NextResponse.json({ error: 'Disciplina no encontrada' }, { status: 400 })
    }
    if (data.preferredInstructorId) {
      const instructor = await prisma.instructor.findUnique({
        where: { id: data.preferredInstructorId },
      })
      if (!instructor) {
        return NextResponse.json({ error: 'Instructor no encontrado' }, { status: 400 })
      }
    }

    // Create the request
    const created = await prisma.privateSessionRequest.create({
      data: {
        userId,
        purchaseId: purchase.id,
        preferredDisciplineId: data.preferredDisciplineId,
        preferredInstructorId: data.preferredInstructorId ?? null,
        preferredSlot1: slot1,
        preferredSlot2: slot2,
        preferredSlot3: slot3,
        notes: data.notes?.trim() || null,
        status: 'PENDING',
      },
      include: {
        preferredDiscipline: { select: { name: true } },
        preferredInstructor: { select: { name: true } },
      },
    })

    console.log('[PRIVATE_SESSIONS] Request created:', {
      id: created.id,
      userId,
      purchaseId: purchase.id,
      discipline: created.preferredDiscipline.name,
    })

    // Fire-and-forget: notify all admins
    notifyAdminsOfNewRequest(created.id).catch((err) =>
      console.error('[PRIVATE_SESSIONS] Admin notification failed:', err)
    )

    return NextResponse.json({ request: created }, { status: 201 })
  } catch (error) {
    console.error('[PRIVATE_SESSIONS] Error creating request:', error)
    return NextResponse.json(
      { error: 'Error al crear la solicitud' },
      { status: 500 }
    )
  }
}

async function notifyAdminsOfNewRequest(requestId: string) {
  const req = await prisma.privateSessionRequest.findUnique({
    where: { id: requestId },
    include: {
      user: { select: { name: true, email: true } },
      preferredDiscipline: { select: { name: true } },
      preferredInstructor: { select: { name: true } },
    },
  })
  if (!req) return

  // Notification target: ADMIN_NOTIFICATION_EMAIL env var, or all ADMIN users
  const envEmail = process.env.ADMIN_NOTIFICATION_EMAIL
  const recipients: string[] = []
  if (envEmail) {
    recipients.push(envEmail)
  } else {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true },
    })
    recipients.push(...admins.map((a) => a.email))
  }

  if (recipients.length === 0) {
    console.warn('[PRIVATE_SESSIONS] No admin email recipients found for notification')
    return
  }

  const html = buildAdminPrivateSessionNotification({
    userName: req.user.name || req.user.email,
    userEmail: req.user.email,
    disciplineName: req.preferredDiscipline.name,
    instructorName: req.preferredInstructor?.name ?? null,
    slot1: req.preferredSlot1,
    slot2: req.preferredSlot2,
    slot3: req.preferredSlot3,
    notes: req.notes,
    requestId: req.id,
  })

  for (const to of recipients) {
    await sendEmail({
      to,
      subject: `Nueva solicitud de sesión privada — ${req.user.name || req.user.email}`,
      html,
    }).catch((err) =>
      console.error('[PRIVATE_SESSIONS] sendEmail failed for', to, err)
    )
  }
}
