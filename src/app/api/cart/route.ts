import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

// Get or create session ID for cart
async function getCartSessionId(): Promise<string> {
  const session = await getServerSession(authOptions)

  if (session?.user?.id) {
    return `user_${session.user.id}`
  }

  const cookieStore = await cookies()
  let sessionId = cookieStore.get('cart_session')?.value

  if (!sessionId) {
    sessionId = `guest_${crypto.randomUUID()}`
  }

  return sessionId
}

export async function GET() {
  try {
    const sessionId = await getCartSessionId()

    const cartItems = await prisma.cartItem.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    })

    // Get package details for each cart item
    const packageIds = cartItems.map((item) => item.packageId)
    const packages = await prisma.package.findMany({
      where: { id: { in: packageIds } },
    })

    const itemsWithDetails = cartItems.map((item) => ({
      ...item,
      package: packages.find((pkg) => pkg.id === item.packageId),
    }))

    return NextResponse.json(itemsWithDetails)
  } catch (error) {
    console.error('Error fetching cart:', error)
    return NextResponse.json(
      { error: 'Error al obtener el carrito' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const sessionId = await getCartSessionId()
    const body = await request.json()
    const { packageId, quantity = 1 } = body

    if (!packageId) {
      return NextResponse.json(
        { error: 'Package ID is required' },
        { status: 400 }
      )
    }

    // Check if package exists
    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
    })

    if (!pkg) {
      return NextResponse.json(
        { error: 'Paquete no encontrado' },
        { status: 404 }
      )
    }

    // Upsert cart item
    const cartItem = await prisma.cartItem.upsert({
      where: {
        sessionId_packageId: {
          sessionId,
          packageId,
        },
      },
      update: {
        quantity: { increment: quantity },
      },
      create: {
        sessionId,
        packageId,
        quantity,
      },
    })

    // Set cookie for guest sessions
    if (sessionId.startsWith('guest_')) {
      const response = NextResponse.json(cartItem, { status: 201 })
      response.cookies.set('cart_session', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
      return response
    }

    return NextResponse.json(cartItem, { status: 201 })
  } catch (error) {
    console.error('Error adding to cart:', error)
    return NextResponse.json(
      { error: 'Error al agregar al carrito' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const sessionId = await getCartSessionId()
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')

    if (itemId) {
      // Delete specific item
      await prisma.cartItem.delete({
        where: { id: itemId },
      })
    } else {
      // Clear entire cart
      await prisma.cartItem.deleteMany({
        where: { sessionId },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting from cart:', error)
    return NextResponse.json(
      { error: 'Error al eliminar del carrito' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { itemId, quantity } = body

    if (!itemId || quantity === undefined) {
      return NextResponse.json(
        { error: 'Item ID and quantity are required' },
        { status: 400 }
      )
    }

    if (quantity <= 0) {
      await prisma.cartItem.delete({
        where: { id: itemId },
      })
      return NextResponse.json({ deleted: true })
    }

    const cartItem = await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    })

    return NextResponse.json(cartItem)
  } catch (error) {
    console.error('Error updating cart:', error)
    return NextResponse.json(
      { error: 'Error al actualizar el carrito' },
      { status: 500 }
    )
  }
}
