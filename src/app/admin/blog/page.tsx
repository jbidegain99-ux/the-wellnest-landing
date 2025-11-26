'use client'

import * as React from 'react'
import { Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Card, CardContent } from '@/components/ui/Card'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
} from '@/components/ui/Modal'
import { formatDate, slugify } from '@/lib/utils'

// Mock blog posts
const initialPosts = [
  {
    id: '1',
    title: '5 Beneficios del Yoga para tu Vida Diaria',
    slug: '5-beneficios-del-yoga',
    excerpt: 'Descubre cómo una práctica regular de yoga puede transformar tu vida...',
    category: 'Yoga',
    status: 'PUBLISHED',
    publishedAt: new Date('2024-01-15'),
    createdAt: new Date('2024-01-10'),
  },
  {
    id: '2',
    title: 'Pilates Mat vs Pilates Reformer',
    slug: 'pilates-mat-vs-reformer',
    excerpt: 'Una guía completa para entender las diferencias...',
    category: 'Pilates',
    status: 'PUBLISHED',
    publishedAt: new Date('2024-01-10'),
    createdAt: new Date('2024-01-05'),
  },
  {
    id: '3',
    title: 'Sound Healing: La Ciencia Detrás',
    slug: 'sound-healing-ciencia',
    excerpt: 'Exploramos la investigación científica que respalda...',
    category: 'Sound Healing',
    status: 'DRAFT',
    publishedAt: null,
    createdAt: new Date('2024-01-08'),
  },
]

const categories = ['Yoga', 'Pilates', 'Pole Sport', 'Sound Healing', 'Nutrición', 'Bienestar']

export default function AdminBlogPage() {
  const [posts, setPosts] = React.useState(initialPosts)
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [editingPost, setEditingPost] = React.useState<typeof initialPosts[0] | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const handleCreate = () => {
    setEditingPost(null)
    setIsModalOpen(true)
  }

  const handleEdit = (post: typeof initialPosts[0]) => {
    setEditingPost(post)
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const title = formData.get('title') as string
    const data = {
      title,
      slug: slugify(title),
      excerpt: formData.get('excerpt') as string,
      category: formData.get('category') as string,
      status: formData.get('status') as string,
      publishedAt: formData.get('status') === 'PUBLISHED' ? new Date() : null,
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))

    if (editingPost) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === editingPost.id ? { ...p, ...data } : p
        )
      )
    } else {
      setPosts((prev) => [
        { id: Date.now().toString(), createdAt: new Date(), ...data },
        ...prev,
      ])
    }

    setIsLoading(false)
    setIsModalOpen(false)
  }

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás segura de eliminar este artículo?')) {
      setPosts((prev) => prev.filter((p) => p.id !== id))
    }
  }

  const toggleStatus = (id: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: p.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED',
              publishedAt: p.status === 'DRAFT' ? new Date() : null,
            }
          : p
      )
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">
            Blog
          </h1>
          <p className="text-gray-600 mt-1">
            Administra los artículos del blog
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Artículo
        </Button>
      </div>

      {/* Posts Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-beige">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Título
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Categoría
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Estado
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Fecha
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-beige">
                {posts.map((post) => (
                  <tr key={post.id}>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-foreground">{post.title}</p>
                        <p className="text-sm text-gray-500 truncate max-w-xs">
                          {post.excerpt}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary">{post.category}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={post.status === 'PUBLISHED' ? 'success' : 'warning'}
                      >
                        {post.status === 'PUBLISHED' ? 'Publicado' : 'Borrador'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {post.publishedAt
                        ? formatDate(post.publishedAt)
                        : formatDate(post.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(post)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleStatus(post.id)}
                        >
                          {post.status === 'PUBLISHED' ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(post.id)}
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
        <ModalContent className="max-w-2xl">
          <ModalHeader>
            <ModalTitle>
              {editingPost ? 'Editar Artículo' : 'Nuevo Artículo'}
            </ModalTitle>
          </ModalHeader>

          <form onSubmit={handleSave}>
            <div className="space-y-4 py-4">
              <Input
                label="Título"
                name="title"
                defaultValue={editingPost?.title}
                required
              />

              <Textarea
                label="Extracto"
                name="excerpt"
                defaultValue={editingPost?.excerpt}
                required
                className="min-h-[100px]"
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Categoría
                  </label>
                  <select
                    name="category"
                    defaultValue={editingPost?.category || categories[0]}
                    className="w-full h-11 rounded-lg border border-beige-dark bg-white px-4"
                    required
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Estado
                  </label>
                  <select
                    name="status"
                    defaultValue={editingPost?.status || 'DRAFT'}
                    className="w-full h-11 rounded-lg border border-beige-dark bg-white px-4"
                    required
                  >
                    <option value="DRAFT">Borrador</option>
                    <option value="PUBLISHED">Publicar</option>
                  </select>
                </div>
              </div>

              <Textarea
                label="Contenido (Markdown)"
                name="content"
                placeholder="Escribe el contenido del artículo..."
                className="min-h-[200px] font-mono text-sm"
              />
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
                {editingPost ? 'Guardar Cambios' : 'Crear Artículo'}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  )
}
