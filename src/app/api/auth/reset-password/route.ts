import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createHash } from 'crypto'
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

    // Buscar token válido por su hash (la BD guarda sha256 del token);
    // fallback al valor crudo para tokens emitidos antes de este cambio
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const resetToken =
      (await prisma.passwordResetToken.findUnique({
        where: { token: tokenHash },
      })) ??
      (await prisma.passwordResetToken.findUnique({
        where: { token },
      }))

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

    // Hashear nueva contraseña y actualizar. El consumo del token es
    // atómico: dos envíos paralelos del formulario no resetean dos veces.
    const hashedPassword = await bcrypt.hash(password, 12)

    await prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: resetToken.id, used: false },
        data: { used: true },
      })
      if (consumed.count === 0) {
        throw new Error('TOKEN_ALREADY_USED')
      }
      await tx.user.update({
        where: { id: user.id },
        data: { password: hashedPassword, passwordChangedAt: new Date() },
      })
    })

    console.log(`[RESET PASSWORD] Contraseña actualizada para: ${user.email}`)

    return NextResponse.json({
      message: 'Contraseña actualizada exitosamente.',
      success: true,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'TOKEN_ALREADY_USED') {
      return NextResponse.json(
        { error: 'Este enlace ya fue utilizado. Solicita uno nuevo.' },
        { status: 400 }
      )
    }
    console.error('Error in reset password:', error)
    return NextResponse.json(
      { error: 'Error al restablecer la contraseña' },
      { status: 500 }
    )
  }
}
