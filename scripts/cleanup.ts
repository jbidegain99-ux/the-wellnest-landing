import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const REAL_USER_EMAILS = [
  'wendyblanco@gmail.com',
  '2020wendyblanco@gmail.com',
  'florencecervantes2@gmail.com',
  'kevincanodance1703@gmail.com',
  'soundy.denisse@gmail.com',
  'soundydenisse@gmail.com',
  'ocampfg@gmail.com',
  'cotolisbeth@gmail.com',
  'conscienceholistic@outlook.com',
  'conscienciaholistic@outlook.com',
  'adriana_llopez@hotmail.com',
  'jbidegain@republicode.com',
  'j.bidegain99@gmail.com',
  'nicollesoundy@outlook.com',
  'admin@thewellnest.sv',
]

async function cleanup() {
  console.log('Starting database cleanup...\n')

  try {
    // 1. Show current state
    const initialCounts = {
      users: await prisma.user.count(),
      classes: await prisma.class.count(),
      reservations: await prisma.reservation.count(),
      waitlist: await prisma.waitlist.count(),
    }
    console.log('Current state:', initialCounts)
    console.log()

    // 2. Delete waitlist entries (foreign key to class)
    const deletedWaitlist = await prisma.waitlist.deleteMany({})
    console.log(`Deleted ${deletedWaitlist.count} waitlist entries`)

    // 3. Delete reservations (foreign key to class + user)
    const deletedReservations = await prisma.reservation.deleteMany({})
    console.log(`Deleted ${deletedReservations.count} reservations`)

    // 4. Delete all classes (schedules)
    const deletedClasses = await prisma.class.deleteMany({})
    console.log(`Deleted ${deletedClasses.count} classes`)

    // 5. List users that will be deleted (for review)
    const usersToDelete = await prisma.user.findMany({
      where: {
        email: { notIn: REAL_USER_EMAILS },
      },
      select: { name: true, email: true },
    })

    if (usersToDelete.length > 0) {
      console.log(`\nUsers to delete (${usersToDelete.length}):`)
      usersToDelete.forEach(u => {
        console.log(`  - ${u.name || 'Sin nombre'} (${u.email})`)
      })
    }

    // 6. Delete test/demo users (keep real ones)
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        email: { notIn: REAL_USER_EMAILS },
      },
    })
    console.log(`\nDeleted ${deletedUsers.count} test users`)

    // 7. Final state
    const finalCounts = {
      users: await prisma.user.count(),
      classes: await prisma.class.count(),
      reservations: await prisma.reservation.count(),
      waitlist: await prisma.waitlist.count(),
    }
    console.log('\nFinal state:', finalCounts)

    // 8. List remaining users
    const remainingUsers = await prisma.user.findMany({
      select: { name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    })
    console.log('\nRemaining users:')
    remainingUsers.forEach(u => {
      console.log(`  - ${u.name} (${u.email}) [${u.role}]`)
    })

    console.log('\nCleanup completed successfully!')
  } catch (error) {
    console.error('Error during cleanup:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

cleanup()
