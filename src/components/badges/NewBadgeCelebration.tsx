'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import { BadgeArt } from '@/components/badges/BadgeArt'
import { useModalFocus } from '@/components/badges/useModalFocus'
import { useProgressGlance } from '@/components/progress/ProgressGlanceProvider'
import { Button } from '@/components/ui/Button'
import { hidesSiteChrome } from '@/lib/events/routes'
import type { GlanceBadge } from '@/lib/progress/glance'
import { glanceBadgeState } from '@/lib/progress/glanceText'

/** Espera breve para que la página se pinte antes de celebrar. */
const OPEN_DELAY_MS = 700

/**
 * Celebración de un logro nuevo. Se monta una vez (en Providers) y aparece
 * cuando hay logros ganados que este dispositivo no ha visto: muestra el más
 * reciente y "+N logros más". Cerrar o ir a Mis logros los marca como vistos.
 * No aparece en el admin ni en las páginas de evento.
 */
export function NewBadgeCelebration() {
  const { glance, unseen, markSeen } = useProgressGlance()
  const pathname = usePathname()
  const router = useRouter()
  // Lo que se muestra queda fijo mientras el diálogo está abierto.
  const [shown, setShown] = React.useState<{ badge: GlanceBadge; ids: string[] } | null>(null)

  const blockedRoute = hidesSiteChrome(pathname)

  React.useEffect(() => {
    if (shown || blockedRoute || !glance || unseen.length === 0) return
    const badge = glance.recentBadges.find((b) => b.id === unseen[0])
    if (!badge) return
    const ids = unseen
    const timer = window.setTimeout(() => setShown({ badge, ids }), OPEN_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [shown, blockedRoute, glance, unseen])

  const close = React.useCallback(() => {
    if (!shown) return
    markSeen(shown.ids)
    setShown(null)
  }, [shown, markSeen])

  const goToBadges = React.useCallback(() => {
    if (!shown) return
    markSeen(shown.ids)
    setShown(null)
    router.push('/perfil/logros')
  }, [shown, markSeen, router])

  if (!shown || blockedRoute) return null
  return createPortal(
    <CelebrationDialog badge={shown.badge} extra={shown.ids.length - 1} onClose={close} onGoToBadges={goToBadges} />,
    document.body
  )
}

interface CelebrationDialogProps {
  badge: GlanceBadge
  /** Otros logros sin ver además del que se muestra. */
  extra: number
  onClose: () => void
  onGoToBadges: () => void
}

/** Destello de cuatro puntas (sin arcos). */
function Sparkle({ className, size, delay }: { className: string; size: number; delay: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`celebrate-twinkle absolute ${className}`}
      style={{ animationDelay: delay }}
    >
      <path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z" fill="#C4A77D" />
    </svg>
  )
}

function CelebrationDialog({ badge, extra, onClose, onGoToBadges }: CelebrationDialogProps) {
  const titleId = React.useId()
  const descId = React.useId()
  const artId = React.useId()
  const panelRef = React.useRef<HTMLDivElement>(null)
  // El foco inicial va al panel (no a un botón): Enter no navega por accidente
  // y no aparece un anillo de foco al abrir; Tab entra a los botones.
  useModalFocus(panelRef, panelRef, onClose)

  const state = React.useMemo(() => glanceBadgeState(badge), [badge])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div aria-hidden="true" className="badge-backdrop-in absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className="celebrate-pop outline-none focus-visible:outline-none relative w-full max-w-sm max-h-[92vh] overflow-y-auto rounded-[28px] bg-white text-center shadow-2xl"
      >
        {/* Vitrina: la medalla entra con escala sobre un halo de arena */}
        <div
          className="relative flex justify-center overflow-hidden rounded-t-[28px] px-6 pb-4 pt-10"
          style={{ background: 'linear-gradient(180deg, #FFF8EF 0%, #FFFFFF 100%)' }}
        >
          <div className="relative h-[176px] w-[176px]">
            <div
              aria-hidden="true"
              className="celebrate-halo absolute -inset-10 rounded-full"
              style={{
                background:
                  'radial-gradient(circle, rgba(232,203,150,0.75) 0%, rgba(245,228,196,0.55) 38%, rgba(255,248,239,0) 70%)',
              }}
            />
            <Sparkle className="-left-3 top-6" size={18} delay="0.55s" />
            <Sparkle className="-right-2 top-0" size={13} delay="0.75s" />
            <Sparkle className="-right-5 bottom-8" size={16} delay="0.95s" />
            <BadgeArt badge={state} size={176} animate idSuffix={artId} className="relative" />
            {/* El brillo cruza solo el disco de la medalla */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-[6%] overflow-hidden rounded-full">
              <span
                className="celebrate-shine absolute inset-y-[-20%] left-0 w-1/3"
                style={{
                  background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.7) 50%, rgba(255,255,255,0) 100%)',
                  mixBlendMode: 'soft-light',
                }}
              />
            </span>
          </div>
        </div>

        <div className="px-6 pb-6 pt-2 sm:px-8 sm:pb-8">
          <p className="text-sm font-semibold text-primary-700">¡Nuevo logro!</p>
          <h2 id={titleId} className="mt-1 text-2xl font-semibold text-foreground">
            {badge.title}
          </h2>
          <p id={descId} className="mx-auto mt-2 max-w-xs text-gray-600">
            {badge.description}
          </p>
          {extra > 0 && (
            <p className="mt-4 inline-flex rounded-full bg-beige px-3 py-1 text-sm font-medium text-foreground">
              +{extra} {extra === 1 ? 'logro más' : 'logros más'}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-2">
            <Button type="button" onClick={onGoToBadges} className="w-full">
              Ver mis logros
            </Button>
            <Button type="button" variant="ghost" onClick={onClose} className="w-full">
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
