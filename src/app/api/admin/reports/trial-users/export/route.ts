import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getNowInSV, formatInSV } from '@/lib/utils/timezone'

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

    const now = getNowInSV()
    const dateStr = formatInSV(new Date(), 'yyyy-MM-dd')

    if (trialPackages.length === 0) {
      const bom = '\uFEFF'
      const header = 'Nombre,Email,Teléfono,Fecha Trial,Paquete Trial,Ha Comprado,Total Gastado,Días Desde Trial'
      return new Response(bom + header + '\n', {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="trial-users-${dateStr}.csv"`,
        },
      })
    }

    const trialPackageIds = trialPackages.map((p) => p.id)

    // 2. Find all purchases for trial packages, include user data
    const trialPurchases = await prisma.purchase.findMany({
      where: {
        packageId: { in: trialPackageIds },
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

    // 4. Build CSV rows
    const rows: string[] = []

    for (const tp of uniqueTrialPurchases) {
      const subsequentPurchases = await prisma.purchase.findMany({
        where: {
          userId: tp.userId,
          createdAt: { gt: tp.createdAt },
          package: { price: { gt: 0 } },
        },
        select: { finalPrice: true },
      })

      const totalSpent = Math.round(
        subsequentPurchases.reduce((sum, sp) => sum + sp.finalPrice, 0) * 100
      ) / 100

      const hasReturned = subsequentPurchases.length > 0
      const daysSince = Math.floor(
        (now.getTime() - tp.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      )

      const trialDate = formatInSV(tp.createdAt, 'yyyy-MM-dd')

      // Escape CSV fields that may contain commas or quotes
      const escapeCsv = (val: string): string => {
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`
        }
        return `"${val}"`
      }

      rows.push(
        [
          escapeCsv(tp.user.name),
          escapeCsv(tp.user.email),
          escapeCsv(tp.user.phone || 'N/A'),
          trialDate,
          escapeCsv(tp.package.name),
          hasReturned ? 'Sí' : 'No',
          totalSpent.toFixed(2),
          daysSince.toString(),
        ].join(',')
      )
    }

    const bom = '\uFEFF'
    const header = 'Nombre,Email,Teléfono,Fecha Trial,Paquete Trial,Ha Comprado,Total Gastado,Días Desde Trial'
    const csvContent = bom + [header, ...rows].join('\n') + '\n'

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="trial-users-${dateStr}.csv"`,
      },
    })
  } catch (error) {
    console.error('Error exporting trial users CSV:', error)
    return NextResponse.json(
      { error: 'Error generating CSV export' },
      { status: 500 }
    )
  }
}
