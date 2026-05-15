'use client'

import * as React from 'react'
import { Plus, Edit2, Trash2, Loader2, Check, AlertCircle, FileText, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
} from '@/components/ui/Modal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { formatPrice } from '@/lib/utils'

interface SearchedUser {
  id: string
  name: string | null
  email: string
}

interface Package {
  id: string
  name: string
  shortDescription: string
  fullDescription?: string
  classCount: number
  price: number
  validityDays: number
  isActive: boolean
  isFeatured: boolean
  isShareable: boolean
  maxShares: number
}

export default function AdminPaquetesPage() {
  const [packages, setPackages] = React.useState<Package[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [editingPackage, setEditingPackage] = React.useState<Package | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // Nueva Orden modal state — assign a package to a student
  const [showOrderModal, setShowOrderModal] = React.useState(false)
  const [orderUserSearch, setOrderUserSearch] = React.useState('')
  const [orderUserResults, setOrderUserResults] = React.useState<SearchedUser[]>([])
  const [orderSelectedUser, setOrderSelectedUser] = React.useState<SearchedUser | null>(null)
  const [isSearchingOrderUsers, setIsSearchingOrderUsers] = React.useState(false)
  const [orderPackageId, setOrderPackageId] = React.useState('')
  const [orderExpiresAt, setOrderExpiresAt] = React.useState('')
  const [orderPaymentSource, setOrderPaymentSource] = React.useState<'POS' | 'MANUAL_TRANSFER' | 'GIFT'>('POS')
  const [orderSendInvoice, setOrderSendInvoice] = React.useState(true)
  const [isAssigning, setIsAssigning] = React.useState(false)
  const orderSearchTimeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined)

  // Fetch packages from database
  const fetchPackages = React.useCallback(async () => {
    try {
      const response = await fetch('/api/admin/packages')
      if (response.ok) {
        const data = await response.json()
        setPackages(data)
      } else {
        showError('Error al cargar los paquetes')
      }
    } catch (error) {
      console.error('Error fetching packages:', error)
      showError('Error de conexión')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchPackages()
  }, [fetchPackages])

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

  const handleEdit = (pkg: Package) => {
    setEditingPackage(pkg)
    setIsModalOpen(true)
  }

  const handleCreate = () => {
    setEditingPackage(null)
    setIsModalOpen(true)
  }

  const resetOrderForm = () => {
    setOrderUserSearch('')
    setOrderUserResults([])
    setOrderSelectedUser(null)
    setOrderPackageId('')
    setOrderExpiresAt('')
    setOrderPaymentSource('POS')
    setOrderSendInvoice(true)
  }

  const openOrderModal = () => {
    resetOrderForm()
    setShowOrderModal(true)
  }

  const handleOrderUserSearch = (value: string) => {
    setOrderUserSearch(value)
    setOrderSelectedUser(null)
    if (orderSearchTimeoutRef.current) clearTimeout(orderSearchTimeoutRef.current)
    if (!value.trim()) {
      setOrderUserResults([])
      return
    }
    orderSearchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingOrderUsers(true)
      try {
        const response = await fetch(`/api/admin/users?search=${encodeURIComponent(value)}&limit=5`)
        if (response.ok) {
          const data = await response.json()
          setOrderUserResults(
            data.users.map((u: { id: string; name: string | null; email: string }) => ({
              id: u.id,
              name: u.name,
              email: u.email,
            }))
          )
        }
      } catch {
        // silent
      } finally {
        setIsSearchingOrderUsers(false)
      }
    }, 300)
  }

  const selectOrderUser = (user: SearchedUser) => {
    setOrderSelectedUser(user)
    setOrderUserSearch(user.name || user.email)
    setOrderUserResults([])
  }

  // When selected package changes, pre-fill expiration with today + validityDays
  React.useEffect(() => {
    if (!orderPackageId) {
      setOrderExpiresAt('')
      return
    }
    const pkg = packages.find((p) => p.id === orderPackageId)
    if (!pkg) return
    const d = new Date()
    d.setDate(d.getDate() + pkg.validityDays)
    const pad = (n: number) => String(n).padStart(2, '0')
    setOrderExpiresAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
  }, [orderPackageId, packages])

  const handleCreateOrder = async () => {
    if (!orderSelectedUser || !orderPackageId) return
    setIsAssigning(true)
    setErrorMessage(null)
    try {
      const body: {
        packageId: string
        paymentSource: 'POS' | 'MANUAL_TRANSFER' | 'GIFT'
        sendInvoice: boolean
        expiresAt?: string
      } = {
        packageId: orderPackageId,
        paymentSource: orderPaymentSource,
        sendInvoice: orderSendInvoice,
      }
      if (orderExpiresAt) {
        // Interpret the date as end-of-day in El Salvador (UTC-6)
        body.expiresAt = new Date(`${orderExpiresAt}T23:59:00-06:00`).toISOString()
      }
      const response = await fetch(
        `/api/admin/users/${orderSelectedUser.id}/assign-package`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )
      const result = await response.json()
      if (!response.ok) {
        showError(result.error || 'Error al crear la orden')
        return
      }
      showSuccess(result.message || 'Orden creada correctamente')
      setShowOrderModal(false)
      resetOrderForm()
    } catch (error) {
      console.error('Error creating order:', error)
      showError('Error de conexión')
    } finally {
      setIsAssigning(false)
    }
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSaving(true)
    setErrorMessage(null)

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name') as string,
      shortDescription: formData.get('shortDescription') as string,
      classCount: parseInt(formData.get('classCount') as string),
      price: parseFloat(formData.get('price') as string),
      validityDays: parseInt(formData.get('validityDays') as string),
      isActive: formData.get('isActive') === 'on',
      isFeatured: formData.get('isFeatured') === 'on',
      isShareable: formData.get('isShareable') === 'on',
      maxShares: parseInt(formData.get('maxShares') as string) || 0,
    }

    try {
      if (editingPackage) {
        // Update existing package
        const response = await fetch(`/api/admin/packages/${editingPackage.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        const result = await response.json()

        if (!response.ok) {
          showError(result.error || 'Error al actualizar el paquete')
          return
        }

        showSuccess('Paquete actualizado correctamente')
      } else {
        // Create new package
        const response = await fetch('/api/admin/packages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        const result = await response.json()

        if (!response.ok) {
          showError(result.error || 'Error al crear el paquete')
          return
        }

        showSuccess('Paquete creado correctamente')
      }

      // Refresh packages list
      await fetchPackages()
      setIsModalOpen(false)
    } catch (error) {
      console.error('Error saving package:', error)
      showError('Error de conexión')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/admin/packages/${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        showError(result.error || 'Error al eliminar el paquete')
        setDeleteConfirmId(null)
        return
      }

      showSuccess(result.message || 'Paquete eliminado correctamente')
      await fetchPackages()
    } catch (error) {
      console.error('Error deleting package:', error)
      showError('Error de conexión')
    } finally {
      setIsDeleting(false)
      setDeleteConfirmId(null)
    }
  }

  const toggleActive = async (id: string) => {
    const pkg = packages.find(p => p.id === id)
    if (!pkg) return

    try {
      const response = await fetch(`/api/admin/packages/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !pkg.isActive }),
      })

      if (response.ok) {
        await fetchPackages()
        showSuccess(pkg.isActive ? 'Paquete desactivado' : 'Paquete activado')
      } else {
        showError('Error al actualizar el estado')
      }
    } catch (error) {
      console.error('Error toggling package status:', error)
      showError('Error de conexión')
    }
  }

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
            Paquetes
          </h1>
          <p className="text-gray-600 mt-1">
            Administra los paquetes de clases
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openOrderModal}>
            <ShoppingBag className="h-4 w-4 mr-2" />
            Nueva Orden
          </Button>
          <Button variant="outline" onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Paquete
          </Button>
        </div>
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

      {/* Packages Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-beige">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Nombre
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Clases
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Precio
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
                {packages.map((pkg) => (
                  <tr key={pkg.id}>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-foreground">{pkg.name}</p>
                        <p className="text-sm text-gray-500">
                          {pkg.shortDescription}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {pkg.classCount === 999 ? 'Ilimitadas' : pkg.classCount}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {formatPrice(pkg.price)}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {pkg.validityDays} días
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Badge variant={pkg.isActive ? 'success' : 'error'}>
                          {pkg.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                        {pkg.isFeatured && (
                          <Badge variant="secondary">Destacado</Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(pkg)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActive(pkg.id)}
                        >
                          {pkg.isActive ? 'Desactivar' : 'Activar'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmId(pkg.id)}
                          className="text-[var(--color-error)]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {packages.length === 0 && !isLoading && (
        <div className="text-center py-12 text-gray-500">
          No hay paquetes creados
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={isModalOpen} onOpenChange={setIsModalOpen}>
        <ModalContent className="max-w-lg">
          <ModalHeader>
            <ModalTitle>
              {editingPackage ? 'Editar Paquete' : 'Nuevo Paquete'}
            </ModalTitle>
          </ModalHeader>

          <form onSubmit={handleSave}>
            <div className="space-y-4 py-4">
              <Input
                label="Nombre"
                name="name"
                defaultValue={editingPackage?.name}
                required
              />
              <Textarea
                label="Descripción corta"
                name="shortDescription"
                defaultValue={editingPackage?.shortDescription}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Número de clases"
                  name="classCount"
                  type="number"
                  min="1"
                  defaultValue={editingPackage?.classCount}
                  required
                />
                <Input
                  label="Precio (USD)"
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={editingPackage?.price}
                  required
                />
              </div>
              <Input
                label="Vigencia (días)"
                name="validityDays"
                type="number"
                min="1"
                defaultValue={editingPackage?.validityDays}
                required
              />
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={editingPackage?.isActive ?? true}
                    className="rounded border-beige-dark text-primary focus:ring-primary"
                  />
                  <span className="text-sm">Activo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isFeatured"
                    defaultChecked={editingPackage?.isFeatured}
                    className="rounded border-beige-dark text-primary focus:ring-primary"
                  />
                  <span className="text-sm">Destacado</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isShareable"
                    defaultChecked={editingPackage?.isShareable}
                    className="rounded border-beige-dark text-primary focus:ring-primary"
                  />
                  <span className="text-sm">Compartible</span>
                </label>
              </div>
              <Input
                label="Máx. invitados por clase"
                name="maxShares"
                type="number"
                min="0"
                max="5"
                defaultValue={editingPackage?.maxShares ?? 0}
              />
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
                {editingPackage ? 'Guardar Cambios' : 'Crear Paquete'}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Nueva Orden Modal — assign package to student */}
      <Modal open={showOrderModal} onOpenChange={(open) => !isAssigning && setShowOrderModal(open)}>
        <ModalContent className="max-w-lg">
          <ModalHeader>
            <ModalTitle>Nueva Orden</ModalTitle>
          </ModalHeader>

          <div className="py-4 space-y-4">
            {/* Estudiante */}
            <div className="relative">
              <label className="block text-sm font-medium text-foreground mb-2">
                Estudiante
              </label>
              <Input
                placeholder="Busca por nombre o correo"
                value={orderUserSearch}
                onChange={(e) => handleOrderUserSearch(e.target.value)}
                autoComplete="off"
              />
              {(orderUserResults.length > 0 || isSearchingOrderUsers) && !orderSelectedUser && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-beige rounded-lg shadow-md max-h-60 overflow-y-auto">
                  {isSearchingOrderUsers ? (
                    <div className="px-3 py-2 text-sm text-gray-500 flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Buscando...
                    </div>
                  ) : (
                    orderUserResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => selectOrderUser(u)}
                        className="w-full text-left px-3 py-2 hover:bg-beige transition-colors"
                      >
                        <p className="font-medium text-sm text-foreground">
                          {u.name || 'Sin nombre'}
                        </p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
              {orderSelectedUser && (
                <div className="mt-2 p-3 bg-beige rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-foreground">
                      {orderSelectedUser.name || 'Sin nombre'}
                    </p>
                    <p className="text-xs text-gray-500">{orderSelectedUser.email}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOrderSelectedUser(null)
                      setOrderUserSearch('')
                    }}
                  >
                    Cambiar
                  </Button>
                </div>
              )}
            </div>

            {/* Paquete */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Paquete
              </label>
              <Select value={orderPackageId} onValueChange={setOrderPackageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un paquete" />
                </SelectTrigger>
                <SelectContent>
                  {packages
                    .filter((p) => p.isActive)
                    .map((pkg) => (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        {pkg.name} ({pkg.classCount === 999 ? 'ilimitadas' : `${pkg.classCount} clases`})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Vencimiento */}
            {orderPackageId && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Vencimiento
                </label>
                <Input
                  type="date"
                  value={orderExpiresAt}
                  onChange={(e) => setOrderExpiresAt(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Por defecto: {packages.find((p) => p.id === orderPackageId)?.validityDays} días desde hoy. Puedes ajustarla.
                </p>
              </div>
            )}

            {/* Fuente del pago */}
            {orderPackageId && (() => {
              const selectedPkg = packages.find((p) => p.id === orderPackageId)
              if (!selectedPkg) return null
              const isGift = orderPaymentSource === 'GIFT'
              const hasPrice = selectedPkg.price > 0
              return (
                <>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Fuente del pago
                    </label>
                    <Select
                      value={orderPaymentSource}
                      onValueChange={(v) =>
                        setOrderPaymentSource(v as 'POS' | 'MANUAL_TRANSFER' | 'GIFT')
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="POS">Pago por POS (tarjeta en terminal)</SelectItem>
                        <SelectItem value="MANUAL_TRANSFER">Transferencia / Efectivo</SelectItem>
                        <SelectItem value="GIFT">Cortesía / Regalo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div
                    className={
                      'p-4 rounded-lg text-sm ' +
                      (isGift
                        ? 'bg-amber-50 border border-amber-200 text-amber-800'
                        : 'bg-emerald-50 border border-emerald-200 text-emerald-800')
                    }
                  >
                    {isGift ? (
                      <p>Cortesía sin costo. No se contabiliza como venta ni se genera factura.</p>
                    ) : (
                      <p>
                        Monto a cobrar: <strong>${selectedPkg.price.toFixed(2)}</strong>
                        {orderPaymentSource === 'POS'
                          ? ' — registrado como pago por POS.'
                          : ' — registrado como transferencia/efectivo.'}
                      </p>
                    )}
                  </div>

                  {!isGift && hasPrice && (
                    <label className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={orderSendInvoice}
                        onChange={(e) => setOrderSendInvoice(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <div className="text-sm">
                        <p className="font-medium text-blue-800 flex items-center gap-1.5">
                          <FileText className="h-4 w-4" />
                          Generar factura electrónica
                        </p>
                        <p className="text-blue-600 mt-0.5">
                          Envía la venta al Facturador SV para crear el DTE por ${selectedPkg.price.toFixed(2)}.
                        </p>
                      </div>
                    </label>
                  )}
                </>
              )
            })()}
          </div>

          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => setShowOrderModal(false)}
              disabled={isAssigning}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateOrder}
              disabled={!orderSelectedUser || !orderPackageId}
              isLoading={isAssigning}
            >
              {orderPaymentSource === 'GIFT'
                ? 'Crear Cortesía'
                : orderSendInvoice
                ? 'Crear Orden y Facturar'
                : 'Crear Orden'}
            </Button>
          </ModalFooter>
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
              ¿Estás seguro de que deseas eliminar este paquete? Si tiene compras asociadas, será desactivado en lugar de eliminado.
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
