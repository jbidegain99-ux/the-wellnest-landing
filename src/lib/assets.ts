import { prisma } from '@/lib/prisma'

// Default assets (fallback if DB is empty)
// IMPORTANT: Admin should update these with actual Wellnest images
// - Pole Fitness: Upload "Pole Fitness.jpeg" to CDN and update URL
// - Terapia de Sonido: Upload "meditation-guide-with-singing-bowls.jpg" to CDN and update URL
export const DEFAULT_ASSETS: Record<string, { type: string; url: string; label: string }> = {
  hero_video_url: {
    type: 'video',
    url: 'https://videos.pexels.com/video-files/5123881/5123881-hd_1280_720_25fps.mp4',
    label: 'Video del Hero (Home)',
  },
  discipline_yoga_image_url: {
    type: 'image',
    url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200&q=80',
    label: 'Imagen de Yoga',
  },
  discipline_pilates_image_url: {
    type: 'image',
    url: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1200&q=80',
    label: 'Imagen de Pilates',
  },
  discipline_pole_image_url: {
    type: 'image',
    // Placeholder - Admin should upload "Pole Fitness.jpeg" to CDN
    url: 'https://images.unsplash.com/photo-1600618528240-fb9fc964b853?w=1200&q=80',
    label: 'Imagen de Pole Fitness',
  },
  discipline_sound_image_url: {
    type: 'image',
    // Placeholder - Admin should upload "meditation-guide-with-singing-bowls.jpg" to CDN
    url: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=1200&q=80',
    label: 'Imagen de Terapia de Sonido',
  },
  discipline_nutrition_image_url: {
    type: 'image',
    url: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200&q=80',
    label: 'Imagen de Nutrición',
  },
}

export type BrandAssets = Record<string, { type: string; url: string }>

/**
 * Get all brand assets from database (Server-side only)
 * Falls back to defaults if DB fails or is empty
 */
export async function getBrandAssets(): Promise<BrandAssets> {
  try {
    const assets = await prisma.brandAsset.findMany()

    // Start with defaults
    const assetsMap: BrandAssets = {}
    Object.entries(DEFAULT_ASSETS).forEach(([key, value]) => {
      assetsMap[key] = { type: value.type, url: value.url }
    })

    // Override with DB values
    assets.forEach((asset) => {
      assetsMap[asset.key] = {
        type: asset.type,
        url: asset.url,
      }
    })

    return assetsMap
  } catch (error) {
    console.error('Error fetching brand assets:', error)
    // Return defaults if DB fails
    const fallback: BrandAssets = {}
    Object.entries(DEFAULT_ASSETS).forEach(([key, value]) => {
      fallback[key] = { type: value.type, url: value.url }
    })
    return fallback
  }
}

/**
 * Get a single asset URL by key
 */
export async function getAssetUrl(key: string): Promise<string | null> {
  try {
    const asset = await prisma.brandAsset.findUnique({
      where: { key },
    })

    if (asset) {
      return asset.url
    }

    // Fallback to default
    return DEFAULT_ASSETS[key]?.url || null
  } catch (error) {
    console.error(`Error fetching asset ${key}:`, error)
    return DEFAULT_ASSETS[key]?.url || null
  }
}
