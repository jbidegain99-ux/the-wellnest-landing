import { describe, it, expect } from 'vitest'
import type { AttendedClass } from '../summary'
import type { BadgeState } from './types'
import { evaluateBadges, monthlyTarget, currentChallenge, nextBadges, recentBadges } from './evaluate'

const NOW = new Date('2026-10-24T18:00:00Z') // sábado 24-oct SV
const DAY_MS = 24 * 3600 * 1000
const OCT_2026 = 2026 * 12 + 9

function cls(dateISO: string, slug: string, min = 60, classType: string | null = null): AttendedClass {
  return {
    classId: `c-${dateISO}-${slug}`,
    dateTime: new Date(dateISO),
    durationMin: min,
    disciplineSlug: slug,
    disciplineName: slug,
    classType,
  }
}

/** `n` clases diarias desde `startISO`, a la misma hora. */
function daily(startISO: string, n: number, slug = 'pilates'): AttendedClass[] {
  const start = new Date(startISO).getTime()
  return Array.from({ length: n }, (_, i) => cls(new Date(start + i * DAY_MS).toISOString(), slug))
}

function byId(badges: BadgeState[], id: string): BadgeState {
  const b = badges.find((x) => x.id === id)
  if (!b) throw new Error(`no existe ${id}`)
  return b
}

