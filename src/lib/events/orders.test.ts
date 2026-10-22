import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const { txMock, prismaMock } = vi.hoisted(() => {
  const txMock = {
    event: { findUnique: vi.fn() },
    eventOrder: { aggregate: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    eventTicket: { createMany: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    user: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  }
  const prismaMock = {
    ...txMock,
    $transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
  }
  return { txMock, prismaMock }
})
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { isOrderExpired, hasCapacity, createEventOrder, confirmEventOrder, cancelEventOrder, buildPaidOrdersCsv, getOrderView, claimTicket } from './orders'

const NOW = new Date('2026-10-22T15:00:00Z')
const EVENT = {
  id: 'evt1', slug: 'villains-ball', name: 'The Villains Ball', priceCents: 1000, capacity: null as number | null,
  salesOpen: true, startsAt: new Date('2026-10-31T00:30:00Z'), endsAt: new Date('2026-10-31T05:59:00Z'), venue: 'x',
  isActive: true, ticketsEnabled: true, codePrefix: 'HW-', thanksMessage: null as string | null, theme: 'villains', imageUrl: null as string | null,
}
const INPUT = { name: 'Ana Martínez', phone: '7792-3957', email: 'Ana@Gmail.com', quantity: 2, marketingOptIn: true }

function knownError(code: string, target?: string[]) {
  return new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: 'test', meta: target ? { target } : undefined })
}

describe('isOrderExpired', () => {
  it('PENDING vencido', () => expect(isOrderExpired({ status: 'PENDING', expiresAt: new Date(NOW.getTime() - 1) }, NOW)).toBe(true))
  it('PENDING vigente', () => expect(isOrderExpired({ status: 'PENDING', expiresAt: new Date(NOW.getTime() + 1) }, NOW)).toBe(false))
  it('PAID nunca vence', () => expect(isOrderExpired({ status: 'PAID', expiresAt: new Date(0) }, NOW)).toBe(false))
})

describe('hasCapacity', () => {
  it('sin tope', () => expect(hasCapacity(null, 999, 6)).toBe(true))
  it('se pasa', () => expect(hasCapacity(10, 8, 3)).toBe(false))
  it('justo', () => expect(hasCapacity(10, 7, 3)).toBe(true))
})

