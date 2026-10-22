import { describe, it, expect } from 'vitest'
import { canBuy } from './catalog'

const E = { isActive: true, ticketsEnabled: true, salesOpen: true, startsAt: new Date('2026-10-31T00:30:00Z') }
const NOW = new Date('2026-10-25T00:00:00Z')

describe('canBuy', () => {
  it('abierto', () => expect(canBuy(E, NOW)).toBe(true))
  it.each([['isActive'], ['ticketsEnabled'], ['salesOpen']] as const)('%s en false → no', (k) => expect(canBuy({ ...E, [k]: false }, NOW)).toBe(false))
  it('ya empezó → no', () => expect(canBuy(E, new Date('2026-10-31T00:30:00Z'))).toBe(false))
})