describe('evaluateBadges', () => {
  it('sin clases', () => {
    const badges = evaluateBadges([], NOW)
    const first = byId(badges, 'clases-1')
    expect(first.earnedAt).toBeNull()
    expect(first.current).toBe(0)
    expect(first.label).toBe('1')
    const reto = byId(badges, 'reto-2026-10')
    expect(reto.target).toBe(4)
    expect(reto.label).toBe('OCT')
    expect(reto.title).toBe('Reto de octubre')
    expect(reto.description).toBe('Toma 4 clases en octubre de 2026.')
    expect(badges.filter((b) => b.earnedAt !== null)).toHaveLength(0)
    // Clases: solo las próximas 3
    expect(badges.filter((b) => b.category === 'clases').map((b) => b.id)).toEqual([
      'clases-1',
      'clases-5',
      'clases-10',
    ])
  })

  it('ids únicos y en el orden de categorías', () => {
    const badges = evaluateBadges(daily('2026-09-01T15:00:00Z', 30), NOW)
    const ids = badges.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    const cats = badges.map((b) => b.category)
    const firstIdx = (c: string) => cats.indexOf(c as BadgeState['category'])
    expect(firstIdx('clases')).toBeLessThan(firstIdx('disciplinas'))
    expect(firstIdx('disciplinas')).toBeLessThan(firstIdx('constancia'))
    expect(firstIdx('reto')).toBeLessThan(firstIdx('exploradora'))
    expect(firstIdx('calma')).toBeLessThan(firstIdx('momentos'))
  })

  it('25 clases de pilates', () => {
    const classes = daily('2026-09-01T15:00:00Z', 25)
    const badges = evaluateBadges(classes, NOW)
    expect(byId(badges, 'clases-25').earnedAt).toBe(classes[24].dateTime.toISOString())
    expect(byId(badges, 'clases-25').tier).toBe(4)
    expect(byId(badges, 'clases-1').tier).toBe(1)
    const pil = byId(badges, 'disciplina-pilates-25')
    expect(pil.earnedAt).toBe(classes[24].dateTime.toISOString())
    expect(pil.discipline).toBe('pilates')
    expect(pil.glyph).toBe('pilates')
    expect(byId(badges, 'disciplina-pilates-50').earnedAt).toBeNull()
    expect(byId(badges, 'disciplina-pilates-50').current).toBe(25)
    const pole = byId(badges, 'disciplina-pole-1')
    expect(pole.earnedAt).toBeNull()
    expect(pole.current).toBe(0)
    // Clases: ganadas + próximas 3
    expect(badges.filter((b) => b.category === 'clases').map((b) => b.id)).toEqual([
      'clases-1',
      'clases-5',
      'clases-10',
      'clases-25',
      'clases-50',
      'clases-75',
      'clases-100',
    ])
  })

  it('después de 500, umbrales cada +100 con tier 5', () => {
    const classes = daily('2025-01-01T15:00:00Z', 501)
    const now = new Date('2026-12-31T12:00:00Z')
    const ids = evaluateBadges(classes, now)
      .filter((b) => b.category === 'clases')
      .map((b) => b.id)
    expect(ids.slice(-4)).toEqual(['clases-500', 'clases-600', 'clases-700', 'clases-800'])
    const b700 = byId(evaluateBadges(classes, now), 'clases-700')
    expect(b700.tier).toBe(5)
    expect(b700.current).toBe(501)
  })

  it('aro-telas cuenta para aro y telas', () => {
    const badges = evaluateBadges([cls('2026-10-20T15:00:00Z', 'aro-telas')], NOW)
    expect(byId(badges, 'disciplina-aro-1').earnedAt).toBe('2026-10-20T15:00:00.000Z')
    expect(byId(badges, 'disciplina-telas-1').earnedAt).toBe('2026-10-20T15:00:00.000Z')
    expect(byId(badges, 'exploradora-3').current).toBe(2)
    expect(byId(badges, 'exploradora-3').earnedAt).toBeNull()
    expect(badges.some((b) => b.id.includes('aro-telas'))).toBe(false)
  })

  it('exploradora 7 con las 7 disciplinas', () => {
    const slugs = ['pole', 'pilates', 'yoga', 'aro-telas', 'soundbath', 'baile']
    const classes = slugs.map((s, i) => cls(`2026-10-${10 + i}T15:00:00Z`, s))
    const badges = evaluateBadges(classes, NOW)
    expect(byId(badges, 'exploradora-3').earnedAt).toBe('2026-10-12T15:00:00.000Z')
    expect(byId(badges, 'exploradora-5').earnedAt).toBe('2026-10-13T15:00:00.000Z')
    expect(byId(badges, 'exploradora-7').earnedAt).toBe('2026-10-15T15:00:00.000Z')
  })

  it('racha: se gana con la mejor racha; el avance de las no ganadas es la racha actual', () => {
    // Miércoles de semanas 1, 2, 3, (4 vacía), 5, 6
    const classes = ['2026-08-05', '2026-08-12', '2026-08-19', '2026-09-02', '2026-09-09'].map((d) =>
      cls(`${d}T15:00:00Z`, 'pole')
    )
    const inWeek6 = new Date('2026-09-10T18:00:00Z') // jueves de la semana 6
    const badges = evaluateBadges(classes, inWeek6)
    const r2 = byId(badges, 'racha-2')
    expect(r2.earnedAt).toBe('2026-08-12T15:00:00.000Z')
    expect(r2.current).toBe(2)
    const r4 = byId(badges, 'racha-4')
    expect(r4.earnedAt).toBeNull()
    expect(r4.current).toBe(2)
    expect(r4.label).toBe('4')
  })

  it('racha: la semana en curso sin clase todavía no corta la racha', () => {
    const classes = ['2026-09-02', '2026-09-09'].map((d) => cls(`${d}T15:00:00Z`, 'pole'))
    const inWeek7 = new Date('2026-09-15T18:00:00Z') // martes de la semana siguiente, sin clase aún
    expect(byId(evaluateBadges(classes, inWeek7), 'racha-4').current).toBe(2)
  })

  it('racha: sin clase la semana pasada ni esta, el avance vuelve a 0 y lo ganado se queda', () => {
    const classes = ['2026-08-05', '2026-08-12', '2026-08-19'].map((d) => cls(`${d}T15:00:00Z`, 'pole'))
    const badges = evaluateBadges(classes, NOW)
    expect(byId(badges, 'racha-2').earnedAt).toBe('2026-08-12T15:00:00.000Z')
    expect(byId(badges, 'racha-2').current).toBe(2)
    expect(byId(badges, 'racha-4').earnedAt).toBeNull()
    expect(byId(badges, 'racha-4').current).toBe(0)
  })

  it('racha: dos clases la misma semana cuentan como una semana', () => {
    const classes = [
      cls('2026-10-13T15:00:00Z', 'pole'),
      cls('2026-10-20T15:00:00Z', 'pole'),
      cls('2026-10-22T15:00:00Z', 'yoga'),
    ]
    expect(byId(evaluateBadges(classes, NOW), 'racha-4').current).toBe(2)
  })

  it('semanas activas: 150 min activos en una semana; la calma no cuenta', () => {
    const active = [
      cls('2026-10-19T15:00:00Z', 'pole'),
      cls('2026-10-20T15:00:00Z', 'pole'),
      cls('2026-10-21T15:00:00Z', 'pole', 30),
    ]
    const badges = evaluateBadges(active, NOW)
    expect(byId(badges, 'semanas-1').earnedAt).toBe('2026-10-21T15:00:00.000Z')

    const calm = [
      cls('2026-10-19T15:00:00Z', 'soundbath'),
      cls('2026-10-20T15:00:00Z', 'soundbath'),
      cls('2026-10-21T15:00:00Z', 'soundbath'),
    ]
    expect(byId(evaluateBadges(calm, NOW), 'semanas-1').earnedAt).toBeNull()
  })

  it('calma: minutos × peso de calma', () => {
    const badges = evaluateBadges(
      [cls('2026-10-19T15:00:00Z', 'soundbath'), cls('2026-10-20T15:00:00Z', 'yoga')],
      NOW
    )
    expect(byId(badges, 'calma-60').earnedAt).toBe('2026-10-19T15:00:00.000Z')
    // 60 + 60 × 0.7 = 102
    expect(byId(badges, 'calma-180').current).toBe(102)
    expect(byId(badges, 'calma-180').label).toBe('180')
  })

  it('monthlyTarget', () => {
    const jul = daily('2026-07-01T15:00:00Z', 6)
    const aug = daily('2026-08-01T15:00:00Z', 8)
    const sep = daily('2026-09-01T15:00:00Z', 10)
    expect(monthlyTarget([...jul, ...aug, ...sep], OCT_2026)).toBe(9)
    const many = [
      ...daily('2026-07-01T15:00:00Z', 30),
      ...daily('2026-08-01T15:00:00Z', 30),
      ...daily('2026-09-01T15:00:00Z', 30),
    ]
    expect(monthlyTarget(many, OCT_2026)).toBe(20)
    expect(monthlyTarget([], OCT_2026)).toBe(4)
    // 10/10/10 → 11 (sin error de coma flotante)
    const ten = [
      ...daily('2026-07-01T15:00:00Z', 10),
      ...daily('2026-08-01T15:00:00Z', 10),
      ...daily('2026-09-01T15:00:00Z', 10),
    ]
    expect(monthlyTarget(ten, OCT_2026)).toBe(11)
    // Solo un mes con 3 clases: (0+0+3)/3 × 1.1 → 2 → mínimo 4
    expect(monthlyTarget(daily('2026-09-01T15:00:00Z', 3), OCT_2026)).toBe(4)
    // Las clases del mismo mes o posteriores no cuentan
    expect(monthlyTarget(daily('2026-10-01T15:00:00Z', 20), OCT_2026)).toBe(4)
  })

  it('reto: el mes no logrado no aparece; el logrado sí', () => {
    const missed = evaluateBadges(daily('2026-09-01T15:00:00Z', 2), NOW)
    expect(missed.some((b) => b.id === 'reto-2026-09')).toBe(false)
    expect(missed.filter((b) => b.category === 'reto').map((b) => b.id)).toEqual(['reto-2026-10'])

    const sep = daily('2026-09-01T15:00:00Z', 4)
    const won = evaluateBadges(sep, NOW)
    const reto = byId(won, 'reto-2026-09')
    expect(reto.earnedAt).toBe(sep[3].dateTime.toISOString())
    expect(reto.tier).toBe(4)
    expect(reto.label).toBe('SEP')
    // Octubre: meta = ceil((0+0+4)/3 × 1.1) = 2 → 4
    const oct = byId(won, 'reto-2026-10')
    expect(oct.target).toBe(4)
    expect(oct.current).toBe(0)
    expect(oct.earnedAt).toBeNull()
  })

  it('reto del mes en curso ganado', () => {
    const oct = daily('2026-10-01T15:00:00Z', 5)
    const reto = byId(evaluateBadges(oct, NOW), 'reto-2026-10')
    expect(reto.earnedAt).toBe(oct[3].dateTime.toISOString())
    expect(reto.current).toBe(4)
  })

  it('momentos: mañanera antes de las 9:00 SV', () => {
    const early = evaluateBadges([cls('2026-10-20T14:30:00Z', 'pole')], NOW)
    expect(byId(early, 'momento-manianera').current).toBe(1)
    const nine = evaluateBadges([cls('2026-10-20T15:00:00Z', 'pole')], NOW)
    expect(byId(nine, 'momento-manianera').current).toBe(0)
    expect(byId(early, 'momento-manianera').label).toBeUndefined()
    expect(byId(early, 'momento-manianera').tier).toBe(3)
  })

  it('momentos: atardecer desde las 19:00 SV', () => {
    const at19 = evaluateBadges([cls('2026-10-21T01:00:00Z', 'pole')], NOW) // 20-oct 19:00 SV
    expect(byId(at19, 'momento-atardecer').current).toBe(1)
    const at1859 = evaluateBadges([cls('2026-10-21T00:59:00Z', 'pole')], NOW)
    expect(byId(at1859, 'momento-atardecer').current).toBe(0)
  })

  it('momentos: fin de semana en hora SV', () => {
    const now = new Date('2026-10-27T18:00:00Z')
    const badges = evaluateBadges([cls('2026-10-26T05:30:00Z', 'pole')], now) // dom 25-oct 23:30 SV
    expect(byId(badges, 'momento-finde').current).toBe(1)
    const monday = evaluateBadges([cls('2026-10-26T12:00:00Z', 'pole')], now)
    expect(byId(monday, 'momento-finde').current).toBe(0)
  })

  it('momentos: doble sesión y semana completa', () => {
    const badges = evaluateBadges(
      [
        cls('2026-10-19T15:00:00Z', 'pole'),
        cls('2026-10-19T22:00:00Z', 'yoga'),
        cls('2026-10-21T15:00:00Z', 'pole'),
        cls('2026-10-23T15:00:00Z', 'pole'),
      ],
      NOW
    )
    expect(byId(badges, 'momento-doble').earnedAt).toBe('2026-10-19T22:00:00.000Z')
    expect(byId(badges, 'momento-semana-completa').earnedAt).toBe('2026-10-23T15:00:00.000Z')

    const spread = evaluateBadges(
      [cls('2026-10-23T15:00:00Z', 'pole'), cls('2026-10-24T15:00:00Z', 'pole'), cls('2026-10-26T15:00:00Z', 'pole')],
      new Date('2026-10-27T00:00:00Z')
    )
    expect(byId(spread, 'momento-semana-completa').current).toBe(2)
    expect(byId(spread, 'momento-doble').current).toBe(1)
  })

  it('aniversario', () => {
    const badges = evaluateBadges(
      [cls('2025-10-01T15:00:00Z', 'pole'), cls('2026-10-02T15:00:00Z', 'pole')],
      NOW
    )
    const a1 = byId(badges, 'aniversario-1')
    expect(a1.earnedAt).toBe('2026-10-02T15:00:00.000Z')
    expect(a1.tier).toBe(5)
    expect(a1.category).toBe('momentos')
    expect(a1.label).toBe('1')
    const a2 = byId(badges, 'aniversario-2')
    expect(a2.earnedAt).toBeNull()
    expect(a2.current).toBe(1)

    const short = evaluateBadges(
      [cls('2025-10-01T15:00:00Z', 'pole'), cls('2026-09-30T15:00:00Z', 'pole')],
      NOW
    )
    expect(byId(short, 'aniversario-1').earnedAt).toBeNull()
  })

  it('ignora clases futuras', () => {
    const badges = evaluateBadges([cls('2026-10-25T15:00:00Z', 'pole')], NOW)
    expect(byId(badges, 'clases-1').earnedAt).toBeNull()
  })

  it('disciplina desconocida suma a Clases sin crear fila', () => {
    const badges = evaluateBadges([cls('2026-10-20T15:00:00Z', 'nueva')], NOW)
    expect(byId(badges, 'clases-1').earnedAt).toBe('2026-10-20T15:00:00.000Z')
    expect(badges.some((b) => b.id.includes('nueva'))).toBe(false)
    expect(badges.filter((b) => b.category === 'disciplinas').every((b) => b.earnedAt === null)).toBe(true)
    expect(byId(badges, 'exploradora-3').current).toBe(0)
    expect(badges.filter((b) => b.category === 'disciplinas')).toHaveLength(35)
  })
})

