import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EXCLUDED_USER_IDS } from '@/lib/constants'
import { getExcludedPurchaseIds } from '@/lib/excluded-purchases'
import {
  getStartOfMonthSV,
  getStartOfWeekSV,
  getStartOfTodaySV,
} from '@/lib/utils/timezone'
import { aggregatePurchases, groupByDaySV, type RawPurchase } from '@/lib/finance/aggregate'
import { getCurrentFinancialConfig } from '@/lib/finance/config'
import { fromZonedTime } from 'date-fns-tz'

export const dynamic = 'force-dynamic'

const TZ = 'America/El_Salvador'

type Period = 'today' | 'week' | 'month' | 'custom'

function resolveRange(
  period: Period,
  startParam: string | null,
  endParam: string | null
): { start: Date; end: Date } {
  if (period === 'custom' && startParam && endParam) {
    // Interpret YYYY-MM-DD as SV-local midnight → UTC
    const [sy, sm, sd] = startParam.split('-').map(Number)
    const [ey, em, ed] = endParam.split('-').map(Number)
    const start = fromZonedTime(new Date(sy, sm - 1, sd, 0, 0, 0, 0), TZ)
    const end = fromZonedTime(new Date(ey, em - 1, ed, 23, 59, 59, 999), TZ)
    return { start, end }
  }
  const now = new Date()
  if (period === 'today') return { start: getStartOfTodaySV(), end: now }
  if (period === 'week') return { start: getStartOfWeekSV(), end: now }
  return { start: getStartOfMonthSV(), end: now }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const rawPeriod = (searchParams.get('period') || 'month') as Period
    const period: Period = (['today', 'week', 'month', 'custom'] as const).includes(rawPeriod)
      ? rawPeriod
      : 'month'
    const { start, end } = resolveRange(
      period,
      searchParams.get('start'),
      searchParams.get('end')
    )

    const excludedIds = await getExcludedPurchaseIds()
    const purchases = await prisma.purchase.findMany({
      where: {
        userId: { notIn: EXCLUDED_USER_IDS },
        ...(excludedIds.length > 0 && { id: { notIn: excludedIds } }),
        createdAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        finalPrice: true,
        paymentProviderId: true,
        createdAt: true,
      },
    })

    const config = getCurrentFinancialConfig()
    const rows: RawPurchase[] = purchases.map((p) => ({
      id: p.id,
      finalPrice: p.finalPrice,
      paymentProviderId: p.paymentProviderId,
      createdAt: p.createdAt,
    }))

    const totals = aggregatePurchases(rows, config)
    const daily = groupByDaySV(rows, config)

    return NextResponse.json({
      period,
      range: { start: start.toISOString(), end: end.toISOString() },
      config: {
        ivaRate: config.ivaRate,
        ivaIncludedInPrice: config.ivaIncludedInPrice,
        gatewayFeeRate: config.gatewayFeeRate,
        tds3DsPerTransaction: config.tds3DsPerTransaction,
        retencionEnabled: config.retencionEnabled,
      },
      totals,
      daily,
    })
  } catch (error) {
    console.error('Error in finances summary:', error)
    return NextResponse.json(
      { error: 'Error al calcular resumen financiero' },
      { status: 500 }
    )
  }
}