describe('createEventOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    txMock.event.findUnique.mockResolvedValue({ ...EVENT })
    txMock.eventOrder.aggregate.mockResolvedValue({ _sum: { quantity: 0 } })
    txMock.eventOrder.create.mockImplementation(async ({ data }: { data: { code: string; accessToken: string } }) => data)
  })

  it('evento inexistente → 404', async () => {
    txMock.event.findUnique.mockResolvedValue(null)
    expect(await createEventOrder('nope', INPUT, NOW)).toEqual({ ok: false, status: 404, error: 'Evento no encontrado' })
  })

  it('venta cerrada → 409', async () => {
    txMock.event.findUnique.mockResolvedValue({ ...EVENT, salesOpen: false })
    expect(await createEventOrder('villains-ball', INPUT, NOW)).toEqual({ ok: false, status: 409, error: 'La venta de entradas está cerrada' })
  })

  it('evento desactivado → 409', async () => {
    txMock.event.findUnique.mockResolvedValue({ ...EVENT, isActive: false })
    expect(await createEventOrder('villains-ball', INPUT, NOW)).toEqual({ ok: false, status: 409, error: 'La venta de entradas está cerrada' })
  })

  it('evento sin venta de entradas → 409', async () => {
    txMock.event.findUnique.mockResolvedValue({ ...EVENT, ticketsEnabled: false })
    expect(await createEventOrder('villains-ball', INPUT, NOW)).toEqual({ ok: false, status: 409, error: 'La venta de entradas está cerrada' })
  })

  it('usa el prefijo de código del evento', async () => {
    txMock.event.findUnique.mockResolvedValue({ ...EVENT, codePrefix: 'VP-' })
    await createEventOrder('vintage-pilates', INPUT, NOW)
    expect(txMock.eventOrder.create.mock.calls[0][0].data.code).toMatch(/^VP-[A-Z2-9]{4}$/)
  })

  it('ya empezó el evento → 409', async () => {
    const r = await createEventOrder('villains-ball', INPUT, new Date('2026-10-31T00:30:00Z'))
    expect(r).toEqual({ ok: false, status: 409, error: 'La venta de entradas está cerrada' })
  })

  it('sin cupo → 409', async () => {
    txMock.event.findUnique.mockResolvedValue({ ...EVENT, capacity: 10 })
    txMock.eventOrder.aggregate.mockResolvedValue({ _sum: { quantity: 9 } })
    expect(await createEventOrder('villains-ball', INPUT, NOW)).toEqual({ ok: false, status: 409, error: 'Las entradas se agotaron' })
  })

  it('cuenta PAID + PENDING vigentes para el cupo', async () => {
    await createEventOrder('villains-ball', INPUT, NOW)
    expect(txMock.eventOrder.aggregate).toHaveBeenCalledWith({
      where: { eventId: 'evt1', OR: [{ status: 'PAID' }, { status: 'PENDING', expiresAt: { gt: NOW } }] },
      _sum: { quantity: true },
    })
  })

  it('teléfono inválido → 400 sin tocar la BD', async () => {
    const r = await createEventOrder('villains-ball', { ...INPUT, phone: '1234' }, NOW)
    expect(r).toEqual({ ok: false, status: 400, error: 'Escribí tu WhatsApp con código de país si no es de El Salvador' })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('feliz: crea PENDING con monto, vencimiento 24h, correo y teléfono normalizados', async () => {
    const r = await createEventOrder('villains-ball', INPUT, NOW)
    expect(r.ok).toBe(true)
    const data = txMock.eventOrder.create.mock.calls[0][0].data
    expect(data).toMatchObject({
      eventId: 'evt1', buyerName: 'Ana Martínez', buyerEmail: 'ana@gmail.com', buyerPhone: '+50377923957',
      quantity: 2, amountCents: 2000, marketingOptIn: true, expiresAt: new Date('2026-10-23T15:00:00Z'),
    })
    expect(data.code).toMatch(/^HW-[A-Z2-9]{4}$/)
    expect(data.accessToken).toMatch(/^[0-9a-f]{64}$/)
    if (r.ok) expect(r).toEqual({ ok: true, accessToken: data.accessToken, code: data.code, amountCents: 2000, event: { name: 'The Villains Ball', startsAt: EVENT.startsAt, venue: 'x', thanksMessage: null } })
    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' })
  })

  it('reintenta si choca el código único', async () => {
    prismaMock.$transaction
      .mockRejectedValueOnce(knownError('P2002', ['code']))
      .mockImplementationOnce(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock))
    const r = await createEventOrder('villains-ball', INPUT, NOW)
    expect(r.ok).toBe(true)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2)
  })

  it('reintenta una vez por conflicto de serialización y luego propaga', async () => {
    prismaMock.$transaction.mockRejectedValue(knownError('P2034'))
    await expect(createEventOrder('villains-ball', INPUT, NOW)).rejects.toThrow('boom')
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2)
    prismaMock.$transaction.mockReset()
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock))
  })
})

const ORDER = {
  id: 'o1', eventId: 'evt1', code: 'HW-7K3P', accessToken: 'acc', buyerName: 'Ana Martínez', buyerEmail: 'ana@gmail.com',
  buyerPhone: '+50377923957', quantity: 3, amountCents: 3000, status: 'PENDING', marketingOptIn: true,
  expiresAt: new Date('2026-10-23T15:00:00Z'), event: { ...EVENT },
}

