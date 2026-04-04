import sharp from 'sharp'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

// Brand colors
const SAGE_GREEN = '#639922'
const CREAM = '#E8DDD3'
const WHITE = '#FFFFFF'

/**
 * SVG for the standard icon:
 * - Sage green background
 * - Stylized "W" letter in cream at center-top
 * - Small meditation circle below (person silhouette abstraction)
 */
function createIconSvg(size, padding) {
  const innerSize = size - padding * 2
  const cx = size / 2
  const cy = size / 2

  // Scale factors relative to 512
  const s = size / 512

  // "W" letter - clean geometric construction
  const wTop = cy - 80 * s
  const wBottom = cy + 30 * s
  const wWidth = 160 * s
  const wLeft = cx - wWidth / 2
  const wStroke = 18 * s

  // Meditation symbol: small circle (head) + curved line (body)
  const symCy = cy + 85 * s
  const headR = 12 * s
  const bodyWidth = 50 * s

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${SAGE_GREEN}" rx="${24 * s}"/>

  <!-- Stylized W -->
  <polyline
    points="${wLeft},${wTop} ${wLeft + wWidth * 0.22},${wBottom} ${cx},${wTop + (wBottom - wTop) * 0.45} ${wLeft + wWidth * 0.78},${wBottom} ${wLeft + wWidth},${wTop}"
    fill="none"
    stroke="${CREAM}"
    stroke-width="${wStroke}"
    stroke-linecap="round"
    stroke-linejoin="round"
  />

  <!-- Meditation symbol: head -->
  <circle cx="${cx}" cy="${symCy - 22 * s}" r="${headR}" fill="${CREAM}" opacity="0.85"/>

  <!-- Meditation symbol: seated body (lotus curve) -->
  <path
    d="M ${cx - bodyWidth},${symCy + 18 * s} Q ${cx - bodyWidth * 0.5},${symCy - 8 * s} ${cx},${symCy + 4 * s} Q ${cx + bodyWidth * 0.5},${symCy - 8 * s} ${cx + bodyWidth},${symCy + 18 * s}"
    fill="none"
    stroke="${CREAM}"
    stroke-width="${8 * s}"
    stroke-linecap="round"
    opacity="0.85"
  />

  <!-- "wellnest" text below -->
  <text
    x="${cx}"
    y="${cy + 155 * s}"
    text-anchor="middle"
    font-family="Helvetica, Arial, sans-serif"
    font-size="${22 * s}px"
    font-weight="400"
    letter-spacing="${3 * s}px"
    fill="${CREAM}"
    opacity="0.7"
  >wellnest</text>
</svg>`
}

/**
 * Maskable icon: same design but with extra safe-zone padding (minimum 20%)
 * The safe zone for maskable icons is the inner 80% circle
 */
function createMaskableIconSvg(size) {
  // Maskable icons need content within the inner 80% (safe zone)
  // So we use ~20% padding on each side
  const padding = Math.round(size * 0.15)
  return createIconSvg(size, padding)
}

async function generateIcons() {
  console.log('Generating PWA icons...')

  // 1. icon-192.png
  const svg192 = createIconSvg(192, 0)
  await sharp(Buffer.from(svg192))
    .png({ compressionLevel: 9 })
    .toFile(join(publicDir, 'icon-192.png'))
  console.log('  ✓ icon-192.png (192x192)')

  // 2. icon-512.png
  const svg512 = createIconSvg(512, 0)
  await sharp(Buffer.from(svg512))
    .png({ compressionLevel: 9 })
    .toFile(join(publicDir, 'icon-512.png'))
  console.log('  ✓ icon-512.png (512x512)')

  // 3. icon-maskable-192.png
  const svgMaskable = createMaskableIconSvg(192)
  await sharp(Buffer.from(svgMaskable))
    .png({ compressionLevel: 9 })
    .toFile(join(publicDir, 'icon-maskable-192.png'))
  console.log('  ✓ icon-maskable-192.png (192x192 maskable)')

  // Print file sizes
  const { statSync } = await import('fs')
  for (const name of ['icon-192.png', 'icon-512.png', 'icon-maskable-192.png']) {
    const stats = statSync(join(publicDir, name))
    console.log(`  ${name}: ${(stats.size / 1024).toFixed(1)} KB`)
  }

  console.log('\nDone! Icons saved to /public/')
}

generateIcons().catch(console.error)
