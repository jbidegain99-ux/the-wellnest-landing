import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { normalizeDiscountCode } from '@/lib/discounts'
import { svExpiryEndOfDay } from '@/lib/utils/timezone'
import { randomUUID } from 'crypto'

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

// Handle successful payment - creates purchase records.
// Una sola transacción: el increment de maxUses es condicional y atómico, la
// redención maneja el caso VOID previo (upsert) y los bundles generan una
// purchase por paquete hijo (igual que markOrderPaid).
async function handleSuccessfulPayment({
  userId,
  items,
  discountCode,
  discountCodeId,
  discountPercentage,
}: {
  userId: string
  items: Array<{
    packageId: string
    quantity: number
    package: {
      id: string
      name: string
      slug: string | null
      price: number
      classCount: number
      validityDays: number
      bundleChildSlugs: string[]
    }
  }>
  discountCode?: string
  discountCodeId?: string
  discountPercentage?: number
}) {
  console.log('[CHECKOUT API] Creating purchase records for user:', userId)
  const batchId = randomUUID()
  const round2 = (n: number) => Math.round(n * 100) / 100

  const purchases = await prisma.$transaction(async (tx) => {
    // Claim atómico del cupo del código ANTES de crear purchases: compara
    // currentUses contra maxUses en la misma sentencia (dos checkouts
    // concurrentes no pueden exceder el límite)
    if (discountCode && discountCodeId) {
      const claimed = await tx.$executeRaw`
        UPDATE "DiscountCode"
        SET "currentUses" = "currentUses" + 1
        WHERE id = ${discountCodeId}
          AND "isActive" = true
          AND ("maxUses" IS NULL OR "currentUses" < "maxUses")`
      if (claimed === 0) {
        throw new Error('DISCOUNT_EXHAUSTED')
      }
    }

    const created = []
    for (const item of items) {
      for (let i = 0; i < item.quantity; i++) {
        const originalPrice = item.package.price
        const finalPrice = discountPercentage
          ? round2(originalPrice * (1 - discountPercentage / 100))
          : originalPrice

        // Bundle: una purchase por paquete hijo, precio prorrateado
        if (item.package.bundleChildSlugs && item.package.bundleChildSlugs.length > 0) {
          const bundleGroupId = randomUUID()
          const children = await tx.package.findMany({
            where: { slug: { in: item.package.bundleChildSlugs } },
          })
          if (children.length !== item.package.bundleChildSlugs.length) {
            throw new Error(`Bundle ${item.package.slug ?? item.package.id}: faltan paquetes hijos`)
          }
          const originalShare = round2(originalPrice / children.length)
          const finalShare = round2(finalPrice / children.length)
          for (let c = 0; c < children.length; c++) {
            const child = children[c]
            const isLast = c === children.length - 1
            const purchase = await tx.purchase.create({
              data: {
                userId,
                packageId: child.id,
                classesRemaining: child.classCount,
                expiresAt: svExpiryEndOfDay(item.package.validityDays),
                originalPrice: isLast
                  ? round2(originalPrice - originalShare * (children.length - 1))
                  : originalShare,
                finalPrice: isLast
                  ? round2(finalPrice - finalShare * (children.length - 1))
                  : finalShare,
                discountCode: discountCode || null,
                status: 'ACTIVE',
                paymentProviderId: `${isTestMode ? 'test' : 'free'}_${batchId}_${item.packageId}_${i}_${child.slug}`,
                bundleParentPackageId: item.package.id,
                bundleGroupId,
              },
              include: { package: true },
            })
            created.push(purchase)
          }
          continue
        }

        const purchase = await tx.purchase.create({
          data: {
            userId,
            packageId: item.packageId,
            classesRemaining: item.package.classCount,
            expiresAt: svExpiryEndOfDay(item.package.validityDays),
            originalPrice,
            finalPrice,
            discountCode: discountCode || null,
            status: 'ACTIVE',
            paymentProviderId: `${isTestMode ? 'test' : 'free'}_${batchId}_${item.packageId}_${i}`,
          },
          include: {
            package: true,
          },
        })
        created.push(purchase)
      }
    }

    // Redención: upsert maneja una redención VOID previa del mismo código
    // (antes el create chocaba con el unique y duplicaba purchases al reintentar)
    if (discountCode && discountCodeId && created.length > 0) {
      await tx.promoRedemption.upsert({
        where: {
          userId_discountCodeId: { userId, discountCodeId },
        },
        update: { status: 'APPLIED', purchaseId: created[0].id },
        create: {
          userId,
          discountCodeId,
          purchaseId: created[0].id,
          status: 'APPLIED',
        },
      })
    }

    return created
  })

  console.log('[CHECKOUT API] Total purchases created:', purchases.length)
  return purchases
}

