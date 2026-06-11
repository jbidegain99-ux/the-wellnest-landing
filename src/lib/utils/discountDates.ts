/**
 * Parseo de fechas de vigencia de códigos de descuento.
 *
 * El admin elige días calendario (YYYY-MM-DD) pensando en hora El Salvador.
 * `new Date('YYYY-MM-DD')` los interpretaría como medianoche UTC, con lo que
 * un código "válido hasta el 15" moría a las 6pm SV del 14.
 */

import { svLocalToUTC } from '@/lib/utils/timezone'

export function parseDiscountDateSV(value: string, boundary: 'start' | 'end'): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (dateOnly) {
    const [, y, m, d] = dateOnly
    return boundary === 'start'
      ? svLocalToUTC(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0)
      : svLocalToUTC(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999)
  }
  // Valor con hora explícita (ISO completo): respetarlo tal cual
  return new Date(value)
}
