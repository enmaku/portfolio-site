/**
 * Downscales hires PNGs → mobile runtime assets.
 * For repo-tracked art, prefer SVG masters under `public/assets/dungeon-runner/masters`
 * and `npm run rasterize-dungeon-runner-masters` (see `src/features/dungeon-runner/ASSET_PACK.md`).
 * Strips AI-baked gray checkerboard / fake “transparency” grays (neutral RGB, no chroma)
 * before resize so alpha is real and patterns don’t shrink into muddy texture.
 */
import { mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { dungeonRunnerScaleTargets } from './dungeon-runner-scale-targets.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..')
const hiresRoot = path.join(repoRoot, 'artifacts/dungeon-runner/hires-pre-scale')
const runtimeRoot = path.join(repoRoot, 'public/assets/dungeon-runner/runtime')

function stripByMode(data, width, height, mode) {
  const configs = {
    // Icons/doodles: remove light neutral backdrop & typical checker (low chroma, bright/mid grays)
    'strip-neutral-light': { minAvg: 148, maxSpread: 28 },
    // Kraft cards: keep brown/tan (usually has chroma); strip only light neutral margins
    'strip-neutral-card': { minAvg: 168, maxSpread: 22 },
    // Board wash: only kill near-white neutrals so brown noise survives
    'strip-neutral-subtle': { minAvg: 208, maxSpread: 24 },
  }
  const { minAvg, maxSpread } = configs[mode] ?? configs['strip-neutral-light']
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (data[i + 3] === 0) continue
    const spread = Math.max(r, g, b) - Math.min(r, g, b)
    const avg = (r + g + b) / 3
    if (spread <= maxSpread && avg >= minAvg) {
      data[i + 3] = 0
    }
  }
}

async function preprocessPng(srcPath, stripMode) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixels = new Uint8ClampedArray(data)
  if (stripMode && stripMode !== 'none') {
    stripByMode(pixels, info.width, info.height, stripMode)
  }

  return sharp(Buffer.from(pixels), {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  }).ensureAlpha()
}

async function resolveHiresSrc(task) {
  const candidates = [task.src, ...(task.srcAlternates ?? [])]
  for (const rel of candidates) {
    const abs = path.join(hiresRoot, rel)
    try {
      await stat(abs)
      return abs
    } catch (e) {
      if (e?.code !== 'ENOENT') throw e
    }
  }
  return null
}

/** Symmetric inset (px per edge) on square plate output after `contain`; re-upscaled so the disc reads larger under CSS `object-fit: contain`. */
const PLATE_RUNTIME_INSET_PX = 24

async function scaleOne(task, missing) {
  const { out, width, height, strip } = task
  const srcPath = await resolveHiresSrc(task)
  const outPath = path.join(runtimeRoot, out)
  if (!srcPath) {
    const tried = [task.src, ...(task.srcAlternates ?? [])].join(' | ')
    missing.push(tried)
    return
  }
  await mkdir(path.dirname(outPath), { recursive: true })

  const pipeline = await preprocessPng(srcPath, strip)
  const contained = pipeline.resize(width, height, {
    fit: 'contain',
    position: 'centre',
    kernel: sharp.kernel.lanczos3,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })

  let finalSharp = contained
  if (
    out === 'equipment/plate.png' &&
    width === height &&
    width > PLATE_RUNTIME_INSET_PX * 2
  ) {
    const inner = width - PLATE_RUNTIME_INSET_PX * 2
    const raster = await contained.png({ compressionLevel: 9 }).toBuffer()
    const meta = await sharp(raster).metadata()
    if (meta.width === width && meta.height === height) {
      finalSharp = sharp(raster)
        .extract({
          left: PLATE_RUNTIME_INSET_PX,
          top: PLATE_RUNTIME_INSET_PX,
          width: inner,
          height: inner,
        })
        .resize(width, height, {
          fit: 'cover',
          position: 'centre',
          kernel: sharp.kernel.lanczos3,
        })
    }
  }

  await finalSharp
    .png({
      compressionLevel: 9,
      effort: 10,
    })
    .toFile(outPath)

  const st = await stat(outPath)
  console.log(`${out} → ${width}×${height} (${(st.size / 1024).toFixed(1)} KB)`)
}

const missing = []
for (const t of dungeonRunnerScaleTargets) {
  await scaleOne(t, missing)
}

if (missing.length) {
  console.error('Missing hires sources:\n', missing.join('\n'))
  process.exitCode = 1
} else {
  console.log('All hires scaled with alpha cleanup.')
}
