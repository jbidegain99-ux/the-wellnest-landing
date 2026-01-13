import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - Get user's referral data
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const userId = session.user.id

    // Get user to get their QR code (used as referral code)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { qrCode: true, name: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // Use the first 8 chars of qrCode as referral code
    const referralCode = user.qrCode.substring(0, 8).toUpperCase()

    // Get referral history
    const referrals = await prisma.referral.findMany({
      where: { referrerUserId: userId },
      include: {
        referred: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Calculate stats
    const completedReferrals = referrals.filter((r) => r.status === 'COMPLETED')
    const pendingReferrals = referrals.filter((r) => r.status === 'PENDING')
    const totalClassesEarned = completedReferrals.reduce((sum, r) => sum + r.classesEarned, 0)

    // Format history
    const history = referrals.map((r) => ({
      id: r.id,
      friendName: r.referred?.name || r.referredEmail || 'Usuario',
      date: r.createdAt.toISOString(),
      status: r.status.toLowerCase(),
      classesEarned: r.classesEarned,
      eventType: r.eventType,
    }))

    return NextResponse.json({
      referralCode,
      link: `${process.env.NEXTAUTH_URL || 'https://thewellnest.sv'}/registro?ref=${referralCode}`,
      classesEarned: totalClassesEarned,
      friendsReferred: completedReferrals.length,
      pendingReferrals: pendingReferrals.length,
      history,
    })
  } catch (error) {
    console.error('Error fetching referral data:', error)
    return NextResponse.json(
      { error: 'Error al obtener datos de referidos' },
      { status: 500 }
    )
  }
}

// POST - Validate and apply referral code during registration
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { code, referredUserId, referredEmail } = body

    if (!code) {
      return NextResponse.json(
        { valid: false, error: 'Código requerido' },
        { status: 400 }
      )
    }

    // Find user by referral code (first 8 chars of qrCode)
    const referrer = await prisma.user.findFirst({
      where: {
        qrCode: {
          startsWith: code.toUpperCase().substring(0, 8),
        },
      },
    })

    if (!referrer) {
      console.log('[REFERRAL API] Code not found:', code)
      return NextResponse.json({
        valid: false,
        error: 'Código de referido no válido',
      })
    }

    // Check if trying to refer self
    if (referredUserId && referrer.id === referredUserId) {
      return NextResponse.json({
        valid: false,
        error: 'No puedes usar tu propio código de referido',
      })
    }

    // If just validating, return success
    if (!referredUserId && !referredEmail) {
      return NextResponse.json({
        valid: true,
        referrerName: referrer.name,
        message: `Código válido. Referido por ${referrer.name}`,
      })
    }

    // Check if this user was already referred
    if (referredUserId || referredEmail) {
      const existingReferral = await prisma.referral.findFirst({
        where: {
          OR: [
            referredUserId ? { referredUserId } : {},
            referredEmail ? { referredEmail } : {},
          ].filter((c) => Object.keys(c).length > 0),
        },
      })

      if (existingReferral) {
        return NextResponse.json({
          valid: false,
          error: 'Este usuario ya fue referido anteriormente',
        })
      }

      // Create referral record
      const referral = await prisma.referral.create({
        data: {
          referrerUserId: referrer.id,
          referredUserId: referredUserId || null,
          referredEmail: referredEmail || null,
          referralCode: code.toUpperCase(),
          eventType: referredUserId ? 'SIGNUP' : 'PENDING',
          status: 'PENDING',
          discountApplied: 10, // 10% discount for referred user
        },
      })

      console.log('[REFERRAL API] Referral created:', {
        id: referral.id,
        referrer: referrer.id,
        referred: referredUserId || referredEmail,
      })

      return NextResponse.json({
        valid: true,
        referralId: referral.id,
        referrerName: referrer.name,
        discountPercentage: 10,
        message: `Te ha referido ${referrer.name}. Recibirás 10% de descuento en tu primera compra.`,
      })
    }

    return NextResponse.json({ valid: true })
  } catch (error) {
    console.error('Error processing referral:', error)
    return NextResponse.json(
      { valid: false, error: 'Error al procesar código de referido' },
      { status: 500 }
    )
  }
}
