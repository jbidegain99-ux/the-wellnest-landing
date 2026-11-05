import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  addGuestToReservationInTx,
  AddGuestFailure,
  checkAddGuestEligibility,
  type HostReservationForGuest,
} from './addGuest'

const now = new Date('2026-11-05T12:00:00Z')
const later = new Date('2026-11-06T12:00:00Z')

function host(overrides: Partial<HostReservationForGuest> = {}): HostReservationForGuest {
  return {
    userId: 'u1',
    isGuestReservation: false,
    status: 'CONFIRMED',
    class: { dateTime: later, isCancelled: false, isPrivate: false },
    purchase: {
      status: 'ACTIVE',
      classesRemaining: 3,
      expiresAt: new Date('2026-12-01T00:00:00Z'),
      package: { isShareable: true, maxShares: 1 },
    },
    ...overrides,
  }
}

const check = (r: HostReservationForGuest | null, guestEmail = 'amiga@example.com') =>
  checkAddGuestEligibility(r, 'u1', 'paola@example.com', guestEmail, now)

describe('checkAddGuestEligibility', () => {
  it('permite una reserva confirmada futura con paquete compartible y clases', () => {
    expect(check(host())).toBeNull()
  })

  it('no deja tocar reservas ajenas ni filas de invitado', () => {
    expect(check(null)).toBe('NOT_FOUND')
    expect(check(host({ userId: 'otra' }))).toBe('NOT_FOUND')
    expect(check(host({ isGuestReservation: true }))).toBe('NOT_FOUND')
  })

  it('rechaza reservas no confirmadas, clases canceladas, privadas o ya empezadas', () => {
    expect(check(host({ status: 'CANCELLED' }))).toBe('NOT_ACTIVE')
    expect(check(host({ class: { dateTime: later, isCancelled: true, isPrivate: false } }))).toBe('CLASS_UNAVAILABLE')
    expect(check(host({ class: { dateTime: later, isCancelled: false, isPrivate: true } }))).toBe('CLASS_UNAVAILABLE')
    expect(check(host({ class: { dateTime: now, isCancelled: false, isPrivate: false } }))).toBe('CLASS_STARTED')
  })

  it('exige paquete compartible, vigente y con al menos 1 clase', () => {
    const base = host().purchase
    expect(check(host({ purchase: { ...base, package: { isShareable: false, maxShares: 0 } } }))).toBe('NOT_SHAREABLE')
    expect(check(host({ purchase: { ...base, expiresAt: now } }))).toBe('PACKAGE_EXPIRED')
    expect(check(host({ purchase: { ...base, classesRemaining: 0, status: 'DEPLETED' } }))).toBe('NO_CREDITS')
  })

  it('no acepta como invitado el correo de la titular', () => {
    expect(check(host(), ' Paola@Example.com ')).toBe('SAME_EMAIL')
  })
})

const tx = {
  $queryRaw: vi.fn(),
  reservation: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  purchase: { update: vi.fn() },
}
const txArg = tx as unknown as Parameters<typeof addGuestToReservationInTx>[0]

const params = {
  hostReservationId: 'host-1',
  userId: 'u1',
  classId: 'c1',
  maxCapacity: 10,
  purchaseId: 'p1',
  guestEmail: 'amiga@example.com',
  guestName: 'Amiga',
}

describe('addGuestToReservationInTx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tx.$queryRaw.mockResolvedValue([{ isCancelled: false }])
    // 1.ª llamada: la titular sigue confirmada; 2.ª: no hay invitado previo
    tx.reservation.findFirst.mockResolvedValueOnce({ id: 'host-1' }).mockResolvedValueOnce(null)
    tx.reservation.count.mockResolvedValue(5)
    tx.reservation.create.mockResolvedValue({ id: 'guest-new' })
    tx.reservation.updateMany.mockResolvedValue({ count: 1 })
    tx.purchase.update.mockResolvedValue({ classesRemaining: 2 })
  })

  it('crea el invitado y descuenta 1 clase', async () => {
    const res = await addGuestToReservationInTx(txArg, params)

    expect(res).toEqual({ guestReservationId: 'guest-new', classesRemaining: 2 })
    expect(tx.purchase.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { classesRemaining: { decrement: 1 } },
    })
    expect(tx.reservation.create.mock.calls[0][0].data).toMatchObject({
      isGuestReservation: true,
      guestEmail: 'amiga@example.com',
      guestStatus: 'ACCEPTED',
      purchaseId: 'p1',
      status: 'CONFIRMED',
    })
  })

  it('reutiliza la fila cancelada de un invitado anterior', async () => {
    tx.reservation.findFirst.mockReset()
    tx.reservation.findFirst
      .mockResolvedValueOnce({ id: 'host-1' })
      .mockResolvedValueOnce({ id: 'guest-old', status: 'CANCELLED' })

    const res = await addGuestToReservationInTx(txArg, params)

    expect(res.guestReservationId).toBe('guest-old')
    expect(tx.reservation.create).not.toHaveBeenCalled()
    expect(tx.reservation.updateMany.mock.calls[0][0]).toEqual({
      where: { id: 'guest-old', status: 'CANCELLED' },
      data: expect.objectContaining({ status: 'CONFIRMED', guestEmail: 'amiga@example.com', cancelledAt: null }),
    })
  })

  it('marca el paquete como agotado si era su última clase', async () => {
    tx.purchase.update.mockResolvedValueOnce({ classesRemaining: 0 })

    await addGuestToReservationInTx(txArg, params)

    expect(tx.purchase.update).toHaveBeenLastCalledWith({ where: { id: 'p1' }, data: { status: 'DEPLETED' } })
  })

  it.each([
    ['clase cancelada', () => tx.$queryRaw.mockResolvedValue([{ isCancelled: true }]), 'CLASS_UNAVAILABLE'],
    ['titular ya no confirmada', () => { tx.reservation.findFirst.mockReset(); tx.reservation.findFirst.mockResolvedValue(null) }, 'NOT_ACTIVE'],
    ['clase llena', () => tx.reservation.count.mockResolvedValue(10), 'CLASS_FULL'],
    ['invitado vivo', () => { tx.reservation.findFirst.mockReset(); tx.reservation.findFirst.mockResolvedValueOnce({ id: 'host-1' }).mockResolvedValueOnce({ id: 'g', status: 'CONFIRMED' }) }, 'GUEST_ALREADY_ACTIVE'],
    ['sin créditos (carrera)', () => tx.purchase.update.mockResolvedValue({ classesRemaining: -1 }), 'NO_CREDITS'],
  ])('falla con %s', async (_label, arrange, reason) => {
    arrange()
    const err: unknown = await addGuestToReservationInTx(txArg, params).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AddGuestFailure)
    expect((err as AddGuestFailure).reason).toBe(reason)
  })
})
