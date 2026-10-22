'use client'

import * as React from 'react'

type Other = { seq: number; label: string; holderName: string | null; shareUrl: string }

/** Botón "Pasar invitación" de la entrada del comprador: lista las demás para mandarlas por WhatsApp. */
export function PassInvitations({ others }: { others: Other[] }) {
  const [open, setOpen] = React.useState(false)
  const pending = others.filter((o) => !o.holderName).length
  return (
    <div className="flex w-full flex-col gap-3">
      <button type="button" className="ev-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {others.length === 1 ? 'PASAR LA OTRA INVITACIÓN' : `PASAR INVITACIONES (${others.length})`}
      </button>
      {open && (
        <ul className="flex flex-col gap-2">
          {others.map((o) => (
            <li key={o.seq} className="flex items-center justify-between gap-3 border border-[#3A2C24] px-3 py-2">
              <div className="flex flex-col">
                <span className="ev-cinzel text-[12px] tracking-[0.14em]">{o.label}</span>
                <span className="text-[15px] text-[#CDBFA8]">{o.holderName ? `Reclamada por ${o.holderName}` : 'Sin reclamar'}</span>
              </div>
              {!o.holderName && (
                <a href={o.shareUrl} target="_blank" rel="noopener noreferrer" className="ev-btn-outline min-h-[44px] px-3 text-[11px]">
                  WHATSAPP
                </a>
              )}
            </li>
          ))}
          {pending > 0 && (
            <li className="text-[14px] italic text-[#CDBFA8]">Cada acompañante abre su enlace y deja sus datos para recibir su QR.</li>
          )}
        </ul>
      )}
    </div>
  )
}
