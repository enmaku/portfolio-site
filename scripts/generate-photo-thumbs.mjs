/**
 * Resize originals in src/assets/photos/ into src/assets/photos/thumbs/ as WebP.
 * The gallery loads thumbs; the lightbox still uses full-resolution files.
 *
 * Env (optional):
 *   PHOTO_THUMB_MAX_WIDTH — default 960
 *   PHOTO_THUMB_QUALITY   — default 82
 */
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const photosDir = path.join(root, 'src/assets/photos')
const thumbsDir = path.join(photosDir, 'thumbs')
const MAX_WIDTH = Number(process.env.PHOTO_THUMB_MAX_WIDTH || 960)
const QUALITY = Number(process.env.PHOTO_THUMB_QUALITY || 82)

const EXT = /\.(jpe?g|png|webp)$/i

async function main() {
  await fs.mkdir(thumbsDir, { recursive: true })

  let entries
  try {
    entries = await fs.readdir(photosDir, { withFileTypes: true })
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.warn('generate-photo-thumbs: no photos directory, skipping')
      return
    }
    throw e
  }

  const files = entries
    .filter((d) => d.isFile() && EXT.test(d.name))
    .map((d) => d.name)

  if (files.length === 0) {
    console.log('generate-photo-thumbs: no images in', photosDir)
    return
  }

  for (const name of files) {
    const inPath = path.join(photosDir, name)
    const base = name.replace(/\.[^.]+$/i, '')
    const outPath = path.join(thumbsDir, `${base}.webp`)

    const meta = await sharp(inPath).metadata()
    await sharp(inPath)
      .rotate()
      .resize({
        width: MAX_WIDTH,
        withoutEnlargement: true,
      })
      .webp({ quality: QUALITY })
      .toFile(outPath)

    const dim =
      meta.width && meta.height ? ` (${meta.width}×${meta.height})` : ''
    console.log(`thumb: ${base}.webp${dim}`)
  }

  console.log(`generate-photo-thumbs: wrote ${files.length} file(s) to thumbs/`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
