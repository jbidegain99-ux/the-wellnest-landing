// Arte de las insignias: SVG generado por una función pura.
// La misma fuente sirve para la web (inline) y para los PNG del correo.
//
// Anatomía de una medalla ganada (de atrás hacia adelante):
//   borde metálico (degradado del tier) → escalón biselado → cara esmaltada
//   (degradado de la categoría o disciplina) → sombra interna → brillo diagonal
//   → glifo y número en relieve, del mismo metal que el borde.
// Bloqueada: la misma silueta en beige plano, glifo tenue y arco de progreso.
//
// Las letras y números se dibujan como trazos (monolínea redondeada, en la línea
// de Quicksand) para que el PNG rasterizado se vea igual que la web, sin
// depender de las fuentes instaladas en el servidor.

import { MONTH_LABELS } from '../time'
import {
  ACTIVE_WEEK_BADGES,
  ANNIVERSARY_BADGES,
  CALM_BADGES,
  CHALLENGE_TIER,
  DISCIPLINE_BADGES,
  EXPLORER_BADGES,
  MOMENT_BADGES,
  STREAK_BADGES,
  classBadgeDef,
  classThresholdAt,
} from './catalog'
import type { BadgeCategory, BadgeGlyph, BadgeState, BadgeTier } from './types'

export type BadgeArtInput = Pick<BadgeState, 'id' | 'category' | 'tier' | 'glyph' | 'label' | 'discipline'>

export interface BadgeArtOptions {
  locked: boolean
  /** Avance 0–1; solo se dibuja en bloqueadas. */
  progress?: number
  /** Ancho y alto en px del SVG (por defecto 120). */
  size?: number
  /** Se mezcla en el prefijo de ids: para pintar la misma insignia dos veces en una página. */
  idSuffix?: string
}

// ── Utilidades ────────────────────────────────────────────────────────────

const CX = 60
const CY = 60

function r2(x: number): string {
  return String(Math.round(x * 100) / 100)
}

/** Hash FNV-1a corto y determinista para prefijar ids. */
function shortHash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/** Círculo como path (sentido horario), para que todo sea `<path>`. */
function circlePath(cx: number, cy: number, r: number): string {
  return `M${r2(cx - r)} ${r2(cy)}A${r2(r)} ${r2(r)} 0 1 1 ${r2(cx + r)} ${r2(cy)}A${r2(r)} ${r2(r)} 0 1 1 ${r2(cx - r)} ${r2(cy)}Z`
}

interface Pt {
  x: number
  y: number
}

function polar(r: number, deg: number, cx = CX, cy = CY): Pt {
  const a = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

/** Polígono con esquinas redondeadas (curvas cuadráticas en cada vértice). */
function roundedPolygon(points: Pt[], radius: number): string {
  const n = points.length
  let d = ''
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n]
    const cur = points[i]
    const next = points[(i + 1) % n]
    const toPrev = { x: prev.x - cur.x, y: prev.y - cur.y }
    const toNext = { x: next.x - cur.x, y: next.y - cur.y }
    const lp = Math.hypot(toPrev.x, toPrev.y)
    const ln = Math.hypot(toNext.x, toNext.y)
    const rr = Math.min(radius, lp / 2, ln / 2)
    const a = { x: cur.x + (toPrev.x / lp) * rr, y: cur.y + (toPrev.y / lp) * rr }
    const b = { x: cur.x + (toNext.x / ln) * rr, y: cur.y + (toNext.y / ln) * rr }
    d += `${i === 0 ? 'M' : 'L'}${r2(a.x)} ${r2(a.y)}Q${r2(cur.x)} ${r2(cur.y)} ${r2(b.x)} ${r2(b.y)}`
  }
  return d + 'Z'
}

function regularPolygon(sides: number, r: number, startDeg: number): Pt[] {
  return Array.from({ length: sides }, (_, i) => polar(r, startDeg + (360 / sides) * i))
}

/** Path de cúbicas en coordenadas absolutas, escalado alrededor de (cx, cy). */
function scaledCubicPath(start: Pt, curves: number[][], s: number, cx: number, cy: number): string {
  const tx = (x: number) => r2(cx + (x - cx) * s)
  const ty = (y: number) => r2(cy + (y - cy) * s)
  let d = `M${tx(start.x)} ${ty(start.y)}`
  for (const c of curves) {
    d += `C${tx(c[0])} ${ty(c[1])} ${tx(c[2])} ${ty(c[3])} ${tx(c[4])} ${ty(c[5])}`
  }
  return d + 'Z'
}

// ── Formas por categoría ──────────────────────────────────────────────────

interface ShapeSpec {
  /** Contorno exterior (borde metálico). */
  rim: string
  /** Escalón biselado entre borde y cara. */
  bevel: string
  /** Cara esmaltada. */
  face: string
  /** Detalle detrás del borde (pétalos de atrás, etc.). */
  behind?: string
  /** Detalle grabado sobre el borde (estrías de moneda, etc.). */
  rimDetail?: string
  /** Centro del glifo cuando hay número / cuando no lo hay. */
  glyphY: number
  glyphSoloY: number
  /** Centro del número y ancho máximo. */
  labelY: number
  labelMaxW: number
  /** Tamaño del glifo junto al número (por defecto 36) y tope del alto del número. */
  glyphSize?: number
  labelCapMax?: number
}

function coinTicks(): string {
  let d = ''
  for (let i = 0; i < 60; i++) {
    const a = polar(48.6, i * 6)
    const b = polar(52, i * 6)
    d += `M${r2(a.x)} ${r2(a.y)}L${r2(b.x)} ${r2(b.y)}`
  }
  return d
}

