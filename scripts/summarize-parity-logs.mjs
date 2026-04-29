#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const heroes = ['WARRIOR', 'BARBARIAN', 'MAGE', 'ROGUE']
const baseDir = process.argv[2] ?? 'artifacts/parity'
const outPath = process.argv[3] ?? path.join(baseDir, 'summary-4242.json')

const summary = {}
for (const hero of heroes) {
  const filePath = path.join(baseDir, `parity-${hero}-4242.log`)
  const text = readFileSync(filePath, 'utf8')
  summary[hero] = parseLog(text)
}

writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`)
console.log(`wrote ${outPath}`)

function parseLog(text) {
  const firstDivergence = Number(matchLine(text, /First divergence at step (\d+):/)?.[1] ?? -1)
  const jsAction = matchLine(text, /JS: .* action=(.+)$/m)?.[1] ?? null
  const pyAction = matchLine(text, /PY: .* action=(.+)$/m)?.[1] ?? null
  const maxAbsDiff = Number(matchLine(text, /max abs diff: ([0-9.]+)/)?.[1] ?? '0')
  const changedDims = Number(matchLine(text, /changed dims \(>1e-6\): (\d+)/)?.[1] ?? '0')
  const phase = {
    js: matchLine(text, /phase: js=([^\s]+) py=/)?.[1] ?? null,
    py: matchLine(text, /phase: js=[^\s]+ py=([^\s]+)/)?.[1] ?? null,
  }
  const dungeonSub = {
    js: matchLine(text, /dungeon_sub: js=([^\s]+) py=/)?.[1] ?? null,
    py: matchLine(text, /dungeon_sub: js=[^\s]+ py=([^\s]+)/)?.[1] ?? null,
  }
  return { firstDivergence, jsAction, pyAction, maxAbsDiff, changedDims, phase, dungeonSub }
}

function matchLine(text, regex) {
  return text.match(regex)
}
