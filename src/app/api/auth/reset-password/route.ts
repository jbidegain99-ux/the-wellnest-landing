import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/auth/reset-password
 * Valida el token y actualiza la contraseña del usuario.
 */
export async function POST(request: Request) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token y contraseña son requeridos' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400 }
      )
    }

    // Buscar token válido
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    })

    if (!resetToken) {
      return NextResponse.json(
        { error: 'El enlace es inválido o ya fue utilizado.' },
        { status: 400 }
      )
    }

    if (resetToken.used) {
      return NextResponse.json(
        { error: 'Este enlace ya fue utilizado. Solicita uno nuevo.' },
        { status: 400 }
      )
    }

    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'El enlace ha expirado. Solicita uno nuevo.' },
        { status: 400 }
      )
    }

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { email: resetToken.email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'No se encontró la cuenta asociada.' },
        { status: 400 }
      )
    }

    // Hashear nueva contraseña y actualizar
    const hashedPassword = await bcrypt.hash(password, 12)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
    ])

    console.log(`[RESET PASSWORD] Contraseña actualizada para: ${user.email}`)

    return NextResponse.json({
      message: 'Contraseña actualizada exitosamente.',
      success: true,
    })
  } catch (error) {
    console.error('Error in reset password:', error)
    return NextResponse.json(
      { error: 'Error al restablecer la contraseña' },
      { status: 500 }
    )
  }
}
