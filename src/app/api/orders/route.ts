/**
 * POST /api/orders - Create a new PENDING order from cart
 *
 * This endpoint creates an Order with status PENDING, which can then be
 * paid via PayWay or other payment gateways.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

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

// Validate discount code
async function validateDiscountCode(code: string, packageIds: string[], userId: string) {
  const discount = await prisma.discountCode.findFirst({
    where: {
      code: code.toUpperCase(),
      isActive: true,
      validFrom: { lte: new Date() },
      validUntil: { gte: new Date() },
    },
  })

  if (!discount) {
    return { discount: null, error: 'Codigo de descuento invalido o expirado' }
  }

  // Check if user already used this code
  const existingRedemption = await prisma.promoRedemption.findUnique({
    where: {
      userId_discountCodeId: {
        userId: userId,
        discountCodeId: discount.id,
      },
    },
  })

  if (existingRedemption && existingRedemption.status === 'APPLIED') {
    return { discount: null, error: 'Este codigo promocional ya fue usado por tu cuenta.' }
  }

  // Check max uses
  if (discount.maxUses !== null && discount.currentUses >= discount.maxUses) {
    return { discount: null, error: 'Este codigo ya alcanzo su limite de usos' }
  }

  // Check if applicable to packages
  if (discount.applicableTo.length > 0) {
    const isApplicable = packageIds.some((id) => discount.applicableTo.includes(id))
    if (!isApplicable) {
      return { discount: null, error: 'Este codigo no aplica a los paquetes seleccionados' }
    }
  }

  return { discount, error: null }
}

export async function POST(request: Request) {
  console.log('[ORDERS API] POST request received')

  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      console.log('[ORDERS API] No authenticated user')
      return NextResponse.json(
        { error: 'Debes iniciar sesion para crear una orden' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const body = await request.json()
    const { discountCode, paymentMethod } = body

    console.log('[ORDERS API] Request data:', { userId, discountCode, paymentMethod })

    // Get cart items
    const cartSessionId = await getCartSessionId()

    if (!cartSessionId) {
      return NextResponse.json({ error: 'No se encontro el carrito' }, { status: 400 })
    }

    const cartItems = await prisma.cartItem.findMany({
      where: { sessionId: cartSessionId },
    })

    if (cartItems.length === 0) {
      return NextResponse.json({ error: 'El carrito esta vacio' }, { status: 400 })
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
    let validatedDiscountId: string | undefined

    if (discountCode) {
      console.log('[ORDERS API] Validating discount code:', discountCode)
      const { discount, error } = await validateDiscountCode(discountCode, packageIds, userId)
      if (discount) {
        discountPercentage = discount.percentage
        validatedDiscountCode = discount.code
        validatedDiscountId = discount.id
        console.log('[ORDERS API] Discount valid:', {
          code: discount.code,
          percentage: discount.percentage,
        })
      } else {
        console.log('[ORDERS API] Discount code rejected:', error)
        return NextResponse.json({ error: error || 'El codigo de descuento no es valido.' }, { status: 400 })
      }
    }

    // Calculate totals
    const subtotal = itemsWithPackages.reduce(
      (sum, item) => sum + item.package.price * item.quantity,
      0
    )
    const discountAmount = subtotal * (discountPercentage / 100)
    const total = subtotal - discountAmount

    console.log('[ORDERS API] Order totals:', {
      subtotal,
      discountPercentage,
      discountAmount,
      total,
    })

    // Create order with items in a transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create the order
      const newOrder = await tx.order.create({
        data: {
          userId,
          status: 'PENDING',
          subtotal,
          discount: discountAmount,
          total,
          discountCodeId: validatedDiscountId,
          discountCode: validatedDiscountCode,
        },
      })

      // Create order items
      for (const item of itemsWithPackages) {
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            packageId: item.packageId,
            quantity: item.quantity,
            unitPrice: item.package.price,
            totalPrice: item.package.price * item.quantity,
          },
        })
      }

      // Clear cart after creating order
      await tx.cartItem.deleteMany({
        where: { sessionId: cartSessionId },
      })

      // Return order with items
      return tx.order.findUnique({
        where: { id: newOrder.id },
        include: {
          items: {
            include: {
              package: true,
            },
          },
        },
      })
    })

    console.log('[ORDERS API] Order created:', {
      orderId: order?.id,
      status: order?.status,
      total: order?.total,
      itemCount: order?.items.length,
    })

    return NextResponse.json({
      success: true,
      order: {
        id: order?.id,
        status: order?.status,
        subtotal: order?.subtotal,
        discount: order?.discount,
        total: order?.total,
        discountCode: order?.discountCode,
        items: order?.items.map((item) => ({
          id: item.id,
          packageId: item.packageId,
          packageName: item.package.name,
          classCount: item.package.classCount,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
      },
      // Include redirect URL for the selected payment method
      redirectUrl: paymentMethod === 'payway' ? `/checkout/payway/${order?.id}` : null,
    })
  } catch (error) {
    console.error('[ORDERS API] Error creating order:', error)
    return NextResponse.json({ error: 'Error al crear la orden' }, { status: 500 })
  }
}

// GET endpoint to retrieve a specific order (for order detail page)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const url = new URL(request.url)
    const orderId = url.searchParams.get('id')

    if (!orderId) {
      return NextResponse.json({ error: 'ID de orden requerido' }, { status: 400 })
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: session.user.id, // Ensure user owns this order
      },
      include: {
        items: {
          include: {
            package: true,
          },
        },
        transactions: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    return NextResponse.json({
      order: {
        id: order.id,
        status: order.status,
        subtotal: order.subtotal,
        discount: order.discount,
        total: order.total,
        discountCode: order.discountCode,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        items: order.items.map((item) => ({
          id: item.id,
          packageId: item.packageId,
          packageName: item.package.name,
          classCount: item.package.classCount,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
        transactions: order.transactions.map((tx) => ({
          id: tx.id,
          provider: tx.provider,
          status: tx.status,
          authorizationNumber: tx.authorizationNumber,
          cardBrand: tx.cardBrand,
          cardLastDigits: tx.cardLastDigits,
          createdAt: tx.createdAt,
        })),
      },
    })
  } catch (error) {
    console.error('[ORDERS API] Error getting order:', error)
    return NextResponse.json({ error: 'Error al obtener la orden' }, { status: 500 })
  }
}
