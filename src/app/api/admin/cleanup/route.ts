import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Official instructor IDs from seed
const OFFICIAL_INSTRUCTOR_IDS = [
  'instructor-nicolle',
  'instructor-florence',
  'instructor-adriana',
  'instructor-kevin',
  'instructor-denisse',
]

// Official package slugs from document
const OFFICIAL_PACKAGE_SLUGS = [
  'drop-in-class',
  'mini-flow-4',
  'balance-pass-8',
  'energia-total-12',
  'vital-plan-16',
  'full-access-24',
  'wellnest-trimestral-80',
]

export async function POST(request: Request) {
  console.log('[CLEANUP API] ========== POST REQUEST ==========')

  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const results = {
      instructorsDeleted: 0,
      instructorsDeactivated: 0,
      packagesDeleted: 0,
      packagesDeactivated: 0,
    }

    // ===============================================
    // CLEANUP INSTRUCTORS
    // ===============================================

    // Find all instructors that are NOT in the official list
    const unofficialInstructors = await prisma.instructor.findMany({
      where: {
        id: { notIn: OFFICIAL_INSTRUCTOR_IDS },
      },
      include: {
        _count: {
          select: { classes: true },
        },
      },
    })

    console.log('[CLEANUP API] Found unofficial instructors:', unofficialInstructors.length)
    unofficialInstructors.forEach((i) => {
      console.log(`  - ${i.name} (${i.id}): ${i._count.classes} classes`)
    })

    for (const instructor of unofficialInstructors) {
      if (instructor._count.classes === 0) {
        // No classes associated - safe to delete
        await prisma.instructor.delete({
          where: { id: instructor.id },
        })
        results.instructorsDeleted++
        console.log(`[CLEANUP API] Deleted instructor: ${instructor.name}`)
      } else {
        // Has classes - just deactivate
        await prisma.instructor.update({
          where: { id: instructor.id },
          data: { isActive: false },
        })
        results.instructorsDeactivated++
        console.log(`[CLEANUP API] Deactivated instructor: ${instructor.name}`)
      }
    }

    // ===============================================
    // CLEANUP PACKAGES
    // ===============================================

    // Find all packages that are NOT in the official list
    const unofficialPackages = await prisma.package.findMany({
      where: {
        OR: [
          { slug: null },
          { slug: { notIn: OFFICIAL_PACKAGE_SLUGS } },
        ],
      },
      include: {
        _count: {
          select: { purchases: true },
        },
      },
    })

    console.log('[CLEANUP API] Found unofficial packages:', unofficialPackages.length)
    unofficialPackages.forEach((p) => {
      console.log(`  - ${p.name} (${p.slug || 'no-slug'}): ${p._count.purchases} purchases`)
    })

    for (const pkg of unofficialPackages) {
      if (pkg._count.purchases === 0) {
        // No purchases associated - safe to delete
        await prisma.package.delete({
          where: { id: pkg.id },
        })
        results.packagesDeleted++
        console.log(`[CLEANUP API] Deleted package: ${pkg.name}`)
      } else {
        // Has purchases - just deactivate
        await prisma.package.update({
          where: { id: pkg.id },
          data: { isActive: false },
        })
        results.packagesDeactivated++
        console.log(`[CLEANUP API] Deactivated package: ${pkg.name}`)
      }
    }

    console.log('[CLEANUP API] Cleanup completed:', results)

    return NextResponse.json({
      success: true,
      message: 'Limpieza completada exitosamente',
      results,
    })
  } catch (error) {
    console.error('[CLEANUP API] Error:', error)
    return NextResponse.json(
      { error: 'Error al limpiar la base de datos' },
      { status: 500 }
    )
  }
}

// GET - Show what would be cleaned up (preview)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Find all instructors that are NOT in the official list
    const unofficialInstructors = await prisma.instructor.findMany({
      where: {
        id: { notIn: OFFICIAL_INSTRUCTOR_IDS },
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        _count: {
          select: { classes: true },
        },
      },
    })

    // Find all packages that are NOT in the official list
    const unofficialPackages = await prisma.package.findMany({
      where: {
        OR: [
          { slug: null },
          { slug: { notIn: OFFICIAL_PACKAGE_SLUGS } },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        _count: {
          select: { purchases: true },
        },
      },
    })

    // Get current official data
    const officialInstructors = await prisma.instructor.findMany({
      where: {
        id: { in: OFFICIAL_INSTRUCTOR_IDS },
      },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    })

    const officialPackages = await prisma.package.findMany({
      where: {
        slug: { in: OFFICIAL_PACKAGE_SLUGS },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        isActive: true,
      },
    })

    return NextResponse.json({
      toCleanup: {
        instructors: unofficialInstructors,
        packages: unofficialPackages,
      },
      official: {
        instructors: officialInstructors,
        packages: officialPackages,
      },
    })
  } catch (error) {
    console.error('[CLEANUP API] Error:', error)
    return NextResponse.json(
      { error: 'Error al obtener datos' },
      { status: 500 }
    )
  }
}