function sunRays(): string {
  const pts: Pt[] = []
  const rays = 16
  for (let i = 0; i < rays * 2; i++) {
    pts.push(polar(i % 2 === 0 ? 55.5 : 45.5, -90 + (180 / rays) * i))
  }
  return roundedPolygon(pts, 2.2)
}

function lotusPetals(count: number, tipR: number, baseR: number, offsetDeg: number, spread: number): string {
  let d = ''
  for (let i = 0; i < count; i++) {
    const t = -90 + offsetDeg + (360 / count) * i
    const b1 = polar(baseR, t - spread)
    const c1 = polar(tipR - 2, t - spread * 0.75)
    const tip = polar(tipR, t)
    const c2 = polar(tipR - 2, t + spread * 0.75)
    const b2 = polar(baseR, t + spread)
    d += `M${r2(b1.x)} ${r2(b1.y)}Q${r2(c1.x)} ${r2(c1.y)} ${r2(tip.x)} ${r2(tip.y)}Q${r2(c2.x)} ${r2(c2.y)} ${r2(b2.x)} ${r2(b2.y)}Z`
  }
  return d
}

const SHIELD_START: Pt = { x: 60, y: 7 }
const SHIELD_CURVES: number[][] = [
  [72, 15, 88, 16.5, 103, 14.5],
  [104.5, 30, 104.5, 44, 103.5, 58],
  [101.5, 84, 84, 102, 60, 113],
  [36, 102, 18.5, 84, 16.5, 58],
  [15.5, 44, 15.5, 30, 17, 14.5],
  [32, 16.5, 48, 15, 60, 7],
]

const DROP_START: Pt = { x: 60, y: 5 }
const DROP_CURVES: number[][] = [
  [64, 5, 101, 47, 101, 75],
  [101, 97, 83, 114, 60, 114],
  [37, 114, 19, 97, 19, 75],
  [19, 47, 56, 5, 60, 5],
]

function shapeFor(category: BadgeCategory): ShapeSpec {
  switch (category) {
    case 'clases':
      return {
        rim: circlePath(CX, CY, 53.5),
        bevel: circlePath(CX, CY, 47.5),
        face: circlePath(CX, CY, 43.5),
        rimDetail: coinTicks(),
        glyphY: 39,
        glyphSoloY: 60,
        labelY: 81,
        labelMaxW: 62,
      }
    case 'disciplinas':
      return {
        rim: roundedPolygon(regularPolygon(6, 57, 0), 9),
        bevel: roundedPolygon(regularPolygon(6, 51, 0), 7.5),
        face: roundedPolygon(regularPolygon(6, 46.5, 0), 6.5),
        glyphY: 40,
        glyphSoloY: 60,
        labelY: 80.5,
        labelMaxW: 56,
        glyphSize: 37,
      }
    case 'constancia':
      return {
        rim: scaledCubicPath(SHIELD_START, SHIELD_CURVES, 1, 60, 60),
        bevel: scaledCubicPath(SHIELD_START, SHIELD_CURVES, 0.885, 60, 60),
        face: scaledCubicPath(SHIELD_START, SHIELD_CURVES, 0.8, 60, 60),
        glyphY: 39.5,
        glyphSoloY: 58,
        labelY: 79,
        labelMaxW: 50,
        glyphSize: 37,
      }
    case 'semanas':
      return {
        rim: sunRays(),
        bevel: circlePath(CX, CY, 43.5),
        face: circlePath(CX, CY, 39),
        glyphY: 44,
        glyphSoloY: 60,
        labelY: 79,
        labelMaxW: 50,
        glyphSize: 32,
        labelCapMax: 17,
      }
    case 'reto':
      return {
        rim: roundedPolygon(regularPolygon(8, 55.5, -90 + 22.5), 7),
        bevel: roundedPolygon(regularPolygon(8, 49.5, -90 + 22.5), 6),
        face: roundedPolygon(regularPolygon(8, 45, -90 + 22.5), 5),
        glyphY: 44,
        glyphSoloY: 44,
        labelY: 81,
        labelMaxW: 56,
      }
    case 'exploradora':
      return {
        rim: roundedPolygon(regularPolygon(4, 57, -90), 11),
        bevel: roundedPolygon(regularPolygon(4, 50, -90), 9),
        face: roundedPolygon(regularPolygon(4, 45, -90), 8),
        rimDetail: compassNotches(),
        glyphY: 44,
        glyphSoloY: 60,
        labelY: 79,
        labelMaxW: 34,
        glyphSize: 34,
        labelCapMax: 18,
      }
    case 'calma':
      return {
        behind: lotusPetals(8, 51.5, 34, 22.5, 19),
        rim: lotusPetals(8, 56, 36, 0, 20) + circlePath(CX, CY, 45),
        bevel: circlePath(CX, CY, 43.5),
        face: circlePath(CX, CY, 39),
        glyphY: 44,
        glyphSoloY: 60,
        labelY: 79,
        labelMaxW: 56,
        glyphSize: 32,
        labelCapMax: 17,
      }
    case 'momentos':
      return {
        rim: scaledCubicPath(DROP_START, DROP_CURVES, 1, 60, 74),
        bevel: scaledCubicPath(DROP_START, DROP_CURVES, 0.895, 60, 74),
        face: scaledCubicPath(DROP_START, DROP_CURVES, 0.815, 60, 74),
        glyphY: 63,
        glyphSoloY: 76,
        labelY: 94,
        labelMaxW: 40,
        glyphSize: 30,
        labelCapMax: 16,
      }
  }
}

/** Pequeñas marcas de rosa de los vientos en las cuatro diagonales del rombo. */
function compassNotches(): string {
  let d = ''
  for (const deg of [-45, 45, 135, 225]) {
    const a = polar(36.5, deg)
    const b = polar(40.5, deg)
    d += `M${r2(a.x)} ${r2(a.y)}L${r2(b.x)} ${r2(b.y)}`
  }
  return d
}

