import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

/**
 * Genera una contraseña temporal legible
 * Formato: palabra + 4 números (ej: Wellnest1234)
 */
function generateTempPassword(): string {
  const words = ['Wellnest', 'Bienestar', 'Wellness', 'Studio', 'Namaste']
  const word = words[Math.floor(Math.random() * words.length)]
  const numbers = Math.floor(1000 + Math.random() * 9000)
  return `${word}${numbers}`
}

/**
 * GET /api/admin/password-reset-requests
 * Lista todas las solicitudes de reseteo de contraseña
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // PENDING, APPROVED, REJECTED, EXPIRED, all

    // Marcar como expiradas las solicitudes vencidas
    await prisma.passwordResetRequest.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    })

    // Construir filtro
    const where: Record<string, unknown> = {}
    if (status && status !== 'all') {
      where.status = status
    }

    const requests = await prisma.passwordResetRequest.findMany({
      where,
      orderBy: [
        { status: 'asc' }, // PENDING first
        { createdAt: 'desc' },
      ],
    })

    // Contar por estado
    const counts = await prisma.passwordResetRequest.groupBy({
      by: ['status'],
      _count: true,
    })

    const countsByStatus = {
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      EXPIRED: 0,
    }
    counts.forEach((c) => {
      countsByStatus[c.status as keyof typeof countsByStatus] = c._count
    })

    return NextResponse.json({
      requests,
      counts: countsByStatus,
      total: requests.length,
    })
  } catch (error) {
    console.error('Error fetching password reset requests:', error)
    return NextResponse.json(
      { error: 'Error al obtener las solicitudes' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/password-reset-requests
 * Aprobar o rechazar una solicitud
 * Body: { id: string, action: 'approve' | 'reject', notes?: string }
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id, action, notes } = await request.json()

    if (!id || !action) {
      return NextResponse.json(
        { error: 'Se requiere id y action' },
        { status: 400 }
      )
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Action debe ser "approve" o "reject"' },
        { status: 400 }
      )
    }

    // Buscar la solicitud
    const resetRequest = await prisma.passwordResetRequest.findUnique({
      where: { id },
    })

    if (!resetRequest) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      )
    }

    if (resetRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Esta solicitud ya fue procesada' },
        { status: 400 }
      )
    }

    if (action === 'reject') {
      // Rechazar la solicitud
      await prisma.passwordResetRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          adminNotes: notes || null,
          processedBy: session.user.email || session.user.name,
          processedAt: new Date(),
        },
      })

      return NextResponse.json({
        message: 'Solicitud rechazada',
        success: true,
      })
    }

    // Aprobar la solicitud
    if (!resetRequest.userId) {
      return NextResponse.json(
        { error: 'No se puede aprobar: usuario no encontrado en el sistema' },
        { status: 400 }
      )
    }

    // Generar contraseña temporal
    const tempPassword = generateTempPassword()
    const hashedPassword = await bcrypt.hash(tempPassword, 10)

    // Actualizar contraseña del usuario
    await prisma.user.update({
      where: { id: resetRequest.userId },
      data: { password: hashedPassword },
    })

    // Actualizar la solicitud
    await prisma.passwordResetRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        tempPassword, // Guardamos la contraseña temporal para referencia
        adminNotes: notes || null,
        processedBy: session.user.email || session.user.name,
        processedAt: new Date(),
      },
    })

    console.log(`[PASSWORD RESET] Aprobada solicitud para ${resetRequest.email} por ${session.user.email}`)

    return NextResponse.json({
      message: 'Solicitud aprobada',
      success: true,
      tempPassword,
      user: {
        name: resetRequest.userName,
        email: resetRequest.email,
      },
      instructions: [
        `Contraseña temporal: ${tempPassword}`,
        'Comunica esta contraseña al usuario por WhatsApp',
        'Recuérdale que debe cambiarla desde su perfil por seguridad',
      ],
    })
  } catch (error) {
    console.error('Error processing password reset request:', error)
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    )
  }
}
