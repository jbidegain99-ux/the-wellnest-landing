'use client'

import * as React from 'react'
import { Save, Globe, CreditCard, Loader2, CheckCircle } from 'lucide-react'
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
  siteName: 'Wellnest',
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

    </div>
  )
}
