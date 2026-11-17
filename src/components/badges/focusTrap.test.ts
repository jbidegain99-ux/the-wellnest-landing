import { describe, it, expect } from 'vitest'
import { tabTrapTarget } from './focusTrap'

// Nodos de juguete: el panel contiene a sus botones; `outside` está fuera.
const panel = { name: 'panel' }
const first = { name: 'first' }
const middle = { name: 'middle' }
const last = { name: 'last' }
const outside = { name: 'outside' }
type Node = typeof panel
const items: Node[] = [first, middle, last]
const inside = (n: Node | null) => n === panel || items.includes(n as Node)

function target(active: Node | null, shiftKey: boolean, list: Node[] = items) {
  return tabTrapTarget({ items: list, active, panel, inside, shiftKey })
}

describe('tabTrapTarget', () => {
  it('Shift+Tab con el foco en el propio panel (foco inicial) va al último, no se escapa', () => {
    expect(target(panel, true)).toBe(last)
  })

  it('Shift+Tab en el primero va al último', () => {
    expect(target(first, true)).toBe(last)
  })

  it('Tab en el último va al primero', () => {
    expect(target(last, false)).toBe(first)
  })

  it('con el foco fuera del panel, Tab va al primero y Shift+Tab al último', () => {
    expect(target(outside, false)).toBe(first)
    expect(target(outside, true)).toBe(last)
    expect(target(null, true)).toBe(last)
  })

  it('en medio, o Tab desde el panel, deja actuar al navegador', () => {
    expect(target(middle, false)).toBeNull()
    expect(target(middle, true)).toBeNull()
    expect(target(panel, false)).toBeNull()
  })

  it('sin elementos enfocables, el foco se queda en el panel', () => {
    expect(target(panel, true, [])).toBe(panel)
    expect(target(panel, false, [])).toBe(panel)
  })
})
