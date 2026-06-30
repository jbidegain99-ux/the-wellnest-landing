/**
 * Colores oficiales por disciplina - The Wellnest
 *
 * Fuente única de verdad para colores de disciplinas.
 * Usado en: Main Site (Horarios, Clases) y Admin (Horarios)
 */

// Colores oficiales por slug de disciplina
export const DISCIPLINE_COLORS: Record<string, string> = {
  // Colores principales
  yoga: '#6A6F4C',              // Verde oliva
  pilates: '#806044',           // Café tierra
  'mat-pilates': '#806044',     // Café tierra (alias)
  pole: '#806044',              // Café tierra
  'pole-fitness': '#806044',    // Café tierra (alias)
  soundbath: '#482F21',         // Café oscuro
  'terapia-de-sonido': '#482F21', // Café oscuro
  nutricion: '#6B7F5E',         // Verde oscuro
  'aro-telas': '#8B6B61',       // Terracota
  aro: '#8B6B61',               // Terracota (misma familia)
  telas: '#7B6B8A',             // Lavanda oscuro
}

// Colores para fondos de Tailwind (desktop calendar)
export const disciplineColors: Record<string, string> = {
  yoga: 'bg-[#6A6F4C]',
  pilates: 'bg-[#806044]',
  'mat-pilates': 'bg-[#806044]',
  pole: 'bg-[#806044]',
  'pole-fitness': 'bg-[#806044]',
  soundbath: 'bg-[#482F21]',
  'terapia-de-sonido': 'bg-[#482F21]',
  nutricion: 'bg-[#6B7F5E]',
  'aro-telas': 'bg-[#8B6B61]',
  aro: 'bg-[#8B6B61]',
  telas: 'bg-[#7B6B8A]',
}

// Colores para borde izquierdo en móvil
export const disciplineBorderColors: Record<string, string> = {
  yoga: 'border-l-[#6A6F4C]',
  pilates: 'border-l-[#806044]',
  'mat-pilates': 'border-l-[#806044]',
  pole: 'border-l-[#806044]',
  'pole-fitness': 'border-l-[#806044]',
  soundbath: 'border-l-[#482F21]',
  'terapia-de-sonido': 'border-l-[#482F21]',
  nutricion: 'border-l-[#6B7F5E]',
  'aro-telas': 'border-l-[#8B6B61]',
  aro: 'border-l-[#8B6B61]',
  telas: 'border-l-[#7B6B8A]',
}

// Badge colors para móvil (texto visible)
export const disciplineBadgeColors: Record<string, string> = {
  yoga: 'bg-[#6A6F4C] text-white',
  pilates: 'bg-[#806044] text-white',
  'mat-pilates': 'bg-[#806044] text-white',
  pole: 'bg-[#806044] text-white',
  'pole-fitness': 'bg-[#806044] text-white',
  soundbath: 'bg-[#482F21] text-white',
  'terapia-de-sonido': 'bg-[#482F21] text-white',
  nutricion: 'bg-[#6B7F5E] text-white',
  'aro-telas': 'bg-[#8B6B61] text-white',
  aro: 'bg-[#8B6B61] text-white',
  telas: 'bg-[#7B6B8A] text-white',
}

/**
 * Obtiene el color de fondo para una disciplina
 * @param slug - Slug de la disciplina (yoga, pilates, pole, etc.)
 * @returns Clase de Tailwind para el color de fondo
 */
export function getDisciplineColor(slug: string): string {
  const normalizedSlug = slug.toLowerCase().replace(/\s+/g, '-')
  return disciplineColors[normalizedSlug] || 'bg-primary'
}

/**
 * Obtiene el color de borde para una disciplina (móvil)
 * @param slug - Slug de la disciplina
 * @returns Clase de Tailwind para el color de borde
 */
export function getDisciplineBorderColor(slug: string): string {
  const normalizedSlug = slug.toLowerCase().replace(/\s+/g, '-')
  return disciplineBorderColors[normalizedSlug] || 'border-l-primary'
}

/**
 * Obtiene el color de badge para una disciplina (móvil)
 * @param slug - Slug de la disciplina
 * @returns Clases de Tailwind para el badge
 */
export function getDisciplineBadgeColor(slug: string): string {
  const normalizedSlug = slug.toLowerCase().replace(/\s+/g, '-')
  return disciplineBadgeColors[normalizedSlug] || 'bg-primary text-white'
}

/**
 * Obtiene el color hex raw para una disciplina
 * @param slug - Slug de la disciplina
 * @returns Color hex
 */
export function getDisciplineHexColor(slug: string): string {
  const normalizedSlug = slug.toLowerCase().replace(/\s+/g, '-')
  return DISCIPLINE_COLORS[normalizedSlug] || '#9CAF88'
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace('#', '')
  const full = value.length === 3
    ? value.split('').map((c) => c + c).join('')
    : value
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

/**
 * Tinte sutil de fondo para una disciplina (Opción C — "color sutil integrado").
 * Mezcla el color oficial hacia el blanco para obtener una superficie sólida y
 * tenue, sin transparencias, que se eleva sobre el fondo crema del horario.
 * Fuente única: se deriva de getDisciplineHexColor (mismo fallback neutral).
 *
 * @param slug - Slug de la disciplina
 * @param amount - Proporción del color de marca (0-1). Default 0.15 (~15%).
 * @returns Color rgb() listo para usar en `style.backgroundColor`
 */
export function getDisciplineTintColor(slug: string, amount = 0.15): string {
  const { r, g, b } = hexToRgb(getDisciplineHexColor(slug))
  const mix = (channel: number) => Math.round(channel * amount + 255 * (1 - amount))
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}
