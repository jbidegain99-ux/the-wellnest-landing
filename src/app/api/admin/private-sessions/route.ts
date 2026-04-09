/**
 * Admin-facing API for private session requests.
 * GET — List all requests, filterable by status.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED'] as const
type Status = (typeof VALID_STATUSES)[number]

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get('status')
  const status =
    statusParam && (VALID_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as Status)
      : null

  const requests = await prisma.privateSessionRequest.findMany({
    where: status ? { status } : undefined,
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      purchase: {
        include: { package: { select: { name: true, price: true } } },
      },
      preferredDiscipline: { select: { id: true, name: true, slug: true } },
      preferredInstructor: { select: { id: true, name: true } },
      confirmedClass: {
        include: {
          discipline: { select: { name: true } },
          instructor: { select: { name: true } },
        },
      },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })

  // Summary counts per status for the admin badge
  const counts = await prisma.privateSessionRequest.groupBy({
    by: ['status'],
    _count: { id: true },
  })
  const countsByStatus: Record<string, number> = {}
  for (const c of counts) {
    countsByStatus[c.status] = c._count.id
  }

  return NextResponse.json({ requests, countsByStatus })
}
