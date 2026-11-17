import { describe, it, expect } from 'vitest'
import { moveInQueue } from './waitlistOrder'

describe('moveInQueue', () => {
  const queue = ['a', 'b', 'c', 'd']

  it('sube una entrada al primer lugar', () => {
    expect(moveInQueue(queue, 'c', 1)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('sube una posición', () => {
    expect(moveInQueue(queue, 'c', 2)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('baja una posición', () => {
    expect(moveInQueue(queue, 'b', 3)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('baja al último lugar', () => {
    expect(moveInQueue(queue, 'a', 4)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('no cambia nada si ya está en esa posición', () => {
    expect(moveInQueue(queue, 'b', 2)).toEqual(queue)
  })

  it('no modifica el arreglo original', () => {
    const copy = [...queue]
    moveInQueue(queue, 'd', 1)
    expect(queue).toEqual(copy)
  })

  it('rechaza una posición fuera de rango', () => {
    expect(moveInQueue(queue, 'b', 0)).toBeNull()
    expect(moveInQueue(queue, 'b', 5)).toBeNull()
    expect(moveInQueue(queue, 'b', 1.5)).toBeNull()
  })

  it('rechaza una entrada que no está en la cola', () => {
    expect(moveInQueue(queue, 'z', 1)).toBeNull()
  })
})
