export type PhoneResult = { ok: true; e164: string } | { ok: false; error: string }

const PHONE_ERROR = 'Escribí tu WhatsApp con código de país si no es de El Salvador'

export function normalizePhone(input: string): PhoneResult {
  const cleaned = input.trim().replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1)
    if (/^\d{8,15}$/.test(digits)) return { ok: true, e164: '+' + digits }
    return { ok: false, error: PHONE_ERROR }
  }
  let digits = cleaned
  if (digits.length === 11 && digits.startsWith('503')) digits = digits.slice(3)
  if (/^[267]\d{7}$/.test(digits)) return { ok: true, e164: '+503' + digits }
  return { ok: false, error: PHONE_ERROR }
}

export function waNumber(e164: string): string {
  return e164.replace(/^\+/, '')
}