// ── Metales y colores ─────────────────────────────────────────────────────

interface Metal {
  hi: string
  light: string
  mid: string
  dark: string
  deep: string
}

/** Tier 1–5: cobre, arena, salvia, oro cálido, platino perlado. */
const METALS: Record<BadgeTier, Metal> = {
  1: { hi: '#F8DDCA', light: '#E3AC88', mid: '#BF7D57', dark: '#8F5536', deep: '#5A321E' },
  2: { hi: '#FCF2DF', light: '#E6D1AA', mid: '#C4A77D', dark: '#937754', deep: '#5E4C36' },
  3: { hi: '#F0F5E9', light: '#C6D4B6', mid: '#9CAF88', dark: '#6B7F5E', deep: '#3F4D35' },
  4: { hi: '#FFF5D3', light: '#F1D68E', mid: '#D5A94F', dark: '#A0772B', deep: '#614515' },
  5: { hi: '#FFFFFF', light: '#FFF8EF', mid: '#E4DDD3', dark: '#AFA69C', deep: '#665E56' },
}

interface Enamel {
  light: string
  dark: string
}

const CATEGORY_ENAMEL: Record<BadgeCategory, Enamel> = {
  clases: { light: '#86705F', dark: '#3E352E' },
  disciplinas: { light: '#8C9A7E', dark: '#4C5A43' },
  constancia: { light: '#C68B67', dark: '#7A4430' },
  semanas: { light: '#93B2C4', dark: '#4C6A80' },
  reto: { light: '#B97A78', dark: '#6A3A40' },
  exploradora: { light: '#7DA39C', dark: '#365A55' },
  calma: { light: '#A69FC2', dark: '#585079' },
  momentos: { light: '#A98AA4', dark: '#5A4058' },
}

const DISCIPLINE_ENAMEL: Record<string, Enamel> = {
  pole: { light: '#CC948A', dark: '#844A45' },
  pilates: { light: '#94AA84', dark: '#4A5D40' },
  yoga: { light: '#D9AE7C', dark: '#94643A' },
  aro: { light: '#B391A6', dark: '#684659' },
  telas: { light: '#8EAAB3', dark: '#47636D' },
  soundbath: { light: '#8A8FB9', dark: '#43477A' },
  baile: { light: '#B5779A', dark: '#5F3352' },
}

function enamelFor(badge: BadgeArtInput): Enamel {
  if (badge.discipline && DISCIPLINE_ENAMEL[badge.discipline]) return DISCIPLINE_ENAMEL[badge.discipline]
  return CATEGORY_ENAMEL[badge.category]
}

const LOCKED = {
  rim: '#E8E0D4',
  bevel: '#EEE7DC',
  face: '#F5F0E8',
  edge: '#DCD2C4',
  ink: '#D8CDBE',
  track: '#EFE9E0',
  arc: '#C4A77D',
}

// ── Glifos (caja de 48×48, dibujados a mano) ──────────────────────────────

/** stroke: línea; fill: relleno; cut: se pinta del color de la cara (calado). */
interface GlyphPart {
  d: string
  kind: 'stroke' | 'fill' | 'cut'
}

const s = (d: string): GlyphPart => ({ d, kind: 'stroke' })
const f = (d: string): GlyphPart => ({ d, kind: 'fill' })
const cut = (d: string): GlyphPart => ({ d, kind: 'cut' })

function dots(points: Array<[number, number, number]>): GlyphPart[] {
  return points.map(([x, y, r]) => f(circlePath(x, y, r)))
}

