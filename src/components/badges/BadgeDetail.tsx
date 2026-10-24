'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, X } from 'lucide-react'
import { BadgeArt } from '@/components/badges/BadgeArt'
import {
  badgeProgressText,
  formatBadgeDate,
  progressRatio,
  remainingText,
} from '@/lib/progress/badges/display'
import { CATEGORY_LABELS, type BadgeState } from '@/lib/progress/badges/types'

interface BadgeDetailProps {
  /** Insignia abierta; `null` = cerrado. */
  badge: BadgeState | null
  onClose: () => void
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Detalle de un logro: hoja inferior en móvil, modal centrado en escritorio.
 * Escape o tocar fuera lo cierran; el foco queda dentro y vuelve al botón que lo abrió.
 */
export function BadgeDetail({ badge, onClose }: BadgeDetailProps) {
  if (!badge) return null
  return createPortal(<DetailDialog badge={badge} onClose={onClose} />, document.body)
}

function DetailDialog({ badge, onClose }: { badge: BadgeState; onClose: () => void }) {
  const titleId = React.useId()
  const descId = React.useId()
  const artId = React.useId()
  const panelRef = React.useRef<HTMLDivElement>(null)
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose

  React.useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previous?.focus()
    }
  }, [])

  const earned = badge.earnedAt !== null
  const ratio = progressRatio(badge)

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <div
        aria-hidden="true"
        className="badge-backdrop-in absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="badge-sheet-in relative w-full max-h-[92vh] overflow-y-auto rounded-t-[28px] bg-white shadow-2xl sm:max-w-md sm:rounded-[28px]"
      >
        <div className="absolute left-1/2 top-2.5 h-1.5 w-10 -translate-x-1/2 rounded-full bg-beige-dark sm:hidden" aria-hidden="true" />
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full text-gray-600 hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
        >
          <X className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">Cerrar</span>
        </button>

        {/* Vitrina: la medalla sobre un halo cálido (ganada) o un fondo neutro (bloqueada) */}
        <div
          className="flex justify-center rounded-t-[28px] px-6 pb-6 pt-12"
          style={{
            background: earned
              ? 'radial-gradient(circle at 50% 58%, #FBEFD9 0%, #F5F0E8 46%, #FFFFFF 78%)'
              : 'linear-gradient(180deg, #F5F0E8 0%, #FFFFFF 100%)',
          }}
        >
          <BadgeArt
            badge={badge}
            size={184}
            progress={earned ? undefined : ratio}
            idSuffix={artId}
            className="badge-flip-in"
          />
        </div>

        <div className="px-6 pb-8 pt-1 text-center sm:px-8">
          <p className="text-sm font-medium text-primary-700">{CATEGORY_LABELS[badge.category]}</p>
          <h2 id={titleId} className="mt-1 text-2xl font-semibold text-foreground">
            {badge.title}
          </h2>
          <p id={descId} className="mx-auto mt-2 max-w-xs text-gray-600">
            {badge.description}
          </p>

          {earned && badge.earnedAt ? (
            <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Ganado el {formatBadgeDate(badge.earnedAt)}
            </p>
          ) : (
            <div className="mx-auto mt-6 max-w-xs text-left">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-foreground">{badgeProgressText(badge)}</span>
                <span className="text-gray-600">{remainingText(badge)}</span>
              </div>
              <div
                className="mt-2 h-2.5 overflow-hidden rounded-full bg-beige"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={badge.target}
                aria-valuenow={badge.current}
                aria-label="Avance"
              >
                <div
                  className="h-full rounded-full bg-primary-600"
                  style={{ width: `${Math.max(ratio * 100, ratio > 0 ? 4 : 0)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
