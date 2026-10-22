import { describe, it, expect } from 'vitest'
import { sortByLastName } from './guestList'

describe('sortByLastName', () => {
  it('ordena por apellido (última palabra), luego nombre, sin importar tildes', () => {
    const rows = [{ buyerName: 'Ana Martínez' }, { buyerName: 'Luis Álvarez' }, { buyerName: 'Carlos Martinez' }, { buyerName: 'Zoe' }]
    expect(sortByLastName(rows).map((r) => r.buyerName)).toEqual(['Luis Álvarez', 'Ana Martínez', 'Carlos Martinez', 'Zoe'])
  })
})
