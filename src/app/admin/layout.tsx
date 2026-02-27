'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  Calendar,
  Users,
  UserCheck,
  Tag,
  Settings,
  Menu,
  X,
  ArrowLeft,
  Image,
  RefreshCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Paquetes', href: '/admin/paquetes', icon: Package },
  { name: 'Horarios', href: '/admin/horarios', icon: Calendar },
  { name: 'Usuarios', href: '/admin/usuarios', icon: Users },
  { name: 'Instructores', href: '/admin/instructores', icon: UserCheck },
  { name: 'Promociones', href: '/admin/promociones', icon: Tag },
  { name: 'Reembolsos', href: '/admin/reembolsos', icon: RefreshCcw },
  { name: 'Brand Assets', href: '/admin/assets', icon: Image },
  { name: 'Configuración', href: '/admin/configuracion', icon: Settings },
]

export default function AdminLayout({
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

  if (!session || session.user?.role !== 'ADMIN') {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-beige">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
        <div className="flex items-center justify-between p-4">
          <Link href="/" className="flex items-center gap-2 text-gray-600">
            <ArrowLeft className="h-5 w-5" />
            <span>Volver al sitio</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-beige"
          >
            {sidebarOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transform transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-beige">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="font-logo text-2xl font-normal tracking-[0.1em] text-[#453C34]">
                wellnest.
              </span>
            </Link>
            <p className="text-xs font-medium tracking-[0.15em] text-gray-400 uppercase mt-1">
              Panel Admin
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive =
                pathname === item.href ||
                (item.href !== '/admin' && pathname.startsWith(item.href))

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-gray-600 hover:bg-beige hover:text-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-beige">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al sitio
            </Link>
          </div>
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
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  )
}
