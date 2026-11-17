'use client'

import * as React from 'react'
import { BadgeArt } from '@/components/badges/BadgeArt'
import { badgeProgressText, formatBadgeDate, progressRatio } from '@/lib/progress/badges/display'
import type { BadgeState } from '@/lib/progress/badges/types'
import { cn } from '@/lib/utils'

interface BadgeTileProps {
  badge: BadgeState
  onSelect: (badge: BadgeState) => void
  size?: number
}

/** Una insignia tocable: medalla, título y fecha (ganada) o avance (bloqueada). */
export function BadgeTile({ badge, onSelect, size = 88 }: BadgeTileProps) {
  const idSuffix = React.useId()
  const earned = badge.earnedAt !== null

  return (
    <button
      type="button"
      onClick={() => onSelect(badge)}
      aria-haspopup="dialog"
      className={cn(
        'group flex w-full flex-col items-center rounded-2xl px-1 pb-2 pt-3 text-center',
        'transition-colors hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600'
      )}
    >
      <BadgeArt
        badge={badge}
        size={size}
        progress={earned ? undefined : progressRatio(badge)}
        idSuffix={idSuffix}
        className={cn(
          'transition-transform duration-300 motion-reduce:transition-none',
          earned && 'group-hover:-translate-y-0.5 group-hover:scale-[1.03]'
        )}
      />
      <span
        className={cn(
          'mt-2 line-clamp-2 text-[13px] font-medium leading-snug',
          earned ? 'text-foreground' : 'text-gray-600'
        )}
      >
        {badge.title}
      </span>
      <span className={cn('mt-0.5 text-xs leading-snug', earned ? 'text-primary-700' : 'text-gray-500')}>
        {earned && badge.earnedAt ? formatBadgeDate(badge.earnedAt) : badgeProgressText(badge)}
      </span>
    </button>
  )
}

interface BadgeGridProps {
  badges: BadgeState[]
  onSelect: (badge: BadgeState) => void
  /** Columnas: "full" = 3 / 4 / 5 / 6 según el ancho; "row" = 3 / 6 (para una fila de recientes). */
  layout?: 'full' | 'row'
  size?: number
  label?: string
}

export function BadgeGrid({ badges, onSelect, layout = 'full', size, label }: BadgeGridProps) {
  return (
    <ul
      aria-label={label}
      className={cn(
        'grid gap-x-2 gap-y-3',
        layout === 'full' ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6' : 'grid-cols-3 sm:grid-cols-6'
      )}
    >
      {badges.map((b) => (
        <li key={b.id}>
          <BadgeTile badge={b} onSelect={onSelect} size={size} />
        </li>
      ))}
    </ul>
  )
}
