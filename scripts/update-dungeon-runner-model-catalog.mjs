#!/usr/bin/env node
import { readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const modelsRoot = path.join(process.cwd(), 'public', 'models', 'dungeon-runner')
const entries = existsSync(modelsRoot) ? readdirSync(modelsRoot) : []
const models = entries.filter((entry) => {
  const dirPath = path.join(modelsRoot, entry)
  return statSync(dirPath).isDirectory() && existsSync(path.join(dirPath, 'model.json'))
})

writeFileSync(path.join(modelsRoot, 'models.json'), JSON.stringify({ models }, null, 2) + '\n')
console.log(`Wrote catalog for ${models.length} model(s)`)
