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

// Official discipline slugs
const OFFICIAL_DISCIPLINE_SLUGS = [
  'yoga',
  'pilates',
  'pole',
  'soundbath',
  'nutricion',
]

export async function POST() {
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
      disciplinesDeleted: 0,
      disciplinesDeactivated: 0,
      classesDeleted: 0,
    }

    // ===============================================
    // STEP 1: DELETE CLASSES FROM UNOFFICIAL INSTRUCTORS
    // ===============================================
    // First, delete classes that reference unofficial instructors
    // so we can then delete the instructors
    const unofficialInstructorIds = await prisma.instructor.findMany({
      where: { id: { notIn: OFFICIAL_INSTRUCTOR_IDS } },
      select: { id: true },
    })

    if (unofficialInstructorIds.length > 0) {
      const deletedClasses = await prisma.class.deleteMany({
        where: {
          instructorId: { in: unofficialInstructorIds.map(i => i.id) },
        },
      })
      results.classesDeleted += deletedClasses.count
      console.log(`[CLEANUP API] Deleted ${deletedClasses.count} classes from unofficial instructors`)
    }

    // ===============================================
    // STEP 2: CLEANUP INSTRUCTORS (now safe to delete)
    // ===============================================
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
        // Still has classes - just deactivate
        await prisma.instructor.update({
          where: { id: instructor.id },
          data: { isActive: false },
        })
        results.instructorsDeactivated++
        console.log(`[CLEANUP API] Deactivated instructor: ${instructor.name}`)
      }
    }

    // ===============================================
    // STEP 3: CLEANUP PACKAGES
    // ===============================================
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
        await prisma.package.delete({
          where: { id: pkg.id },
        })
        results.packagesDeleted++
        console.log(`[CLEANUP API] Deleted package: ${pkg.name}`)
      } else {
        await prisma.package.update({
          where: { id: pkg.id },
          data: { isActive: false },
        })
        results.packagesDeactivated++
        console.log(`[CLEANUP API] Deactivated package: ${pkg.name}`)
      }
    }

    // ===============================================
    // STEP 4: CLEANUP DUPLICATE DISCIPLINES
    // ===============================================
    // Delete classes from unofficial disciplines first
    const unofficialDisciplineIds = await prisma.discipline.findMany({
      where: { slug: { notIn: OFFICIAL_DISCIPLINE_SLUGS } },
      select: { id: true },
    })

    if (unofficialDisciplineIds.length > 0) {
      const deletedDisciplineClasses = await prisma.class.deleteMany({
        where: {
          disciplineId: { in: unofficialDisciplineIds.map(d => d.id) },
        },
      })
      results.classesDeleted += deletedDisciplineClasses.count
      console.log(`[CLEANUP API] Deleted ${deletedDisciplineClasses.count} classes from unofficial disciplines`)
    }

    const unofficialDisciplines = await prisma.discipline.findMany({
      where: {
        slug: { notIn: OFFICIAL_DISCIPLINE_SLUGS },
      },
      include: {
        _count: {
          select: { classes: true },
        },
      },
    })

    console.log('[CLEANUP API] Found unofficial disciplines:', unofficialDisciplines.length)
    unofficialDisciplines.forEach((d) => {
      console.log(`  - ${d.name} (${d.slug}): ${d._count.classes} classes`)
    })

    for (const discipline of unofficialDisciplines) {
      if (discipline._count.classes === 0) {
        await prisma.discipline.delete({
          where: { id: discipline.id },
        })
        results.disciplinesDeleted++
        console.log(`[CLEANUP API] Deleted discipline: ${discipline.name}`)
      } else {
        await prisma.discipline.update({
          where: { id: discipline.id },
          data: { isActive: false },
        })
        results.disciplinesDeactivated++
        console.log(`[CLEANUP API] Deactivated discipline: ${discipline.name}`)
      }
    }

    // ===============================================
    // STEP 5: ENSURE OFFICIAL DATA IS ACTIVE
    // ===============================================
    await prisma.instructor.updateMany({
      where: { id: { in: OFFICIAL_INSTRUCTOR_IDS } },
      data: { isActive: true },
    })

    await prisma.package.updateMany({
      where: { slug: { in: OFFICIAL_PACKAGE_SLUGS } },
      data: { isActive: true },
    })

    await prisma.discipline.updateMany({
      where: { slug: { in: OFFICIAL_DISCIPLINE_SLUGS } },
      data: { isActive: true },
    })

    console.log('[CLEANUP API] Cleanup completed:', results)

    return NextResponse.json({
      success: true,
      message: 'Limpieza completada exitosamente',
      results,
    })
  } catch (error) {
    console.error('[CLEANUP API] Error:', error)
    return NextResponse.json(
      { error: 'Error al limpiar la base de datos', details: error instanceof Error ? error.message : 'Unknown error' },
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

    // Find all disciplines that are NOT in the official list
    const unofficialDisciplines = await prisma.discipline.findMany({
      where: {
        slug: { notIn: OFFICIAL_DISCIPLINE_SLUGS },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        _count: {
          select: { classes: true },
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

    const officialDisciplines = await prisma.discipline.findMany({
      where: {
        slug: { in: OFFICIAL_DISCIPLINE_SLUGS },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
      },
    })

    return NextResponse.json({
      toCleanup: {
        instructors: unofficialInstructors,
        packages: unofficialPackages,
        disciplines: unofficialDisciplines,
      },
      official: {
        instructors: officialInstructors,
        packages: officialPackages,
        disciplines: officialDisciplines,
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