describe('confirmEventOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXTAUTH_URL = 'https://wellneststudio.net'
    txMock.eventOrder.findUnique.mockResolvedValue({ ...ORDER })
    txMock.eventOrder.updateMany.mockResolvedValue({ count: 1 })
    txMock.eventOrder.aggregate.mockResolvedValue({ _sum: { quantity: 3 } })
    txMock.eventOrder.update.mockResolvedValue({})
    txMock.eventTicket.createMany.mockResolvedValue({ count: 3 })
    txMock.user.findFirst.mockResolvedValue(null)
    txMock.user.create.mockResolvedValue({ id: 'u9' })
  })

  it('carrera: si otro admin ya lo confirmó → 409 y no crea entradas', async () => {
    txMock.eventOrder.updateMany.mockResolvedValue({ count: 0 })
    expect(await confirmEventOrder('o1', 'admin1', NOW)).toEqual({ ok: false, status: 409, error: 'Ya estaba confirmado' })
    expect(txMock.eventOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 'o1', status: 'PENDING' }, data: { status: 'PAID', paidAt: NOW, confirmedById: 'admin1' },
    })
    expect(txMock.eventTicket.createMany).not.toHaveBeenCalled()
  })

  it('pedido anulado → 409', async () => {
    txMock.eventOrder.findUnique.mockResolvedValue({ ...ORDER, status: 'CANCELLED' })
    expect(await confirmEventOrder('o1', 'admin1', NOW)).toEqual({ ok: false, status: 409, error: 'Este pedido fue anulado' })
  })

  it('inexistente → 404', async () => {
    txMock.eventOrder.findUnique.mockResolvedValue(null)
    expect(await confirmEventOrder('x', 'admin1', NOW)).toEqual({ ok: false, status: 404, error: 'Pedido no encontrado' })
  })

  it('feliz: crea 3 entradas, la 1 del comprador, y arma el WhatsApp', async () => {
    const r = await confirmEventOrder('o1', 'admin1', NOW)
    expect(r.ok).toBe(true)
    const rows = txMock.eventTicket.createMany.mock.calls[0][0].data as Array<Record<string, unknown>>
    expect(rows.map((t) => t.seq)).toEqual([1, 2, 3])
    expect(new Set(rows.map((t) => t.token)).size).toBe(3)
    rows.forEach((t) => expect(t.token).toMatch(/^[0-9a-f]{64}$/))
    expect(rows[0]).toMatchObject({ holderName: 'Ana Martínez', holderEmail: 'ana@gmail.com', holderPhone: '+50377923957', holderUserId: 'u9', claimedAt: NOW, marketingOptIn: true })
    expect(rows[1].holderName).toBeUndefined()
    expect(txMock.eventOrder.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { buyerUserId: 'u9' } })
    if (r.ok) {
      expect(r.whatsappUrl.startsWith('https://wa.me/50377923957?text=')).toBe(true)
      expect(decodeURIComponent(r.whatsappUrl)).toContain(`/entrada/${rows[0].token}`)
      expect(r.overCapacity).toBe(false)
      expect(r.order).toEqual({ code: 'HW-7K3P', buyerName: 'Ana Martínez', buyerEmail: 'ana@gmail.com' })
    }
  })

  it('vencido y sobre el cupo: confirma igual y avisa', async () => {
    txMock.eventOrder.findUnique.mockResolvedValue({ ...ORDER, expiresAt: new Date(0), event: { ...EVENT, capacity: 10 } })
    txMock.eventOrder.aggregate.mockResolvedValue({ _sum: { quantity: 13 } })
    const r = await confirmEventOrder('o1', 'admin1', NOW)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.overCapacity).toBe(true)
  })
})

describe('cancelEventOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    txMock.eventOrder.updateMany.mockResolvedValue({ count: 1 })
  })
  it('PAID sin nota → 400', async () => {
    prismaMock.eventOrder.findUnique.mockResolvedValue({ ...ORDER, status: 'PAID' })
    expect(await cancelEventOrder('o1', 'admin1', '  ')).toEqual({ ok: false, status: 400, error: 'Escribí el motivo de la anulación' })
  })
  it('PAID con nota → CANCELLED', async () => {
    prismaMock.eventOrder.findUnique.mockResolvedValue({ ...ORDER, status: 'PAID' })
    expect(await cancelEventOrder('o1', 'admin1', 'Reembolso', NOW)).toEqual({ ok: true })
    expect(prismaMock.eventOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 'o1', status: 'PAID' }, data: { status: 'CANCELLED', cancelledAt: NOW, adminNote: 'Reembolso' },
    })
  })
  it('PENDING sin nota → ok', async () => {
    prismaMock.eventOrder.findUnique.mockResolvedValue({ ...ORDER })
    expect(await cancelEventOrder('o1', 'admin1', null, NOW)).toEqual({ ok: true })
  })
  it('ya anulado → 409', async () => {
    prismaMock.eventOrder.findUnique.mockResolvedValue({ ...ORDER, status: 'CANCELLED' })
    expect(await cancelEventOrder('o1', 'admin1', 'x')).toEqual({ ok: false, status: 409, error: 'El pedido ya estaba anulado' })
  })
})

describe('buildPaidOrdersCsv', () => {
  it('BOM, encabezado, dólares y comillas', () => {
    const csv = buildPaidOrdersCsv([{
      code: 'HW-7K3P', buyerName: 'Martínez, Ana "La Condesa"', buyerEmail: 'ana@gmail.com', buyerPhone: '+50377923957',
      quantity: 2, amountCents: 2000, paidAt: new Date('2026-10-23T02:05:00Z'), confirmedBy: 'Jose',
    }])
    expect(csv.startsWith('\uFEFFcodigo,comprador,correo,telefono,cantidad,monto,pagado_el,confirmado_por\r\n')).toBe(true)
    expect(csv).toContain('HW-7K3P,"Martínez, Ana ""La Condesa""",ana@gmail.com,+50377923957,2,20.00,2026-10-22 20:05,Jose')
  })
})

