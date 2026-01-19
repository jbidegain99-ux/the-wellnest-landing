'use client'

import * as React from 'react'
import { Save, Globe, CreditCard, Database, AlertTriangle, Loader2, CheckCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

interface Settings {
  siteName: string
  siteDescription: string
  phone: string
  email: string
  address: string
  stripePublicKey: string
  stripeSecretKey: string
  cancellationHours: string
  defaultCapacity: string
  cancellationPolicy: string
}

const defaultSettings: Settings = {
  siteName: 'The Wellnest',
  siteDescription: 'Tu santuario de bienestar integral en El Salvador.',
  phone: '+503 1234 5678',
  email: 'hola@thewellnest.sv',
  address: 'Presidente Plaza, Colonia San Benito, San Salvador, El Salvador',
  stripePublicKey: 'pk_test_...',
  stripeSecretKey: 'sk_test_...',
  cancellationHours: '4',
  defaultCapacity: '15',
  cancellationPolicy: 'Puedes cancelar tu reserva hasta 4 horas antes del inicio de la clase sin penalización. Las cancelaciones tardías o no asistencias resultarán en la pérdida de la clase de tu paquete.',
}

export default function AdminConfiguracionPage() {
  const [settings, setSettings] = React.useState<Settings>(defaultSettings)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [saveSuccess, setSaveSuccess] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [isSeedLoading, setIsSeedLoading] = React.useState(false)
  const [seedResult, setSeedResult] = React.useState<{
    success?: boolean
    message?: string
    data?: Record<string, number>
  } | null>(null)
  const [isCleanupLoading, setIsCleanupLoading] = React.useState(false)
  const [cleanupResult, setCleanupResult] = React.useState<{
    success?: boolean
    message?: string
    results?: Record<string, number>
  } | null>(null)

  // Load settings on mount
  React.useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch('/api/admin/settings')
        if (response.ok) {
          const data = await response.json()
          setSettings({ ...defaultSettings, ...data.settings })
        }
      } catch (error) {
        console.error('Error loading settings:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadSettings()
  }, [])

  const handleChange = (key: keyof Settings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSaveSuccess(false)
    setSaveError(null)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })

      if (response.ok) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      } else {
        const data = await response.json()
        setSaveError(data.error || 'Error al guardar')
      }
    } catch {
      setSaveError('Error de conexión')
    } finally {
      setIsSaving(false)
    }
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

  const handleCleanupDatabase = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar los datos de prueba (instructores y paquetes no oficiales)?')) {
      return
    }

    setIsCleanupLoading(true)
    setCleanupResult(null)

    try {
      const response = await fetch('/api/admin/cleanup', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        setCleanupResult({
          success: true,
          message: 'Limpieza completada exitosamente',
          results: data.results,
        })
      } else {
        setCleanupResult({
          success: false,
          message: data.error || 'Error al limpiar la base de datos',
        })
      }
    } catch {
      setCleanupResult({
        success: false,
        message: 'Error de conexión',
      })
    } finally {
      setIsCleanupLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
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
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="flex items-center gap-1 text-green-600 text-sm">
              <CheckCircle className="h-4 w-4" />
              Guardado
            </span>
          )}
          {saveError && (
            <span className="text-red-600 text-sm">{saveError}</span>
          )}
          <Button onClick={handleSave} isLoading={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            Guardar Cambios
          </Button>
        </div>
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
            value={settings.siteName}
            onChange={(e) => handleChange('siteName', e.target.value)}
          />
          <Textarea
            label="Descripción"
            value={settings.siteDescription}
            onChange={(e) => handleChange('siteDescription', e.target.value)}
          />
          <Input
            label="Teléfono"
            value={settings.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
          />
          <Input
            label="Email de contacto"
            type="email"
            value={settings.email}
            onChange={(e) => handleChange('email', e.target.value)}
          />
          <Input
            label="Dirección"
            value={settings.address}
            onChange={(e) => handleChange('address', e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Payment Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Configuración de Pagos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Clave Pública"
            value={settings.stripePublicKey}
            onChange={(e) => handleChange('stripePublicKey', e.target.value)}
          />
          <Input
            label="Clave Secreta"
            type="password"
            value={settings.stripeSecretKey}
            onChange={(e) => handleChange('stripeSecretKey', e.target.value)}
          />
          <div className="p-4 bg-beige rounded-lg text-sm text-gray-600">
            <p>
              <strong>Nota:</strong> Para aceptar pagos en El Salvador, asegúrate
              de que tu cuenta de pagos esté configurada correctamente y cumpla
              con las regulaciones locales.
            </p>
          </div>
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
              value={settings.cancellationHours}
              onChange={(e) => handleChange('cancellationHours', e.target.value)}
            />
            <Input
              label="Cupos por clase (default)"
              type="number"
              value={settings.defaultCapacity}
              onChange={(e) => handleChange('defaultCapacity', e.target.value)}
            />
          </div>
          <Textarea
            label="Mensaje de política de cancelación"
            value={settings.cancellationPolicy}
            onChange={(e) => handleChange('cancellationPolicy', e.target.value)}
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

          {/* Cleanup Section */}
          <div className="border-t border-gray-200 pt-4 mt-6">
            <h4 className="font-medium text-foreground mb-2">Limpieza de Datos de Prueba</h4>
            <p className="text-sm text-gray-600 mb-4">
              Elimina instructores y paquetes de prueba que no son parte de los datos oficiales.
              Solo quedarán los 5 instructores reales y los 7 paquetes oficiales.
            </p>
            <Button
              onClick={handleCleanupDatabase}
              isLoading={isCleanupLoading}
              variant="outline"
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Limpiar Datos de Prueba
            </Button>

            {cleanupResult && (
              <div
                className={`mt-4 p-4 rounded-lg ${
                  cleanupResult.success
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}
              >
                <p className="font-medium">{cleanupResult.message}</p>
                {cleanupResult.results && (
                  <ul className="mt-2 text-sm space-y-1">
                    <li>Instructores eliminados: {cleanupResult.results.instructorsDeleted}</li>
                    <li>Instructores desactivados: {cleanupResult.results.instructorsDeactivated}</li>
                    <li>Paquetes eliminados: {cleanupResult.results.packagesDeleted}</li>
                    <li>Paquetes desactivados: {cleanupResult.results.packagesDeactivated}</li>
                  </ul>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
