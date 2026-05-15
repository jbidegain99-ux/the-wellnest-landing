import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const pkg = await prisma.package.findFirst({ where: { slug: 'private-flow' } })
  if (!pkg) {
    console.error('Private Flow package no encontrado')
    process.exit(1)
  }

  const updated = await prisma.package.update({
    where: { id: pkg.id },
    data: {
      subtitle: 'Una sesión personalizada para ti',
      shortDescription:
        'Clase 1:1 \n' +
        '-Atención 100% personalizada\n' +
        '-Rutina adaptada a tus objetivos y necesidades\n' +
        '-Mayor conexión\n' +
        '-Espacio íntimo y cómodo\n' +
        '-Ideal para embarazo, postparto o lesiones\n' +
        '-Horarios más flexibles\n' +
        '-Acompañamiento cercano y motivación constante\n' +
        '-Experiencia exclusiva y enfocada en ti',
    },
  })

  console.log('Actualizado:', {
    name: updated.name,
    subtitle: updated.subtitle,
    shortDescription: updated.shortDescription,
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
