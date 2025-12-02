import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Get all purchases for the user, ordered by status and expiration
    const purchases = await prisma.purchase.findMany({
      where: {
        userId,
      },
      include: {
        package: true,
        reservations: {
          include: {
            class: {
              include: {
                instructor: true,
                discipline: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: [
        { status: 'asc' }, // ACTIVE first
        { expiresAt: 'asc' },
      ],
    })

    // Separate active and expired/used purchases
    const now = new Date()
    const activePurchases = purchases.filter(
      (p) =>
        p.status === 'ACTIVE' &&
        p.classesRemaining > 0 &&
        new Date(p.expiresAt) > now
    )

    const historyPurchases = purchases.filter(
      (p) =>
        p.status !== 'ACTIVE' ||
        p.classesRemaining === 0 ||
        new Date(p.expiresAt) <= now
    )

    return NextResponse.json({
      activePurchases: activePurchases.map((p) => ({
        id: p.id,
        packageId: p.packageId,
        packageName: p.package.name,
        classesTotal: p.package.classCount,
        classesRemaining: p.classesRemaining,
        classesUsed: p.package.classCount - p.classesRemaining,
        expiresAt: p.expiresAt,
        purchasedAt: p.createdAt,
        status: p.status,
        reservations: p.reservations.map((r) => ({
          id: r.id,
          discipline: r.class.discipline?.name,
          instructor: r.class.instructor?.name,
          dateTime: r.class.dateTime,
          status: r.status,
        })),
      })),
      historyPurchases: historyPurchases.map((p) => ({
        id: p.id,
        packageId: p.packageId,
        packageName: p.package.name,
        classesTotal: p.package.classCount,
        classesRemaining: p.classesRemaining,
        classesUsed: p.package.classCount - p.classesRemaining,
        expiresAt: p.expiresAt,
        purchasedAt: p.createdAt,
        status: p.status,
      })),
      totalActive: activePurchases.length,
      totalClassesRemaining: activePurchases.reduce(
        (sum, p) => sum + p.classesRemaining,
        0
      ),
    })
  } catch (error) {
    console.error('Error fetching user purchases:', error)
    return NextResponse.json(
      { error: 'Error al obtener los paquetes' },
      { status: 500 }
    )
  }
}
