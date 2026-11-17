import { describe, it, expect } from 'vitest'
import { topAxes, monthFullName, monthShortName, monthDeltaText, plural } from './display'
import type { Axis } from './profiles'

describe('topAxes', () => {
  it('devuelve los ejes mayores en orden, ignorando ceros', () => {
    const mix: Record<Axis, number> = {
      fuerza: 0.6,
      flexibilidad: 0.4,
      equilibrio: 0.5,
      core: 1,
      energia: 0.3,
      calma: 0,
    }
    expect(topAxes(mix, 2)).toEqual(['core', 'fuerza'])
  })

  it('con un solo eje distinto de cero devuelve solo ese', () => {
    const mix: Record<Axis, number> = {
      fuerza: 0,
      flexibilidad: 0,
      equilibrio: 0,
      core: 0,
      energia: 0,
      calma: 1,
    }
    expect(topAxes(mix, 2)).toEqual(['calma'])
  })
})

describe('nombres de mes', () => {
  it('convierte la etiqueta "sep 2026" a nombre completo y corto', () => {
    expect(monthFullName('sep 2026')).toBe('septiembre')
    expect(monthShortName('sep 2026')).toBe('Sep')
  })

  it('etiqueta desconocida: devuelve la etiqueta tal cual', () => {
    expect(monthFullName('xyz')).toBe('xyz')
  })
})

describe('monthDeltaText', () => {
  it('más que el mes anterior: +N min vs. mes', () => {
    expect(monthDeltaText(60, 40, 'sep 2026')).toBe('+20 min vs. septiembre')
  })

  it('igual: lo dice sin signo', () => {
    expect(monthDeltaText(40, 40, 'sep 2026')).toBe('Igual que en septiembre')
  })

  it('menos: no muestra comparación (sin restar ni culpar)', () => {
    expect(monthDeltaText(10, 40, 'sep 2026')).toBeNull()
  })

  it('este mes en cero y el anterior con minutos: sin comparación', () => {
    expect(monthDeltaText(0, 40, 'sep 2026')).toBeNull()
  })

  it('ambos en cero: sin comparación', () => {
    expect(monthDeltaText(0, 0, 'sep 2026')).toBeNull()
  })
})

describe('plural', () => {
  it('elige singular o plural', () => {
    expect(plural(1, 'clase', 'clases')).toBe('1 clase')
    expect(plural(0, 'clase', 'clases')).toBe('0 clases')
    expect(plural(3, 'semana', 'semanas')).toBe('3 semanas')
  })
})
