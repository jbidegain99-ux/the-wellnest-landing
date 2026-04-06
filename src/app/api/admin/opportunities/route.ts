import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getNowInSV } from '@/lib/utils/timezone'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const now = getNowInSV()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
      expiringPackages,
      abandonedCarts,
      allPurchases,
      trialPurchases,
      lowRemainingPackages,
      classes,
      noShowReservations,
    ] = await Promise.all([
      // 1. Packages expiring this week
      prisma.purchase.findMany({
        where: {
          status: 'ACTIVE',
          expiresAt: { gt: now, lte: sevenDaysFromNow },
        },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          package: { select: { name: true, price: true } },
        },
        orderBy: { expiresAt: 'asc' },
      }),

      // 2. Abandoned carts (pending orders)
      prisma.order.findMany({
        where: { status: 'PENDING' },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          items: { include: { package: { select: { name: true, price: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // 3 & 5 & 6. All purchases for trial conversion, inactive users, and upsell analysis
      prisma.purchase.findMany({
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          package: { select: { name: true, price: true, classCount: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // 3b. Trial purchases specifically
      prisma.purchase.findMany({
        where: {
          package: { name: { contains: 'Prueba', mode: 'insensitive' } },
        },
        select: { userId: true },
      }),

      // 4. Low remaining classes (1-2 left, still active)
      prisma.purchase.findMany({
        where: {
          status: 'ACTIVE',
          classesRemaining: { lte: 2, gt: 0 },
          expiresAt: { gt: now },
        },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          package: { select: { name: true, price: true, classCount: true } },
        },
        orderBy: { classesRemaining: 'asc' },
      }),

      // 7 & 9. Classes for demand and occupancy analysis (last 30 days + upcoming)
      prisma.class.findMany({
        where: {
          isCancelled: false,
          dateTime: { gte: thirtyDaysAgo },
        },
        include: {
          discipline: { select: { name: true } },
          instructor: { select: { name: true } },
          _count: {
            select: {
              reservations: { where: { status: { in: ['CONFIRMED', 'ATTENDED'] } } },
            },
          },
        },
        orderBy: { dateTime: 'desc' },
      }),

      // 8. No-show reservations (last 30 days)
      prisma.reservation.findMany({
        where: {
          status: 'NO_SHOW',
          createdAt: { gte: thirtyDaysAgo },
        },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          class: {
            include: {
              discipline: { select: { name: true } },
            },
          },
        },
      }),
    ])

    // --- Process data ---

    // 1. Expiring packages (already fetched)
    const expiringList = expiringPackages.map((p) => ({
      userId: p.user.id,
      userName: p.user.name,
      userEmail: p.user.email,
      userPhone: p.user.phone,
      packageName: p.package.name,
      packagePrice: p.package.price,
      classesRemaining: p.classesRemaining,
      expiresAt: p.expiresAt.toISOString(),
      daysUntilExpiry: Math.ceil((p.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    }))

    // 2. Abandoned carts
    const abandonedList = abandonedCarts.map((o) => ({
      userId: o.user.id,
      userName: o.user.name,
      userEmail: o.user.email,
      userPhone: o.user.phone,
      packageName: o.items.map((i) => i.package.name).join(', ') || 'Desconocido',
      amount: o.total,
      attemptDate: o.createdAt.toISOString(),
      daysSinceAttempt: Math.floor((now.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
    }))

    // 3. Trial users without conversion
    const trialUserIds = new Set(trialPurchases.map((p) => p.userId))
    const usersWithPaidPurchase = new Set(
      allPurchases
        .filter((p) => !p.package.name.toLowerCase().includes('prueba'))
        .map((p) => p.userId)
    )
    const trialNoConversion = allPurchases
      .filter(
        (p) =>
          p.package.name.toLowerCase().includes('prueba') &&
          !usersWithPaidPurchase.has(p.userId)
      )
      // Deduplicate by userId
      .filter((p, i, arr) => arr.findIndex((x) => x.userId === p.userId) === i)
      .map((p) => ({
        userId: p.user.id,
        userName: p.user.name,
        userEmail: p.user.email,
        userPhone: p.user.phone,
        trialDate: p.createdAt.toISOString(),
        daysSinceTrial: Math.floor((now.getTime() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
        trialPackage: p.package.name,
      }))

    // 4. Low remaining classes (already fetched)
    const lowRemainingList = lowRemainingPackages.map((p) => ({
      userId: p.user.id,
      userName: p.user.name,
      userEmail: p.user.email,
      userPhone: p.user.phone,
      packageName: p.package.name,
      classesRemaining: p.classesRemaining,
      totalClasses: p.package.classCount,
      expiresAt: p.expiresAt.toISOString(),
    }))

    // 5. Inactive users (expired/depleted, no new purchase in 30+ days)
    const userLastPurchase = new Map<string, { date: Date; user: typeof allPurchases[0]['user']; packageName: string }>()
    for (const p of allPurchases) {
      const existing = userLastPurchase.get(p.userId)
      if (!existing || p.createdAt > existing.date) {
        userLastPurchase.set(p.userId, { date: p.createdAt, user: p.user, packageName: p.package.name })
      }
    }
    // Users with active packages
    const usersWithActivePackage = new Set(
      allPurchases.filter((p) => p.status === 'ACTIVE' && p.expiresAt > now).map((p) => p.userId)
    )
    const inactiveList = Array.from(userLastPurchase.entries())
      .filter(([userId, data]) => {
        return !usersWithActivePackage.has(userId) && data.date < thirtyDaysAgo
      })
      .map(([userId, data]) => ({
        userId,
        userName: data.user.name,
        userEmail: data.user.email,
        userPhone: data.user.phone,
        lastPackage: data.packageName,
        lastPurchaseDate: data.date.toISOString(),
        daysSinceLastPurchase: Math.floor((now.getTime() - data.date.getTime()) / (1000 * 60 * 60 * 24)),
      }))
      .sort((a, b) => a.daysSinceLastPurchase - b.daysSinceLastPurchase)

    // 6. Upsell candidates (users who bought 2+ small packages, never bought a large one)
    const userPurchaseCounts = new Map<string, { count: number; totalSpent: number; maxClassCount: number; user: typeof allPurchases[0]['user'] }>()
    for (const p of allPurchases) {
      if (p.package.name.toLowerCase().includes('prueba')) continue
      const existing = userPurchaseCounts.get(p.userId)
      if (existing) {
        existing.count++
        existing.totalSpent += p.finalPrice
        existing.maxClassCount = Math.max(existing.maxClassCount, p.package.classCount)
      } else {
        userPurchaseCounts.set(p.userId, {
          count: 1,
          totalSpent: p.finalPrice,
          maxClassCount: p.package.classCount,
          user: p.user,
        })
      }
    }
    const upsellList = Array.from(userPurchaseCounts.entries())
      .filter(([, data]) => data.count >= 2 && data.maxClassCount <= 8)
      .map(([userId, data]) => ({
        userId,
        userName: data.user.name,
        userEmail: data.user.email,
        userPhone: data.user.phone,
        purchaseCount: data.count,
        totalSpent: data.totalSpent,
        maxPackageSize: data.maxClassCount,
      }))
      .sort((a, b) => b.purchaseCount - a.purchaseCount)

    // 7. High-demand classes (occupancy >= 90%)
    const highDemandClasses = classes
      .filter((c) => c.maxCapacity > 0 && c._count.reservations / c.maxCapacity >= 0.9)
      .map((c) => ({
        classId: c.id,
        discipline: c.discipline.name,
        instructor: c.instructor.name,
        dateTime: c.dateTime.toISOString(),
        enrolled: c._count.reservations,
        capacity: c.maxCapacity,
        occupancyRate: Math.round((c._count.reservations / c.maxCapacity) * 100),
      }))

    // 8. Recurring no-shows (users with 2+ no-shows in last 30 days)
    const noShowCounts = new Map<string, { count: number; user: typeof noShowReservations[0]['user']; lastClass: string }>()
    for (const r of noShowReservations) {
      const existing = noShowCounts.get(r.userId)
      if (existing) {
        existing.count++
      } else {
        noShowCounts.set(r.userId, {
          count: 1,
          user: r.user,
          lastClass: r.class.discipline.name,
        })
      }
    }
    const recurringNoShows = Array.from(noShowCounts.entries())
      .filter(([, data]) => data.count >= 2)
      .map(([userId, data]) => ({
        userId,
        userName: data.user.name,
        userEmail: data.user.email,
        userPhone: data.user.phone,
        noShowCount: data.count,
        lastClass: data.lastClass,
      }))
      .sort((a, b) => b.noShowCount - a.noShowCount)

    // 9. Low-occupancy classes (occupancy <= 40%)
    const lowOccupancyClasses = classes
      .filter((c) => c.maxCapacity > 0 && c._count.reservations / c.maxCapacity <= 0.4 && c.dateTime > thirtyDaysAgo)
      .map((c) => ({
        classId: c.id,
        discipline: c.discipline.name,
        instructor: c.instructor.name,
        dateTime: c.dateTime.toISOString(),
        enrolled: c._count.reservations,
        capacity: c.maxCapacity,
        occupancyRate: Math.round((c._count.reservations / c.maxCapacity) * 100),
      }))

    // Group low-occupancy by discipline for summary
    const lowOccByDiscipline = new Map<string, { count: number; avgOccupancy: number }>()
    for (const c of lowOccupancyClasses) {
      const existing = lowOccByDiscipline.get(c.discipline)
      if (existing) {
        existing.count++
        existing.avgOccupancy = (existing.avgOccupancy * (existing.count - 1) + c.occupancyRate) / existing.count
      } else {
        lowOccByDiscipline.set(c.discipline, { count: 1, avgOccupancy: c.occupancyRate })
      }
    }

    return NextResponse.json({
      summary: {
        expiringThisWeek: expiringList.length,
        abandonedCarts: abandonedList.length,
        trialNoConversion: trialNoConversion.length,
        lowRemaining: lowRemainingList.length,
        inactiveUsers: inactiveList.length,
        upsellCandidates: upsellList.length,
        highDemandClasses: highDemandClasses.length,
        recurringNoShows: recurringNoShows.length,
        lowOccupancyClasses: lowOccupancyClasses.length,
      },
      opportunities: {
        expiringThisWeek: expiringList,
        abandonedCarts: abandonedList,
        trialNoConversion,
        lowRemaining: lowRemainingList,
        inactiveUsers: inactiveList,
        upsellCandidates: upsellList,
        highDemandClasses,
        recurringNoShows,
        lowOccupancyClasses: Array.from(lowOccByDiscipline.entries()).map(([discipline, data]) => ({
          discipline,
          classCount: data.count,
          avgOccupancy: Math.round(data.avgOccupancy),
        })),
      },
    })
  } catch (error) {
    console.error('Error fetching opportunities:', error)
    return NextResponse.json(
      { error: 'Error al obtener oportunidades' },
      { status: 500 }
    )
  }
}
