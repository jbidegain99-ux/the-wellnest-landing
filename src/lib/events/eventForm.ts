// Formulario de eventos del admin. Sin imports de servidor: lo usa también el cliente.
import { z } from 'zod'
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'

const TZ = 'America/El_Salvador'
const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const RESERVED_SLUGS = ['pedido', 'nuevo', 'checkin', 'lista']

export function slugify(name: string): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export const eventFormInput = z
  .object({
    name: z.string().trim().min(3, 'Escribí el nombre del evento').max(80),
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones').min(3).max(60)
      .refine((s) => !RESERVED_SLUGS.includes(s), 'Ese identificador está reservado'),
    startsAtLocal: z.string().regex(LOCAL, 'Fecha de inicio inválida'),
    endsAtLocal: z.string().regex(LOCAL, 'Fecha de fin inválida'),
    venue: z.string().trim().min(3, 'Escribí el lugar').max(120),
    priceDollars: z.number().min(0).max(1000),
    capacity: z.number().int().positive().nullable(),
    summary: z.string().trim().max(200),
    description: z.string().trim().max(3000),
    imageUrl: z.string().trim().refine((u) => u === '' || u.startsWith('/') || u.startsWith('https://'), 'La imagen debe ser una ruta (/…) o una URL https://'),
    codePrefix: z.string().regex(/^[A-Z]{2,3}-$/, 'De 2 a 3 letras mayúsculas y un guion, ej. VP-'),
    theme: z.enum(['villains', 'wellnest']),
    ticketsEnabled: z.boolean(),
    isActive: z.boolean(),
    salesOpen: z.boolean(),
    thanksMessage: z.string().trim().max(500),
    pagePath: z.string().trim().refine((p) => p === '' || /^\/[a-z0-9/-]*$/.test(p), 'Debe ser una ruta del sitio, ej. /halloween'),
  })
  .superRefine((v, ctx) => {
    if (LOCAL.test(v.startsAtLocal) && LOCAL.test(v.endsAtLocal) && v.endsAtLocal <= v.startsAtLocal) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endsAtLocal'], message: 'El fin tiene que ser después del inicio' })
    }
  })
export type EventFormInput = z.infer<typeof eventFormInput>

export type EventData = {
  name: string; slug: string; startsAt: Date; endsAt: Date; venue: string; priceCents: number; capacity: number | null
  summary: string; description: string; imageUrl: string | null; codePrefix: string; theme: string
  ticketsEnabled: boolean; isActive: boolean; salesOpen: boolean; thanksMessage: string | null; pagePath: string | null
}

export function eventFormToData(v: EventFormInput): EventData {
  const orNull = (s: string) => (s.trim() === '' ? null : s.trim())
  return {
    name: v.name, slug: v.slug,
    startsAt: fromZonedTime(v.startsAtLocal, TZ), endsAt: fromZonedTime(v.endsAtLocal, TZ),
    venue: v.venue, priceCents: Math.round(v.priceDollars * 100), capacity: v.capacity,
    summary: v.summary, description: v.description, imageUrl: orNull(v.imageUrl), codePrefix: v.codePrefix, theme: v.theme,
    ticketsEnabled: v.ticketsEnabled, isActive: v.isActive, salesOpen: v.salesOpen,
    thanksMessage: orNull(v.thanksMessage), pagePath: orNull(v.pagePath),
  }
}

/** Fecha UTC → "YYYY-MM-DDTHH:mm" en hora de El Salvador, para <input type="datetime-local">. */
export function localInputFromDate(d: Date): string {
  return formatInTimeZone(d, TZ, "yyyy-MM-dd'T'HH:mm")
}
