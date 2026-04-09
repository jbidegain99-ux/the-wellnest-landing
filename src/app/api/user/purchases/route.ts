import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Force dynamic - this route uses headers/session
export const dynamic = 'force-dynamic'

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

    // For shared purchases, fetch sharing info
    const sharedGroupIds = Array.from(new Set(
      purchases.map((p) => p.sharedGroupId).filter(Boolean) as string[]
    ))

    let sharedInfo: Record<string, Array<{ userName: string | null; isOriginal: boolean }>> = {}

    if (sharedGroupIds.length > 0) {
      const groupPurchases = await prisma.purchase.findMany({
        where: {
          sharedGroupId: { in: sharedGroupIds },
          userId: { not: userId },
        },
        include: {
          user: { select: { name: true } },
        },
      })

      for (const gp of groupPurchases) {
        if (!gp.sharedGroupId) continue
        if (!sharedInfo[gp.sharedGroupId]) {
          sharedInfo[gp.sharedGroupId] = []
        }
        sharedInfo[gp.sharedGroupId].push({
          userName: gp.user.name,
          isOriginal: !gp.sharedFromId,
        })
      }
    }

    // For child purchases, fetch original owner name
    const sharedFromIds = Array.from(new Set(
      purchases.map((p) => p.sharedFromId).filter(Boolean) as string[]
    ))

    let originalOwners: Record<string, string | null> = {}

    if (sharedFromIds.length > 0) {
      const originals = await prisma.purchase.findMany({
        where: { id: { in: sharedFromIds } },
        include: { user: { select: { name: true } } },
      })
      for (const o of originals) {
        originalOwners[o.id] = o.user.name
      }
    }

    const mapPurchase = (p: typeof purchases[0], includeReservations: boolean) => {
      const isShared = !!p.sharedGroupId
      const isChild = !!p.sharedFromId
      const classesTotal = isShared && p.classesAllocated != null
        ? p.classesAllocated
        : p.package.classCount
      const classesUsed = classesTotal - p.classesRemaining

      return {
        id: p.id,
        packageId: p.packageId,
        packageName: p.package.name,
        classesTotal,
        classesRemaining: p.classesRemaining,
        classesUsed: Math.max(0, classesUsed),
        expiresAt: p.expiresAt,
        purchasedAt: p.createdAt,
        status: p.status,
        isPrivate: p.package.isPrivate,
        isShared,
        isChild,
        sharedByName: isChild && p.sharedFromId ? (originalOwners[p.sharedFromId] || null) : null,
        sharedWith: isShared && p.sharedGroupId ? (sharedInfo[p.sharedGroupId] || []) : [],
        ...(includeReservations
          ? {
              reservations: p.reservations.map((r) => ({
                id: r.id,
                discipline: r.class.discipline?.name,
                instructor: r.class.instructor?.name,
                dateTime: r.class.dateTime,
                status: r.status,
              })),
            }
          : {}),
      }
    }

    return NextResponse.json({
      activePurchases: activePurchases.map((p) => mapPurchase(p, true)),
      historyPurchases: historyPurchases.map((p) => mapPurchase(p, false)),
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
