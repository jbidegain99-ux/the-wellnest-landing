import { describe, it, expect } from 'vitest'
import {
  AXES,
  AXIS_LABELS,
  getDisciplineProfile,
  estimateActiveKcal,
  isActiveMet,
} from './profiles'

describe('getDisciplineProfile', () => {
  it('pole: MET 4.5, Intensa, foco con Tren superior', () => {
    const p = getDisciplineProfile('pole', null)
    expect(p.met).toBe(4.5)
    expect(p.intensity).toBe('Intensa')
    expect(p.focus).toContain('Tren superior')
  })

  it('pilates: core = 1', () => {
    expect(getDisciplineProfile('pilates', null).weights.core).toBe(1)
  })

  it('yoga sin tipo: 2.3 Suave', () => {
    const p = getDisciplineProfile('yoga', null)
    expect(p.met).toBe(2.3)
    expect(p.intensity).toBe('Suave')
  })

  it('yoga Vinyasa: 2.7 Moderada', () => {
    const p = getDisciplineProfile('yoga', 'Vinyasa✨')
    expect(p.met).toBe(2.7)
    expect(p.intensity).toBe('Moderada')
  })

  it('yoga Sculpt y Power: 3.0 Moderada', () => {
    expect(getDisciplineProfile('yoga', 'Sculpt').met).toBe(3.0)
    expect(getDisciplineProfile('yoga', 'Power Yóga').met).toBe(3.0)
    expect(getDisciplineProfile('yoga', 'Sculpt').intensity).toBe('Moderada')
  })

  it('soundbath: solo calma', () => {
    const p = getDisciplineProfile('soundbath', null)
    expect(p.weights.calma).toBe(1)
    for (const a of AXES.filter((x) => x !== 'calma')) expect(p.weights[a]).toBe(0)
  })

  it('slug desconocido: genérico', () => {
    const p = getDisciplineProfile('nuevo', null)
    expect(p.met).toBe(3.0)
    expect(p.focus).toEqual(['Movimiento'])
  })

  it('ejes y etiquetas', () => {
    expect(AXES).toEqual(['fuerza', 'flexibilidad', 'equilibrio', 'core', 'energia', 'calma'])
    expect(AXIS_LABELS.energia).toBe('Energía')
  })
})

describe('estimateActiveKcal', () => {
  it('2.8 MET, 50 min -> 80-110', () => {
    expect(estimateActiveKcal(2.8, 50)).toEqual({ min: 80, max: 110 })
  })
  it('MET 1.0 -> null', () => {
    expect(estimateActiveKcal(1.0, 55)).toBeNull()
  })
})

describe('isActiveMet', () => {
  it('umbral 1.5', () => {
    expect(isActiveMet(1.0)).toBe(false)
    expect(isActiveMet(1.5)).toBe(true)
  })
})
