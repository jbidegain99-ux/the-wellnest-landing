import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(0, parseInt(searchParams.get('page') || '0'))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const search = searchParams.get('search') || ''
    const paymentMethod = searchParams.get('paymentMethod') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

    const skip = page * limit

    // Build where clause for purchases (the source of truth for sales)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {}

    // Search by user email/name or package name
    if (search) {
      where.OR = [
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { package: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }

    // Filter by payment method (skip if empty or "all")
    if (paymentMethod === 'Offline') {
      where.paymentProviderId = null
    } else if (paymentMethod === 'PayWay') {
      where.paymentProviderId = { not: null }
    }
    // "all" or empty string: no filter applied

    // Date range filter (on purchase createdAt)
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        // Include the full end date day
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    // Determine sort field
    const orderByField = sortBy === 'amount' ? 'finalPrice' : 'createdAt'

    const [total, purchases] = await Promise.all([
      prisma.purchase.count({ where }),
      prisma.purchase.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
          package: { select: { name: true } },
        },
        orderBy: { [orderByField]: sortOrder },
        skip,
        take: limit,
      }),
    ])

    const sales = purchases.map((p) => ({
      id: p.id,
      userEmail: p.user.email,
      userName: p.user.name,
      packageName: p.package.name,
      amount: p.finalPrice,
      createdAt: p.createdAt.toISOString(),
      status: p.status.toLowerCase(),
      paymentMethod: p.paymentProviderId ? 'PayWay' : 'Offline',
      notes: p.discountCode || null,
    }))

    return NextResponse.json({
      sales,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching sales:', error)
    return NextResponse.json(
      { error: 'Error al obtener las ventas' },
      { status: 500 }
    )
  }
}
