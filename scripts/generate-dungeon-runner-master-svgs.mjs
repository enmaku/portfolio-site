/**
 * Writes editable SVG masters under public/assets/dungeon-runner/masters/.
 * Run after changing shapes; then run rasterize-dungeon-runner-masters.mjs for runtime PNGs.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')
const outRoot = path.join(repoRoot, 'public/assets/dungeon-runner/masters')

const kraft = { fill: '#e8d4b8', stroke: '#5c4033', ink: 'rgba(18,14,12,0.82)' }

function cardFaceSvg(variant) {
  const extra =
    variant === 'back'
      ? `<g opacity="0.35" fill="none" stroke="${kraft.stroke}" stroke-width="3" stroke-linecap="round">
          <path d="M120 96 Q240 40 360 96" />
          <path d="M140 176 Q240 130 340 176" />
        </g>`
      : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 272" width="480" height="272">
  <rect x="6" y="6" width="468" height="260" rx="20" ry="20" fill="${kraft.fill}" stroke="${kraft.stroke}" stroke-width="4"/>
  ${extra}
</svg>`
}

function pileSvg(kind) {
  if (kind === 'deck') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 128" width="320" height="128">
  <g fill="none" stroke="${kraft.stroke}" stroke-width="3" stroke-linejoin="round">
    <rect x="48" y="28" width="200" height="72" rx="10" fill="${kraft.fill}" opacity="0.92" transform="translate(4 6)"/>
    <rect x="48" y="28" width="200" height="72" rx="10" fill="${kraft.fill}" opacity="0.96" transform="translate(2 3)"/>
    <rect x="48" y="28" width="200" height="72" rx="10" fill="${kraft.fill}"/>
  </g>
</svg>`
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 128" width="320" height="128">
  <path d="M40 96 Q160 24 280 96 Z" fill="#c4a574" stroke="${kraft.stroke}" stroke-width="3" stroke-linejoin="round"/>
  <ellipse cx="160" cy="88" rx="28" ry="10" fill="#8b6914" opacity="0.35"/>
</svg>`
}

function doodleSvg(species) {
  const doodles = {
    goblin: `<ellipse cx="64" cy="72" rx="38" ry="44" fill="#7cb87a" stroke="${kraft.stroke}" stroke-width="3"/>
      <circle cx="52" cy="64" r="6" fill="${kraft.ink}"/><circle cx="76" cy="64" r="6" fill="${kraft.ink}"/>
      <path d="M48 88 Q64 98 80 88" fill="none" stroke="${kraft.stroke}" stroke-width="2.5" stroke-linecap="round"/>`,
    skeleton: `<circle cx="64" cy="56" r="28" fill="#f2efe6" stroke="${kraft.stroke}" stroke-width="3"/>
      <circle cx="56" cy="52" r="5" fill="${kraft.ink}"/><circle cx="72" cy="52" r="5" fill="${kraft.ink}"/>
      <rect x="44" y="84" width="40" height="52" rx="6" fill="#e0dcd0" stroke="${kraft.stroke}" stroke-width="2.5"/>`,
    orc: `<rect x="28" y="40" width="72" height="88" rx="16" fill="#6a8f6a" stroke="${kraft.stroke}" stroke-width="3"/>
      <path d="M40 56 L48 48 M80 56 L72 48" stroke="${kraft.stroke}" stroke-width="3" stroke-linecap="round"/>
      <rect x="48" y="72" width="32" height="8" rx="2" fill="${kraft.ink}"/>`,
    vampire: `<path d="M64 32 L88 72 L40 72 Z" fill="#6b4a6b" stroke="${kraft.stroke}" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="64" cy="78" r="22" fill="#d8c8d8" stroke="${kraft.stroke}" stroke-width="2"/>
      <circle cx="58" cy="76" r="4" fill="${kraft.ink}"/><circle cx="70" cy="76" r="4" fill="${kraft.ink}"/>`,
    golem: `<rect x="36" y="44" width="56" height="72" rx="8" fill="#9a9a8a" stroke="${kraft.stroke}" stroke-width="3"/>
      <rect x="48" y="56" width="32" height="12" rx="2" fill="${kraft.ink}"/>`,
    lich: `<circle cx="64" cy="64" r="36" fill="#c8d4e8" stroke="${kraft.stroke}" stroke-width="3"/>
      <circle cx="52" cy="60" r="8" fill="${kraft.ink}"/><circle cx="76" cy="60" r="8" fill="${kraft.ink}"/>
      <path d="M32 40 L40 24 M96 40 L88 24" stroke="${kraft.stroke}" stroke-width="3" stroke-linecap="round"/>`,
    demon: `<path d="M64 28 L96 96 L32 96 Z" fill="#c44" stroke="${kraft.stroke}" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="64" cy="72" r="10" fill="#2a0808"/>`,
    dragon: `<path d="M24 80 Q64 24 104 80 Q72 64 64 96 Q56 64 24 80" fill="#b85" stroke="${kraft.stroke}" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="72" cy="56" r="5" fill="${kraft.ink}"/>`,
  }
  const inner = doodles[species] ?? doodles.goblin
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  ${inner}
</svg>`
}

function symbolSvg(name) {
  const shapes = {
    torch: `<path d="M64 24 Q88 48 72 72 L56 72 Q40 48 64 24" fill="#f4a020" stroke="${kraft.stroke}" stroke-width="2.5"/>
      <rect x="58" y="72" width="12" height="40" rx="2" fill="${kraft.stroke}"/>`,
    chalice: `<path d="M48 40 H80 L74 88 Q64 96 54 88 Z" fill="#c9b8ff" stroke="${kraft.stroke}" stroke-width="2.5"/>
      <rect x="60" y="88" width="8" height="16" fill="${kraft.stroke}"/>`,
    hammer: `<rect x="56" y="32" width="16" height="56" rx="3" fill="#888" stroke="${kraft.stroke}" stroke-width="2"/>
      <rect x="36" y="28" width="56" height="16" rx="3" fill="#a65" stroke="${kraft.stroke}" stroke-width="2"/>`,
    cloak: `<path d="M64 28 Q96 72 88 112 H40 Q32 72 64 28" fill="#4a6a8a" stroke="${kraft.stroke}" stroke-width="2.5"/>`,
    pact: `<circle cx="64" cy="64" r="28" fill="none" stroke="${kraft.stroke}" stroke-width="3"/>
      <path d="M52 64 L60 72 L76 52" fill="none" stroke="${kraft.stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
    staff: `<path d="M64 24 L64 104" stroke="${kraft.stroke}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="64" cy="28" r="10" fill="#9cf" stroke="${kraft.stroke}" stroke-width="2"/>`,
  }
  const inner = shapes[name] ?? shapes.torch
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  ${inner}
</svg>`
}

function seatIconSvg(role) {
  if (role === 'runner') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <circle cx="64" cy="44" r="22" fill="${kraft.fill}" stroke="${kraft.stroke}" stroke-width="3"/>
  <path d="M32 112 Q64 72 96 112" fill="${kraft.fill}" stroke="${kraft.stroke}" stroke-width="3" stroke-linejoin="round"/>
</svg>`
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <path d="M64 28 L96 96 H32 Z" fill="#8a3030" stroke="${kraft.stroke}" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="64" cy="56" r="8" fill="#2a0808"/>
</svg>`
}

function turnCounterSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <circle cx="64" cy="64" r="52" fill="#fff8e8" stroke="${kraft.stroke}" stroke-width="4"/>
  <path d="M64 28 L64 64 L88 76" fill="none" stroke="${kraft.stroke}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`
}

function boardTextureSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 144" width="800" height="144" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e6d2b4"/>
      <stop offset="0.5" stop-color="#d8c4a4"/>
      <stop offset="1" stop-color="#cbb496"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="800" height="144" fill="url(#g)"/>
  <g opacity="0.14" fill="none" stroke="#6b5344" stroke-width="1.2" stroke-linecap="round">
    <path d="M40 72 Q200 48 360 72 T680 72"/>
    <path d="M80 96 Q260 120 440 96 T720 96"/>
  </g>
</svg>`
}

async function write(rel, content) {
  const fp = path.join(outRoot, rel)
  await mkdir(path.dirname(fp), { recursive: true })
  await writeFile(fp, content, 'utf8')
}

const species = ['goblin', 'skeleton', 'orc', 'vampire', 'golem', 'lich', 'demon', 'dragon']
const symNames = ['torch', 'chalice', 'hammer', 'cloak', 'pact', 'staff']

await write('cards/card-blank.svg', cardFaceSvg('face'))
await write('cards/monster-back.svg', cardFaceSvg('back'))
await write('cards/revealed-monster.svg', cardFaceSvg('face'))
await write('piles/deck-back.svg', pileSvg('deck'))
await write('piles/dungeon-back.svg', pileSvg('dungeon'))

for (const s of species) {
  await write(`cards/doodles/${s}.svg`, doodleSvg(s))
}
for (const s of symNames) {
  await write(`symbols/${s}.svg`, symbolSvg(s))
}
await write('icons/runner.svg', seatIconSvg('runner'))
await write('icons/monster.svg', seatIconSvg('monster'))
await write('counters/turn.svg', turnCounterSvg())
await write('board/bidding-texture.svg', boardTextureSvg())

console.log(`Wrote masters under ${path.relative(repoRoot, outRoot)}`)
