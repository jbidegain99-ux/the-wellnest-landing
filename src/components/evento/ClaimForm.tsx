'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { claimTicketInput } from '@/lib/events/schemas'

/** Formulario para que un acompañante reclame su invitación y reciba su QR. */
export function ClaimForm({ token, onClaimed }: { token: string; onClaimed?: () => void }) {
  const router = useRouter()
  const [optIn, setOptIn] = React.useState(true)
  const [error, setError] = React.useState('')
  const [sending, setSending] = React.useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (sending) return
    setError('')
    const form = new FormData(e.currentTarget)
    const parsed = claimTicketInput.safeParse({
      name: String(form.get('name') ?? ''),
      phone: String(form.get('phone') ?? ''),
      email: String(form.get('email') ?? ''),
      marketingOptIn: optIn,
    })
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Revisá tus datos')
      return
    }
    setSending(true)
    try {
      const res = await fetch(`/api/entradas/${token}/reclamar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const data: { error?: string } = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'No pudimos guardar tus datos. Probá de nuevo.')
        if (res.status === 409) router.refresh()
        return
      }
      if (onClaimed) onClaimed()
      else router.refresh()
    } catch {
      setError('No pudimos guardar tus datos. Revisá tu conexión.')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex w-full flex-col gap-3 text-left">
      <div className="flex flex-col gap-[2px]">
        <label htmlFor="cl-nombre" className="ev-label">NOMBRE COMPLETO</label>
        <input id="cl-nombre" name="name" type="text" autoComplete="name" required className="ev-input" />
      </div>
      <div className="flex flex-col gap-[2px]">
        <label htmlFor="cl-wa" className="ev-label">WHATSAPP</label>
        <input id="cl-wa" name="phone" type="tel" autoComplete="tel" inputMode="tel" required placeholder="+503 0000 0000" className="ev-input" />
      </div>
      <div className="flex flex-col gap-[2px]">
        <label htmlFor="cl-correo" className="ev-label">CORREO</label>
        <input id="cl-correo" name="email" type="email" autoComplete="email" required placeholder="tucorreo@ejemplo.com" className="ev-input" />
      </div>
      <label className="flex cursor-pointer items-start gap-[10px] text-[15px] leading-[1.3] text-[color:var(--ev-muted)]">
        <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-[2px] h-[18px] w-[18px] flex-shrink-0 [accent-color:var(--ev-accent)]" />
        Quiero enterarme de las clases y eventos de Wellnest
      </label>
      {error && <p role="alert" className="ev-error">{error}</p>}
      <button type="submit" disabled={sending} className="ev-btn">{sending ? 'ENVIANDO…' : 'RECIBIR MI QR'}</button>
    </form>
  )
}
