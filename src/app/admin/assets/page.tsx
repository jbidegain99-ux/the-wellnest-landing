'use client'

import * as React from 'react'
import { Save, Image as ImageIcon, Video, RefreshCw, Check, X, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

interface BrandAsset {
  id: string
  key: string
  type: string
  url: string
  label?: string
  updatedAt: string
}

const ASSET_LABELS: Record<string, string> = {
  hero_video_url: 'Video del Hero (Home)',
  discipline_yoga_image_url: 'Imagen de Yoga',
  discipline_pilates_image_url: 'Imagen de Pilates',
  discipline_pole_image_url: 'Imagen de Pole Fitness',
  discipline_sound_image_url: 'Imagen de Terapia de Sonido',
  discipline_nutrition_image_url: 'Imagen de Nutrición',
}

export default function AdminAssetsPage() {
  const [assets, setAssets] = React.useState<BrandAsset[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [editingKey, setEditingKey] = React.useState<string | null>(null)
  const [editUrl, setEditUrl] = React.useState('')
  const [savingKey, setSavingKey] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchAssets = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/assets')
      const data = await response.json()
      if (data.assets) {
        setAssets(data.assets)
      }
      if (data.seeded) {
        setMessage({ type: 'success', text: 'Assets inicializados con valores por defecto' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al cargar los assets' })
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  const handleEdit = (asset: BrandAsset) => {
    setEditingKey(asset.key)
    setEditUrl(asset.url)
    setMessage(null)
  }

  const handleCancel = () => {
    setEditingKey(null)
    setEditUrl('')
  }

  const handleSave = async (key: string) => {
    setSavingKey(key)
    setMessage(null)

    try {
      const response = await fetch(`/api/admin/assets/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: editUrl }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: `Asset "${ASSET_LABELS[key] || key}" actualizado correctamente` })
        setEditingKey(null)
        setEditUrl('')
        // Refresh assets
        await fetchAssets()
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al guardar' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión' })
    } finally {
      setSavingKey(null)
    }
  }

  const handleSeedDefaults = async () => {
    setIsLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/assets', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: data.message })
        await fetchAssets()
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al inicializar' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">
            Brand Assets
          </h1>
          <p className="text-gray-600 mt-1">
            Administra las imágenes y videos del sitio web
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAssets} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button variant="outline" onClick={handleSeedDefaults} disabled={isLoading}>
            Restaurar Defaults
          </Button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Instructions */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-gray-600 space-y-2">
            <p><strong>Instrucciones:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Puedes usar URLs de servicios externos como Cloudinary, Vercel Blob, S3 o cualquier CDN.</li>
              <li>Para subir archivos, primero súbelos a tu servicio de hosting preferido y pega la URL aquí.</li>
              <li>Las URLs deben ser HTTPS para producción.</li>
              <li>Los cambios se reflejan inmediatamente en el sitio web.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Assets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading && assets.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            Cargando assets...
          </div>
        ) : assets.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-gray-500 mb-4">No hay assets configurados</p>
            <Button onClick={handleSeedDefaults}>
              Inicializar Assets por Defecto
            </Button>
          </div>
        ) : (
          assets.map((asset) => (
            <Card key={asset.key} className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {asset.type === 'video' ? (
                    <Video className="h-5 w-5 text-primary" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-primary" />
                  )}
                  {asset.label || ASSET_LABELS[asset.key] || asset.key}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Preview */}
                <div className="relative h-40 bg-gray-100 rounded-lg overflow-hidden">
                  {asset.type === 'video' ? (
                    <video
                      src={asset.url}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      autoPlay
                      playsInline
                    />
                  ) : (
                    <img
                      src={asset.url}
                      alt={asset.label || asset.key}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23ddd" width="100%" height="100%"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">Error</text></svg>'
                      }}
                    />
                  )}
                </div>

                {/* URL Display/Edit */}
                {editingKey === asset.key ? (
                  <div className="space-y-3">
                    <Input
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      placeholder="https://..."
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSave(asset.key)}
                        isLoading={savingKey === asset.key}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Guardar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancel}
                        disabled={savingKey === asset.key}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded flex-1 truncate">
                        {asset.url}
                      </code>
                      <a
                        href={asset.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-500 hover:text-primary"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(asset)}
                      className="w-full"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Cambiar URL
                    </Button>
                  </div>
                )}

                {/* Meta */}
                <p className="text-xs text-gray-400">
                  Key: <code>{asset.key}</code>
                  {asset.updatedAt && (
                    <> · Actualizado: {new Date(asset.updatedAt).toLocaleDateString('es-ES')}</>
                  )}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
