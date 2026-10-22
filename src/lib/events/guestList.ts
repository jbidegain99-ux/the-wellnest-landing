const key = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Orden por apellido (última palabra del nombre) y luego por nombre completo, sin importar tildes. */
export function sortByLastName<T extends { buyerName: string }>(rows: T[]): T[] {
  const last = (name: string) => {
    const parts = name.trim().split(/\s+/)
    return key(parts[parts.length - 1] ?? '')
  }
  return [...rows].sort((a, b) => last(a.buyerName).localeCompare(last(b.buyerName)) || key(a.buyerName).localeCompare(key(b.buyerName)))
}