const GLYPHS: Record<BadgeGlyph, GlyphPart[]> = {
  // Brote: cada clase hace crecer algo.
  clases: [
    s('M9 43Q24 37 39 43'),
    s('M24 41C24 33 23.2 27 24 19'),
    f('M23.6 29C16.5 30 9 25.5 8 15.5C17 14.5 23 20.5 23.6 29Z'),
    f('M24.3 22C24.6 12.5 31.5 5.5 41.5 6C41.5 16 34 22.4 24.3 22Z'),
  ],
  // Barra con bailarina enganchada.
  pole: [
    s('M15.5 4V44'),
    s('M11 3.5H20'),
    s('M9 45H22'),
    s('M25 17L15.5 7.5'),
    s('M25 17L38.5 4.5'),
    s('M25 17C27.5 22 28.5 26 27.5 30'),
    f(circlePath(28.5, 35.5, 3.9)),
    s('M26.5 26L15.5 24'),
    s('M27 29.5L15.5 32.5'),
  ],
  // Pilates: postura "teaser" sobre el mat.
  pilates: [
    s('M5 42.5H43'),
    f(circlePath(12.5, 13.5, 4)),
    s('M16 19.5L24.5 35'),
    s('M24.5 35L40 17.5'),
    s('M17.5 22.5L32.5 11.5'),
  ],
  // Yoga: postura del árbol.
  yoga: [
    f(circlePath(24, 12, 3.7)),
    s('M24 21L12.5 7'),
    s('M24 21L35.5 7'),
    s('M24 19V31'),
    s('M24 31V45.5'),
    s('M24 31L32.5 35.5L24.5 39.5'),
    s('M14 45.5H34'),
  ],
  // Aro aéreo colgado con una figura sentada en la curva.
  aro: [
    s('M24 1V7'),
    s(circlePath(24, 24.5, 17)),
    f(circlePath(16.5, 21.5, 3.4)),
    s('M18.5 26C20.5 31.5 25.5 35 31.5 35'),
    s('M31.5 35L35.5 22'),
    s('M20 28.5L13.5 33.5'),
  ],
  // Telas: dos lienzos que caen y se cruzan.
  telas: [
    s('M11 3H37'),
    s('M20 3C19 11 17.5 16 15.5 22C13.5 29 14.5 38 18 46'),
    s('M28 3C29 11 30.5 16 32.5 22C34.5 29 33.5 38 30 46'),
    s('M16 20.5H32'),
    s('M24 20.5V27'),
    f(circlePath(24, 31.5, 3.6)),
    s('M22 27.5L16.5 33'),
    s('M26 27.5L31.5 33'),
  ],
  // Cuenco tibetano con ondas de sonido.
  soundbath: [
    s('M15.5 16Q24 10 32.5 16'),
    s('M10 9.5Q24 0.5 38 9.5'),
    f('M6.5 23H41.5C41.5 34.5 33.5 41 24 41C14.5 41 6.5 34.5 6.5 23Z'),
    cut('M10 27H38'),
    s('M16.5 45.5H31.5'),
  ],
  // Bailarina girando.
  baile: [
    f(circlePath(27.5, 8, 3.8)),
    s('M26.5 13.5C25.5 18 24.5 22 24.5 26'),
    s('M26 15.5C30.5 13.5 34.5 9 37.5 3.5'),
    s('M25.5 16.5C20.5 17.5 15.5 15.5 10.5 17.5'),
    f('M24.5 24C19.5 28 13.5 32 9.5 36.5C17 38 30.5 38 38 34.5C32.5 31.5 28.5 28 24.5 24Z'),
    s('M21 37L18 45.5'),
    s('M28.5 37L33.5 44.5'),
  ],
  // Llama de la racha.
  racha: [
    s('M24 3.5C27.5 13 37.5 18 37.5 30C37.5 38.5 31.5 44.5 24 44.5C16.5 44.5 10.5 38.5 10.5 30C10.5 23 15.5 18.5 18 12.5C20 18 21.5 20 24.5 21.5C23.5 15 22 10 24 3.5Z'),
    f('M24 26C26.5 30 30.5 32 30.5 36.5C30.5 40 27.5 42.5 24 42.5C20.5 42.5 17.5 40 17.5 36.5C17.5 32 21.5 30 24 26Z'),
  ],
  // Sol con los siete días de la semana alrededor.
  sol: [
    f(circlePath(24, 24, 8.5)),
    ...dots(
      Array.from({ length: 7 }, (_, i): [number, number, number] => {
        const p = polar(18, -90 + (360 / 7) * i, 24, 24)
        return [p.x, p.y, 2.8]
      })
    ),
  ],
  // Montaña con bandera en la cima.
  reto: [
    s('M3.5 42.5L18 19.5L25.5 30L31.5 22L44.5 42.5Z'),
    s('M18 19.5V4.5'),
    f('M18 4.5L30 8.5L18 12.5Z'),
    s('M12.5 29L15.5 31.5L18 29L20.5 31.5L22.5 29'),
  ],
  // Brújula.
  brujula: [
    s(circlePath(24, 24, 15.5)),
    f('M24 5.5L28.8 24H19.2Z'),
    s('M19.2 24L24 42.5L28.8 24'),
    s('M2.5 24H7.5'),
    s('M40.5 24H45.5'),
  ],
  // Flor de loto sobre el agua.
  loto: [
    f('M24 7C30.5 14 30.5 27 24 34.5C17.5 27 17.5 14 24 7Z'),
    s('M21.5 34.5C13.5 33.5 7.5 26.5 6.5 17C13.5 18 18.5 22 21 27.5'),
    s('M26.5 34.5C34.5 33.5 40.5 26.5 41.5 17C34.5 18 29.5 22 27 27.5'),
    s('M7 41Q15.5 37 24 41Q32.5 45 41 41'),
  ],
  // Amanecer.
  manianera: [
    s('M3.5 33.5H44.5'),
    f('M11.5 33.5A12.5 12.5 0 0 1 36.5 33.5Z'),
    s('M24 15.5V8.5'),
    s('M12 20.5L8 16.5'),
    s('M36 20.5L40 16.5'),
    s('M7.5 27.5L3 26.5'),
    s('M40.5 27.5L45 26.5'),
    s('M12.5 39.5H35.5'),
    s('M19 45H29'),
  ],
  // Atardecer: sol rayado que se esconde, con una estrella.
  atardecer: [
    f('M9.5 33A14.5 14.5 0 0 1 38.5 33Z'),
    cut('M8 25H40'),
    cut('M8 29.5H40'),
    s('M3.5 33H44.5'),
    s('M13.5 39H34.5'),
    s('M19.5 44.5H28.5'),
    f('M39.5 3.5L41 7.5L45 9L41 10.5L39.5 14.5L38 10.5L34 9L38 7.5Z'),
  ],
  // Doble sesión: dos relojes.
  doble: [
    s(circlePath(31.5, 16.5, 11.5)),
    s('M31.5 16.5V10.5'),
    s('M31.5 16.5L35.5 18.5'),
    f(circlePath(18, 30.5, 14)),
    cut('M18 30.5V22.5'),
    cut('M18 30.5L24 33.5'),
  ],
  // Fin de semana: calendario con sábado y domingo marcados.
  finde: [
    s('M8.5 10.5H39.5Q43 10.5 43 14V40Q43 43.5 39.5 43.5H8.5Q5 43.5 5 40V14Q5 10.5 8.5 10.5Z'),
    s('M5 19H43'),
    s('M15 5.5V13.5'),
    s('M33 5.5V13.5'),
    ...dots([
      [11, 27, 1.8],
      [17.5, 27, 1.8],
      [24, 27, 1.8],
      [11, 36, 1.8],
      [17.5, 36, 1.8],
      [24, 36, 1.8],
    ]),
    f('M29.5 24H33V29.5H29.5Z'),
    f('M35.5 24H39V29.5H35.5Z'),
    f('M29.5 33H33V38.5H29.5Z'),
    f('M35.5 33H39V38.5H35.5Z'),
  ],
  // Semana completa: visto grande sobre los siete días, tres marcados.
  'semana-completa': [
    s('M11.5 17L20 25.5L37 8.5'),
    ...dots(
      Array.from({ length: 7 }, (_, i): [number, number, number] => [
        6 + i * 6,
        38.5,
        i === 1 || i === 3 || i === 5 ? 3.1 : 1.5,
      ])
    ),
  ],
  // Aniversario: pastel con vela.
  aniversario: [
    f('M24 1.5C26.3 4.3 27.3 6 27.3 7.6C27.3 9.4 25.8 10.8 24 10.8C22.2 10.8 20.7 9.4 20.7 7.6C20.7 6 21.7 4.3 24 1.5Z'),
    s('M24 13.5V18.5'),
    s('M14 18.5H34V28H14Z'),
    s('M8.5 28H39.5V42H8.5Z'),
    s('M8.5 34Q12.4 37.5 16.25 34Q20.1 37.5 24 34Q27.9 37.5 31.75 34Q35.6 37.5 39.5 34'),
    s('M4 44.5H44'),
  ],
}

