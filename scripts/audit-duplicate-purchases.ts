import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('══════════════════════════════════════════════')
  console.log('  AUDITORÍA: COMPRAS DUPLICADAS POR USUARIO')
  console.log('══════════════════════════════════════════════\n')

  // 1. Buscar los paquetes introductorios
  const trialPkg = await prisma.package.findFirst({
    where: { id: 'cmm78xhwt0000bfage9rlmp2m' },
  })

  const welcomePkg = await prisma.package.findFirst({
    where: { slug: 'welcome-to-wellnest-2' },
  })

  const targetPackages = [
    ...(trialPkg ? [{ label: 'Paquete de Prueba ($0)', id: trialPkg.id }] : []),
    ...(welcomePkg ? [{ label: 'Welcome to Wellnest ($15)', id: welcomePkg.id }] : []),
  ]

  if (targetPackages.length === 0) {
    console.log('⚠️  No se encontraron paquetes introductorios en la BD.')
    return
  }

  for (const pkg of targetPackages) {
    console.log(`\n📦 ${pkg.label} (ID: ${pkg.id})`)
    console.log('─'.repeat(50))

    const duplicates = await prisma.purchase.groupBy({
      by: ['userId'],
      where: {
        packageId: pkg.id,
      },
      _count: { userId: true },
      having: {
        userId: { _count: { gt: 1 } },
      },
    })

    if (duplicates.length === 0) {
      console.log('  ✅ Sin compras duplicadas')
      continue
    }

    console.log(`  ⚠️  ${duplicates.length} usuario(s) con compras múltiples:\n`)

    for (const dup of duplicates) {
      const user = await prisma.user.findUnique({
        where: { id: dup.userId },
        select: { id: true, name: true, email: true },
      })

      const purchases = await prisma.purchase.findMany({
        where: { userId: dup.userId, packageId: pkg.id },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          createdAt: true,
          status: true,
          classesRemaining: true,
        },
      })

      console.log(`  👤 ${user?.name || 'Sin nombre'} (${user?.email})`)
      console.log(`     Compras: ${purchases.length}`)
      purchases.forEach((p, i) => {
        console.log(
          `     ${i + 1}. ID: ${p.id} | ${p.createdAt.toISOString()} | Status: ${p.status} | Clases restantes: ${p.classesRemaining}`
        )
      })
      console.log('')
    }
  }

  // Resumen total
  console.log('\n══════════════════════════════════════════════')
  console.log('  RESUMEN')
  console.log('══════════════════════════════════════════════')
  console.log('  Política: NO se revierten compras existentes.')
  console.log('  Acción: Solo se bloquean compras FUTURAS duplicadas.')
  console.log('══════════════════════════════════════════════\n')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
