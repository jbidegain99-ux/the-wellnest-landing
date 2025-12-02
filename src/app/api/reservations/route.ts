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

    const reservations = await prisma.reservation.findMany({
      where: {
        userId: session.user.id,
        status: { in: ['CONFIRMED'] },
        class: {
          dateTime: { gte: new Date() },
        },
      },
      include: {
        class: {
          include: {
            discipline: true,
            instructor: true,
          },
        },
      },
      orderBy: {
        class: {
          dateTime: 'asc',
        },
      },
    })

    return NextResponse.json(reservations)
  } catch (error) {
    console.error('Error fetching reservations:', error)
    return NextResponse.json(
      { error: 'Error al obtener las reservas' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()
    const { classId, purchaseId: requestedPurchaseId } = body

    // Check if class exists and has capacity
    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        _count: { select: { reservations: { where: { status: 'CONFIRMED' } } } },
      },
    })

    if (!classData) {
      return NextResponse.json(
        { error: 'Clase no encontrada' },
        { status: 404 }
      )
    }

    if (classData._count.reservations >= classData.maxCapacity) {
      return NextResponse.json(
        { error: 'La clase está llena' },
        { status: 400 }
      )
    }

    // Check if user already has a reservation
    const existingReservation = await prisma.reservation.findUnique({
      where: {
        userId_classId: {
          userId,
          classId,
        },
      },
    })

    if (existingReservation) {
      return NextResponse.json(
        { error: 'Ya tienes una reserva para esta clase' },
        { status: 400 }
      )
    }

    // Find the purchase to use - either the specified one or the best available
    let purchase

    if (requestedPurchaseId) {
      // Use the specific purchase requested (from "Mis Paquetes" page)
      purchase = await prisma.purchase.findFirst({
        where: {
          id: requestedPurchaseId,
          userId, // Security: ensure it belongs to this user
          status: 'ACTIVE',
          classesRemaining: { gt: 0 },
          expiresAt: { gt: new Date() },
        },
      })

      if (!purchase) {
        return NextResponse.json(
          { error: 'El paquete seleccionado no está disponible o no tiene clases restantes' },
          { status: 400 }
        )
      }
    } else {
      // Find the best available purchase (expires soonest)
      purchase = await prisma.purchase.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
          classesRemaining: { gt: 0 },
          expiresAt: { gt: new Date() },
        },
        orderBy: { expiresAt: 'asc' },
      })

      if (!purchase) {
        return NextResponse.json(
          { error: 'No tienes clases disponibles. Compra un paquete para reservar.' },
          { status: 400 }
        )
      }
    }

    // Create reservation and update counts
    const [reservation] = await prisma.$transaction([
      prisma.reservation.create({
        data: {
          userId,
          classId,
          purchaseId: purchase.id,
          status: 'CONFIRMED',
        },
      }),
      prisma.purchase.update({
        where: { id: purchase.id },
        data: { classesRemaining: { decrement: 1 } },
      }),
      prisma.class.update({
        where: { id: classId },
        data: { currentCount: { increment: 1 } },
      }),
    ])

    return NextResponse.json(reservation, { status: 201 })
  } catch (error) {
    console.error('Error creating reservation:', error)
    return NextResponse.json(
      { error: 'Error al crear la reserva' },
      { status: 500 }
    )
  }
}
