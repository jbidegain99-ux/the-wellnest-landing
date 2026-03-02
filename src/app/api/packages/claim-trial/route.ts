import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { addDays } from 'date-fns'
import { sendEmail, buildTrialPackageEmail } from '@/lib/emailService'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Debes iniciar sesión para adquirir este paquete' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const body = await request.json()
    const { packageId } = body

    if (!packageId) {
      return NextResponse.json(
        { error: 'ID de paquete requerido' },
        { status: 400 }
      )
    }

    // 1. Verify the package exists and is free (trial)
    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
    })

    if (!pkg) {
      return NextResponse.json(
        { error: 'Paquete no encontrado' },
        { status: 404 }
      )
    }

    if (pkg.price !== 0) {
      return NextResponse.json(
        { error: 'Este paquete requiere pago' },
        { status: 400 }
      )
    }

    if (!pkg.isActive) {
      return NextResponse.json(
        { error: 'Este paquete no está disponible' },
        { status: 400 }
      )
    }

    // 2. Check if user already has this package (1 per user limit)
    const existingPurchase = await prisma.purchase.findFirst({
      where: {
        userId,
        packageId,
      },
    })

    if (existingPurchase) {
      return NextResponse.json(
        {
          error: 'Ya adquiriste el paquete de prueba. Solo se puede obtener una vez.',
          code: 'TRIAL_PACKAGE_LIMIT_EXCEEDED',
        },
        { status: 400 }
      )
    }

    // 3. Create the Purchase record
    const expiresAt = addDays(new Date(), pkg.validityDays)

    const purchase = await prisma.purchase.create({
      data: {
        userId,
        packageId,
        classesRemaining: pkg.classCount,
        expiresAt,
        originalPrice: 0,
        finalPrice: 0,
        status: 'ACTIVE',
        paymentProviderId: `trial_${Date.now()}`,
      },
      include: {
        package: true,
      },
    })

    // 4. Send confirmation email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    })

    if (user?.email) {
      const emailResult = await sendEmail({
        to: user.email,
        subject: 'Tu Paquete de Prueba está Listo - Wellnest',
        html: buildTrialPackageEmail({
          userName: user.name || null,
          packageName: pkg.name,
          classCount: pkg.classCount,
          expiresAt: expiresAt.toLocaleDateString('es-SV', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          profileUrl: `${process.env.NEXTAUTH_URL || 'https://wellneststudio.net'}/perfil/paquetes`,
        }),
      })

      if (!emailResult.success) {
        console.error('[CLAIM-TRIAL] Email failed but purchase was created:', emailResult.error)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Paquete de prueba adquirido exitosamente',
      purchase: {
        id: purchase.id,
        packageName: purchase.package.name,
        classesRemaining: purchase.classesRemaining,
        expiresAt: purchase.expiresAt,
      },
    })
  } catch (error) {
    console.error('[CLAIM-TRIAL] Error:', error)
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    )
  }
}
