import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Find active purchase with remaining classes
    const purchase = await prisma.purchase.findFirst({
      where: {
        userId: session.user.id,
        status: 'ACTIVE',
        classesRemaining: { gt: 0 },
        expiresAt: { gt: new Date() },
      },
      include: {
        package: true,
      },
      orderBy: { expiresAt: 'asc' },
    })

    if (!purchase) {
      return NextResponse.json({
        hasActivePackage: false,
        classesRemaining: 0,
        package: null,
      })
    }

    return NextResponse.json({
      hasActivePackage: true,
      purchaseId: purchase.id,
      classesRemaining: purchase.classesRemaining,
      expiresAt: purchase.expiresAt,
      package: purchase.package,
    })
  } catch (error) {
    console.error('Error fetching active purchase:', error)
    return NextResponse.json(
      { error: 'Error al obtener el paquete activo' },
      { status: 500 }
    )
  }
}
