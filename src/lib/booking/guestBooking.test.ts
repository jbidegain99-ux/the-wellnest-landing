import { describe, it, expect } from 'vitest'
import {
  GUEST_TOTAL_COST,
  GUEST_SEATS,
  checkGuestBookingAllowed,
} from './guestBooking'

describe('guestBooking constants', () => {
  it('a guest booking costs 2 classes and 2 seats', () => {
    expect(GUEST_TOTAL_COST).toBe(2)
    expect(GUEST_SEATS).toBe(2)
  })
})

describe('checkGuestBookingAllowed', () => {
  it('returns OK with enough classes and seats', () => {
    expect(checkGuestBookingAllowed(2, 2)).toBe('OK')
    expect(checkGuestBookingAllowed(80, 10)).toBe('OK')
  })

  it('returns INSUFFICIENT_CREDITS when fewer than 2 classes remain', () => {
    expect(checkGuestBookingAllowed(1, 5)).toBe('INSUFFICIENT_CREDITS')
    expect(checkGuestBookingAllowed(0, 5)).toBe('INSUFFICIENT_CREDITS')
  })

  it('returns INSUFFICIENT_CAPACITY when fewer than 2 seats are free', () => {
    expect(checkGuestBookingAllowed(5, 1)).toBe('INSUFFICIENT_CAPACITY')
    expect(checkGuestBookingAllowed(5, 0)).toBe('INSUFFICIENT_CAPACITY')
  })

  it('checks credits before capacity', () => {
    expect(checkGuestBookingAllowed(1, 0)).toBe('INSUFFICIENT_CREDITS')
  })
})
