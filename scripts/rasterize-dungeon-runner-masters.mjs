/**
 * Rasterizes committed SVG masters → runtime PNGs (sharp).
 * Source: public/assets/dungeon-runner/masters
 * Output: public/assets/dungeon-runner/runtime
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { rasterizeCardGrammarMasterRels } from '../src/features/dungeon-runner/ui/rasterizeGrammarJobRels.js'

const repoRoot = path.resolve(import.meta.dirname, '..')
const masterRoot = path.join(repoRoot, 'public/assets/dungeon-runner/masters')
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
const PILE_W = 240
const PILE_H = 96

const { doodleRels, symbolRels } = rasterizeCardGrammarMasterRels()

/** @type {{ rel: string, w: number, h: number }[]} */
const jobs = [
  { rel: 'cards/card-blank.svg', w: CARD_W, h: CARD_H },
  { rel: 'cards/monster-back.svg', w: CARD_W, h: CARD_H },
  { rel: 'cards/revealed-monster.svg', w: CARD_W, h: CARD_H },
  { rel: 'piles/deck-back.svg', w: PILE_W, h: PILE_H },
  { rel: 'piles/dungeon-back.svg', w: PILE_W, h: PILE_H },
  ...doodleRels.map((rel) => ({ rel, w: DOODLE_W, h: DOODLE_H })),
  ...symbolRels.map((rel) => ({ rel, w: SYMBOL, h: SYMBOL })),
  { rel: 'icons/runner.svg', w: SEAT_ICON, h: SEAT_ICON },
  { rel: 'icons/monster.svg', w: SEAT_ICON, h: SEAT_ICON },
  { rel: 'counters/turn.svg', w: TURN, h: TURN },
  { rel: 'board/bidding-texture.svg', w: BOARD_W, h: BOARD_H },
]

async function rasterize(rel, w, h) {
  const src = path.join(masterRoot, rel)
  const outRel = rel.replace(/\.svg$/i, '.png')
  const dest = path.join(runtimeRoot, outRel)
  await mkdir(path.dirname(dest), { recursive: true })
  await sharp(src)
    .resize(w, h, {
      fit: 'contain',
      position: 'centre',
      kernel: sharp.kernel.lanczos3,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(dest)
  console.log(outRel)
}

for (const j of jobs) {
  await rasterize(j.rel, j.w, j.h)
}

console.log('Rasterize complete.')
