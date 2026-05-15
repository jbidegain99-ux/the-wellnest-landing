import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock Prisma client used by markOrderPaid (hoisted so vi.mock factory can reference them)
const { txMock, prismaMock } = vi.hoisted(() => {
  const txMock = {
    paymentTransaction: { create: vi.fn() },
    purchase: { create: vi.fn() },
    promoRedemption: { findUnique: vi.fn(), create: vi.fn() },
    discountCode: { update: vi.fn() },
    order: { update: vi.fn() },
    package: { findMany: vi.fn() },
  }

  const prismaMock = {
    order: { findUnique: vi.fn() },
    purchase: { findFirst: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
  }

  return { txMock, prismaMock }
})

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

// Stub facturador to avoid network/DTE side effects
vi.mock('@/lib/facturador', () => ({
  sendToFacturador: vi.fn(async () => ({ success: true })),
}))

import { markOrderPaidAndCreatePurchase } from './markOrderPaid'

describe('markOrderPaidAndCreatePurchase — bundle packages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.purchase.update.mockResolvedValue({})
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Test',
      email: 't@example.com',
      phone: null,
      documentId: null,
      documentType: null,
      fiscalAddress: null,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates one Purchase per child slug when bundleChildSlugs is non-empty', async () => {
    const orderId = 'order-bundle'

    prismaMock.order.findUnique.mockResolvedValue({
      id: orderId,
      userId: 'user-1',
      status: 'PENDING',
      discountCode: null,
      discountCodeId: null,
      discountCodeRef: null,
      items: [
        {
          id: 'item-1',
          packageId: 'pkg-trinity',
          quantity: 1,
          unitPrice: 60,
          package: {
            id: 'pkg-trinity',
            name: 'Trinity Flow (6 clases)',
            slug: 'trinity-flow-6',
            classCount: 6,
            validityDays: 30,
            singlePurchaseOnly: false,
            isHidden: false,
            bundleChildSlugs: ['trinity-pole-2', 'trinity-pilates-2', 'trinity-yoga-2'],
          },
        },
      ],
    })

    txMock.package.findMany.mockResolvedValue([
      { id: 'pkg-pole', slug: 'trinity-pole-2', name: 'Trinity — Pole', classCount: 2, validityDays: 30 },
      { id: 'pkg-pilates', slug: 'trinity-pilates-2', name: 'Trinity — Pilates', classCount: 2, validityDays: 30 },
      { id: 'pkg-yoga', slug: 'trinity-yoga-2', name: 'Trinity — Yoga', classCount: 2, validityDays: 30 },
    ])

    txMock.purchase.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      id: `purchase-${args.data.packageId}`,
      ...args.data,
      package: { id: args.data.packageId, name: 'Trinity child' },
    }))

    const result = await markOrderPaidAndCreatePurchase({ orderId, provider: 'PAYWAY' })

    expect(result.success).toBe(true)
    expect(txMock.purchase.create).toHaveBeenCalledTimes(3)

    const calls = txMock.purchase.create.mock.calls.map((c) => c[0].data)
    const groupIds = new Set(calls.map((d) => d.bundleGroupId))
    expect(groupIds.size).toBe(1)
    expect(Array.from(groupIds)[0]).toBeTruthy()

    for (const data of calls) {
      expect(data.bundleParentPackageId).toBe('pkg-trinity')
      expect(data.originalPrice).toBe(0)
      expect(data.finalPrice).toBe(0)
    }

    const packageIds = calls.map((d) => d.packageId).sort()
    expect(packageIds).toEqual(['pkg-pilates', 'pkg-pole', 'pkg-yoga'])

    // classesRemaining comes from each child's classCount (2), not from the parent
    for (const data of calls) {
      expect(data.classesRemaining).toBe(2)
    }
  })

  it('throws when a bundle child slug cannot be resolved in the database', async () => {
    const orderId = 'order-bundle-missing'

    prismaMock.order.findUnique.mockResolvedValue({
      id: orderId,
      userId: 'user-1',
      status: 'PENDING',
      discountCode: null,
      discountCodeId: null,
      discountCodeRef: null,
      items: [
        {
          id: 'item-1',
          packageId: 'pkg-trinity',
          quantity: 1,
          unitPrice: 60,
          package: {
            id: 'pkg-trinity',
            name: 'Trinity Flow',
            slug: 'trinity-flow-6',
            classCount: 6,
            validityDays: 30,
            singlePurchaseOnly: false,
            isHidden: false,
            bundleChildSlugs: ['trinity-pole-2', 'trinity-pilates-2', 'trinity-yoga-2'],
          },
        },
      ],
    })

    // findMany returns only 2 of the 3 expected children — yoga is missing
    txMock.package.findMany.mockResolvedValue([
      { id: 'pkg-pole', slug: 'trinity-pole-2', name: 'P', classCount: 2, validityDays: 30 },
      { id: 'pkg-pilates', slug: 'trinity-pilates-2', name: 'P', classCount: 2, validityDays: 30 },
    ])

    const result = await markOrderPaidAndCreatePurchase({ orderId, provider: 'PAYWAY' })

    expect(result.success).toBe(false)
    expect(result.error).toContain('trinity-yoga-2')
    expect(txMock.purchase.create).not.toHaveBeenCalled()
    expect(txMock.order.update).not.toHaveBeenCalled()
  })

  it('uses the parent validityDays for child expiresAt, ignoring child validityDays', async () => {
    const orderId = 'order-bundle-2'

    prismaMock.order.findUnique.mockResolvedValue({
      id: orderId,
      userId: 'user-1',
      status: 'PENDING',
      discountCode: null,
      discountCodeId: null,
      discountCodeRef: null,
      items: [
        {
          id: 'item-1',
          packageId: 'pkg-trinity',
          quantity: 1,
          unitPrice: 60,
          package: {
            id: 'pkg-trinity',
            name: 'Trinity Flow',
            slug: 'trinity-flow-6',
            classCount: 6,
            validityDays: 30,
            singlePurchaseOnly: false,
            isHidden: false,
            bundleChildSlugs: ['trinity-pole-2'],
          },
        },
      ],
    })
    txMock.package.findMany.mockResolvedValue([
      { id: 'pkg-pole', slug: 'trinity-pole-2', name: 'P', classCount: 2, validityDays: 999 },
    ])
    txMock.purchase.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      id: 'purchase-1',
      ...args.data,
      package: { id: args.data.packageId, name: 'P' },
    }))

    const before = Date.now()
    await markOrderPaidAndCreatePurchase({ orderId, provider: 'PAYWAY' })
    const after = Date.now()

    const data = txMock.purchase.create.mock.calls[0][0].data
    const expiresAt = new Date(data.expiresAt as Date).getTime()
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    expect(expiresAt).toBeGreaterThanOrEqual(before + thirtyDaysMs - 1000)
    expect(expiresAt).toBeLessThanOrEqual(after + thirtyDaysMs + 1000)
  })

  it('does NOT trigger bundle branch for normal packages', async () => {
    const orderId = 'order-normal'

    prismaMock.order.findUnique.mockResolvedValue({
      id: orderId,
      userId: 'user-1',
      status: 'PENDING',
      discountCode: null,
      discountCodeId: null,
      discountCodeRef: null,
      items: [
        {
          id: 'item-1',
          packageId: 'pkg-viajero',
          quantity: 1,
          unitPrice: 215,
          package: {
            id: 'pkg-viajero',
            name: 'Flow Viajero',
            slug: 'flow-viajero-40',
            classCount: 40,
            validityDays: 60,
            singlePurchaseOnly: false,
            isHidden: false,
            bundleChildSlugs: [],
          },
        },
      ],
    })
    txMock.purchase.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      id: 'purchase-normal',
      ...args.data,
      package: { id: 'pkg-viajero', name: 'Flow Viajero' },
    }))

    await markOrderPaidAndCreatePurchase({ orderId, provider: 'PAYWAY' })

    expect(txMock.package.findMany).not.toHaveBeenCalled()
    expect(txMock.purchase.create).toHaveBeenCalledTimes(1)
    const data = txMock.purchase.create.mock.calls[0][0].data
    expect(data.bundleGroupId).toBeUndefined()
    expect(data.bundleParentPackageId).toBeUndefined()
    expect(data.classesRemaining).toBe(40)
    expect(data.originalPrice).toBe(215)
  })
})
