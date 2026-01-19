import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/users/make-admin
 * Convierte un usuario en admin por email
 * Body: { email: string }
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    if (user.role === 'ADMIN') {
      return NextResponse.json({
        message: 'El usuario ya es admin',
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      })
    }

    const updatedUser = await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN' },
    })

    return NextResponse.json({
      message: `Usuario ${updatedUser.name} ahora es ADMIN`,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role
      }
    })
  } catch (error) {
    console.error('Error making user admin:', error)
    return NextResponse.json(
      { error: 'Error al actualizar el usuario' },
      { status: 500 }
    )
  }
}
