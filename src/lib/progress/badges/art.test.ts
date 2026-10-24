import { describe, it, expect } from 'vitest'
import { badgePngPath, badgesWithPng, renderBadgeSvg, type BadgeArtInput } from './art'
import { CATEGORY_ORDER, type BadgeCategory } from './types'

const SAMPLES: Record<BadgeCategory, BadgeArtInput> = {
  clases: { id: 'clases-25', category: 'clases', tier: 4, glyph: 'clases', label: '25' },
  disciplinas: {
    id: 'disciplina-yoga-10',
    category: 'disciplinas',
    tier: 2,
    glyph: 'yoga',
    label: '10',
    discipline: 'yoga',
  },
  constancia: { id: 'racha-8', category: 'constancia', tier: 3, glyph: 'racha', label: '8' },
  semanas: { id: 'semanas-5', category: 'semanas', tier: 2, glyph: 'sol', label: '5' },
  reto: { id: 'reto-2026-10', category: 'reto', tier: 4, glyph: 'reto', label: 'OCT' },
  exploradora: { id: 'exploradora-3', category: 'exploradora', tier: 1, glyph: 'brujula', label: '3' },
  calma: { id: 'calma-600', category: 'calma', tier: 3, glyph: 'loto', label: '600' },
  momentos: { id: 'momento-manianera', category: 'momentos', tier: 3, glyph: 'manianera' },
}

function gradientIds(svg: string): string[] {
  return Array.from(svg.matchAll(/<(?:linearGradient|radialGradient|clipPath)[^>]*\sid="([^"]+)"/g)).map((m) => m[1])
}

function outline(svg: string): string | null {
  const m = svg.match(/<path[^>]*data-part="outline"[^>]*\sd="([^"]+)"/)
  return m ? m[1] : null
}

describe('renderBadgeSvg', () => {
  it('produce un SVG completo con viewBox 120', () => {
    const svg = renderBadgeSvg(SAMPLES.clases, { locked: false })
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('viewBox="0 0 120 120"')
    expect(svg.trim().endsWith('</svg>')).toBe(true)
  })

  it('usa el tamaño pedido', () => {
    const svg = renderBadgeSvg(SAMPLES.clases, { locked: false, size: 72 })
    expect(svg).toContain('width="72"')
    expect(svg).toContain('height="72"')
  })

  it('dos insignias distintas no comparten ids de degradado', () => {
    const a = gradientIds(renderBadgeSvg(SAMPLES.clases, { locked: false }))
    const b = gradientIds(renderBadgeSvg(SAMPLES.constancia, { locked: false }))
    expect(a.length).toBeGreaterThan(0)
    expect(b.length).toBeGreaterThan(0)
    expect(a.filter((id) => b.includes(id))).toEqual([])
  })

  it('la misma insignia ganada y bloqueada no comparte ids', () => {
    const a = gradientIds(renderBadgeSvg(SAMPLES.calma, { locked: false }))
    const b = gradientIds(renderBadgeSvg(SAMPLES.calma, { locked: true, progress: 0.3 }))
    expect(a.filter((id) => b.includes(id))).toEqual([])
  })

  it('cada id de degradado referenciado existe en el SVG', () => {
    for (const cat of CATEGORY_ORDER) {
      const svg = renderBadgeSvg(SAMPLES[cat], { locked: false })
      const ids = new Set(gradientIds(svg))
      const refs = Array.from(svg.matchAll(/url\(#([^)]+)\)/g)).map((m) => m[1])
      for (const ref of refs) expect(ids.has(ref)).toBe(true)
    }
  })

  it('bloqueada con progreso muestra el arco y no el brillo', () => {
    const svg = renderBadgeSvg(SAMPLES.clases, { locked: true, progress: 0.5 })
    expect(svg).toContain('data-part="progress"')
    expect(svg).not.toContain('data-part="sheen"')
  })

  it('bloqueada sin progreso no dibuja arco', () => {
    const svg = renderBadgeSvg(SAMPLES.clases, { locked: true, progress: 0 })
    expect(svg).not.toContain('data-part="progress"')
  })

  it('ganada tiene brillo y no arco', () => {
    const svg = renderBadgeSvg(SAMPLES.clases, { locked: false, progress: 0.5 })
    expect(svg).toContain('data-part="sheen"')
    expect(svg).not.toContain('data-part="progress"')
  })

  it('cada categoría tiene una forma distinta', () => {
    const shapes = CATEGORY_ORDER.map((cat) => outline(renderBadgeSvg(SAMPLES[cat], { locked: false })))
    for (const s of shapes) expect(s).toBeTruthy()
    expect(new Set(shapes).size).toBe(CATEGORY_ORDER.length)
  })

  it('la forma bloqueada es la misma silueta que la ganada', () => {
    for (const cat of CATEGORY_ORDER) {
      expect(outline(renderBadgeSvg(SAMPLES[cat], { locked: true }))).toBe(
        outline(renderBadgeSvg(SAMPLES[cat], { locked: false }))
      )
    }
  })

  it('no rompe con etiquetas largas ni glifos sin etiqueta', () => {
    const svg = renderBadgeSvg({ ...SAMPLES.clases, id: 'clases-2000', label: '2000' }, { locked: false })
    expect(svg).toContain('data-part="label"')
    const plain = renderBadgeSvg(SAMPLES.momentos, { locked: false })
    expect(plain).not.toContain('data-part="label"')
    expect(plain).toContain('data-part="glyph"')
  })
})

describe('badgePngPath', () => {
  it('reto usa la abreviatura del mes', () => {
    expect(badgePngPath({ id: 'reto-2026-10', category: 'reto' })).toBe('/images/badges/reto-oct.png')
    expect(badgePngPath({ id: 'reto-2027-01', category: 'reto' })).toBe('/images/badges/reto-ene.png')
  })

  it('ids del catálogo fijo tienen PNG', () => {
    expect(badgePngPath({ id: 'disciplina-pole-25', category: 'disciplinas' })).toBe(
      '/images/badges/disciplina-pole-25.png'
    )
    expect(badgePngPath({ id: 'momento-doble', category: 'momentos' })).toBe('/images/badges/momento-doble.png')
    expect(badgePngPath({ id: 'clases-2000', category: 'clases' })).toBe('/images/badges/clases-2000.png')
  })

  it('sin PNG devuelve null', () => {
    expect(badgePngPath({ id: 'clases-2100', category: 'clases' })).toBeNull()
    expect(badgePngPath({ id: 'desconocida', category: 'momentos' })).toBeNull()
  })

  it('todas las insignias con PNG tienen ruta y no se repiten', () => {
    const list = badgesWithPng()
    const files = list.map((b) => b.file)
    expect(new Set(files).size).toBe(files.length)
    expect(files).toContain('reto-ene')
    expect(files).toContain('reto-dic')
    expect(files).toContain('clases-2000')
    expect(files).not.toContain('clases-2100')
  })
})
