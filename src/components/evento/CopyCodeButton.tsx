'use client'

import * as React from 'react'

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Sin permiso de portapapeles: el código queda visible para copiarlo a mano
    }
  }
  return (
    <button type="button" onClick={copy} className="ev-btn-outline min-h-[44px] text-[color:var(--ev-ink)]" aria-live="polite">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="8" y="8" width="12" height="12" />
        <path d="M16 8V4H4v12h4" />
      </svg>
      {copied ? 'COPIADO' : 'COPIAR CÓDIGO'}
    </button>
  )
}
