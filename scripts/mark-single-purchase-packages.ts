import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Paquete de prueba
  const trial = await prisma.package.updateMany({
    where: { id: 'cmm78xhwt0000bfage9rlmp2m' },
    data: { singlePurchaseOnly: true },
  })
  console.log(`Trial package: ${trial.count} actualizado(s)`)

  // Welcome to Wellnest
  const welcome = await prisma.package.updateMany({
    where: { slug: 'welcome-to-wellnest-2' },
    data: { singlePurchaseOnly: true },
  })
  console.log(`Welcome package: ${welcome.count} actualizado(s)`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
