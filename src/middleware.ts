import { withAuth, type NextRequestWithAuth } from 'next-auth/middleware'
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import { isQa } from '@/lib/appEnv'
import { qaGateDecision } from '@/lib/qaGate'

// Reglas de sesión de siempre (producción y QA). Sin cambios respecto de la
// versión anterior: solo se invoca para las rutas de AUTH_PREFIXES.
const authMiddleware = withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const isAdminRoute = req.nextUrl.pathname.startsWith('/admin')

    // Check admin access
    if (isAdminRoute && token?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const isAuthRoute = ['/perfil', '/reservar', '/carrito', '/checkout'].some(
          (path) => req.nextUrl.pathname.startsWith(path)
        )
        const isAdminRoute = req.nextUrl.pathname.startsWith('/admin')

        // Require auth for protected routes. token?.id (no solo token): una
        // sesión invalidada por cambio de contraseña conserva el token pero
        // sin id — debe redirigir a login, no quedar "zombie" con 401s.
        if (isAuthRoute || isAdminRoute) {
          return !!token?.id
        }

        return true
      },
    },
  }
)

// Equivale al matcher anterior (`/perfil/:path*`, etc.): el prefijo exacto o
// cualquier subruta, pero no `/perfiles`.
const AUTH_PREFIXES = ['/perfil', '/reservar', '/carrito', '/checkout', '/admin']

function needsAuth(pathname: string): boolean {
  return AUTH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  // 1) Bloqueo de QA. Fuera de QA (producción) siempre 'allow'.
  const decision = qaGateDecision({
    pathname: req.nextUrl.pathname,
    authorization: req.headers.get('authorization'),
    password: process.env.QA_ACCESS_PASSWORD,
    qa: isQa(),
  })
  if (decision === 'challenge') {
    return new NextResponse('Se requiere contraseña de QA', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Wellnest QA"' },
    })
  }

  // 2) Sesión de next-auth, solo en las rutas que ya protegía.
  if (needsAuth(req.nextUrl.pathname)) {
    return authMiddleware(req as NextRequestWithAuth, event)
  }

  return NextResponse.next()
}

export const config = {
  // Todo salvo los assets de Next: el bloqueo de QA necesita ver cada página.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
