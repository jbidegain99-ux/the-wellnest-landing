'use client'

import * as React from 'react'
import { Save, Globe, Mail, CreditCard, Bell, Database, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export default function AdminConfiguracionPage() {
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSeedLoading, setIsSeedLoading] = React.useState(false)
  const [seedResult, setSeedResult] = React.useState<{
    success?: boolean
    message?: string
    data?: Record<string, number>
  } | null>(null)

  const handleSave = async () => {
    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsLoading(false)
  }

  const handleSeedDatabase = async () => {
    if (!confirm('¿Estás seguro de que quieres poblar la base de datos con datos iniciales? Esto eliminará las clases existentes.')) {
      return
    }

    setIsSeedLoading(true)
    setSeedResult(null)

    try {
      const response = await fetch('/api/admin/seed', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        setSeedResult({
          success: true,
          message: 'Base de datos poblada exitosamente',
          data: data.data,
        })
      } else {
        setSeedResult({
          success: false,
          message: data.error || 'Error al poblar la base de datos',
        })
      }
    } catch {
      setSeedResult({
        success: false,
        message: 'Error de conexión',
      })
    } finally {
      setIsSeedLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">
            Configuración
          </h1>
          <p className="text-gray-600 mt-1">
            Administra la configuración del sitio
          </p>
        </div>
        <Button onClick={handleSave} isLoading={isLoading}>
          <Save className="h-4 w-4 mr-2" />
          Guardar Cambios
        </Button>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Información General
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Nombre del estudio"
            defaultValue="The Wellnest"
          />
          <Textarea
            label="Descripción"
            defaultValue="Tu santuario de bienestar integral en El Salvador."
          />
          <Input
            label="Teléfono"
            defaultValue="+503 1234 5678"
          />
          <Input
            label="Email de contacto"
            type="email"
            defaultValue="hola@thewellnest.sv"
          />
          <Input
            label="Dirección"
            defaultValue="Colonia Escalón, San Salvador, El Salvador"
          />
        </CardContent>
      </Card>

      {/* Email Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Configuración de Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Servidor SMTP"
            defaultValue="smtp.gmail.com"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Puerto SMTP"
              defaultValue="587"
            />
            <Input
              label="Email remitente"
              type="email"
              defaultValue="noreply@thewellnest.sv"
            />
          </div>
          <Input
            label="Usuario SMTP"
            defaultValue="noreply@thewellnest.sv"
          />
          <Input
            label="Contraseña SMTP"
            type="password"
            defaultValue="********"
          />
        </CardContent>
      </Card>

      {/* Payment Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Configuración de Pagos (Stripe)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Stripe Publishable Key"
            defaultValue="pk_test_..."
          />
          <Input
            label="Stripe Secret Key"
            type="password"
            defaultValue="sk_test_..."
          />
          <div className="p-4 bg-beige rounded-lg text-sm text-gray-600">
            <p>
              <strong>Nota:</strong> Para aceptar pagos en El Salvador, asegúrate
              de que tu cuenta de Stripe esté configurada correctamente y cumpla
              con las regulaciones locales.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer py-2">
            <div>
              <p className="font-medium text-foreground">
                Notificar nuevas reservas
              </p>
              <p className="text-sm text-gray-500">
                Recibe un email cuando alguien reserve una clase
              </p>
            </div>
            <input
              type="checkbox"
              defaultChecked
              className="h-5 w-5 rounded border-beige-dark text-primary focus:ring-primary"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer py-2">
            <div>
              <p className="font-medium text-foreground">
                Notificar nuevas compras
              </p>
              <p className="text-sm text-gray-500">
                Recibe un email cuando alguien compre un paquete
              </p>
            </div>
            <input
              type="checkbox"
              defaultChecked
              className="h-5 w-5 rounded border-beige-dark text-primary focus:ring-primary"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer py-2">
            <div>
              <p className="font-medium text-foreground">
                Notificar mensajes de contacto
              </p>
              <p className="text-sm text-gray-500">
                Recibe un email cuando alguien envíe un mensaje
              </p>
            </div>
            <input
              type="checkbox"
              defaultChecked
              className="h-5 w-5 rounded border-beige-dark text-primary focus:ring-primary"
            />
          </label>
        </CardContent>
      </Card>

      {/* Cancellation Policy */}
      <Card>
        <CardHeader>
          <CardTitle>Política de Cancelación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Horas mínimas de anticipación"
              type="number"
              defaultValue="4"
            />
            <Input
              label="Cupos por clase (default)"
              type="number"
              defaultValue="15"
            />
          </div>
          <Textarea
            label="Mensaje de política de cancelación"
            defaultValue="Puedes cancelar tu reserva hasta 4 horas antes del inicio de la clase sin penalización. Las cancelaciones tardías o no asistencias resultarán en la pérdida de la clase de tu paquete."
          />
        </CardContent>
      </Card>

      {/* Database Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Administración de Base de Datos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Precaución</p>
              <p>
                Esta acción poblará la base de datos con datos iniciales (disciplinas,
                instructores, paquetes y clases para los próximos 14 días). Las clases
                existentes serán eliminadas.
              </p>
            </div>
          </div>

          <Button
            onClick={handleSeedDatabase}
            isLoading={isSeedLoading}
            variant="outline"
          >
            <Database className="h-4 w-4 mr-2" />
            Poblar Base de Datos
          </Button>

          {seedResult && (
            <div
              className={`p-4 rounded-lg ${
                seedResult.success
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              <p className="font-medium">{seedResult.message}</p>
              {seedResult.data && (
                <ul className="mt-2 text-sm space-y-1">
                  <li>Disciplinas: {seedResult.data.disciplines}</li>
                  <li>Instructores: {seedResult.data.instructors}</li>
                  <li>Paquetes: {seedResult.data.packages}</li>
                  <li>Clases creadas: {seedResult.data.classes}</li>
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
