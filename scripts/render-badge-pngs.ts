// Genera los PNG de las insignias para los correos (estado ganado, 240 px).
// No usa la base de datos ni variables de entorno: el catálogo es fijo.
//
//   npx tsx scripts/render-badge-pngs.ts
//
// Escribe public/images/badges/<id>.png (y reto-ene … reto-dic). Los PNG se commitean.

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { badgesWithPng, renderBadgeSvg } from '../src/lib/progress/badges/art'

const SIZE = 240
const OUT_DIR = path.join(process.cwd(), 'public', 'images', 'badges')

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true })
  const badges = badgesWithPng()
  let totalBytes = 0
  let largest = { file: '', bytes: 0 }
  for (const badge of badges) {
    const svg = renderBadgeSvg(badge, { locked: false, size: SIZE })
    const png = await sharp(Buffer.from(svg))
      .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
      .toBuffer()
    await writeFile(path.join(OUT_DIR, `${badge.file}.png`), png)
    totalBytes += png.length
    if (png.length > largest.bytes) largest = { file: badge.file, bytes: png.length }
  }
  console.log(
    `${badges.length} PNG en ${path.relative(process.cwd(), OUT_DIR)} · ${(totalBytes / 1024).toFixed(0)} KB en total · mayor: ${largest.file} (${(largest.bytes / 1024).toFixed(1)} KB)`
  )
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
