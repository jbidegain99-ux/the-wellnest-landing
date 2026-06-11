import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

// This endpoint creates the initial admin user ONLY if no users exist
// After the first admin is created, this endpoint will always return 403
export async function POST() {
  try {
    // Check if any users exist
    const userCount = await prisma.user.count()

    if (userCount > 0) {
      return NextResponse.json(
        { error: 'Bootstrap already completed. Users exist in database.' },
        { status: 403 }
      )
    }

    // Create admin user with a random one-time password (a fixed bootstrap
    // credential in the repo is a known-password backdoor)
    const oneTimePassword = randomBytes(16).toString('base64url')
    const hashedPassword = await bcrypt.hash(oneTimePassword, 12)
    await prisma.user.create({
      data: {
        email: 'admin@thewellnest.sv',
        name: 'Admin Wellnest',
        password: hashedPassword,
        role: 'ADMIN',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully',
      credentials: {
        email: 'admin@thewellnest.sv',
        password: oneTimePassword,
        note: 'Esta contraseña solo se muestra una vez. Cámbiala inmediatamente después de iniciar sesión.',
      },
    })
  } catch (error) {
    console.error('Bootstrap error:', error)
    return NextResponse.json(
      { error: 'Failed to bootstrap' },
      { status: 500 }
    )
  }
}

// GET endpoint to check if bootstrap is needed
export async function GET() {
  try {
    const userCount = await prisma.user.count()

    return NextResponse.json({
      needsBootstrap: userCount === 0,
      userCount,
    })
  } catch (error) {
    console.error('Bootstrap check error:', error)
    return NextResponse.json(
      { error: 'Failed to check bootstrap status' },
      { status: 500 }
    )
  }
}
