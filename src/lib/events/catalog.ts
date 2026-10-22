import { prisma } from '@/lib/prisma'

/** Campos públicos de un evento (página y tarjeta). */
export const publicEventSelect = {
  id: true, slug: true, name: true, startsAt: true, endsAt: true, venue: true, priceCents: true, capacity: true,
  salesOpen: true, isActive: true, ticketsEnabled: true, summary: true, description: true, imageUrl: true,
  pagePath: true, theme: true,
} as const

export type PublicEvent = {
  id: string; slug: string; name: string; startsAt: Date; endsAt: Date; venue: string; priceCents: number
  capacity: number | null; salesOpen: boolean; isActive: boolean; ticketsEnabled: boolean; summary: string
  description: string; imageUrl: string | null; pagePath: string | null; theme: string
}

export function getPublicEvent(slug: string): Promise<PublicEvent | null> {
  return prisma.event.findUnique({ where: { slug }, select: publicEventSelect })
}

export function listActiveEvents(): Promise<PublicEvent[]> {
  return prisma.event.findMany({ where: { isActive: true }, orderBy: { startsAt: 'asc' }, select: publicEventSelect })
}

/** ¿Se puede comprar ahora? (visible, con venta, abierta y antes del inicio) */
export function canBuy(e: Pick<PublicEvent, 'isActive' | 'ticketsEnabled' | 'salesOpen' | 'startsAt'>, now: Date = new Date()): boolean {
  return e.isActive && e.ticketsEnabled && e.salesOpen && now.getTime() < e.startsAt.getTime()
}
