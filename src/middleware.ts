import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
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

export const config = {
  matcher: [
    '/perfil/:path*',
    '/reservar/:path*',
    '/carrito/:path*',
    '/checkout/:path*',
    '/admin/:path*',
  ],
}
