// Rutas que no muestran el Navbar/Footer del sitio: el admin (tiene su propio
// layout) y las páginas de cada evento (estética propia, pantalla completa).
// La lista /eventos sí los muestra: es una página más del sitio.
const PREFIXES = ['/admin', '/halloween', '/entrada']

export function hidesSiteChrome(pathname: string | null): boolean {
  if (!pathname) return false
  if (pathname.startsWith('/eventos/')) return true
  return PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}
