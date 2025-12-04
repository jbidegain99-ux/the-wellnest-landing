import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { addDays } from 'date-fns'

// Check if we're in test checkout mode
const isTestMode = process.env.WELLNEST_TEST_CHECKOUT === 'true'

// Get cart session ID (same logic as cart API)
async function getCartSessionId(): Promise<string> {
  const session = await getServerSession(authOptions)

  if (session?.user?.id) {
    return `user_${session.user.id}`
  }

  const cookieStore = await cookies()
  const sessionId = cookieStore.get('cart_session')?.value

  return sessionId || ''
}

// Handle successful payment - creates purchase records
async function handleSuccessfulPayment({
  userId,
  items,
  discountCode,
  discountPercentage,
}: {
  userId: string
  items: Array<{
    packageId: string
    quantity: number
    package: {
      id: string
      name: string
      price: number
      classCount: number
      validityDays: number
    }
  }>
  discountCode?: string
  discountPercentage?: number
}) {
  const purchases = []

  for (const item of items) {
    for (let i = 0; i < item.quantity; i++) {
      const originalPrice = item.package.price
      const finalPrice = discountPercentage
        ? originalPrice * (1 - discountPercentage / 100)
        : originalPrice

      const purchase = await prisma.purchase.create({
        data: {
          userId,
          packageId: item.packageId,
          classesRemaining: item.package.classCount,
          expiresAt: addDays(new Date(), item.package.validityDays),
          originalPrice,
          finalPrice,
          discountCode: discountCode || null,
          status: 'ACTIVE',
          stripePaymentId: isTestMode ? `test_${Date.now()}_${i}` : null,
        },
        include: {
          package: true,
        },
      })

      purchases.push(purchase)
    }
  }

  // Update discount code usage if used
  if (discountCode) {
    await prisma.discountCode.updateMany({
      where: { code: discountCode },
      data: { currentUses: { increment: 1 } },
    })
  }

  return purchases
}

// Validate discount code
async function validateDiscountCode(code: string, packageIds: string[]) {
  const discount = await prisma.discountCode.findFirst({
    where: {
      code: code.toUpperCase(),
      isActive: true,
      validFrom: { lte: new Date() },
      validUntil: { gte: new Date() },
    },
  })

  if (!discount) {
    return null
  }

  // Check max uses (if set)
  if (discount.maxUses !== null && discount.currentUses >= discount.maxUses) {
    return null
  }

  // Check if discount is applicable to any of the packages
  if (discount.applicableTo.length > 0) {
    const isApplicable = packageIds.some((id) =>
      discount.applicableTo.includes(id)
    )
    if (!isApplicable) {
      return null
    }
  }

  return discount
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Debes iniciar sesión para completar la compra' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const body = await request.json()
    const { discountCode } = body

    // Get cart items
    const cartSessionId = await getCartSessionId()

    if (!cartSessionId) {
      return NextResponse.json(
        { error: 'No se encontró el carrito' },
        { status: 400 }
      )
    }

    const cartItems = await prisma.cartItem.findMany({
      where: { sessionId: cartSessionId },
    })

    if (cartItems.length === 0) {
      return NextResponse.json(
        { error: 'El carrito está vacío' },
        { status: 400 }
      )
    }

    // Get package details
    const packageIds = cartItems.map((item) => item.packageId)
    const packages = await prisma.package.findMany({
      where: { id: { in: packageIds } },
    })

    const itemsWithPackages = cartItems.map((item) => ({
      ...item,
      package: packages.find((pkg) => pkg.id === item.packageId)!,
    }))

    // Validate all packages exist and are active
    for (const item of itemsWithPackages) {
      if (!item.package || !item.package.isActive) {
        return NextResponse.json(
          { error: `Paquete no disponible: ${item.packageId}` },
          { status: 400 }
        )
      }
    }

    // Validate discount code if provided
    let discountPercentage = 0
    let validatedDiscountCode: string | undefined

    if (discountCode) {
      const discount = await validateDiscountCode(discountCode, packageIds)
      if (discount) {
        discountPercentage = discount.percentage
        validatedDiscountCode = discount.code
      }
    }

    // Calculate totals
    const subtotal = itemsWithPackages.reduce(
      (sum, item) => sum + item.package.price * item.quantity,
      0
    )
    const discountAmount = subtotal * (discountPercentage / 100)
    const total = subtotal - discountAmount

    // If total is 0 (100% discount) or in test mode, process immediately
    if (total === 0 || isTestMode) {
      // Process purchase immediately - no payment needed for $0 or test mode
      const purchases = await handleSuccessfulPayment({
        userId,
        items: itemsWithPackages,
        discountCode: validatedDiscountCode,
        discountPercentage,
      })

      // Clear cart after successful purchase
      await prisma.cartItem.deleteMany({
        where: { sessionId: cartSessionId },
      })

      return NextResponse.json({
        success: true,
        testMode: isTestMode,
        freeOrder: total === 0,
        message: total === 0
          ? '¡Paquete activado gratis con tu código de descuento!'
          : 'Paquete activado correctamente (modo prueba)',
        purchases: purchases.map((p) => ({
          id: p.id,
          packageName: p.package.name,
          classesRemaining: p.classesRemaining,
          expiresAt: p.expiresAt,
          finalPrice: p.finalPrice,
        })),
        summary: {
          subtotal,
          discountCode: validatedDiscountCode,
          discountPercentage,
          discountAmount,
          total,
        },
      })
    } else {
      // PRODUCTION MODE: Would integrate with Stripe here
      // For now, return an error indicating Stripe is not yet configured
      return NextResponse.json(
        {
          error: 'La pasarela de pago aún no está configurada. Contacta al administrador.',
          configurationNeeded: true,
        },
        { status: 503 }
      )

      // Future Stripe integration would go here:
      // 1. Create Stripe PaymentIntent
      // 2. Return client_secret to frontend
      // 3. Frontend confirms payment with Stripe
      // 4. Webhook receives payment_intent.succeeded
      // 5. Call handleSuccessfulPayment() from webhook
    }
  } catch (error) {
    console.error('Error processing checkout:', error)
    return NextResponse.json(
      { error: 'Error al procesar la compra' },
      { status: 500 }
    )
  }
}

// GET endpoint to get checkout summary
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const cartSessionId = await getCartSessionId()

    if (!cartSessionId) {
      return NextResponse.json({ items: [], subtotal: 0, total: 0 })
    }

    const cartItems = await prisma.cartItem.findMany({
      where: { sessionId: cartSessionId },
    })

    const packageIds = cartItems.map((item) => item.packageId)
    const packages = await prisma.package.findMany({
      where: { id: { in: packageIds } },
    })

    const items = cartItems.map((item) => {
      const pkg = packages.find((p) => p.id === item.packageId)
      return {
        id: item.id,
        packageId: item.packageId,
        name: pkg?.name || 'Paquete',
        classCount: pkg?.classCount || 0,
        price: pkg?.price || 0,
        quantity: item.quantity,
      }
    })

    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    )

    return NextResponse.json({
      items,
      subtotal,
      total: subtotal,
      isLoggedIn: !!session?.user?.id,
      testMode: isTestMode,
    })
  } catch (error) {
    console.error('Error getting checkout summary:', error)
    return NextResponse.json(
      { error: 'Error al obtener resumen' },
      { status: 500 }
    )
  }
}
