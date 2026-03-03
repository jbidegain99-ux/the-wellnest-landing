import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-SV', {
    style: 'currency',
    currency: 'USD',
  }).format(price)
}

export const EL_SALVADOR_TZ = 'America/El_Salvador'

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('es-SV', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: EL_SALVADOR_TZ,
  }).format(new Date(date))
}

export function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat('es-SV', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: EL_SALVADOR_TZ,
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('es-SV', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: EL_SALVADOR_TZ,
  }).format(new Date(date))
}

export function formatDateTimeFull(date: Date | string): string {
  const d = new Date(date)
  const datePart = new Intl.DateTimeFormat('es-SV', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: EL_SALVADOR_TZ,
  }).format(d)
  const timePart = new Intl.DateTimeFormat('es-SV', {
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: EL_SALVADOR_TZ,
  }).format(d)
  return `${datePart} a las ${timePart}`
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

export function generateQRCode(): string {
  return `WN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
}

export function getDaysRemaining(expiryDate: Date | string): number {
  const now = new Date()
  const expiry = new Date(expiryDate)
  const diffTime = expiry.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

export function getWeekDays(): string[] {
  return ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
}

export function formatClassType(classType: string | null | undefined): string {
  if (!classType) return ''
  if (classType === 'test') return 'Clase de Prueba'
  if (classType === 'regular') return 'Clase Regular'
  return classType
}

export function getMonthName(month: number): string {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]
  return months[month]
}