// ── Letras monolínea (alto de mayúscula 10) ───────────────────────────────

interface LetterForm {
  d: string
  w: number
}

const LETTERS: Record<string, LetterForm> = {
  '0': { d: 'M3.1 0C5 0 6.2 2.2 6.2 5S5 10 3.1 10S0 7.8 0 5S1.2 0 3.1 0Z', w: 6.2 },
  '1': { d: 'M0.4 2.2L3.2 0V10', w: 3.6 },
  '2': { d: 'M0.4 2.7C0.7 1.1 1.9 0 3.2 0C4.9 0 6 1.2 6 2.8C6 4.3 5.2 5.2 3.9 6.5L0.3 10H6.2', w: 6.4 },
  '3': { d: 'M0.6 0H5.7L2.7 3.9C4.8 3.8 6.2 5.1 6.2 6.9C6.2 8.8 4.8 10 3.1 10C1.8 10 0.8 9.4 0.2 8.4', w: 6.4 },
  '4': { d: 'M4.6 10V0L0 7.1H6.6', w: 6.6 },
  '5': { d: 'M5.6 0H1.3L0.8 4.4C1.5 3.8 2.3 3.6 3.1 3.6C4.9 3.6 6.2 4.9 6.2 6.8C6.2 8.7 4.8 10 3 10C1.8 10 0.8 9.4 0.2 8.4', w: 6.4 },
  '6': { d: 'M4.8 0L1.1 5.6M0.2 6.8C0.2 5 1.5 3.7 3.2 3.7C4.9 3.7 6.2 5 6.2 6.8C6.2 8.7 4.9 10 3.2 10C1.5 10 0.2 8.7 0.2 6.8Z', w: 6.4 },
  '7': { d: 'M0 0H6.2L2.2 10', w: 6.2 },
  '8': { d: 'M3.1 0C4.5 0 5.5 1 5.5 2.3C5.5 3.6 4.5 4.6 3.1 4.6C1.7 4.6 0.7 3.6 0.7 2.3C0.7 1 1.7 0 3.1 0ZM3.1 4.6C4.9 4.6 6.2 5.7 6.2 7.3C6.2 8.9 4.9 10 3.1 10C1.3 10 0 8.9 0 7.3C0 5.7 1.3 4.6 3.1 4.6Z', w: 6.2 },
  '9': { d: 'M1.4 10L5.1 4.4M6 3.2C6 5 4.7 6.3 3 6.3C1.3 6.3 0 5 0 3.2C0 1.3 1.3 0 3 0C4.7 0 6 1.3 6 3.2Z', w: 6.2 },
  A: { d: 'M0 10L3.3 0L6.6 10M1.2 6.6H5.4', w: 6.6 },
  B: { d: 'M0.6 4.8H3.5C4.7 4.8 5.6 3.8 5.6 2.4C5.6 1 4.7 0 3.5 0H0.6V10H3.8C5.2 10 6.2 9 6.2 7.4C6.2 5.8 5.2 4.8 3.8 4.8', w: 6.6 },
  C: { d: 'M6.4 1.6C5.7 0.6 4.8 0 3.7 0C1.6 0 0 2.2 0 5S1.6 10 3.7 10C4.8 10 5.7 9.4 6.4 8.4', w: 6.6 },
  D: { d: 'M0.6 0V10H2.8C5.2 10 6.8 7.8 6.8 5S5.2 0 2.8 0Z', w: 7.2 },
  E: { d: 'M5.6 0H0.6V10H5.6M0.6 5H4.8', w: 5.8 },
  F: { d: 'M5.6 0H0.6V10M0.6 5H4.8', w: 5.6 },
  G: { d: 'M6.4 1.6C5.7 0.6 4.8 0 3.7 0C1.6 0 0 2.2 0 5S1.6 10 3.7 10C5.7 10 7 8.4 7 5.8H4.2', w: 7.2 },
  I: { d: 'M0.6 0V10', w: 1.2 },
  J: { d: 'M4.6 0V7.2C4.6 8.9 3.6 10 2.3 10C1.2 10 0.4 9.4 0 8.4', w: 5 },
  L: { d: 'M0.6 0V10H5.6', w: 5.8 },
  M: { d: 'M0.4 10V0L4 7.2L7.6 0V10', w: 8 },
  N: { d: 'M0.6 10V0L6.2 10V0', w: 6.8 },
  O: { d: 'M3.8 0C5.9 0 7.6 2.2 7.6 5S5.9 10 3.8 10S0 7.8 0 5S1.7 0 3.8 0Z', w: 7.6 },
  P: { d: 'M0.6 10V0H3.5C5 0 6.2 1.2 6.2 2.8C6.2 4.4 5 5.6 3.5 5.6H0.6', w: 6.6 },
  R: { d: 'M0.6 10V0H3.5C5 0 6.2 1.2 6.2 2.8C6.2 4.4 5 5.6 3.5 5.6H0.6M3.4 5.6L6.4 10', w: 6.8 },
  S: { d: 'M5.6 1.4C5 0.5 4.1 0 3.1 0C1.7 0 0.7 0.9 0.7 2.3C0.7 5.2 6 4.6 6 7.6C6 9 4.8 10 3.2 10C1.9 10 0.8 9.4 0.2 8.4', w: 6.2 },
  T: { d: 'M0 0H6.4M3.2 0V10', w: 6.4 },
  U: { d: 'M0.6 0V6.6C0.6 8.6 1.8 10 3.4 10S6.2 8.6 6.2 6.6V0', w: 6.8 },
  V: { d: 'M0 0L3.3 10L6.6 0', w: 6.6 },
  Y: { d: 'M0 0L3.3 5.2L6.6 0M3.3 5.2V10', w: 6.6 },
}

