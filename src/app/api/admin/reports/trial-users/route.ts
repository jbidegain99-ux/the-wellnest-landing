import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EXCLUDED_USER_IDS } from '@/lib/constants'

interface SubsequentPurchase {
  packageName: string
  purchaseDate: string
  amount: number
}

interface TrialUserReport {
  userId: string
  name: string
  email: string
  phone: string | null
  trialPurchaseDate: string
  trialPackageName: string
  subsequentPurchases: SubsequentPurchase[]
  hasReturnedAsCustomer: boolean
  totalSpentAfterTrial: number
  daysSinceTrialPurchase: number
}

interface TrialUsersSummary {
  totalTrialUsers: number
  returnedCustomers: number
  retentionRate: number
  totalRevenueFromConverted: number
}

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Find all trial packages (price === 0)
    const trialPackages = await prisma.package.findMany({
      where: { price: 0 },
      select: { id: true, name: true },
    })

    if (trialPackages.length === 0) {
      return NextResponse.json({
        users: [],
        summary: {
          totalTrialUsers: 0,
          returnedCustomers: 0,
          retentionRate: 0,
          totalRevenueFromConverted: 0,
        },
      })
    }

    const trialPackageIds = trialPackages.map((p) => p.id)

    // 2. Find all purchases for trial packages, include user data
    const trialPurchases = await prisma.purchase.findMany({
      where: {
        packageId: { in: trialPackageIds },
        // Cuentas de prueba fuera de las métricas de conversión
        userId: { notIn: EXCLUDED_USER_IDS },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        package: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // 3. Deduplicate by userId — keep the most recent trial purchase
    const seenUsers = new Set<string>()
    const uniqueTrialPurchases = trialPurchases.filter((p) => {
      if (seenUsers.has(p.userId)) return false
      seenUsers.add(p.userId)
      return true
    })

    // 4. For each trial user, find subsequent paid purchases.
    // Una sola query userId IN (...) agrupada en memoria — antes era una
    // query por usuario (N+1).
    // new Date() para filtros Prisma: getNowInSV devuelve un epoch corrido
    // -6h que NO debe compararse contra timestamps UTC de la BD
    const now = new Date()
    const trialUserIds = uniqueTrialPurchases.map((tp) => tp.userId)
    const allSubsequent = await prisma.purchase.findMany({
      where: {
        userId: { in: trialUserIds },
        package: { price: { gt: 0 } },
      },
      include: {
        package: { select: { name: true, price: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    const subsequentByUser = new Map<string, typeof allSubsequent>()
    for (const sp of allSubsequent) {
      const list = subsequentByUser.get(sp.userId) ?? []
      list.push(sp)
      subsequentByUser.set(sp.userId, list)
    }

    const users: TrialUserReport[] = uniqueTrialPurchases.map((tp) => {
      {
        const subsequentPurchases = (subsequentByUser.get(tp.userId) ?? []).filter(
          (sp) => sp.createdAt > tp.createdAt
        )

        const subsequentData: SubsequentPurchase[] = subsequentPurchases.map((sp) => ({
          packageName: sp.package.name,
          purchaseDate: sp.createdAt.toISOString(),
          amount: sp.finalPrice,
        }))

        const totalSpentAfterTrial = subsequentPurchases.reduce(
          (sum, sp) => sum + sp.finalPrice,
          0
        )

        const daysSinceTrialPurchase = Math.floor(
          (now.getTime() - tp.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        )

        return {
          userId: tp.userId,
          name: tp.user.name,
          email: tp.user.email,
          phone: tp.user.phone,
          trialPurchaseDate: tp.createdAt.toISOString(),
          trialPackageName: tp.package.name,
          subsequentPurchases: subsequentData,
          hasReturnedAsCustomer: subsequentPurchases.length > 0,
          totalSpentAfterTrial: Math.round(totalSpentAfterTrial * 100) / 100,
          daysSinceTrialPurchase,
        }
      }
    })

    // 5. Calculate summary
    const totalTrialUsers = users.length
    const returnedCustomers = users.filter((u) => u.hasReturnedAsCustomer).length
    const retentionRate =
      totalTrialUsers > 0
        ? Math.round((returnedCustomers / totalTrialUsers) * 10000) / 100
        : 0
    const totalRevenueFromConverted = Math.round(
      users.reduce((sum, u) => sum + u.totalSpentAfterTrial, 0) * 100
    ) / 100

    const summary: TrialUsersSummary = {
      totalTrialUsers,
      returnedCustomers,
      retentionRate,
      totalRevenueFromConverted,
    }

    return NextResponse.json({ users, summary })
  } catch (error) {
    console.error('Error generating trial users report:', error)
    return NextResponse.json(
      { error: 'Error generating report' },
      { status: 500 }
    )
  }
}
