import { randomBytes, randomInt } from 'crypto'

// Sin 0/O, 1/I/L: el código se escribe a mano en el concepto de la transferencia
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateOrderCode(prefix: string): string {
  let code = ''
  for (let i = 0; i < 4; i++) code += ALPHABET[randomInt(ALPHABET.length)]
  return prefix + code
}

export function generateToken(): string {
  return randomBytes(32).toString('hex')
}

export function ticketLabel(orderCode: string, seq: number): string {
  return `${orderCode}-${seq}`
}