// Validate discount code with user restriction check
async function validateDiscountCode(code: string, packageIds: string[], userId: string) {
  const discount = await prisma.discountCode.findFirst({
    where: {
      code: normalizeDiscountCode(code),
      isActive: true,
      validFrom: { lte: new Date() },
      validUntil: { gte: new Date() },
    },
  })

  if (!discount) {
    return { discount: null, error: 'Código de descuento inválido o expirado' }
  }

  // A) VERIFICAR SI EL USUARIO YA USÓ ESTE CÓDIGO
  const existingRedemption = await prisma.promoRedemption.findUnique({
    where: {
      userId_discountCodeId: {
        userId: userId,
        discountCodeId: discount.id,
      },
    },
  })

  if (existingRedemption && existingRedemption.status === 'APPLIED') {
    console.log('[CHECKOUT API] User already used this promo code:', { userId, code })
    return { discount: null, error: 'Este código promocional ya fue usado por tu cuenta.' }
  }

  // Check max uses (if set)
  if (discount.maxUses !== null && discount.currentUses >= discount.maxUses) {
    return { discount: null, error: 'Este código ya alcanzó su límite de usos' }
  }

  // Check if discount is applicable to any of the packages
  if (discount.applicableTo.length > 0) {
    const isApplicable = packageIds.some((id) =>
      discount.applicableTo.includes(id)
    )
    if (!isApplicable) {
      return { discount: null, error: 'Este código no aplica a los paquetes seleccionados' }
    }
  }

  return { discount, error: null }
}

export async function POST(request: Request) {
  console.log('[CHECKOUT API] POST request received')

  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      console.log('[CHECKOUT API] No authenticated user')
      return NextResponse.json(
        { error: 'Debes iniciar sesión para completar la compra' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const body = await request.json()
    const { discountCode, acceptTerms } = body

    console.log('[CHECKOUT API] Request data:', { userId, discountCode, acceptTerms })

    // Validar aceptación de términos (OBLIGATORIO)
    if (!acceptTerms) {
      console.log('[CHECKOUT API] Terms not accepted')
      return NextResponse.json(
        { error: 'Debes aceptar los Términos y Condiciones para continuar' },
        { status: 400 }
      )
    }

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

    // Validate single-purchase packages: each singlePurchaseOnly package can only be purchased once per user
    const singlePurchaseItems = itemsWithPackages.filter((item) => item.package.singlePurchaseOnly)
    for (const item of singlePurchaseItems) {
      const existingPurchase = await prisma.purchase.findFirst({
        where: {
          userId,
          packageId: item.packageId,
        },
      })

      if (existingPurchase) {
        console.log('[CHECKOUT API] Single-purchase package already purchased:', {
          userId,
          packageId: item.packageId,
          packageName: item.package.name,
          existingPurchaseId: existingPurchase.id,
        })
        return NextResponse.json(
          {
            error: `Ya compraste "${item.package.name}". Solo se puede adquirir una vez por usuario.`,
            code: 'SINGLE_PURCHASE_LIMIT',
          },
          { status: 409 }
        )
      }
    }

    // Validate discount code if provided
    let discountPercentage = 0
    let validatedDiscountCode: string | undefined
    let validatedDiscountId: string | undefined

    if (discountCode) {
      console.log('[CHECKOUT API] Validating discount code:', discountCode)
      const { discount, error } = await validateDiscountCode(discountCode, packageIds, userId)
      if (discount) {
        discountPercentage = discount.percentage
        validatedDiscountCode = discount.code
        validatedDiscountId = discount.id
        console.log('[CHECKOUT API] Discount valid:', { code: discount.code, percentage: discount.percentage })
      } else {
        console.log('[CHECKOUT API] Discount code rejected:', error)
        return NextResponse.json(
          { error: error || 'El código de descuento no es válido.' },
          { status: 400 }
        )
      }
    }

    // Calculate totals
    const subtotal = itemsWithPackages.reduce(
      (sum, item) => sum + item.package.price * item.quantity,
      0
    )
    const discountAmount = subtotal * (discountPercentage / 100)
    const total = subtotal - discountAmount

    console.log('[CHECKOUT API] Order totals:', {
      subtotal,
      discountPercentage,
      discountAmount,
      total,
      isTestMode,
      isFreeOrder: total === 0,
    })

    // If total is 0 (100% discount) or in test mode, process immediately
    if (total === 0 || isTestMode) {
      console.log('[CHECKOUT API] Processing free/test order - no payment required')
      // Process purchase immediately - no payment needed for $0 or test mode
      const purchases = await handleSuccessfulPayment({
        userId,
        items: itemsWithPackages,
        discountCode: validatedDiscountCode,
        discountCodeId: validatedDiscountId,
        discountPercentage,
      })

      // Clear cart after successful purchase
      console.log('[CHECKOUT API] Clearing cart for session:', cartSessionId)
      await prisma.cartItem.deleteMany({
        where: { sessionId: cartSessionId },
      })
      console.log('[CHECKOUT API] Cart cleared successfully')

      console.log('[CHECKOUT API] Order completed successfully!', {
        purchaseCount: purchases.length,
        totalClasses: purchases.reduce((sum, p) => sum + p.classesRemaining, 0),
        isFreeOrder: total === 0,
        isTestMode,
      })

      return NextResponse.json({
        success: true,
        mode: total === 0 ? 'free_purchase' : 'test_purchase',
        testMode: isTestMode,
        freeOrder: total === 0,
        message: total === 0
          ? 'Paquete asignado exitosamente sin procesar pago.'
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
    if (error instanceof Error && error.message === 'DISCOUNT_EXHAUSTED') {
      return NextResponse.json(
        { error: 'Este código ya alcanzó su límite de usos.' },
        { status: 400 }
      )
    }

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
