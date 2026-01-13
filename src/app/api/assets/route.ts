import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Default assets (fallback if DB is empty)
const DEFAULT_ASSETS: Record<string, { type: string; url: string }> = {
  hero_video_url: {
    type: 'video',
    url: 'https://videos.pexels.com/video-files/5123881/5123881-hd_1280_720_25fps.mp4',
  },
  discipline_yoga_image_url: {
    type: 'image',
    url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200&q=80',
  },
  discipline_pilates_image_url: {
    type: 'image',
    url: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1200&q=80',
  },
  discipline_pole_image_url: {
    type: 'image',
    url: 'https://images.unsplash.com/photo-1600618528240-fb9fc964b853?w=1200&q=80',
  },
  discipline_sound_image_url: {
    type: 'image',
    url: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=1200&q=80',
  },
  discipline_nutrition_image_url: {
    type: 'image',
    url: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200&q=80',
  },
}

// GET /api/assets - Public endpoint to get all brand assets
export async function GET() {
  try {
    const assets = await prisma.brandAsset.findMany()

    // Convert to key-value map for easy access
    const assetsMap: Record<string, { type: string; url: string }> = {}

    // Start with defaults
    Object.entries(DEFAULT_ASSETS).forEach(([key, value]) => {
      assetsMap[key] = value
    })

    // Override with DB values
    assets.forEach((asset) => {
      assetsMap[asset.key] = {
        type: asset.type,
        url: asset.url,
      }
    })

    return NextResponse.json({ assets: assetsMap })
  } catch (error) {
    console.error('Error fetching assets:', error)
    // Return defaults if DB fails
    return NextResponse.json({ assets: DEFAULT_ASSETS })
  }
}
