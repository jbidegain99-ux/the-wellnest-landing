import { describe, it, expect } from 'vitest'
import { buildClassSummaryEmail, newBadgesFrom, type ClassSummaryEmailData } from './classSummaryEmail'
import type { BadgeState } from './badges/types'

const UNSUB = 'https://wellneststudio.net/correo/baja/confirmar?u=u1&t=abc123'

function data(overrides: Partial<ClassSummaryEmailData> = {}): ClassSummaryEmailData {
  return {
    firstName: 'Ana',
    classes: [
      {
        disciplineName: 'Pole Fitness',
        classType: null,
        // Sábado 24-oct-2026, 9:00 en El Salvador
        startsAt: '2026-10-24T15:00:00.000Z',
        minutes: 60,
        intensity: 'Intensa',
        focus: ['Tren superior', 'Agarre', 'Core'],
        calm: false,
      },
    ],
    week: { activeMinutes: 90, targetMinutes: 150 },
    streakWeeks: 3,
    newBadges: [],
    nextBadge: { title: '10 clases', current: 7, target: 10, imageUrl: 'https://wellneststudio.net/images/badges/clases-10.png' },
    progressUrl: 'https://wellneststudio.net/perfil/progreso',
    unsubscribeUrl: UNSUB,
    ...overrides,
  }
}

const calmClass: ClassSummaryEmailData['classes'][number] = {
  disciplineName: 'Terapia de Sonido',
  classType: null,
  startsAt: '2026-10-24T01:00:00.000Z',
  minutes: 60,
  intensity: 'Calma',
  focus: ['Relajación', 'Respiración'],
  calm: true,
}

describe('buildClassSummaryEmail', () => {
  it('asunto con la disciplina de la clase más reciente', () => {
    const { subject } = buildClassSummaryEmail(data())
    expect(subject).toBe('Tu resumen de Pole Fitness')
  })

  it('incluye el botón a Mi progreso y el enlace de baja', () => {
    const { html } = buildClassSummaryEmail(data())
    expect(html).toContain('href="https://wellneststudio.net/perfil/progreso"')
    expect(html).toContain('Ver mi progreso')
    expect(html).toContain(`href="${UNSUB.replace(/&/g, '&amp;')}"`)
    expect(html).toContain('Ya no quiero estos resúmenes')
  })

  it('saluda con el primer nombre y escapa el HTML del nombre', () => {
    expect(buildClassSummaryEmail(data()).html).toContain('Ana')
    const { html } = buildClassSummaryEmail(data({ firstName: '<script>alert(1)</script>' }))
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapa también disciplina y tipo de clase', () => {
    const { html } = buildClassSummaryEmail(
      data({
        classes: [{ ...data().classes[0], disciplineName: '<b>Pole</b>', classType: '<i>Nivel 1</i>' }],
      })
    )
    expect(html).not.toContain('<b>Pole</b>')
    expect(html).not.toContain('<i>Nivel 1</i>')
    expect(html).toContain('&lt;b&gt;Pole&lt;/b&gt;')
  })

  it('muestra hora de El Salvador, minutos, intensidad y foco', () => {
    const { html } = buildClassSummaryEmail(data())
    expect(html).toContain('sáb 24 oct · 9:00 a. m.')
    expect(html).toContain('60 min')
    expect(html).toContain('Intensa')
    expect(html).toContain('Tren superior · Agarre · Core')
    expect(html).toContain('90 de 150 min')
    expect(html).toContain('3 semanas seguidas')
  })

  it('clase de calma: dice "Clase de calma" y no habla de minutos activos', () => {
    const { html } = buildClassSummaryEmail(
      data({ classes: [calmClass], week: { activeMinutes: 0, targetMinutes: 150 } })
    )
    expect(html).toContain('Clase de calma')
    expect(html).not.toMatch(/min(utos)? activos/i)
    // Viernes 23-oct, 19:00 en El Salvador
    expect(html).toContain('vie 23 oct · 7:00 p. m.')
  })

  it('una clase activa sí suma minutos activos', () => {
    expect(buildClassSummaryEmail(data()).html).toContain('+60 min activos')
  })

  it('nunca menciona calorías', () => {
    const { html, subject } = buildClassSummaryEmail(
      data({ classes: [data().classes[0], calmClass] })
    )
    expect(`${subject} ${html}`).not.toMatch(/kcal|calor/i)
  })

  it('varias clases: destaca la más reciente y lista las demás', () => {
    const { html, subject } = buildClassSummaryEmail(data({ classes: [data().classes[0], calmClass] }))
    expect(subject).toBe('Tu resumen de Pole Fitness')
    expect(html).toContain('También sumaste')
    expect(html).toContain('Terapia de Sonido')
  })

  it('logros nuevos con imagen absoluta, ancho/alto y alt', () => {
    const { html } = buildClassSummaryEmail(
      data({
        newBadges: [
          { title: '10 clases', imageUrl: 'https://wellneststudio.net/images/badges/clases-10.png' },
          { title: 'Mañanera', imageUrl: null },
        ],
      })
    )
    expect(html).toContain('Ganaste 2 logros')
    expect(html).toMatch(/<img[^>]+src="https:\/\/wellneststudio\.net\/images\/badges\/clases-10\.png"[^>]+width="88"[^>]+height="88"[^>]+alt="10 clases"/)
    expect(html).toContain('Mañanera')
    // Con logros nuevos no se muestra el próximo
    expect(html).not.toContain('Tu próximo logro')
  })

  it('sin logros nuevos: muestra el próximo con su avance', () => {
    const { html } = buildClassSummaryEmail(data())
    expect(html).toContain('Tu próximo logro')
    expect(html).toContain('10 clases')
    expect(html).toContain('7 de 10')
  })

  it('sin nombre: saludo genérico', () => {
    expect(buildClassSummaryEmail(data({ firstName: '' })).html).toContain('¡Hola!')
  })
})

function badge(id: string, earnedAt: string | null): BadgeState {
  return {
    id,
    category: 'clases',
    title: id,
    description: '',
    tier: 1,
    target: 1,
    current: earnedAt ? 1 : 0,
    earnedAt,
    glyph: 'clases',
  }
}

describe('newBadgesFrom', () => {
  it('devuelve las ganadas en after que no estaban ganadas en before', () => {
    const before = [badge('a', '2026-10-01T00:00:00Z'), badge('b', null)]
    const after = [badge('a', '2026-10-01T00:00:00Z'), badge('b', '2026-10-24T15:00:00Z'), badge('c', '2026-10-24T15:00:00Z'), badge('d', null)]
    expect(newBadgesFrom(before, after).map((b) => b.id)).toEqual(['b', 'c'])
  })

  it('sin cambios: vacío', () => {
    const list = [badge('a', '2026-10-01T00:00:00Z')]
    expect(newBadgesFrom(list, list)).toEqual([])
  })
})
