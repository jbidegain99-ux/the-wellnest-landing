'use client'

import * as React from 'react'
import { tabTrapTarget } from './focusTrap'

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Comportamiento de un diálogo modal mientras está montado: bloquea el scroll
 * del body, pone el foco en `initialFocusRef`, Escape llama a `onClose`, Tab
 * queda dentro de `panelRef` y al desmontar el foco vuelve a donde estaba.
 */
export function useModalFocus(
  panelRef: React.RefObject<HTMLElement>,
  initialFocusRef: React.RefObject<HTMLElement>,
  onClose: () => void
): void {
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose

  React.useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    initialFocusRef.current?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      const panel = panelRef.current
      if (e.key !== 'Tab' || !panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
      const next = tabTrapTarget({
        items,
        active,
        panel,
        inside: (node) => node !== null && panel.contains(node),
        shiftKey: e.shiftKey,
      })
      if (next) {
        e.preventDefault()
        next.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previous?.focus()
    }
  }, [panelRef, initialFocusRef])
}
