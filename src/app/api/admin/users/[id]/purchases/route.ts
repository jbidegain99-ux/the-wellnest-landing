import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - fetch all purchases for a specific user (admin view)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: userId } = await params

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    const purchases = await prisma.purchase.findMany({
      where: { userId },
      include: {
        package: {
          select: {
            id: true,
            name: true,
            classCount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // For shared purchases, fetch group members
    const sharedGroupIds = Array.from(new Set(
      purchases.map((p) => p.sharedGroupId).filter(Boolean) as string[]
    ))

    let groupMembers: Record<string, Array<{ purchaseId: string; userId: string; userName: string | null; classesRemaining: number; classesAllocated: number | null }>> = {}

    if (sharedGroupIds.length > 0) {
      const allGroupPurchases = await prisma.purchase.findMany({
        where: {
          sharedGroupId: { in: sharedGroupIds },
          userId: { not: userId }, // exclude current user
        },
        include: {
          user: { select: { id: true, name: true } },
        },
      })

      for (const gp of allGroupPurchases) {
        if (!gp.sharedGroupId) continue
        if (!groupMembers[gp.sharedGroupId]) {
          groupMembers[gp.sharedGroupId] = []
        }
        groupMembers[gp.sharedGroupId].push({
          purchaseId: gp.id,
          userId: gp.user.id,
          userName: gp.user.name,
          classesRemaining: gp.classesRemaining,
          classesAllocated: gp.classesAllocated,
        })
      }
    }

    const formattedPurchases = purchases.map((p) => ({
      id: p.id,
      packageId: p.packageId,
      packageName: p.package.name,
      classCount: p.package.classCount,
      classesRemaining: p.classesRemaining,
      expiresAt: p.expiresAt.toISOString(),
      createdAt: p.createdAt.toISOString(),
      status: p.status,
      finalPrice: p.finalPrice,
      sharedGroupId: p.sharedGroupId,
      sharedFromId: p.sharedFromId,
      classesAllocated: p.classesAllocated,
      sharedMembers: p.sharedGroupId ? (groupMembers[p.sharedGroupId] || []) : [],
    }))

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
      purchases: formattedPurchases,
    })
  } catch (error) {
    console.error('Error fetching user purchases:', error)
    return NextResponse.json(
      { error: 'Error al obtener las compras del usuario' },
      { status: 500 }
    )
  }
}
