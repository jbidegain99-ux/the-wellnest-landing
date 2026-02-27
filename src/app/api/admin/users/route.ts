import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Force dynamic - this route uses headers/session
export const dynamic = 'force-dynamic'

// GET all users (admin view) with pagination
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')))
    const search = searchParams.get('search') || ''

    const skip = (page - 1) * limit

    // Build where clause for search
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}

    // Get total count and users in parallel
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
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
        skip,
        take: limit,
      }),
    ])

    // Format the response
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      image: user.profileImage,
      role: user.role,
      createdAt: user.createdAt,
      activePackages: user._count.purchases,
      totalClasses: user._count.reservations,
      lastActivity: user.reservations[0]?.createdAt || user.purchases[0]?.createdAt || user.createdAt,
      currentPackage: user.purchases[0]?.package?.name || null,
    }))

    return NextResponse.json({
      users: formattedUsers,
      pagination: {
        current: page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Error al obtener los usuarios' },
      { status: 500 }
    )
  }
}