describe('getOrderView', () => {
  beforeEach(() => { vi.clearAllMocks(); process.env.NEXTAUTH_URL = 'https://wellneststudio.net' })
  it('inexistente → null', async () => {
    prismaMock.eventOrder.findUnique.mockResolvedValue(null)
    expect(await getOrderView('nope', NOW)).toBeNull()
  })
  it('PENDING vencido → expired sin entradas', async () => {
    prismaMock.eventOrder.findUnique.mockResolvedValue({ ...ORDER, expiresAt: new Date(0), tickets: [] })
    const v = await getOrderView('acc', NOW)
    expect(v).toMatchObject({ state: 'expired', code: 'HW-7K3P', quantity: 3, amountCents: 3000, tickets: [] })
  })
  it('PAID → entradas ordenadas por seq con su URL', async () => {
    prismaMock.eventOrder.findUnique.mockResolvedValue({ ...ORDER, status: 'PAID', tickets: [{ seq: 2, token: 'tb' }, { seq: 1, token: 'ta' }] })
    const v = await getOrderView('acc', NOW)
    expect(v?.state).toBe('paid')
    expect(v?.tickets).toEqual([
      { label: 'HW-7K3P-1', url: 'https://wellneststudio.net/entrada/ta' },
      { label: 'HW-7K3P-2', url: 'https://wellneststudio.net/entrada/tb' },
    ])
  })
  it('CANCELLED → cancelled', async () => {
    prismaMock.eventOrder.findUnique.mockResolvedValue({ ...ORDER, status: 'CANCELLED', tickets: [] })
    expect((await getOrderView('acc', NOW))?.state).toBe('cancelled')
  })
})

describe('claimTicket', () => {
  const CLAIM = { name: 'Luis Pérez', phone: '6123 4567', email: 'Luis@x.com', marketingOptIn: false }
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.eventTicket.findUnique.mockResolvedValue({ id: 't2', claimedAt: null, order: { status: 'PAID' } })
    txMock.eventTicket.updateMany.mockResolvedValue({ count: 1 })
    txMock.user.findFirst.mockResolvedValue(null)
    txMock.user.create.mockResolvedValue({ id: 'u7' })
  })
  it('reclama: llena titular y crea su cuenta', async () => {
    expect(await claimTicket('tok', CLAIM, NOW)).toEqual({ ok: true })
    expect(txMock.eventTicket.updateMany).toHaveBeenCalledWith({
      where: { id: 't2', claimedAt: null },
      data: { holderName: 'Luis Pérez', holderEmail: 'luis@x.com', holderPhone: '+50361234567', holderUserId: 'u7', marketingOptIn: false, claimedAt: NOW },
    })
  })
  it('ya reclamada → 409', async () => {
    prismaMock.eventTicket.findUnique.mockResolvedValue({ id: 't2', claimedAt: NOW, order: { status: 'PAID' } })
    expect(await claimTicket('tok', CLAIM, NOW)).toEqual({ ok: false, status: 409, error: 'Esta invitación ya fue reclamada' })
  })
  it('carrera: otro la reclamó entre la lectura y la escritura → 409', async () => {
    txMock.eventTicket.updateMany.mockResolvedValue({ count: 0 })
    expect(await claimTicket('tok', CLAIM, NOW)).toEqual({ ok: false, status: 409, error: 'Esta invitación ya fue reclamada' })
  })
  it('pedido no pagado o anulado → 404', async () => {
    prismaMock.eventTicket.findUnique.mockResolvedValue({ id: 't2', claimedAt: null, order: { status: 'CANCELLED' } })
    expect(await claimTicket('tok', CLAIM, NOW)).toEqual({ ok: false, status: 404, error: 'Invitación no encontrada' })
  })
  it('teléfono inválido → 400', async () => {
    expect(await claimTicket('tok', { ...CLAIM, phone: '12' }, NOW)).toMatchObject({ ok: false, status: 400 })
  })
})

describe('buildPaidOrdersCsv — fórmulas', () => {
  it('neutraliza celdas que Excel interpretaría como fórmula', () => {
    const csv = buildPaidOrdersCsv([{
      code: 'HW-7K3P', buyerName: '=HYPERLINK("http://x","clic")', buyerEmail: '@x.com', buyerPhone: '+50377923957',
      quantity: 1, amountCents: 1000, paidAt: new Date('2026-10-23T02:05:00Z'), confirmedBy: '-Jose',
    }])
    expect(csv).toContain(`"'=HYPERLINK(""http://x"",""clic"")"`)
    expect(csv).toContain(`,'@x.com,`)
    expect(csv).toContain(`,'-Jose\r\n`)
    expect(csv).toContain(',+50377923957,')
  })
})
