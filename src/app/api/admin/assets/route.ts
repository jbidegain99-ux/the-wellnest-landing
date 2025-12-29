import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Default assets to seed if none exist
// IMPORTANT: Admin should update Pole Fitness and Terapia de Sonido with actual images
const DEFAULT_ASSETS = [
  {
    key: 'hero_video_url',
    type: 'video',
    label: 'Video del Hero (Home)',
    url: 'https://videos.pexels.com/video-files/5123881/5123881-hd_1280_720_25fps.mp4',
  },
  {
    key: 'discipline_yoga_image_url',
    type: 'image',
    label: 'Imagen de Yoga',
    url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200&q=80',
  },
  {
    key: 'discipline_pilates_image_url',
    type: 'image',
    label: 'Imagen de Pilates',
    url: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1200&q=80',
  },
  {
    key: 'discipline_pole_image_url',
    type: 'image',
    label: 'Imagen de Pole Fitness',
    // Placeholder - Admin: Upload "Pole Fitness.jpeg" to Cloudinary/Vercel Blob and paste URL here
    url: 'https://images.unsplash.com/photo-1600618528240-fb9fc964b853?w=1200&q=80',
  },
  {
    key: 'discipline_sound_image_url',
    type: 'image',
    label: 'Imagen de Terapia de Sonido',
    // Placeholder - Admin: Upload "meditation-guide-with-singing-bowls.jpg" and paste URL here
    url: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=1200&q=80',
  },
  {
    key: 'discipline_nutrition_image_url',
    type: 'image',
    label: 'Imagen de Nutrición',
    url: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200&q=80',
  },
]

// GET /api/admin/assets - List all brand assets
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Check if assets exist, if not seed them
    const existingAssets = await prisma.brandAsset.findMany({
      orderBy: { key: 'asc' },
    })

    if (existingAssets.length === 0) {
      // Seed default assets
      await prisma.brandAsset.createMany({
        data: DEFAULT_ASSETS,
      })

      const seededAssets = await prisma.brandAsset.findMany({
        orderBy: { key: 'asc' },
      })

      return NextResponse.json({ assets: seededAssets, seeded: true })
    }

    return NextResponse.json({ assets: existingAssets })
  } catch (error) {
    console.error('Error fetching brand assets:', error)
    return NextResponse.json(
      { error: 'Error al obtener los assets' },
      { status: 500 }
    )
  }
}

// POST /api/admin/assets - Seed default assets (manual trigger)
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Upsert all default assets
    const results = await Promise.all(
      DEFAULT_ASSETS.map((asset) =>
        prisma.brandAsset.upsert({
          where: { key: asset.key },
          update: {}, // Don't update if exists
          create: asset,
        })
      )
    )

    return NextResponse.json({
      message: 'Assets inicializados correctamente',
      count: results.length,
    })
  } catch (error) {
    console.error('Error seeding brand assets:', error)
    return NextResponse.json(
      { error: 'Error al inicializar assets' },
      { status: 500 }
    )
  }
}