const LETTER_GAP = 1.9
const LETTER_STROKE = 2.15

interface TextLayout {
  d: string
  transform: string
  scale: number
  width: number
}

function layoutText(text: string, cx: number, cy: number, capH: number, maxW: number): TextLayout | null {
  let d = ''
  let x = 0
  let drawn = 0
  for (const ch of text.toUpperCase()) {
    const form = LETTERS[ch]
    if (!form) continue
    if (drawn > 0) x += LETTER_GAP
    d += `<path d="${form.d}" transform="translate(${r2(x)} 0)"/>`
    x += form.w
    drawn++
  }
  if (drawn === 0) return null
  // El trazo sobresale medio grosor por cada lado.
  const width = x + LETTER_STROKE
  let scale = capH / 10
  if (width * scale > maxW) scale = maxW / width
  const tx = cx - (x * scale) / 2
  const ty = cy - (10 * scale) / 2
  return { d, transform: `translate(${r2(tx)} ${r2(ty)}) scale(${Math.round(scale * 1000) / 1000})`, scale, width }
}

function capHeightFor(text: string): number {
  if (text.length <= 2) return 17
  if (text.length === 3) return 15.5
  return 13
}

// ── Render ────────────────────────────────────────────────────────────────

function gradientDefs(p: string, metal: Metal, enamel: Enamel): string {
  return [
    `<linearGradient id="${p}-rim" gradientUnits="userSpaceOnUse" x1="18" y1="6" x2="102" y2="114">`,
    `<stop offset="0" stop-color="${metal.light}"/>`,
    `<stop offset="0.2" stop-color="${metal.hi}"/>`,
    `<stop offset="0.42" stop-color="${metal.mid}"/>`,
    `<stop offset="0.62" stop-color="${metal.dark}"/>`,
    `<stop offset="0.82" stop-color="${metal.mid}"/>`,
    `<stop offset="1" stop-color="${metal.light}"/>`,
    `</linearGradient>`,
    `<linearGradient id="${p}-bevel" gradientUnits="userSpaceOnUse" x1="30" y1="16" x2="90" y2="104">`,
    `<stop offset="0" stop-color="${metal.deep}"/>`,
    `<stop offset="0.55" stop-color="${metal.mid}"/>`,
    `<stop offset="1" stop-color="${metal.hi}"/>`,
    `</linearGradient>`,
    `<radialGradient id="${p}-face" gradientUnits="userSpaceOnUse" cx="46" cy="36" r="82">`,
    `<stop offset="0" stop-color="${enamel.light}"/>`,
    `<stop offset="1" stop-color="${enamel.dark}"/>`,
    `</radialGradient>`,
    `<radialGradient id="${p}-inner" gradientUnits="userSpaceOnUse" cx="60" cy="62" r="50">`,
    `<stop offset="0.72" stop-color="#000" stop-opacity="0"/>`,
    `<stop offset="1" stop-color="#000" stop-opacity="0.32"/>`,
    `</radialGradient>`,
    `<linearGradient id="${p}-sheen" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="50">`,
    `<stop offset="0" stop-color="#fff" stop-opacity="0"/>`,
    `<stop offset="0.5" stop-color="#fff" stop-opacity="0.3"/>`,
    `<stop offset="1" stop-color="#fff" stop-opacity="0"/>`,
    `</linearGradient>`,
    // Metal del glifo y del número: degradado vertical en coordenadas locales.
    `<linearGradient id="${p}-ink" gradientUnits="userSpaceOnUse" x1="0" y1="2" x2="0" y2="46">`,
    `<stop offset="0" stop-color="${metal.hi}"/>`,
    `<stop offset="0.48" stop-color="${metal.light}"/>`,
    `<stop offset="0.52" stop-color="${metal.mid}"/>`,
    `<stop offset="1" stop-color="${metal.light}"/>`,
    `</linearGradient>`,
    `<linearGradient id="${p}-label" gradientUnits="userSpaceOnUse" x1="0" y1="-0.5" x2="0" y2="10.5">`,
    `<stop offset="0" stop-color="${metal.hi}"/>`,
    `<stop offset="0.48" stop-color="${metal.light}"/>`,
    `<stop offset="0.52" stop-color="${metal.mid}"/>`,
    `<stop offset="1" stop-color="${metal.light}"/>`,
    `</linearGradient>`,
    `<clipPath id="${p}-clip"><path d="__RIM__"/></clipPath>`,
  ].join('')
}