function badge(id: string, current: number, target: number, extra: Partial<BadgeState> = {}): BadgeState {
  return {
    id,
    category: 'clases',
    title: id,
    description: id,
    tier: 1,
    target,
    current,
    earnedAt: null,
    glyph: 'clases',
    ...extra,
  }
}

describe('nextBadges', () => {
  it('ordena por porcentaje, desempata por meta y excluye reto y ganadas', () => {
    const list = [
      badge('cero-chica', 0, 3),
      badge('mitad', 5, 10),
      badge('tres-cuartos', 3, 4),
      badge('mitad-chica', 1, 2),
      badge('ganada', 10, 10, { earnedAt: '2026-10-01T00:00:00.000Z' }),
      badge('reto', 3, 4, { category: 'reto', glyph: 'reto' }),
      badge('cero-grande', 0, 1),
    ]
    expect(nextBadges(list, 10).map((b) => b.id)).toEqual([
      'tres-cuartos',
      'mitad-chica',
      'mitad',
      'cero-grande',
      'cero-chica',
    ])
    expect(nextBadges(list, 2).map((b) => b.id)).toEqual(['tres-cuartos', 'mitad-chica'])
  })
})

describe('recentBadges', () => {
  it('ganadas por fecha desc', () => {
    const list = [
      badge('a', 1, 1, { earnedAt: '2026-10-01T00:00:00.000Z' }),
      badge('b', 0, 1),
      badge('c', 1, 1, { earnedAt: '2026-10-05T00:00:00.000Z' }),
      badge('d', 1, 1, { earnedAt: '2026-09-05T00:00:00.000Z', category: 'reto', glyph: 'reto' }),
    ]
    expect(recentBadges(list, 5).map((b) => b.id)).toEqual(['c', 'a', 'd'])
    expect(recentBadges(list, 1).map((b) => b.id)).toEqual(['c'])
  })
})

describe('currentChallenge', () => {
  it('reto del mes en curso con días que quedan (incluye hoy)', () => {
    const badges = evaluateBadges(daily('2026-10-01T15:00:00Z', 2), NOW)
    const ch = currentChallenge(badges, NOW)
    expect(ch.id).toBe('reto-2026-10')
    expect(ch.current).toBe(2)
    expect(ch.daysLeft).toBe(8) // 24 al 31 de octubre
    const lastDay = new Date('2026-11-01T05:00:00Z') // 31-oct 23:00 SV
    expect(currentChallenge(evaluateBadges([], lastDay), lastDay).daysLeft).toBe(1)
  })
})
