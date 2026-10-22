import { describe, it, expect } from 'vitest'
import { ticketPhase } from './ticketView'

const EVENT = { endsAt: new Date('2026-10-31T05:59:00Z') }
const BEFORE = new Date('2026-10-30T20:00:00Z')
const AFTER = new Date('2026-10-31T06:00:00Z')
const T = { orderStatus: 'PAID' as const, claimedAt: new Date('2026-10-23T00:00:00Z'), checkedInAt: null as Date | null }

describe('ticketPhase', () => {
  it('ready', () => expect(ticketPhase(T, EVENT, BEFORE)).toBe('ready'))
  it('unclaimed', () => expect(ticketPhase({ ...T, claimedAt: null }, EVENT, BEFORE)).toBe('unclaimed'))
  it('cancelled antes', () => expect(ticketPhase({ ...T, orderStatus: 'CANCELLED' }, EVENT, BEFORE)).toBe('cancelled'))
  it('cancelled después también', () => expect(ticketPhase({ ...T, orderStatus: 'CANCELLED' }, EVENT, AFTER)).toBe('cancelled'))
  it('after-attended', () => expect(ticketPhase({ ...T, checkedInAt: new Date('2026-10-31T01:00:00Z') }, EVENT, AFTER)).toBe('after-attended'))
  it('after-missed', () => expect(ticketPhase(T, EVENT, AFTER)).toBe('after-missed'))
  it('sin reclamar después del show → after-missed', () => expect(ticketPhase({ ...T, claimedAt: null }, EVENT, AFTER)).toBe('after-missed'))
  it('durante el show con check-in sigue en ready', () =>
    expect(ticketPhase({ ...T, checkedInAt: new Date('2026-10-31T01:00:00Z') }, EVENT, new Date('2026-10-31T02:00:00Z'))).toBe('ready'))
})