function glyphMarkup(
  parts: GlyphPart[],
  box: { cx: number; cy: number; size: number; strokePx: number },
  paint: { ink: string; cut: string; shadow?: string }
): string {
  const scale = box.size / 48
  const sw = r2(box.strokePx / scale)
  const cutSw = r2((box.strokePx * 0.62) / scale)
  const tx = box.cx - box.size / 2
  const ty = box.cy - box.size / 2
  const draw = (ink: string, withCut: boolean): string =>
    parts
      .map((part) => {
        if (part.kind === 'cut') {
          return withCut
            ? `<path d="${part.d}" fill="none" stroke="${paint.cut}" stroke-width="${cutSw}"/>`
            : ''
        }
        if (part.kind === 'fill') {
          return `<path d="${part.d}" fill="${ink}" stroke="${ink}" stroke-width="${r2(Number(sw) * 0.35)}"/>`
        }
        return `<path d="${part.d}" fill="none" stroke="${ink}" stroke-width="${sw}"/>`
      })
      .join('')
  const common = 'stroke-linecap="round" stroke-linejoin="round"'
  const shadow = paint.shadow
    ? `<g transform="translate(${r2(tx + 0.7)} ${r2(ty + 1.1)}) scale(${r2(scale)})" ${common} opacity="0.85">${draw(paint.shadow, false)}</g>`
    : ''
  return `<g data-part="glyph">${shadow}<g transform="translate(${r2(tx)} ${r2(ty)}) scale(${r2(scale)})" ${common}>${draw(paint.ink, true)}</g></g>`
}

function labelMarkup(
  text: string,
  at: { cx: number; cy: number; capH: number; maxW: number },
  paint: { ink: string; shadow?: string; shadowDx?: number; shadowDy?: number }
): string {
  const layout = layoutText(text, at.cx, at.cy, at.capH, at.maxW)
  if (!layout) return ''
  const common = `fill="none" stroke-linecap="round" stroke-linejoin="round"`
  const shadow = paint.shadow
    ? `<g transform="translate(${r2(paint.shadowDx ?? 0.6)} ${r2(paint.shadowDy ?? 1)})"><g transform="${layout.transform}" ${common} stroke="${paint.shadow}" stroke-width="${r2(LETTER_STROKE + 0.9 / layout.scale)}">${layout.d}</g></g>`
    : ''
  return `<g data-part="label">${shadow}<g transform="${layout.transform}" ${common} stroke="${paint.ink}" stroke-width="${LETTER_STROKE}">${layout.d}</g></g>`
}

/** Banda del mes para el reto: cinta con colas plegadas por detrás. */
function retoBand(fillMain: string, fillTail: string, fold: string, edge: string): string {
  return [
    `<g data-part="band">`,
    `<path d="M7 76H21V96H7L12 86Z" fill="${fillTail}" stroke="${edge}" stroke-width="0.7" stroke-linejoin="round"/>`,
    `<path d="M113 76H99V96H113L108 86Z" fill="${fillTail}" stroke="${edge}" stroke-width="0.7" stroke-linejoin="round"/>`,
    `<path d="M14 91.5L21 96V91.5Z" fill="${fold}"/>`,
    `<path d="M106 91.5L99 96V91.5Z" fill="${fold}"/>`,
    `<path d="M14 70.5H106V91.5H14Z" fill="${fillMain}" stroke="${edge}" stroke-width="0.7" stroke-linejoin="round"/>`,
    `</g>`,
  ].join('')
}

function progressArc(progress: number): string {
  const p = Math.min(Math.max(progress, 0), 1)
  const r = 57.6
  const track = `<path d="${circlePath(CX, CY, r)}" fill="none" stroke="${LOCKED.track}" stroke-width="2.6"/>`
  let arc: string
  if (p >= 0.999) {
    arc = `<path d="${circlePath(CX, CY, r)}" fill="none" stroke="${LOCKED.arc}" stroke-width="2.6"/>`
  } else {
    const end = polar(r, -90 + 360 * p)
    const large = p > 0.5 ? 1 : 0
    // Extremos "butt" + dos puntos rellenos, igual que ProgressRing: con
    // stroke-linecap="round" en arcos, Skia dibuja líneas finas hacia el centro.
    arc =
      `<path d="M${CX} ${r2(CY - r)}A${r} ${r} 0 ${large} 1 ${r2(end.x)} ${r2(end.y)}" fill="none" stroke="${LOCKED.arc}" stroke-width="2.6"/>` +
      `<path d="${circlePath(CX, CY - r, 1.3)}" fill="${LOCKED.arc}"/>` +
      `<path d="${circlePath(end.x, end.y, 1.3)}" fill="${LOCKED.arc}"/>`
  }
  return `<g data-part="progress">${track}${arc}</g>`
}

