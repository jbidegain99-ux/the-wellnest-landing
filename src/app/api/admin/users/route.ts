import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET all users (admin view)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            purchases: {
              where: { status: 'ACTIVE' },
            },
            reservations: {
              where: { status: 'CONFIRMED' },
            },
          },
        },
        purchases: {
          where: { status: 'ACTIVE' },
          include: {
            package: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        reservations: {
          where: { status: 'CONFIRMED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Format the response
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      image: user.image,
      role: user.role,
      createdAt: user.createdAt,
      activePackages: user._count.purchases,
      totalClasses: user._count.reservations,
      lastActivity: user.reservations[0]?.createdAt || user.purchases[0]?.createdAt || user.createdAt,
      currentPackage: user.purchases[0]?.package?.name || null,
    }))

    return NextResponse.json(formattedUsers)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Error al obtener los usuarios' },
      { status: 500 }
    )
  }
}
