/**
 * Rasterize each installable app's launcher icon SVG into the PNG sizes a web
 * app manifest needs (192 and 512), writing to `public/icons/apps/`.
 *
 * Sources are `public/icons/app-icon-<id>.svg` — distinct from the browser tab
 * favicons in the same folder. The launcher artwork is full-bleed color with
 * the glyph scaled inside Android's maskable safe zone (a centered circle of
 * radius 40%), so an OS that crops the icon to a squircle never clips it.
 *
 * Committed output: these PNGs ship with the site, so the build only needs to
 * regenerate them when an app's launcher SVG or color changes.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { APP_ICON_SIZES, INSTALLABLE_APPS } from '../src/share-metadata.js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const ICONS_DIR = path.join(ROOT, 'public/icons')
const OUT_DIR = path.join(ICONS_DIR, 'apps')

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })

  for (const app of INSTALLABLE_APPS) {
    const source = path.join(ICONS_DIR, `app-icon-${app.iconId}.svg`)
    for (const size of APP_ICON_SIZES) {
      const outPath = path.join(OUT_DIR, `${app.iconId}-${size}.png`)
      await sharp(source, { density: Math.ceil((size / 96) * 72) })
        .resize(size, size, { fit: 'contain', background: app.iconColor })
        .png()
        .toFile(outPath)
      console.log(`app icon: ${path.relative(ROOT, outPath)}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
