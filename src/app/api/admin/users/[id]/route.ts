import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        profileImage: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            purchases: { where: { status: 'ACTIVE' } },
            reservations: { where: { status: { in: ['CONFIRMED', 'ATTENDED'] } } },
          },
        },
        purchases: {
          where: { status: 'ACTIVE' },
          include: { package: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        image: user.profileImage,
        role: user.role,
        createdAt: user.createdAt,
        activePackages: user._count.purchases,
        totalClasses: user._count.reservations,
        currentPackage: user.purchases[0]?.package?.name || null,
      },
    })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Error al obtener el usuario' },
      { status: 500 }
    )
  }
}
