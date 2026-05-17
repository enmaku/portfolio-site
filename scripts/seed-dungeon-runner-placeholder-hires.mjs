/**
 * Writes low-fidelity placeholder hires under artifacts/dungeon-runner/hires-pre-scale/
 * (gitignored): `tokens/plate.png` for the shared token plate, `symbols/<key>.png` for
 * `dungeonRunnerNewEquipmentSymbolKeys`. For exercising `npm run scale-dungeon-runner-assets` only.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { dungeonRunnerNewEquipmentSymbolKeys } from './dungeon-runner-scale-targets.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..')
const hiresRoot = path.join(repoRoot, 'artifacts/dungeon-runner/hires-pre-scale')
const H = 512

function plateSvg() {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${H}" height="${H}">
  <circle cx="${H / 2}" cy="${H / 2}" r="${H * 0.42}" fill="#9a7b56" stroke="#5c4630" stroke-width="8"/>
  <circle cx="${H / 2}" cy="${H / 2}" r="${H * 0.38}" fill="none" stroke="#c4a574" stroke-width="3" opacity="0.5"/>
</svg>`,
  )
}

function symbolSvg(key, fill) {
  const label = key.slice(0, 3).toUpperCase()
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${H}" height="${H}">
  <rect width="${H}" height="${H}" fill="#e8e0d8"/>
  <circle cx="${H / 2}" cy="${H / 2}" r="${H * 0.28}" fill="${fill}" stroke="#333" stroke-width="6"/>
  <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle"
    font-family="system-ui,sans-serif" font-size="72" font-weight="700" fill="#222">${label}</text>
</svg>`,
  )
}

const symbolFills = {
  armor: '#6b7c8c',
  shield: '#4a6fa5',
  potion: '#8b4a6b',
  vorpal: '#5a4a8b',
  ring: '#b8860b',
  axe: '#6b5a4a',
  poly: '#4a8b6b',
  omni: '#7a4a8b',
}

async function writePng(rel, svgBuf) {
  const out = path.join(hiresRoot, rel)
  await mkdir(path.dirname(out), { recursive: true })
  await sharp(svgBuf).png({ compressionLevel: 9 }).toFile(out)
  console.log(`wrote ${rel}`)
}

const platePath = path.join(hiresRoot, 'tokens/plate.png')
await mkdir(path.dirname(platePath), { recursive: true })
await sharp(plateSvg()).png({ compressionLevel: 9 }).toFile(platePath)
console.log('wrote tokens/plate.png')

for (const key of dungeonRunnerNewEquipmentSymbolKeys) {
  const fill = symbolFills[key] ?? '#888888'
  await writePng(`symbols/${key}.png`, symbolSvg(key, fill))
}

const readme = path.join(hiresRoot, 'README.txt')
await mkdir(path.dirname(readme), { recursive: true })
await writeFile(
  readme,
  [
    'Placeholder hires only (seed-dungeon-runner-placeholder-hires.mjs).',
    'Swap in painted hires under the same paths; run npm run scale-dungeon-runner-assets.',
    '',
  ].join('\n'),
  'utf8',
)
console.log('wrote README.txt')
