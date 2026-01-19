import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/auth/forgot-password
 * Crea una solicitud de reseteo de contraseña
 * El admin la revisará y aprobará/rechazará desde el panel
 */
export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'El email es requerido' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Buscar el usuario
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true, email: true },
    })

    // Verificar si ya hay una solicitud pendiente reciente (últimas 24 horas)
    const existingRequest = await prisma.passwordResetRequest.findFirst({
      where: {
        email: normalizedEmail,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    })

    if (existingRequest) {
      // Ya hay una solicitud pendiente, pero no revelamos esto por seguridad
      console.log(`[FORGOT PASSWORD] Solicitud duplicada ignorada para: ${normalizedEmail}`)
      return NextResponse.json({
        message: 'Solicitud recibida',
        success: true,
      })
    }

    // Crear la solicitud (incluso si el usuario no existe, por seguridad no revelamos)
    // Pero solo guardamos si el usuario existe para no llenar la BD de spam
    if (user) {
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24) // Expira en 24 horas

      await prisma.passwordResetRequest.create({
        data: {
          email: normalizedEmail,
          userName: user.name,
          userId: user.id,
          status: 'PENDING',
          expiresAt,
        },
      })

      console.log(`[FORGOT PASSWORD] Nueva solicitud creada para: ${normalizedEmail}`)
    } else {
      console.log(`[FORGOT PASSWORD] Email no encontrado: ${normalizedEmail}`)
    }

    // Siempre retornamos éxito por seguridad
    return NextResponse.json({
      message: 'Solicitud recibida',
      success: true,
    })
  } catch (error) {
    console.error('Error in forgot password:', error)
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    )
  }
}
