/**
 * Downscales hires PNGs → mobile runtime assets.
 * Strips AI-baked gray checkerboard / fake “transparency” grays (neutral RGB, no chroma)
 * before resize so alpha is real and patterns don’t shrink into muddy texture.
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const repoRoot = path.resolve(import.meta.dirname, '..')
const hiresRoot = path.join(repoRoot, 'artifacts/dungeon-runner/hires-pre-scale')
const runtimeRoot = path.join(repoRoot, 'public/assets/dungeon-runner/runtime')

const CARD_W = 480
const CARD_H = 272
const DOODLE_W = 400
const DOODLE_H = 224
const SYMBOL = 128
const SEAT_ICON = 128
const TURN = 112
const BOARD_W = 800
const BOARD_H = 144

/** @typedef {'strip-neutral-light' | 'strip-neutral-card' | 'strip-neutral-subtle'} StripMode */

const targets = [
  ...['torch', 'chalice', 'hammer', 'cloak', 'pact', 'staff'].map((name) => ({
    src: `symbols/${name}.png`,
    out: `symbols/${name}.png`,
    width: SYMBOL,
    height: SYMBOL,
    strip: /** @type {StripMode} */ ('strip-neutral-light'),
  })),
  {
    src: 'cards/card-blank.png',
    out: 'cards/card-blank.png',
    width: CARD_W,
    height: CARD_H,
    strip: 'strip-neutral-card',
  },
  {
    src: 'cards/monster-back.png',
    out: 'cards/monster-back.png',
    width: CARD_W,
    height: CARD_H,
    strip: 'strip-neutral-card',
  },
  ...['goblin', 'skeleton', 'orc', 'vampire', 'golem', 'lich', 'demon', 'dragon'].map((species) => ({
    src: `cards/doodles/${species}.png`,
    out: `cards/doodles/${species}.png`,
    width: DOODLE_W,
    height: DOODLE_H,
    strip: /** @type {StripMode} */ ('strip-neutral-light'),
  })),
  { src: 'icons/runner.png', out: 'icons/runner.png', width: SEAT_ICON, height: SEAT_ICON, strip: 'strip-neutral-light' },
  { src: 'icons/monster.png', out: 'icons/monster.png', width: SEAT_ICON, height: SEAT_ICON, strip: 'strip-neutral-light' },
  { src: 'counters/turn.png', out: 'counters/turn.png', width: TURN, height: TURN, strip: 'strip-neutral-light' },
  { src: 'board/bidding-texture.png', out: 'board/bidding-texture.png', width: BOARD_W, height: BOARD_H, strip: 'strip-neutral-subtle' },
]

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

async function scaleOne(task) {
  const { src, out, width, height, strip } = task
  const srcPath = path.join(hiresRoot, src)
  const outPath = path.join(runtimeRoot, out)
  await mkdir(path.dirname(outPath), { recursive: true })

  const pipeline = await preprocessPng(srcPath, strip)
  await pipeline
    .resize(width, height, {
      fit: 'contain',
      position: 'centre',
      kernel: sharp.kernel.lanczos3,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({
      compressionLevel: 9,
      effort: 10,
    })
    .toFile(outPath)

  const fs = await import('node:fs/promises')
  const st = await fs.stat(outPath)
  console.log(`${out} → ${width}×${height} (${(st.size / 1024).toFixed(1)} KB)`)
}

const missing = []
for (const t of targets) {
  try {
    await scaleOne(t)
  } catch (e) {
    if (e.code === 'ENOENT') missing.push(t.src)
    else throw e
  }
}

if (missing.length) {
  console.error('Missing hires sources:\n', missing.join('\n'))
  process.exitCode = 1
} else {
  console.log('All hires scaled with alpha cleanup.')
}
