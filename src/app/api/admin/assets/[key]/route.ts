import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'

export const dynamic = 'force-dynamic'

// GET /api/admin/assets/[key] - Get single asset
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    // Mismo guard ADMIN que el PUT — es un endpoint /api/admin/*
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { key } = await params

    const asset = await prisma.brandAsset.findUnique({
      where: { key },
    })

    if (!asset) {
      return NextResponse.json({ error: 'Asset no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ asset })
  } catch (error) {
    console.error('Error fetching asset:', error)
    return NextResponse.json(
      { error: 'Error al obtener el asset' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/assets/[key] - Update asset URL
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { key } = await params
    const body = await request.json()
    const { url, type } = body

    if (!url) {
      return NextResponse.json({ error: 'URL es requerida' }, { status: 400 })
    }

    // Validate URL format — solo http(s) o rutas internas; esquemas como
    // javascript:/data: terminarían inyectados en atributos src del sitio
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return NextResponse.json(
          { error: 'URL inválida. Solo se permiten URLs https/http o rutas internas.' },
          { status: 400 }
        )
      }
    } catch {
      // If not a valid URL, check if it's a valid internal path
      if (!url.startsWith('/') || url.startsWith('//')) {
        return NextResponse.json(
          { error: 'URL inválida. Debe ser una URL absoluta o una ruta interna que empiece con /' },
          { status: 400 }
        )
      }
    }

    const asset = await prisma.brandAsset.update({
      where: { key },
      data: {
        url,
        ...(type && { type }),
        updatedAt: new Date(),
      },
    })

    // Revalidate pages that use these assets
    revalidatePath('/')
    revalidatePath('/clases')

    return NextResponse.json({
      message: 'Asset actualizado correctamente',
      asset,
    })
  } catch (error) {
    console.error('Error updating asset:', error)
    return NextResponse.json(
      { error: 'Error al actualizar el asset' },
      { status: 500 }
    )
  }
}
