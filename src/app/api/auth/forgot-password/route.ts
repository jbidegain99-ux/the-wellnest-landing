import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/auth/forgot-password
 * Solicita un enlace de recuperación de contraseña
 *
 * NOTA: Por seguridad, siempre retornamos éxito para no revelar
 * si el email existe o no en el sistema.
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

    // Buscar el usuario (sin revelar si existe)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (user) {
      // TODO: Implementar envío de email con enlace de recuperación
      // Por ahora solo logueamos para debug
      console.log(`[FORGOT PASSWORD] Solicitud para: ${email}`)

      // En producción, aquí enviarías el email con:
      // 1. Generar un token único y guardarlo en DB con expiración
      // 2. Enviar email con enlace: /restablecer-contrasena?token=xxx
      // 3. En esa página, validar token y permitir cambiar contraseña
    }

    // Siempre retornamos éxito por seguridad
    return NextResponse.json({
      message: 'Si el email existe, recibirás un enlace de recuperación',
    })
  } catch (error) {
    console.error('Error in forgot password:', error)
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    )
  }
}
