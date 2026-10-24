export interface QaEmailInput {
  to: string[]
  subject: string
  sink: string | undefined
  allowlist: string | undefined
}

export interface QaEmailRouted {
  to: string[]
  subject: string
}

function normalize(addr: string): string {
  return addr.trim().toLowerCase()
}

/**
 * Decide a quién se entrega realmente un correo en QA.
 * Los destinatarios de la lista permitida reciben su correo; el resto se
 * desvía al sink (una sola vez). Devuelve null si no queda nadie: no enviar.
 */
export function routeQaEmail(input: QaEmailInput): QaEmailRouted | null {
  const allowed = new Set(
    (input.allowlist ?? '').split(',').map(normalize).filter(Boolean)
  )
  const sink = input.sink ? normalize(input.sink) : ''

  const originals = input.to.map(a => a.trim()).filter(Boolean)
  const routed: string[] = []
  for (const original of originals) {
    const addr = normalize(original)
    const target = allowed.has(addr) ? addr : sink
    if (target && !routed.includes(target)) routed.push(target)
  }

  if (routed.length === 0) return null

  return {
    to: routed,
    subject: `[QA → ${originals.join(', ')}] ${input.subject}`,
  }
}
