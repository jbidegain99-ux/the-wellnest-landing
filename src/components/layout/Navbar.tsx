'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Menu, X, User, ShoppingBag, LogOut, Settings } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Inicio', href: '/' },
  { name: 'Clases', href: '/clases' },
  { name: 'Paquetes', href: '/paquetes' },
  { name: 'Horarios', href: '/horarios' },
  { name: 'Equipo', href: '/equipo' },
  { name: 'Galería', href: '/galeria' },
  { name: 'Blog', href: '/blog' },
  { name: 'Contacto', href: '/contacto' },
]

export function Navbar() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [isScrolled, setIsScrolled] = React.useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false)
  const pathname = usePathname()
  const { data: session, status } = useSession()

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  React.useEffect(() => {
    setIsOpen(false)
    setIsUserMenuOpen(false)
  }, [pathname])

  const isHomePage = pathname === '/'

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled || !isHomePage
          ? 'bg-white/95 backdrop-blur-sm shadow-sm'
          : 'bg-transparent'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span
              className={cn(
                'font-logo text-2xl font-light tracking-[0.1em] transition-colors',
                isScrolled || !isHomePage ? 'text-[#453C34]' : 'text-white'
              )}
            >
              wellnest.
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                  pathname === item.href
                    ? 'bg-primary/10 text-primary'
                    : isScrolled || !isHomePage
                    ? 'text-gray-600 hover:text-primary hover:bg-primary/5'
                    : 'text-white/90 hover:text-white hover:bg-white/10'
                )}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center space-x-3">
            {status === 'loading' ? (
              <div className="h-10 w-24 bg-beige animate-pulse rounded-full" />
            ) : session ? (
              <>
                <Link href="/carrito">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      isScrolled || !isHomePage
                        ? 'text-gray-600'
                        : 'text-white hover:bg-white/10'
                    )}
                  >
                    <ShoppingBag className="h-5 w-5" />
                  </Button>
                </Link>
                <div className="relative">
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center space-x-2 p-1 rounded-full hover:bg-beige/50 transition-colors"
                  >
                    <Avatar
                      src={session.user?.image}
                      alt={session.user?.name || ''}
                      size="sm"
                    />
                  </button>
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white shadow-lg border border-beige py-2 animate-slide-down">
                      <div className="px-4 py-2 border-b border-beige">
                        <p className="font-medium text-sm">
                          {session.user?.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {session.user?.email}
                        </p>
                      </div>
                      <Link
                        href="/perfil"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-beige/50"
                      >
                        <User className="h-4 w-4" />
                        Mi Perfil
                      </Link>
                      <Link
                        href="/reservar"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-beige/50"
                      >
                        <Settings className="h-4 w-4" />
                        Reservar Clases
                      </Link>
                      {session.user?.role === 'ADMIN' && (
                        <Link
                          href="/admin"
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-beige/50"
                        >
                          <Settings className="h-4 w-4" />
                          Panel Admin
                        </Link>
                      )}
                      <button
                        onClick={() => signOut()}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Cerrar Sesión
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button
                    variant={isScrolled || !isHomePage ? 'ghost' : 'ghost'}
                    className={cn(
                      isScrolled || !isHomePage
                        ? 'text-gray-600'
                        : 'text-white hover:bg-white/10'
                    )}
                  >
                    Iniciar Sesión
                  </Button>
                </Link>
                <Link href="/registro">
                  <Button>Registrarse</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              'lg:hidden p-2 rounded-lg transition-colors',
              isScrolled || !isHomePage
                ? 'text-gray-600 hover:bg-beige'
                : 'text-white hover:bg-white/10'
            )}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="lg:hidden bg-white border-t border-beige animate-slide-down">
          <div className="px-4 py-4 space-y-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'block px-4 py-3 rounded-lg text-base font-medium transition-colors',
                  pathname === item.href
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:bg-beige hover:text-foreground'
                )}
              >
                {item.name}
              </Link>
            ))}
            <div className="pt-4 border-t border-beige space-y-2">
              {session ? (
                <>
                  <Link
                    href="/perfil"
                    className="block px-4 py-3 rounded-lg text-base font-medium text-gray-600 hover:bg-beige"
                  >
                    Mi Perfil
                  </Link>
                  <Link
                    href="/carrito"
                    className="block px-4 py-3 rounded-lg text-base font-medium text-gray-600 hover:bg-beige"
                  >
                    Carrito
                  </Link>
                  <button
                    onClick={() => signOut()}
                    className="block w-full text-left px-4 py-3 rounded-lg text-base font-medium text-red-600 hover:bg-red-50"
                  >
                    Cerrar Sesión
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="block">
                    <Button variant="outline" className="w-full">
                      Iniciar Sesión
                    </Button>
                  </Link>
                  <Link href="/registro" className="block">
                    <Button className="w-full">Registrarse</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
