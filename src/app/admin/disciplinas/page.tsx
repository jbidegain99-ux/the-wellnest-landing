'use client'

import * as React from 'react'
import { Plus, Pencil, Trash2, Search, Loader2, Check, AlertCircle, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/Modal'

interface DisciplineData {
  id: string
  name: string
  slug: string
  description: string
  benefits: string
  image: string | null
  icon: string | null
  order: number
  isActive: boolean
  _count: {
    classes: number
    complementaryClasses: number
    packages: number
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function AdminDisciplinasPage() {
  const [disciplines, setDisciplines] = React.useState<DisciplineData[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  const [searchQuery, setSearchQuery] = React.useState('')
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [editingDiscipline, setEditingDiscipline] = React.useState<DisciplineData | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const [formData, setFormData] = React.useState({
    name: '',
    slug: '',
    description: '',
    benefits: '',
    image: '',
    icon: '',
    order: 0,
    isActive: true,
  })
  const [autoSlug, setAutoSlug] = React.useState(true)

  const fetchDisciplines = React.useCallback(async () => {
    try {
      const response = await fetch('/api/admin/disciplinas')
      if (response.ok) {
        const data = await response.json()
        setDisciplines(data)
      }
    } catch (error) {
      console.error('Error fetching disciplines:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchDisciplines()
  }, [fetchDisciplines])

  const filteredDisciplines = disciplines.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.slug.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const openModal = (discipline?: DisciplineData) => {
    if (discipline) {
      setEditingDiscipline(discipline)
      setFormData({
        name: discipline.name,
        slug: discipline.slug,
        description: discipline.description,
        benefits: discipline.benefits,
        image: discipline.image || '',
        icon: discipline.icon || '',
        order: discipline.order,
        isActive: discipline.isActive,
      })
      setAutoSlug(false)
    } else {
      setEditingDiscipline(null)
      setFormData({
        name: '',
        slug: '',
        description: '',
        benefits: '',
        image: '',
        icon: '',
        order: disciplines.length,
        isActive: true,
      })
      setAutoSlug(true)
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingDiscipline(null)
    setAutoSlug(true)
  }

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

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: autoSlug ? slugify(name) : prev.slug,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setErrorMessage(null)

    const payload = {
      name: formData.name,
      slug: formData.slug,
      description: formData.description,
      benefits: formData.benefits,
      image: formData.image || null,
      icon: formData.icon || null,
      order: formData.order,
      isActive: formData.isActive,
    }

    try {
      if (editingDiscipline) {
        const response = await fetch(`/api/admin/disciplinas/${editingDiscipline.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const data = await response.json()
        if (!response.ok) {
          showError(data.error || 'Error al actualizar la disciplina')
          return
        }
        showSuccess('Disciplina actualizada correctamente')
      } else {
        const response = await fetch('/api/admin/disciplinas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const data = await response.json()
        if (!response.ok) {
          showError(data.error || 'Error al crear la disciplina')
          return
        }
        showSuccess('Disciplina creada correctamente')
      }

      await fetchDisciplines()
      closeModal()
    } catch (error) {
      console.error('Error saving discipline:', error)
      showError('Error de conexión')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/admin/disciplinas/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (!response.ok) {
        showError(data.error || 'Error al eliminar la disciplina')
        setDeleteConfirmId(null)
        return
      }

      showSuccess('Disciplina eliminada correctamente')
      await fetchDisciplines()
    } catch (error) {
      console.error('Error deleting discipline:', error)
      showError('Error de conexión')
    } finally {
      setIsDeleting(false)
      setDeleteConfirmId(null)
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">
            Disciplinas
          </h1>
          <p className="text-gray-600 mt-1">
            Administra las disciplinas del estudio
          </p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus className="h-4 w-4 mr-2" />
          Agregar Disciplina
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

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Buscar por nombre o slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="h-5 w-5" />}
          />
        </div>
      </div>

      {/* Disciplines Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-beige">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Orden
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Disciplina
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Slug
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Uso
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
                {filteredDisciplines.map((discipline) => {
                  const totalClasses = discipline._count.classes + discipline._count.complementaryClasses
                  return (
                    <tr key={discipline.id}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-gray-400">
                          <GripVertical className="h-4 w-4" />
                          <span className="text-sm font-medium">{discipline.order}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-foreground">{discipline.name}</p>
                          <p className="text-sm text-gray-500 line-clamp-1 max-w-xs">
                            {discipline.description}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <code className="text-sm bg-beige px-2 py-0.5 rounded text-gray-600">
                          {discipline.slug}
                        </code>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs">
                            {totalClasses} clases
                          </Badge>
                          {discipline._count.packages > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {discipline._count.packages} paquetes
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={discipline.isActive ? 'success' : 'error'}>
                          {discipline.isActive ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openModal(discipline)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmId(discipline.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {filteredDisciplines.length === 0 && !isLoading && (
        <div className="text-center py-12 text-gray-500">
          No se encontraron disciplinas
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={isModalOpen} onOpenChange={closeModal}>
        <ModalContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <ModalHeader>
            <ModalTitle>
              {editingDiscipline ? 'Editar Disciplina' : 'Agregar Disciplina'}
            </ModalTitle>
          </ModalHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <Input
              label="Nombre"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ej: Yoga, Pilates, Pole Fitness"
              required
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Slug (URL)
                </label>
                {!editingDiscipline && (
                  <button
                    type="button"
                    onClick={() => setAutoSlug(!autoSlug)}
                    className="text-xs text-primary hover:underline"
                  >
                    {autoSlug ? 'Editar manualmente' : 'Auto-generar'}
                  </button>
                )}
              </div>
              <Input
                value={formData.slug}
                onChange={(e) => {
                  setAutoSlug(false)
                  setFormData((prev) => ({ ...prev, slug: e.target.value }))
                }}
                placeholder="yoga, pilates, pole-fitness"
                required
                disabled={autoSlug && !editingDiscipline}
              />
              <p className="text-xs text-gray-500 mt-1">
                Solo letras minúsculas, números y guiones
              </p>
            </div>

            <Textarea
              label="Descripción"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Descripción de la disciplina..."
              required
              className="min-h-[80px]"
            />

            <Textarea
              label="Beneficios"
              value={formData.benefits}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, benefits: e.target.value }))
              }
              placeholder="Beneficios de la disciplina..."
              className="min-h-[80px]"
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="URL de imagen"
                value={formData.image}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, image: e.target.value }))
                }
                placeholder="https://..."
              />
              <Input
                label="Icono (nombre o URL)"
                value={formData.icon}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, icon: e.target.value }))
                }
                placeholder="Ej: lotus, dumbbell"
              />
            </div>

            <Input
              label="Orden de aparición"
              type="number"
              value={formData.order.toString()}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, order: parseInt(e.target.value) || 0 }))
              }
            />

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="discipline-active"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, isActive: e.target.checked }))
                }
                className="w-4 h-4 rounded border-beige-dark text-primary focus:ring-primary"
              />
              <label htmlFor="discipline-active" className="text-sm text-gray-600">
                Disciplina activa (visible en la web)
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={closeModal} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" isLoading={isSaving}>
                {editingDiscipline ? 'Guardar Cambios' : 'Agregar Disciplina'}
              </Button>
            </div>
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
              ¿Estás seguro de que deseas eliminar esta disciplina? Si tiene clases o paquetes asociados, deberás desactivarla en su lugar.
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
