import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  console.log('[DISCOUNT API] Validating discount code...')

  try {
    const body = await request.json()
    const { code, packageIds = [] } = body

    console.log('[DISCOUNT API] Request:', { code, packageIds })

    if (!code) {
      console.log('[DISCOUNT API] No code provided')
      return NextResponse.json(
        { valid: false, error: 'Código requerido' },
        { status: 400 }
      )
    }

    // Get current user session
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id

    const discount = await prisma.discountCode.findFirst({
      where: {
        code: code.toUpperCase(),
        isActive: true,
        validFrom: { lte: new Date() },
        validUntil: { gte: new Date() },
      },
    })

    console.log('[DISCOUNT API] Discount found:', discount ? {
      code: discount.code,
      percentage: discount.percentage,
      isActive: discount.isActive,
      validFrom: discount.validFrom,
      validUntil: discount.validUntil,
      currentUses: discount.currentUses,
      maxUses: discount.maxUses,
    } : 'Not found')

    if (!discount) {
      return NextResponse.json({
        valid: false,
        error: 'Código de descuento inválido o expirado',
      })
    }

    // A) VERIFICAR SI EL USUARIO YA USÓ ESTE CÓDIGO (restricción 1 uso por usuario)
    if (userId) {
      const existingRedemption = await prisma.promoRedemption.findUnique({
        where: {
          userId_discountCodeId: {
            userId: userId,
            discountCodeId: discount.id,
          },
        },
      })

      if (existingRedemption && existingRedemption.status === 'APPLIED') {
        console.log('[DISCOUNT API] User already used this code:', { userId, discountId: discount.id })
        return NextResponse.json({
          valid: false,
          error: 'Este código promocional ya fue usado por tu cuenta.',
        })
      }
    }

    // Check global usage limit
    if (discount.maxUses && discount.currentUses >= discount.maxUses) {
      return NextResponse.json({
        valid: false,
        error: 'Este código ya alcanzó su límite de usos',
      })
    }

    // Check if discount is applicable to the packages
    if (discount.applicableTo.length > 0 && packageIds.length > 0) {
      const isApplicable = packageIds.some((id: string) =>
        discount.applicableTo.includes(id)
      )
      if (!isApplicable) {
        return NextResponse.json({
          valid: false,
          error: 'Este código no aplica a los paquetes seleccionados',
        })
      }
    }

    return NextResponse.json({
      valid: true,
      code: discount.code,
      discountId: discount.id, // Include for redemption tracking
      percentage: discount.percentage,
      message: `Descuento del ${discount.percentage}% aplicado`,
    })
  } catch (error) {
    console.error('Error validating discount code:', error)
    return NextResponse.json(
      { valid: false, error: 'Error al validar el código' },
      { status: 500 }
    )
  }
}
