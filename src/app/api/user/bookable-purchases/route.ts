import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isPackageCompatibleWithClass } from '@/lib/booking/packageCompatibility'
import { isTrialBlockedForClass } from '@/lib/booking/trialCutoff'

// Force dynamic - this route uses the session
export const dynamic = 'force-dynamic'

/**
 * Returns the user's active packages that are valid for a specific class,
 * sorted by earliest expiration (first item = suggested default).
 * Compatibility (private / discipline restrictions) is decided by the shared
 * helper so it never drifts from the booking POST validator.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')
    if (!classId) {
      return NextResponse.json({ error: 'classId requerido' }, { status: 400 })
    }

    const classData = await prisma.class.findUnique({
      where: { id: classId },
      select: { disciplineId: true, dateTime: true },
    })
    if (!classData) {
      return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 })
    }

    const now = new Date()
    const purchases = await prisma.purchase.findMany({
      where: {
        userId: session.user.id,
        status: 'ACTIVE',
        classesRemaining: { gt: 0 },
        expiresAt: { gt: now },
      },
      include: {
        package: {
          include: { disciplines: { select: { disciplineId: true } } },
        },
      },
      orderBy: { expiresAt: 'asc' },
    })

    const bookablePurchases = purchases
      .filter(
        (p) =>
          isPackageCompatibleWithClass(p.package, classData.disciplineId) &&
          !isTrialBlockedForClass(p.packageId, classData.dateTime)
      )
      .map((p) => ({
        purchaseId: p.id,
        packageId: p.packageId,
        packageName: p.package.name,
        classesRemaining: p.classesRemaining,
        expiresAt: p.expiresAt.toISOString(),
        isShareable: p.package.isShareable,
        maxShares: p.package.maxShares,
      }))

    return NextResponse.json({ bookablePurchases })
  } catch (error) {
    console.error('Error fetching bookable purchases:', error)
    return NextResponse.json(
      { error: 'Error al obtener los paquetes disponibles' },
      { status: 500 }
    )
  }
}