export function renderBadgeSvg(badge: BadgeArtInput, opts: BadgeArtOptions): string {
  const size = opts.size ?? 120
  const locked = opts.locked
  const p = `wb${shortHash(`${badge.id}|${locked ? 'l' : 'e'}|${size}${opts.idSuffix ? `|${opts.idSuffix}` : ''}`)}`
  const shape = shapeFor(badge.category)
  const isReto = badge.category === 'reto'
  const label = badge.label ?? ''
  const hasFaceLabel = label !== '' && !isReto

  const glyphBox = isReto
    ? { cx: CX, cy: shape.glyphY, size: 34, strokePx: 3 }
    : hasFaceLabel
      ? { cx: CX, cy: shape.glyphY, size: shape.glyphSize ?? 40, strokePx: 3 }
      : { cx: CX, cy: shape.glyphSoloY, size: 46, strokePx: 3.5 }
  const labelAt = { cx: CX, cy: shape.labelY, capH: isReto ? 11 : Math.min(capHeightFor(label), shape.labelCapMax ?? 99), maxW: shape.labelMaxW }

  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true" focusable="false">`
  )

  if (locked) {
    const progress = opts.progress ?? 0
    const withArc = progress > 0
    // Con arco, la medalla se achica un poco para que el anillo la rodee sin tocarla.
    parts.push(withArc ? `<g transform="translate(60 60) scale(0.86) translate(-60 -60)">` : '<g>')
    if (shape.behind) parts.push(`<path d="${shape.behind}" fill="${LOCKED.rim}"/>`)
    parts.push(
      `<path data-part="outline" d="${shape.rim}" fill="${LOCKED.rim}" stroke="${LOCKED.edge}" stroke-width="0.8" stroke-linejoin="round"/>`
    )
    parts.push(`<path d="${shape.bevel}" fill="${LOCKED.bevel}"/>`)
    parts.push(`<path d="${shape.face}" fill="${LOCKED.face}"/>`)
    if (isReto) parts.push(retoBand(LOCKED.rim, LOCKED.edge, LOCKED.edge, LOCKED.edge))
    parts.push(glyphMarkup(GLYPHS[badge.glyph], glyphBox, { ink: LOCKED.ink, cut: LOCKED.face }))
    if (label !== '') parts.push(labelMarkup(label, labelAt, { ink: isReto ? LOCKED.face : LOCKED.ink }))
    parts.push('</g>')
    if (withArc) parts.push(progressArc(progress))
    parts.push('</svg>')
    return parts.join('')
  }

  const metal = METALS[badge.tier]
  const enamel = enamelFor(badge)
  parts.push(`<defs>${gradientDefs(p, metal, enamel).replace('__RIM__', shape.rim)}</defs>`)
  if (shape.behind) {
    parts.push(`<path d="${shape.behind}" fill="${metal.dark}" stroke="${metal.deep}" stroke-width="0.8" stroke-linejoin="round"/>`)
  }
  parts.push(
    `<path data-part="outline" d="${shape.rim}" fill="url(#${p}-rim)" stroke="${metal.deep}" stroke-width="0.9" stroke-linejoin="round"/>`
  )
  if (shape.rimDetail) {
    parts.push(`<path d="${shape.rimDetail}" fill="none" stroke="${metal.deep}" stroke-opacity="0.28" stroke-width="0.9" stroke-linecap="round"/>`)
  }
  parts.push(`<path d="${shape.bevel}" fill="url(#${p}-bevel)"/>`)
  parts.push(`<path d="${shape.face}" fill="url(#${p}-face)"/>`)
  parts.push(`<path d="${shape.face}" fill="url(#${p}-inner)"/>`)
  // Filo de luz en el borde inferior de la cara: da profundidad al escalón.
  parts.push(`<path d="${shape.face}" fill="none" stroke="${metal.deep}" stroke-opacity="0.55" stroke-width="0.8"/>`)
  if (isReto) parts.push(retoBand(`url(#${p}-rim)`, metal.dark, metal.deep, metal.deep))
  parts.push(
    `<g data-part="sheen" clip-path="url(#${p}-clip)"><rect x="-30" y="20" width="180" height="30" fill="url(#${p}-sheen)" transform="rotate(-38 60 60)"/></g>`
  )
  parts.push(
    glyphMarkup(GLYPHS[badge.glyph], glyphBox, {
      ink: `url(#${p}-ink)`,
      cut: enamel.dark,
      shadow: metal.deep,
    })
  )
  if (label !== '') {
    parts.push(
      isReto
        ? labelMarkup(label, labelAt, { ink: metal.deep, shadow: metal.hi, shadowDx: 0, shadowDy: 0.8 })
        : labelMarkup(label, labelAt, { ink: `url(#${p}-label)`, shadow: metal.deep })
    )
  }
  parts.push('</svg>')
  return parts.join('')
}

// ── PNG para el correo ────────────────────────────────────────────────────

/** Mayor umbral de "Clases" con PNG generado. */
export const CLASS_PNG_MAX = 2000

export interface PngBadge extends BadgeArtInput {
  /** Nombre del archivo, sin extensión, en /images/badges/. */
  file: string
}

/** Todas las insignias con PNG: catálogo fijo, Clases hasta 2000 y los 12 retos. */
export function badgesWithPng(): PngBadge[] {
  const list: PngBadge[] = []
  for (let i = 0; classThresholdAt(i) <= CLASS_PNG_MAX; i++) {
    const def = classBadgeDef(i)
    list.push({ id: def.id, category: def.category, tier: def.tier, glyph: def.glyph, label: def.label, file: def.id })
  }
  const fixed = [
    ...DISCIPLINE_BADGES,
    ...STREAK_BADGES,
    ...ACTIVE_WEEK_BADGES,
    ...EXPLORER_BADGES,
    ...CALM_BADGES,
    ...MOMENT_BADGES,
    ...ANNIVERSARY_BADGES,
  ]
  for (const def of fixed) {
    const item: PngBadge = { id: def.id, category: def.category, tier: def.tier, glyph: def.glyph, file: def.id }
    if (def.label !== undefined) item.label = def.label
    if (def.discipline !== undefined) item.discipline = def.discipline
    list.push(item)
  }
  for (const m of MONTH_LABELS) {
    list.push({
      id: `reto-${m}`,
      category: 'reto',
      tier: CHALLENGE_TIER,
      glyph: 'reto',
      label: m.toUpperCase(),
      file: `reto-${m}`,
    })
  }
  return list
}

let pngIds: Set<string> | null = null

export function badgePngPath(badge: Pick<BadgeState, 'id' | 'category'>): string | null {
  if (badge.category === 'reto') {
    const m = badge.id.match(/^reto-\d{4}-(\d{2})$/)
    const month = m ? Number(m[1]) : NaN
    if (!Number.isInteger(month) || month < 1 || month > 12) return null
    return `/images/badges/reto-${MONTH_LABELS[month - 1]}.png`
  }
  if (!pngIds) pngIds = new Set(badgesWithPng().filter((b) => b.category !== 'reto').map((b) => b.file))
  return pngIds.has(badge.id) ? `/images/badges/${badge.id}.png` : null
}
