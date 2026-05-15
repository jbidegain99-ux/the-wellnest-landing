import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const pkg = await prisma.package.findFirst({ where: { slug: 'private-flow' } })
  if (!pkg) {
    console.error('Private Flow package no encontrado')
    process.exit(1)
  }

  const newBullets = (pkg.bulletsTop as string[]).filter(
    (b) => b !== '3 clases privadas',
  )

  await prisma.package.update({
    where: { id: pkg.id },
    data: { bulletsTop: newBullets },
  })

  console.log('✅ bulletsTop actualizados:', newBullets)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
