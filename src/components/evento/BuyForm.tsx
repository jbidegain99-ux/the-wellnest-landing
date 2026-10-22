'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { createOrderInput } from '@/lib/events/schemas'

const MAX_QTY = 6

export function BuyForm({ priceCents, slug }: { priceCents: number; slug: string }) {
  const router = useRouter()
  const [quantity, setQuantity] = React.useState(1)
  const [optIn, setOptIn] = React.useState(true)
  const [error, setError] = React.useState('')
  const [sending, setSending] = React.useState(false)

  const total = ((priceCents * quantity) / 100).toFixed(2)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (sending) return
    setError('')
    const form = new FormData(e.currentTarget)
    const parsed = createOrderInput.safeParse({
      name: String(form.get('name') ?? ''),
      phone: String(form.get('phone') ?? ''),
      email: String(form.get('email') ?? ''),
      quantity,
      marketingOptIn: optIn,
    })
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Revisá tus datos')
      return
    }
    setSending(true)
    try {
      const res = await fetch(`/api/eventos/${slug}/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const data: { accessToken?: string; error?: string } = await res.json().catch(() => ({}))
      if (!res.ok || !data.accessToken) {
        setError(data.error ?? 'No pudimos crear tu pedido. Probá de nuevo.')
        setSending(false)
        return
      }
      router.push(`/halloween/pedido/${data.accessToken}`)
    } catch {
      setError('No pudimos crear tu pedido. Revisá tu conexión y probá de nuevo.')
      setSending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <div className="flex flex-col gap-[2px]">
        <label htmlFor="ev-nombre" className="ev-label">NOMBRE COMPLETO</label>
        <input id="ev-nombre" name="name" type="text" autoComplete="name" required placeholder="Como aparecerá en tu invitación" className="ev-input" />
      </div>
      <div className="flex flex-col gap-[2px]">
        <label htmlFor="ev-wa" className="ev-label">WHATSAPP</label>
        <input id="ev-wa" name="phone" type="tel" autoComplete="tel" inputMode="tel" required placeholder="+503 0000 0000" className="ev-input" />
      </div>
      <div className="flex flex-col gap-[2px]">
        <label htmlFor="ev-correo" className="ev-label">CORREO</label>
        <input id="ev-correo" name="email" type="email" autoComplete="email" required placeholder="tucorreo@ejemplo.com" className="ev-input" />
      </div>
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex flex-col">
          <span className="ev-label">INVITACIONES</span>
          <span className="text-[15px] text-[#4A3B32]">${(priceCents / 100).toFixed(0)} cada una</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Quitar una invitación" disabled={quantity <= 1}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="h-11 w-11 border border-[#8C7A6B] text-[22px] text-[#1A0F0D] disabled:opacity-40">−</button>
          <span aria-live="polite" className="ev-playfair w-10 text-center text-[24px]">{quantity}</span>
          <button type="button" aria-label="Agregar una invitación" disabled={quantity >= MAX_QTY}
            onClick={() => setQuantity((q) => Math.min(MAX_QTY, q + 1))}
            className="h-11 w-11 border border-[#8C7A6B] text-[22px] text-[#1A0F0D] disabled:opacity-40">+</button>
        </div>
      </div>
      <label className="flex cursor-pointer items-start gap-[10px] text-[15px] leading-[1.3] text-[#3A2C24]">
        <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)}
          className="mt-[2px] h-[18px] w-[18px] flex-shrink-0 accent-[#8E1A24]" />
        Quiero enterarme de las clases y eventos de Wellnest
      </label>
      {error && <p role="alert" className="ev-error">{error}</p>}
      <button type="submit" disabled={sending} className="ev-btn mt-1">
        {sending ? 'ENVIANDO…' : `CONTINUAR · $${total}`}
      </button>
    </form>
  )
}
