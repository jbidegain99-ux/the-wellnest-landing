import { PrismaClient } from '@prisma/client'
import { prodSignalError } from './envFiles'

// Scripts: WELLNEST_ENV=prod sin `import './loadEnv'` haría que Prisma lea el
// .env local (QA) en silencio creyendo estar en producción. Sin WELLNEST_ENV
// (la app en Vercel) no hace nada.
const prodSignal = prodSignalError(process.env)
if (prodSignal) throw new Error(prodSignal)

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// DATABASE_URL (gestionada por la integración de Prisma en Vercel) es la
// conexión DIRECTA a Prisma Postgres (db.prisma.io, tope ~45 conexiones): cada
// instancia serverless retiene su propio pool y en ráfagas se agota
// ("too many connections for role prisma_migration"). DATABASE_POOLED_URL
// apunta al PgBouncer (pooled.db.prisma.io, ?pgbouncer=true) pensado para
// tráfico de la app. Sin ella se usa DATABASE_URL como antes.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: process.env.DATABASE_POOLED_URL || undefined,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
