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
  const numbers = Math.floor(1000 + Math.random() * 9000) // 4 dígitos
  return `${word}${numbers}`
}

/**
 * POST /api/admin/users/reset-password
 * Resetea la contraseña de un usuario y genera una temporal
 * Body: { email: string } o { userId: string }
 * Returns: { tempPassword: string, user: { name, email } }
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { email, userId } = body

    if (!email && !userId) {
      return NextResponse.json(
        { error: 'Se requiere email o userId' },
        { status: 400 }
      )
    }

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: email ? { email: email.toLowerCase() } : { id: userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Generar contraseña temporal
    const tempPassword = generateTempPassword()
    const hashedPassword = await bcrypt.hash(tempPassword, 10)

    // Actualizar contraseña
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    })

    console.log(`[ADMIN] Password reset for user ${user.email} by ${session.user.email}`)

    return NextResponse.json({
      message: 'Contraseña reseteada exitosamente',
      tempPassword,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      instructions: 'Proporciona esta contraseña temporal al usuario. Podrá cambiarla desde su perfil.',
    })
  } catch (error) {
    console.error('Error resetting password:', error)
    return NextResponse.json(
      { error: 'Error al resetear la contraseña' },
      { status: 500 }
    )
  }
}
