'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ClaimForm } from './ClaimForm'
import type { ActivateResult } from '@/lib/events/activate'

export function ActivateButton({ token }: { token: string }) {
  const router = useRouter()
  const [state, setState] = React.useState<'idle' | 'sending' | 'claim' | 'sent' | 'error'>('idle')
  const [message, setMessage] = React.useState('')

  async function activate() {
    setState('sending')
    try {
      const res = await fetch(`/api/entradas/${token}/activar`, { method: 'POST' })
      const data: Partial<ActivateResult> & { error?: string } = await res.json().catch(() => ({}))
      if (data.result === 'email-sent') {
        setMessage(`Te mandamos un correo a ${data.maskedEmail} para que elijas tu contraseña.`)
        setState('sent')
      } else if (data.result === 'has-password') {
        router.push('/login')
      } else if (data.result === 'unclaimed') {
        setState('claim')
      } else {
        setMessage(data.error ?? 'No pudimos enviarte el correo. Probá de nuevo en unos minutos.')
        setState('error')
      }
    } catch {
      setMessage('No pudimos conectarnos. Revisá tu conexión.')
      setState('error')
    }
  }

  if (state === 'sent') return <p role="status" className="text-center text-[17px] font-semibold">{message}</p>
  if (state === 'claim') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[16px]">Antes, dejanos tus datos:</p>
        <ClaimForm token={token} onClaimed={activate} />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={activate} disabled={state === 'sending'} className="ev-btn mt-1">
        {state === 'sending' ? 'ENVIANDO…' : 'ACTIVAR MI CUENTA'}
      </button>
      <p className="text-center text-[15px] text-[color:var(--ev-muted)]">Solo elegís una contraseña.</p>
      {state === 'error' && <p role="alert" className="ev-error text-center">{message}</p>}
    </div>
  )
}
