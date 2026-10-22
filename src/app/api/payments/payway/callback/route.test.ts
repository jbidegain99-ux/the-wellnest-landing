import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const { prismaMock, markOrderPaidMock, sendEmailMock, verifySignatureMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { findUnique: vi.fn() },
    paymentTransaction: { create: vi.fn() },
  },
  markOrderPaidMock: vi.fn(),
  sendEmailMock: vi.fn(),
  verifySignatureMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/payments/markOrderPaid', () => ({ markOrderPaidAndCreatePurchase: markOrderPaidMock }))
vi.mock('@/lib/emailService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/emailService')>()),
  sendEmail: sendEmailMock,
}))
vi.mock('@/lib/payments/payway', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/payments/payway')>()),
  verifyCallbackSignature: verifySignatureMock,
}))

import { POST } from './route'

const ORDER_ID = 'cmuqc53wv0009xdc9igar48ne'

// PayWay manda el oid en el body, no en el query string
const paywayForm: Record<string, string> = {
  oid: ORDER_ID,
  sig: 'sig',
  pwoAuthorizationNumber: '211163',
  pwoReferenceNumber: '627420000656',
  pwoPayWayNumber: '5323215156',
  pwoTransactionDate: '20261001202110',
  pwoCustomerCCBrand: 'VISA',
  pwoCustomerCCLastD: 'X-0061',
  pwoCustomerCCHolder: 'GLADYS DELGADO',
  pwoPaymentNumber: '7313740',
}

function callbackRequest(): Request {
  return new Request('https://wellneststudio.net/api/payments/payway/callback', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(paywayForm).toString(),
  })
}

async function runCallback(): Promise<Response> {
  const promise = POST(callbackRequest())
  await vi.runAllTimersAsync()
  return promise
}

const dbOutOfConnections = () =>
  new Prisma.PrismaClientInitializationError(
    'Too many database connections opened: FATAL: too many connections for role "prisma_migration"',
    '5.22.0'
  )

const paid = { success: true, alreadyPaid: false, purchases: [] }

describe('PayWay callback — DB failures after an approved charge', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    verifySignatureMock.mockReturnValue(true)
    sendEmailMock.mockResolvedValue({ success: true })
    prismaMock.paymentTransaction.create.mockResolvedValue({})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('retries the order lookup while the DB is out of connections, then credits the payment', async () => {
    prismaMock.order.findUnique
      .mockRejectedValueOnce(dbOutOfConnections())
      .mockResolvedValueOnce({ id: ORDER_ID, status: 'PENDING' })
    markOrderPaidMock.mockResolvedValue(paid)

    const res = await runCallback()

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain(`/payment/success?oid=${ORDER_ID}`)
    expect(markOrderPaidMock).toHaveBeenCalledTimes(1)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('retries markOrderPaid when it fails with a transient DB error', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: ORDER_ID, status: 'PENDING' })
    markOrderPaidMock.mockRejectedValueOnce(dbOutOfConnections()).mockResolvedValueOnce(paid)

    const res = await runCallback()

    expect(res.headers.get('location')).toContain(`/payment/success?oid=${ORDER_ID}`)
    expect(markOrderPaidMock).toHaveBeenCalledTimes(2)
  })

  it('when the DB stays down: sends the customer to the review page (oid from the body) and alerts admins', async () => {
    prismaMock.order.findUnique.mockRejectedValue(dbOutOfConnections())

    const res = await runCallback()

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain(
      `/checkout/payway/${ORDER_ID}?status=error&reason=processing_failed`
    )
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    const email = sendEmailMock.mock.calls[0][0]
    expect(email.to).toEqual(['jbidegain@republicode.com', 'alexis2293@gmail.com'])
    expect(email.subject).toContain(ORDER_ID)
    expect(email.html).toContain('211163')
    expect(email.html).toContain('627420000656')
  })

  it('alerts admins when the charge cannot be credited for a business reason', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: ORDER_ID, status: 'PENDING' })
    markOrderPaidMock.mockResolvedValue({ success: false, alreadyPaid: false, error: 'Solo se puede adquirir una vez.' })

    const res = await runCallback()

    expect(res.headers.get('location')).toContain('reason=processing_failed')
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
  })

  it('alerts admins when the charged order is no longer PENDING', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: ORDER_ID, status: 'CANCELLED' })

    const res = await runCallback()

    expect(res.headers.get('location')).toContain('reason=invalid_status')
    expect(markOrderPaidMock).not.toHaveBeenCalled()
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
  })

  it('does not alert when the signature is invalid (not a real PayWay charge)', async () => {
    verifySignatureMock.mockReturnValue(false)

    const res = await runCallback()

    expect(res.status).toBe(401)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })
})
