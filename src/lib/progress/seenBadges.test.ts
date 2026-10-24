import { describe, it, expect } from 'vitest'
import { SEEN_BADGES_KEY, nextSeenList, readSeen, unseenBadges, writeSeen, type SeenStorage } from './seenBadges'

const DAY_MS = 24 * 3600 * 1000
const NOW = new Date('2026-10-24T18:00:00Z')

function ago(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString()
}

const earned = [
  { id: 'clases-1', earnedAt: ago(20) },
  { id: 'clases-5', earnedAt: ago(6) },
  { id: 'racha-2', earnedAt: ago(1) },
  { id: 'reto-2026-10', earnedAt: ago(8) },
]

function memoryStorage(initial: Record<string, string> = {}): SeenStorage & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v
    },
  }
}

const throwing: SeenStorage = {
  getItem: () => {
    throw new Error('bloqueado')
  },
  setItem: () => {
    throw new Error('bloqueado')
  },
}

describe('unseenBadges', () => {
  it('sin clave (primera vez en el dispositivo): solo lo ganado en los últimos 7 días, lo más nuevo primero', () => {
    expect(unseenBadges(earned, null, NOW)).toEqual(['racha-2', 'clases-5'])
  })

  it('con lista: todo lo que no esté en ella, sin importar la fecha', () => {
    expect(unseenBadges(earned, ['clases-5', 'racha-2'], NOW)).toEqual(['reto-2026-10', 'clases-1'])
    expect(unseenBadges(earned, earned.map((e) => e.id), NOW)).toEqual([])
    expect(unseenBadges(earned, [], NOW)).toEqual(['racha-2', 'clases-5', 'reto-2026-10', 'clases-1'])
  })

  it('sin ganados no hay nada que celebrar', () => {
    expect(unseenBadges([], null, NOW)).toEqual([])
  })
})

describe('readSeen / writeSeen', () => {
  it('sin clave devuelve null', () => {
    expect(readSeen(memoryStorage())).toBeNull()
  })

  it('guarda y lee la lista', () => {
    const s = memoryStorage()
    expect(writeSeen(['a', 'b'], s)).toBe(true)
    expect(JSON.parse(s.data[SEEN_BADGES_KEY])).toEqual(['a', 'b'])
    expect(readSeen(s)).toEqual(['a', 'b'])
  })

  it('usa la clave wellnest:logros:vistos', () => {
    expect(SEEN_BADGES_KEY).toBe('wellnest:logros:vistos')
  })

  it('un valor dañado se trata como sin clave; ignora lo que no sea texto', () => {
    expect(readSeen(memoryStorage({ [SEEN_BADGES_KEY]: '{no es json' }))).toBeNull()
    expect(readSeen(memoryStorage({ [SEEN_BADGES_KEY]: '{"a":1}' }))).toBeNull()
    expect(readSeen(memoryStorage({ [SEEN_BADGES_KEY]: '["a",2,null,"b"]' }))).toEqual(['a', 'b'])
  })

  it('si el almacenamiento falla no lanza: null al leer, false al escribir', () => {
    expect(readSeen(throwing)).toBeNull()
    expect(writeSeen(['a'], throwing)).toBe(false)
    expect(readSeen(null)).toBeNull()
    expect(writeSeen(['a'], null)).toBe(false)
  })
})

describe('nextSeenList', () => {
  it('sin clave: parte de lo que ya se da por visto (más de 7 días) y suma lo marcado', () => {
    expect(nextSeenList(null, earned, [], NOW).sort()).toEqual(['clases-1', 'reto-2026-10'])
    expect(nextSeenList(null, earned, ['racha-2'], NOW).sort()).toEqual(['clases-1', 'racha-2', 'reto-2026-10'])
  })

  it('con lista: suma lo marcado sin repetir', () => {
    expect(nextSeenList(['clases-1'], earned, ['racha-2', 'clases-1'], NOW)).toEqual(['clases-1', 'racha-2'])
  })

  it('olvida lo que ya salió de los recientes (no puede volver a aparecer)', () => {
    expect(nextSeenList(['viejo', 'clases-1'], earned, ['racha-2'], NOW)).toEqual(['clases-1', 'racha-2'])
  })

  it('al marcar todo, ya no queda nada sin ver', () => {
    const all = unseenBadges(earned, null, NOW)
    const next = nextSeenList(null, earned, all, NOW)
    expect(unseenBadges(earned, next, NOW)).toEqual([])
  })
})
