'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { MiniProgressRing } from '@/components/progress/MiniProgressRing'
import { useProgressGlance } from '@/components/progress/ProgressGlanceProvider'
import { glanceStripParts } from '@/lib/progress/glanceText'

/**
 * Franja de progreso en la home, justo bajo el Navbar y sobre el hero (vidrio
 * oscuro sobre el video). Sin sesión, mientras carga o si falla: no aparece.
 * Va en posición absoluta, así no mueve el hero.
 */
export function HomeProgressStrip() {
  const { glance } = useProgressGlance()
  if (!glance) return null

  const firstClass = glance.totalClasses === 0
  const parts = glanceStripParts(glance)

  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 z-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className="glance-fade-in pointer-events-auto flex items-center gap-3 rounded-2xl bg-black/35 py-2 pl-2.5 pr-3 text-white ring-1 ring-white/15 backdrop-blur-md sm:inline-flex sm:rounded-full sm:py-1.5 sm:pl-2 sm:pr-2"
        >
          {firstClass ? (
            <>
              <p className="min-w-0 flex-1 pl-1.5 text-sm leading-snug sm:flex-none">
                Reserva tu primera clase y empieza a sumar logros
              </p>
              <Link
                href="/reservar"
                className="shrink-0 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                Reservar
              </Link>
            </>
          ) : (
            <Link
              href="/perfil/progreso"
              className="group flex min-w-0 flex-1 items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:flex-none"
            >
              <MiniProgressRing
                ratio={glance.week.activeMinutes / glance.week.targetMinutes}
                size={30}
                stroke={3}
                trackColor="rgba(255,255,255,0.28)"
                arcColor="#B9CCA6"
                className="shrink-0"
              />
              <span className="min-w-0 flex-1 text-[13px] leading-snug sm:flex-none sm:text-sm">
                {/* Móvil: la semana en una línea y la racha (o el próximo logro) en otra; el resto, desde sm */}
                <span className="block font-semibold sm:inline">{parts[0]}</span>
                {parts.length > 1 && (
                  <span className="block truncate text-white/85 sm:inline">
                    <span aria-hidden="true" className="hidden px-1.5 text-white/50 sm:inline">
                      ·
                    </span>
                    {parts[1]}
                    {parts.slice(2).map((part) => (
                      <span key={part} className="hidden sm:inline">
                        <span aria-hidden="true" className="px-1.5 text-white/50">
                          ·
                        </span>
                        {part}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <span className="hidden shrink-0 whitespace-nowrap pl-1 pr-2 text-sm font-semibold underline decoration-white/50 underline-offset-4 transition-colors group-hover:decoration-white sm:inline">
                Ver mi progreso
              </span>
              <span className="sr-only sm:hidden">Ver mi progreso</span>
              <ChevronRight className="h-5 w-5 shrink-0 text-white/80 sm:hidden" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
