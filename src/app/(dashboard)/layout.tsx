'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import {
  User,
  Package,
  Calendar,
  Clock,
  History,
  Settings,
  Gift,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Mi Perfil', href: '/perfil', icon: User },
  { name: 'Mis Paquetes', href: '/perfil/paquetes', icon: Package },
  { name: 'Próximas Reservas', href: '/perfil/reservas', icon: Calendar },
  { name: 'Lista de Espera', href: '/perfil/espera', icon: Clock },
  { name: 'Historial', href: '/perfil/historial', icon: History },
  { name: 'Mis Invitaciones', href: '/perfil/invitaciones', icon: Gift },
  { name: 'Configuración', href: '/perfil/configuracion', icon: Settings },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!session) {
    redirect('/login?redirect=/perfil')
  }

  return (
    <div className="min-h-screen bg-cream pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden fixed bottom-4 right-4 z-50 p-4 bg-primary text-white rounded-full shadow-lg"
          >
            {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          {/* Sidebar */}
          <aside
            className={cn(
              'fixed inset-y-0 left-0 z-40 w-64 bg-white transform transition-transform duration-300 lg:relative lg:translate-x-0 lg:block pt-24 lg:pt-0',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            )}
          >
            <div className="lg:sticky lg:top-24">
              <nav className="p-4 space-y-1">
                {navigation.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-gray-600 hover:bg-beige hover:text-foreground'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {item.name}
                    </Link>
                  )
                })}
              </nav>
            </div>
          </aside>

          {/* Backdrop */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-30 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Main content */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  )
}
