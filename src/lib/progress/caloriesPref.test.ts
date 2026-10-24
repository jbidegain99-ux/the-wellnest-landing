import { describe, it, expect } from 'vitest'
import {
  SHOW_CALORIES_KEY,
  readShowCalories,
  writeShowCalories,
  type PrefStorage,
} from './caloriesPref'

function memoryStorage(initial: Record<string, string> = {}): PrefStorage & {
  data: Record<string, string>
} {
  const data: Record<string, string> = { ...initial }
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v
    },
  }
}

const throwingStorage: PrefStorage = {
  getItem: () => {
    throw new Error('SecurityError')
  },
  setItem: () => {
    throw new Error('QuotaExceededError')
  },
}

describe('preferencia de calorías', () => {
  it('usa la clave acordada', () => {
    expect(SHOW_CALORIES_KEY).toBe('wellnest:progreso:mostrarCalorias')
  })

  it('readShowCalories: false si no hay clave', () => {
    expect(readShowCalories(memoryStorage())).toBe(false)
  })

  it('readShowCalories: false si localStorage lanza', () => {
    expect(readShowCalories(throwingStorage)).toBe(false)
  })

  it('readShowCalories: false si no hay storage disponible', () => {
    expect(readShowCalories(null)).toBe(false)
  })

  it("readShowCalories: true solo con '1'", () => {
    expect(readShowCalories(memoryStorage({ [SHOW_CALORIES_KEY]: '1' }))).toBe(true)
    expect(readShowCalories(memoryStorage({ [SHOW_CALORIES_KEY]: '0' }))).toBe(false)
    expect(readShowCalories(memoryStorage({ [SHOW_CALORIES_KEY]: 'true' }))).toBe(false)
  })

  it("writeShowCalories(true) guarda '1' en la clave", () => {
    const s = memoryStorage()
    writeShowCalories(true, s)
    expect(s.data[SHOW_CALORIES_KEY]).toBe('1')
    expect(readShowCalories(s)).toBe(true)
  })

  it("writeShowCalories(false) guarda '0'", () => {
    const s = memoryStorage({ [SHOW_CALORIES_KEY]: '1' })
    writeShowCalories(false, s)
    expect(s.data[SHOW_CALORIES_KEY]).toBe('0')
    expect(readShowCalories(s)).toBe(false)
  })

  it('writeShowCalories no lanza si localStorage falla o no existe', () => {
    expect(() => writeShowCalories(true, throwingStorage)).not.toThrow()
    expect(() => writeShowCalories(true, null)).not.toThrow()
  })

  it('sin argumento (entorno sin localStorage) no lanza y lee false', () => {
    expect(() => writeShowCalories(true)).not.toThrow()
    expect(readShowCalories()).toBe(false)
  })
})
