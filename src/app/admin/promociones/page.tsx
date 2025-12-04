'use client'

import * as React from 'react'
import { Plus, Edit2, Trash2, Copy, Loader2, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
} from '@/components/ui/Modal'
import { formatDate } from '@/lib/utils'

interface DiscountCode {
  id: string
  code: string
  percentage: number
  maxUses: number | null
  currentUses: number
  validFrom: string
  validUntil: string
  isActive: boolean
  applicableTo: string[]
  createdAt: string
}

export default function AdminPromocionesPage() {
  const [discountCodes, setDiscountCodes] = React.useState<DiscountCode[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [editingPromo, setEditingPromo] = React.useState<DiscountCode | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null)
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const showSuccess = (message: string) => {
    setSuccessMessage(message)
    setErrorMessage(null)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const showError = (message: string) => {
    setErrorMessage(message)
    setSuccessMessage(null)
    setTimeout(() => setErrorMessage(null), 5000)
  }

  // Fetch discount codes from database
  const fetchDiscountCodes = React.useCallback(async () => {
    try {
      const response = await fetch('/api/admin/discount-codes')
      if (response.ok) {
        const data = await response.json()
        setDiscountCodes(data.discountCodes || [])
      }
    } catch (error) {
      console.error('Error fetching discount codes:', error)
    }
  }, [])

  React.useEffect(() => {
    const loadData = async () => {
      await fetchDiscountCodes()
      setIsLoading(false)
    }
    loadData()
  }, [fetchDiscountCodes])

  const handleEdit = (promo: DiscountCode) => {
    setEditingPromo(promo)
    setIsModalOpen(true)
  }

  const handleCreate = () => {
    setEditingPromo(null)
    setIsModalOpen(true)
  }

  const handleCopyCode = async (code: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    setErrorMessage(null)

    const formData = new FormData(e.currentTarget)
    const data = {
      code: (formData.get('code') as string).toUpperCase().trim(),
      percentage: parseFloat(formData.get('percentage') as string),
      maxUses: formData.get('maxUses') ? parseInt(formData.get('maxUses') as string) : null,
      validFrom: formData.get('validFrom') as string,
      validUntil: formData.get('validUntil') as string,
      isActive: formData.get('isActive') === 'on',
    }

    try {
      if (editingPromo) {
        // Update existing discount code
        const response = await fetch(`/api/admin/discount-codes/${editingPromo.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        const result = await response.json()

        if (!response.ok) {
          showError(result.error || 'Error al actualizar el código')
          setIsSaving(false)
          return
        }

        showSuccess('Código actualizado correctamente')
      } else {
        // Create new discount code
        const response = await fetch('/api/admin/discount-codes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        const result = await response.json()

        if (!response.ok) {
          showError(result.error || 'Error al crear el código')
          setIsSaving(false)
          return
        }

        showSuccess('Código creado correctamente')
      }

      // Refresh the list
      await fetchDiscountCodes()
      setIsModalOpen(false)
    } catch (error) {
      console.error('Error saving discount code:', error)
      showError('Error de conexión')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/admin/discount-codes/${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        showError(result.error || 'Error al eliminar el código')
        setDeleteConfirmId(null)
        setIsDeleting(false)
        return
      }

      showSuccess('Código eliminado correctamente')
      await fetchDiscountCodes()
    } catch (error) {
      console.error('Error deleting discount code:', error)
      showError('Error de conexión')
    } finally {
      setIsDeleting(false)
      setDeleteConfirmId(null)
    }
  }

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/discount-codes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      })

      if (response.ok) {
        showSuccess(currentStatus ? 'Código desactivado' : 'Código activado')
        await fetchDiscountCodes()
      } else {
        const result = await response.json()
        showError(result.error || 'Error al cambiar el estado')
      }
    } catch (error) {
      console.error('Error toggling status:', error)
      showError('Error de conexión')
    }
  }

  const isExpired = (dateStr: string) => new Date(dateStr) < new Date()
  const isMaxedOut = (promo: DiscountCode) =>
    promo.maxUses !== null && promo.currentUses >= promo.maxUses

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
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
            Promociones
          </h1>
          <p className="text-gray-600 mt-1">
            Administra códigos de descuento
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Promoción
        </Button>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <Check className="h-5 w-5" />
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          {errorMessage}
        </div>
      )}

      {/* Promotions Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-beige">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Código
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Descuento
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Usos
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Vigencia
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Estado
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-beige">
                {discountCodes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      No hay códigos de descuento. Crea uno nuevo.
                    </td>
                  </tr>
                ) : (
                  discountCodes.map((promo) => (
                    <tr key={promo.id}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <code className="font-mono font-medium text-foreground bg-beige px-2 py-1 rounded">
                            {promo.code}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyCode(promo.code)}
                          >
                            {copiedCode === promo.code ? '✓' : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-primary">
                        {promo.percentage}%
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {promo.currentUses}
                        {promo.maxUses !== null && ` / ${promo.maxUses}`}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        <div>
                          {formatDate(new Date(promo.validFrom))} -
                        </div>
                        <div>{formatDate(new Date(promo.validUntil))}</div>
                      </td>
                      <td className="py-3 px-4">
                        {isExpired(promo.validUntil) ? (
                          <Badge variant="error">Vencido</Badge>
                        ) : isMaxedOut(promo) ? (
                          <Badge variant="warning">Agotado</Badge>
                        ) : promo.isActive ? (
                          <Badge variant="success">Activo</Badge>
                        ) : (
                          <Badge variant="error">Inactivo</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(promo)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleActive(promo.id, promo.isActive)}
                          >
                            {promo.isActive ? 'Desactivar' : 'Activar'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmId(promo.id)}
                            className="text-[var(--color-error)]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Modal open={isModalOpen} onOpenChange={setIsModalOpen}>
        <ModalContent className="max-w-lg">
          <ModalHeader>
            <ModalTitle>
              {editingPromo ? 'Editar Promoción' : 'Nueva Promoción'}
            </ModalTitle>
          </ModalHeader>

          <form onSubmit={handleSave}>
            <div className="space-y-4 py-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    label="Código"
                    name="code"
                    defaultValue={editingPromo?.code}
                    placeholder="CODIGO10"
                    required
                    className="uppercase"
                  />
                </div>
                {!editingPromo && (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-7"
                    onClick={() => {
                      const input = document.querySelector('input[name="code"]') as HTMLInputElement
                      if (input) input.value = generateRandomCode()
                    }}
                  >
                    Generar
                  </Button>
                )}
              </div>

              <Input
                label="Porcentaje de descuento"
                name="percentage"
                type="number"
                min="1"
                max="100"
                defaultValue={editingPromo?.percentage}
                required
              />

              <Input
                label="Límite de usos (dejar vacío para ilimitado)"
                name="maxUses"
                type="number"
                min="1"
                defaultValue={editingPromo?.maxUses ?? ''}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Válido desde"
                  name="validFrom"
                  type="date"
                  defaultValue={
                    editingPromo?.validFrom
                      ? new Date(editingPromo.validFrom).toISOString().split('T')[0]
                      : ''
                  }
                  required
                />
                <Input
                  label="Válido hasta"
                  name="validUntil"
                  type="date"
                  defaultValue={
                    editingPromo?.validUntil
                      ? new Date(editingPromo.validUntil).toISOString().split('T')[0]
                      : ''
                  }
                  required
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={editingPromo?.isActive ?? true}
                  className="rounded border-beige-dark text-primary focus:ring-primary"
                />
                <span className="text-sm">Activo</span>
              </label>
            </div>

            <ModalFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsModalOpen(false)}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button type="submit" isLoading={isSaving}>
                {editingPromo ? 'Guardar Cambios' : 'Crear Promoción'}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirmId} onOpenChange={() => !isDeleting && setDeleteConfirmId(null)}>
        <ModalContent className="max-w-sm">
          <ModalHeader>
            <ModalTitle>Confirmar eliminación</ModalTitle>
          </ModalHeader>
          <div className="py-4">
            <p className="text-gray-600">
              ¿Estás segura de que deseas eliminar este código de descuento? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1"
                disabled={isDeleting}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                isLoading={isDeleting}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>
    </div>
  )
}
