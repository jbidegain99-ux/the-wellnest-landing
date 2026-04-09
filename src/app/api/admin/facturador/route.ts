/**
 * Health check endpoint para la integración con Facturador SV.
 * Solo accesible por ADMIN.
 *
 * GET /api/admin/facturador — Muestra estado de configuración y últimos webhooks.
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFacturadorConfig } from '@/lib/facturador'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const config = getFacturadorConfig()

  // Recent webhook logs
  const recentWebhooks = await prisma.webhookLog.findMany({
    where: { source: 'facturador-sv' },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      event: true,
      purchaseId: true,
      status: true,
      error: true,
      createdAt: true,
    },
  })

  // Purchases with invoice status
  const invoiceStats = await prisma.purchase.groupBy({
    by: ['invoiceStatus'],
    _count: { id: true },
    where: { invoiceStatus: { not: null } },
  })

  // Recent purchases with invoice info
  const recentInvoices = await prisma.purchase.findMany({
    where: { invoiceStatus: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      invoiceStatus: true,
      invoiceNumber: true,
      dteUuid: true,
      invoiceError: true,
      invoiceSentAt: true,
      invoiceCompletedAt: true,
      finalPrice: true,
      package: { select: { name: true } },
      user: { select: { name: true, email: true } },
    },
  })

  return NextResponse.json({
    integration: {
      configured: config !== null,
      apiUrl: config?.apiUrl ? `${config.apiUrl.substring(0, 40)}...` : null,
      tenantId: config?.tenantId || null,
      hasJwtToken: !!config?.jwtToken,
      hasWebhookSecret: !!config?.webhookSecret,
    },
    invoiceStats: invoiceStats.map(s => ({
      status: s.invoiceStatus,
      count: s._count.id,
    })),
    recentInvoices,
    recentWebhooks,
  })
}
