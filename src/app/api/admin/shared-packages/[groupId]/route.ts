import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - view all purchases in a shared group
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { groupId } = await params

    const purchases = await prisma.purchase.findMany({
      where: { sharedGroupId: groupId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        package: { select: { id: true, name: true, classCount: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    if (purchases.length === 0) {
      return NextResponse.json(
        { error: 'Grupo compartido no encontrado' },
        { status: 404 }
      )
    }

    const original = purchases.find((p) => !p.sharedFromId)
    const children = purchases.filter((p) => !!p.sharedFromId)

    return NextResponse.json({
      groupId,
      packageName: purchases[0].package.name,
      original: original
        ? {
            id: original.id,
            userId: original.user.id,
            userName: original.user.name,
            userEmail: original.user.email,
            classesRemaining: original.classesRemaining,
            classesAllocated: original.classesAllocated,
            expiresAt: original.expiresAt.toISOString(),
            status: original.status,
          }
        : null,
      members: children.map((p) => ({
        id: p.id,
        userId: p.user.id,
        userName: p.user.name,
        userEmail: p.user.email,
        classesRemaining: p.classesRemaining,
        classesAllocated: p.classesAllocated,
        expiresAt: p.expiresAt.toISOString(),
        status: p.status,
      })),
      totalMembers: purchases.length,
    })
  } catch (error) {
    console.error('Error fetching shared group:', error)
    return NextResponse.json(
      { error: 'Error al obtener el grupo compartido' },
      { status: 500 }
    )
  }
}
