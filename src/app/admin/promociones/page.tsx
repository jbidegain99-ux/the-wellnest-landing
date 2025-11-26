'use client'

import * as React from 'react'
import { Plus, Edit2, Trash2, Copy } from 'lucide-react'
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

// Mock promotions data
const initialPromotions = [
  {
    id: '1',
    code: 'WELCOME10',
    percentage: 10,
    maxUses: 100,
    currentUses: 45,
    validFrom: new Date('2024-01-01'),
    validUntil: new Date('2024-12-31'),
    isActive: true,
  },
  {
    id: '2',
    code: 'NEWYEAR20',
    percentage: 20,
    maxUses: 50,
    currentUses: 50,
    validFrom: new Date('2024-01-01'),
    validUntil: new Date('2024-01-31'),
    isActive: false,
  },
  {
    id: '3',
    code: 'FRIEND15',
    percentage: 15,
    maxUses: null,
    currentUses: 23,
    validFrom: new Date('2024-01-01'),
    validUntil: new Date('2024-06-30'),
    isActive: true,
  },
]

export default function AdminPromocionesPage() {
  const [promotions, setPromotions] = React.useState(initialPromotions)
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [editingPromo, setEditingPromo] = React.useState<typeof initialPromotions[0] | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null)

  const handleEdit = (promo: typeof initialPromotions[0]) => {
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
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      code: (formData.get('code') as string).toUpperCase(),
      percentage: parseFloat(formData.get('percentage') as string),
      maxUses: formData.get('maxUses') ? parseInt(formData.get('maxUses') as string) : null,
      validFrom: new Date(formData.get('validFrom') as string),
      validUntil: new Date(formData.get('validUntil') as string),
      isActive: formData.get('isActive') === 'on',
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))

    if (editingPromo) {
      setPromotions((prev) =>
        prev.map((p) =>
          p.id === editingPromo.id ? { ...p, ...data } : p
        )
      )
    } else {
      setPromotions((prev) => [
        ...prev,
        { id: Date.now().toString(), currentUses: 0, ...data },
      ])
    }

    setIsLoading(false)
    setIsModalOpen(false)
  }

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás segura de eliminar esta promoción?')) {
      setPromotions((prev) => prev.filter((p) => p.id !== id))
    }
  }

  const toggleActive = (id: string) => {
    setPromotions((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, isActive: !p.isActive } : p
      )
    )
  }

  const isExpired = (date: Date) => new Date(date) < new Date()
  const isMaxedOut = (promo: typeof initialPromotions[0]) =>
    promo.maxUses !== null && promo.currentUses >= promo.maxUses

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
                {promotions.map((promo) => (
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
                        {formatDate(promo.validFrom)} -
                      </div>
                      <div>{formatDate(promo.validUntil)}</div>
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
                          onClick={() => toggleActive(promo.id)}
                        >
                          {promo.isActive ? 'Desactivar' : 'Activar'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(promo.id)}
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
              >
                Cancelar
              </Button>
              <Button type="submit" isLoading={isLoading}>
                {editingPromo ? 'Guardar Cambios' : 'Crear Promoción'}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  )
}
