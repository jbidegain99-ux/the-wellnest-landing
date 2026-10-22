// Rutas que no muestran el Navbar/Footer del sitio: el admin (tiene su propio
// layout) y las páginas del evento (estética propia, pantalla completa).
const PREFIXES = ['/admin', '/halloween', '/entrada']

export function hidesSiteChrome(pathname: string | null): boolean {
  if (!pathname) return false
  return PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}
