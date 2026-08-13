import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

test('win share and aggregate builders stay Chart.js-free', () => {
  for (const file of [
    'buildWinShareChart.js',
    'aggregateStatisticsViewModel.js',
    'sessionStatisticsViewModel.js',
    'gameDetailStatisticsViewModel.js',
  ]) {
    const src = readFileSync(join(here, file), 'utf8')
    assert.equal(src.includes('chart.js'), false, `${file} must not import chart.js`)
    assert.equal(src.includes('vue-chartjs'), false, `${file} must not import vue-chartjs`)
  }
})
