import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  confirmHostAndGuestInTx,
  GUEST_ALREADY_ACTIVE,
  RESERVATION_CHANGED_RACE,
} from './guestReservationTx'

const tx = {
  reservation: {
    findFirst: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
}
// El helper solo usa estos métodos del delegate
const txArg = tx as unknown as Parameters<typeof confirmHostAndGuestInTx>[0]

const base = {
  userId: 'u1',
  classId: 'c1',
  purchaseId: 'p-new',
  guestEmail: 'amiga@example.com',
  guestName: 'Amiga',
}

describe('confirmHostAndGuestInTx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tx.reservation.create.mockResolvedValue({ id: 'host-created' })
    tx.reservation.findUniqueOrThrow.mockResolvedValue({ id: 'host-old' })
    tx.reservation.updateMany.mockResolvedValue({ count: 1 })
  })

  it('reserva nueva: crea titular e invitado', async () => {
    tx.reservation.findFirst.mockResolvedValue(null)

    const host = await confirmHostAndGuestInTx(txArg, { ...base, cancelledHostId: null })

    expect(host).toEqual({ id: 'host-created' })
    expect(tx.reservation.create).toHaveBeenCalledTimes(2)
    expect(tx.reservation.create.mock.calls[1][0].data).toMatchObject({
      isGuestReservation: true,
      guestEmail: 'amiga@example.com',
      guestStatus: 'ACCEPTED',
      purchaseId: 'p-new',
    })
    expect(tx.reservation.updateMany).not.toHaveBeenCalled()
  })

  it('titular cancelada sin invitado previo: reactiva la titular y crea el invitado', async () => {
    tx.reservation.findFirst.mockResolvedValue(null)

    const host = await confirmHostAndGuestInTx(txArg, { ...base, cancelledHostId: 'host-old' })

    expect(host).toEqual({ id: 'host-old' })
    expect(tx.reservation.updateMany).toHaveBeenCalledWith({
      where: { id: 'host-old', status: 'CANCELLED' },
      data: expect.objectContaining({ status: 'CONFIRMED', cancelledAt: null, purchaseId: 'p-new' }),
    })
    expect(tx.reservation.create).toHaveBeenCalledTimes(1)
    expect(tx.reservation.create.mock.calls[0][0].data.isGuestReservation).toBe(true)
  })

  it('titular e invitado cancelados (lo que deja el admin): reactiva ambos sin crear filas', async () => {
    tx.reservation.findFirst.mockResolvedValue({ id: 'guest-old', status: 'CANCELLED' })

    await confirmHostAndGuestInTx(txArg, { ...base, cancelledHostId: 'host-old' })

    expect(tx.reservation.create).not.toHaveBeenCalled()
    expect(tx.reservation.updateMany).toHaveBeenCalledTimes(2)
    expect(tx.reservation.updateMany.mock.calls[1][0]).toEqual({
      where: { id: 'guest-old', status: 'CANCELLED' },
      data: expect.objectContaining({
        status: 'CONFIRMED',
        guestEmail: 'amiga@example.com',
        guestName: 'Amiga',
        guestStatus: 'ACCEPTED',
        purchaseId: 'p-new',
        checkedIn: false,
      }),
    })
  })

  it('rechaza si el invitado ya tiene reserva viva', async () => {
    tx.reservation.findFirst.mockResolvedValue({ id: 'guest-old', status: 'CONFIRMED' })

    await expect(
      confirmHostAndGuestInTx(txArg, { ...base, cancelledHostId: 'host-old' })
    ).rejects.toThrow(GUEST_ALREADY_ACTIVE)
    expect(tx.reservation.updateMany).not.toHaveBeenCalled()
  })

  it('falla si la reserva cancelada cambió de estado en paralelo', async () => {
    tx.reservation.findFirst.mockResolvedValue(null)
    tx.reservation.updateMany.mockResolvedValue({ count: 0 })

    await expect(
      confirmHostAndGuestInTx(txArg, { ...base, cancelledHostId: 'host-old' })
    ).rejects.toThrow(RESERVATION_CHANGED_RACE)
    expect(tx.reservation.create).not.toHaveBeenCalled()
  })
})
