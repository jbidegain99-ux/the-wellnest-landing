import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EXCLUSIONS = [
  {
    purchaseId: 'cmmzix0oe0001hmp2u6pvgy9d',
    reason: 'FAKE_DUPLICATE_SHARED_PACKAGE',
    notes:
      'Esther Umanzor — Wellnest Trimestral $355 (20/03/2026). Compra fantasma generada por el flujo de paquete compartido: cuando admin asigna un paquete trimestral compartido entre 2 usuarias el sistema crea 2 Purchase completas y luego se restan clases manualmente. Solo Paola Nasser pagó realmente el paquete; esta entrada no representa dinero recibido. Confirmado por José 2026-04-07 contra recibos POS Serfinsa (2x $177.50 a nombre de Paola).',
  },
  {
    purchaseId: 'cmmur3ica0001nnqhlg997cl9',
    reason: 'BARTER_TRADE',
    notes:
      'Victoria Sosa — Mini Flow (4 clases) $49.99 (17/03/2026). Paquete entregado en concepto de pago por servicios prestados al estudio (trueque). No hubo dinero involucrado. Las clases ya fueron consumidas y son legítimas — esta exclusión solo afecta el reporte financiero. Confirmado por José 2026-04-07.',
  },
];

async function main() {
  for (const ex of EXCLUSIONS) {
    const purchase = await prisma.purchase.findUnique({
      where: { id: ex.purchaseId },
      include: { user: true, package: true },
    });
    if (!purchase) {
      console.error(`❌ Purchase ${ex.purchaseId} not found, skipping`);
      continue;
    }
    const existing = await prisma.excludedPurchase.findUnique({
      where: { purchaseId: ex.purchaseId },
    });
    if (existing) {
      console.log(`⏭  Already excluded: ${purchase.user.name} — ${purchase.package.name} ($${purchase.finalPrice})`);
      continue;
    }
    const created = await prisma.excludedPurchase.create({
      data: {
        purchaseId: ex.purchaseId,
        reason: ex.reason,
        notes: ex.notes,
      },
    });
    console.log(`✅ Excluded ${purchase.user.name} — ${purchase.package.name} ($${purchase.finalPrice})`);
    console.log(`   reason=${created.reason}  excludedAt=${created.excludedAt.toISOString()}`);
  }

  // Print summary of all current exclusions
  const all = await prisma.excludedPurchase.findMany({ orderBy: { excludedAt: 'asc' } });
  console.log(`\n=== Total exclusions in DB: ${all.length} ===`);
  let totalAmount = 0;
  for (const e of all) {
    const p = await prisma.purchase.findUnique({
      where: { id: e.purchaseId },
      include: { user: true, package: true },
    });
    if (p) {
      totalAmount += p.finalPrice;
      console.log(`  ${p.user.name.padEnd(25)} ${p.package.name.padEnd(40)} $${p.finalPrice.toFixed(2).padStart(8)}  ${e.reason}`);
    }
  }
  console.log(`  ${' '.repeat(67)} TOTAL  $${totalAmount.toFixed(2)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
