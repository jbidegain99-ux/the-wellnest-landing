/**
 * Reordenamiento de la lista de espera.
 *
 * La cola se promueve por `position` ascendente (ver waitlistPromotion.ts), así
 * que mover a alguien es reescribir las posiciones 1..N sin huecos. Esta función
 * es pura: recibe los ids en el orden actual y devuelve el orden nuevo.
 *
 * Devuelve null si el id no está en la cola o si la posición destino no es un
 * entero entre 1 y el tamaño de la cola.
 */
export function moveInQueue(
  orderedIds: readonly string[],
  id: string,
  toPosition: number
): string[] | null {
  const from = orderedIds.indexOf(id)
  if (from === -1) return null
  if (!Number.isInteger(toPosition) || toPosition < 1 || toPosition > orderedIds.length) {
    return null
  }
  const next = orderedIds.filter((x) => x !== id)
  next.splice(toPosition - 1, 0, id)
  return next
}
