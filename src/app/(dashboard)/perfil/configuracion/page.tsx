'use client'

import * as React from 'react'
import { signOut } from 'next-auth/react'
import { Bell, Mail, Phone, Trash2, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export default function ConfiguracionPage() {
  const [notifications, setNotifications] = React.useState({
    email_reservations: true,
    email_reminders: true,
    email_promotions: false,
    email_newsletter: true,
    sms_reminders: false,
  })

  const handleToggle = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground">
          Configuración
        </h1>
        <p className="text-gray-600 mt-1">
          Administra tus preferencias de cuenta
        </p>
      </div>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email notifications */}
          <div>
            <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-medium text-foreground">
                    Confirmación de reservas
                  </p>
                  <p className="text-sm text-gray-500">
                    Recibe un email cuando reserves una clase
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.email_reservations}
                  onChange={() => handleToggle('email_reservations')}
                  className="h-5 w-5 rounded border-beige-dark text-primary focus:ring-primary"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-medium text-foreground">
                    Recordatorios de clases
                  </p>
                  <p className="text-sm text-gray-500">
                    Recibe un recordatorio 2 horas antes de tu clase
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.email_reminders}
                  onChange={() => handleToggle('email_reminders')}
                  className="h-5 w-5 rounded border-beige-dark text-primary focus:ring-primary"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-medium text-foreground">
                    Promociones y ofertas
                  </p>
                  <p className="text-sm text-gray-500">
                    Entérate de descuentos exclusivos
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.email_promotions}
                  onChange={() => handleToggle('email_promotions')}
                  className="h-5 w-5 rounded border-beige-dark text-primary focus:ring-primary"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-medium text-foreground">Newsletter</p>
                  <p className="text-sm text-gray-500">
                    Artículos y consejos de bienestar
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.email_newsletter}
                  onChange={() => handleToggle('email_newsletter')}
                  className="h-5 w-5 rounded border-beige-dark text-primary focus:ring-primary"
                />
              </label>
            </div>
          </div>

          {/* SMS notifications */}
          <div className="pt-4 border-t border-beige">
            <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
              <Phone className="h-4 w-4" />
              SMS
            </h3>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-medium text-foreground">
                  Recordatorios por SMS
                </p>
                <p className="text-sm text-gray-500">
                  Recibe un SMS antes de tu clase
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifications.sms_reminders}
                onChange={() => handleToggle('sms_reminders')}
                className="h-5 w-5 rounded border-beige-dark text-primary focus:ring-primary"
              />
            </label>
          </div>

          <Button variant="outline" className="w-full sm:w-auto">
            Guardar preferencias
          </Button>
        </CardContent>
      </Card>

      {/* Account Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Cuenta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-beige">
            <div>
              <p className="font-medium text-foreground">Cerrar sesión</p>
              <p className="text-sm text-gray-500">
                Cierra sesión en este dispositivo
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-gray-600"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar sesión
            </Button>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-[var(--color-error)]">
                Eliminar cuenta
              </p>
              <p className="text-sm text-gray-500">
                Elimina permanentemente tu cuenta y todos tus datos
              </p>
            </div>
            <Button
              variant="ghost"
              className="text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
