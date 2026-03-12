import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.package.findFirst({
    where: { slug: 'welcome-to-wellnest-2' }
  });

  const data = {
    name: 'Welcome to Wellnest (2 clases)',
    slug: 'welcome-to-wellnest-2',
    subtitle: 'Tu primer paso para reconectar',
    price: 15.00,
    classCount: 2,
    validityDays: 30,
    isActive: true,
    shortDescription: 'Tu primer paso para reconectar con el movimiento consciente.',
    fullDescription: 'Perfecto para conocer Wellnest Studio y vivir tu primera experiencia de movimiento consciente. Sabemos que amarás tu primera clase, por eso incluimos una segunda sesión para que explores otra disciplina o repitas tu favorita.',
    bulletsTop: [
      '2 clases de la disciplina que desees',
      'Vigencia: 30 días',
      'Ideal para probar',
    ],
    bulletsBottom: [],
    currency: 'USD',
    originalPrice: null,
    discountPercent: null,
    isShareable: false,
    maxShares: 0,
    isFeatured: false,
    order: 0, // First position (introductory package)
  };

  if (existing) {
    await prisma.package.update({
      where: { id: existing.id },
      data
    });
    console.log(`✅ Paquete actualizado: ${existing.id}`);
  } else {
    const created = await prisma.package.create({ data });
    console.log(`✅ Paquete creado: ${created.id}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
