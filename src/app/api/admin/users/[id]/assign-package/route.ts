import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const assignPackageSchema = z.object({
  packageId: z.string().min(1, 'Se requiere el ID del paquete'),
  classCount: z.number().optional(), // If not provided, use package default
})

// POST - assign a package to a user
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: userId } = await params
    const body = await request.json()
    const validation = assignPackageSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Datos inválidos' },
        { status: 400 }
      )
    }

    const { packageId, classCount } = validation.data

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Verify package exists and is active
    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
    })

    if (!pkg) {
      return NextResponse.json(
        { error: 'Paquete no encontrado' },
        { status: 404 }
      )
    }

    // Calculate expiration date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + pkg.validityDays)

    // Create the purchase (assign package to user)
    const purchase = await prisma.purchase.create({
      data: {
        userId,
        packageId,
        classesRemaining: classCount || pkg.classCount,
        originalPrice: pkg.price,
        finalPrice: 0, // Admin-assigned packages are free
        expiresAt,
        status: 'ACTIVE',
      },
      include: {
        package: true,
      },
    })

    console.log('[ADMIN] Package assigned:', {
      userId,
      packageId,
      purchaseId: purchase.id,
      classesRemaining: purchase.classesRemaining,
      expiresAt: purchase.expiresAt,
      adminId: session.user.id,
    })

    return NextResponse.json({
      message: `Paquete "${pkg.name}" asignado correctamente`,
      purchase: {
        id: purchase.id,
        packageName: purchase.package.name,
        classesRemaining: purchase.classesRemaining,
        expiresAt: purchase.expiresAt,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Error assigning package:', error)
    return NextResponse.json(
      { error: 'Error al asignar el paquete' },
      { status: 500 }
    )
  }
}
