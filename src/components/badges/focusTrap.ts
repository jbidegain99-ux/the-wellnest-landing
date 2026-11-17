// Regla de Tab/Shift+Tab dentro de un diálogo modal (pura, sin DOM).

export interface TabTrapInput<T> {
  /** Elementos enfocables del panel, en orden. */
  items: readonly T[]
  /** Elemento con el foco (document.activeElement). */
  active: T | null
  /** El panel del diálogo (puede tener el foco: tabIndex -1). */
  panel: T
  /** ¿El nodo está dentro del panel (o es el panel)? */
  inside: (node: T | null) => boolean
  shiftKey: boolean
}

/**
 * A dónde mover el foco al pulsar Tab, o null si el navegador puede seguir solo.
 * El panel cuenta como borde: con el foco en el panel (foco inicial), Shift+Tab
 * iría al elemento anterior de la página, así que va al último.
 */
export function tabTrapTarget<T>({ items, active, panel, inside, shiftKey }: TabTrapInput<T>): T | null {
  if (items.length === 0) return panel
  const first = items[0]
  const last = items[items.length - 1]
  const outside = active === null || !inside(active)
  if (shiftKey) return active === first || active === panel || outside ? last : null
  return active === last || outside ? first : null
}
