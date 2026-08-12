import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from './core/worldGenerationOptions.js'
import {
  MEANDER_REFINE_DEPENDENT_CONTROL_KEYS,
  WORLD_BUILDER_GENERATION_CONTROL_SECTIONS,
  isGenerationControlDisabled,
} from './worldBuilderGenerationControls.js'
import { placeMetalNodes } from './core/resources/placeMetalNodes.js'
import { SEA_LEVEL } from './core/biomeIds.js'

/**
 * @param {string} key
 */
function findGenerationControlByKey(key) {
  for (const section of WORLD_BUILDER_GENERATION_CONTROL_SECTIONS) {
    const control = section.controls.find((entry) => entry.key === key)
    if (control) return control
  }
  return undefined
}

/**
 * @param {string} sectionName
 * @returns {string[]}
 */
function controlKeysForSection(sectionName) {
  const section = WORLD_BUILDER_GENERATION_CONTROL_SECTIONS.find(
    (entry) => entry.section === sectionName,
  )
  assert.ok(section)
  return section.controls.map((control) => control.key)
}

test('Wind section is first and owns prevailing plus secondary maximum', () => {
  assert.equal(WORLD_BUILDER_GENERATION_CONTROL_SECTIONS[0].section, 'Wind')
  assert.deepEqual(controlKeysForSection('Wind'), [
    'prevailingWindDegrees',
    'secondaryMaximumLinked',
    'secondaryMaximumDegrees',
  ])
  assert.equal(controlKeysForSection('Climate').includes('prevailingWindDegrees'), false)
})

test('isGenerationControlDisabled gates secondary maximum while linked', () => {
  assert.equal(
    isGenerationControlDisabled('secondaryMaximumDegrees', DEFAULT_WORLD_GENERATION_OPTIONS, {
      secondaryMaximumLinked: true,
    }),
    true,
  )
  assert.equal(
    isGenerationControlDisabled('secondaryMaximumDegrees', DEFAULT_WORLD_GENERATION_OPTIONS, {
      secondaryMaximumLinked: false,
    }),
    false,
  )
})

test('meander refine toggle precedes its dependent sliders in Erosion & hydrology', () => {
  const keys = controlKeysForSection('Erosion & hydrology')
  const soilDrainageIndex = keys.indexOf('soilDrainageScale')
  const minLakeIndex = keys.indexOf('minLakeAreaScale')
  const meanderIndex = keys.indexOf('enableMeanderRefine')
  const attractionIndex = keys.indexOf('riverAttractionRadiusScale')
  const mergeIndex = keys.indexOf('riverMergeStrength')

  assert.ok(soilDrainageIndex >= 0)
  assert.ok(minLakeIndex > soilDrainageIndex)
  assert.ok(meanderIndex > minLakeIndex)
  assert.ok(attractionIndex > meanderIndex)
  assert.ok(mergeIndex > attractionIndex)
  assert.ok(!MEANDER_REFINE_DEPENDENT_CONTROL_KEYS.has('soilDrainageScale'))
  assert.ok(!MEANDER_REFINE_DEPENDENT_CONTROL_KEYS.has('minLakeAreaScale'))
})

test('isGenerationControlDisabled gates meander refine child sliders only', () => {
  const disabledOptions = {
    ...DEFAULT_WORLD_GENERATION_OPTIONS,
    enableMeanderRefine: false,
  }
  const enabledOptions = {
    ...DEFAULT_WORLD_GENERATION_OPTIONS,
    enableMeanderRefine: true,
  }

  for (const key of MEANDER_REFINE_DEPENDENT_CONTROL_KEYS) {
    assert.ok(findGenerationControlByKey(key))
    assert.equal(isGenerationControlDisabled(key, disabledOptions), true)
    assert.equal(isGenerationControlDisabled(key, enabledOptions), false)
  }

  assert.equal(isGenerationControlDisabled('enableMeanderRefine', disabledOptions), false)
  assert.equal(isGenerationControlDisabled('soilDrainageScale', disabledOptions), false)
  assert.equal(isGenerationControlDisabled('navigableFlowCutoffScale', disabledOptions), false)
})

test('Resources section exposes mineral occurrence controls after the metal mine cap', () => {
  const keys = controlKeysForSection('Resources')
  const capIndex = keys.indexOf('maxMetalNodes')
  assert.ok(capIndex >= 0)
  for (const occurrenceKey of [
    'mineralOccurrenceCopper',
    'mineralOccurrenceSilver',
    'mineralOccurrenceGold',
    'mineralOccurrenceDiamond',
  ]) {
    assert.ok(keys.indexOf(occurrenceKey) > capIndex)
  }
})

test('occurrence controls change deposit mix while the deposit count holds', () => {
  const gridWidth = 96
  const gridHeight = 96
  const metalsRaster = new Float32Array(gridWidth * gridHeight)
  let seeded = 0
  for (let y = 8; y < gridHeight - 8 && seeded < 150; y += 6) {
    for (let x = 8; x < gridWidth - 8 && seeded < 150; x += 6) {
      metalsRaster[y * gridWidth + x] = 0.5 + ((seeded % 20) / 20) * 0.4
      seeded += 1
    }
  }
  const elevation = new Float32Array(gridWidth * gridHeight).fill(SEA_LEVEL + 0.4)
  const base = {
    metalsRaster,
    elevation,
    width: gridWidth,
    height: gridHeight,
    geographySeed: 8675309,
    maxNodes: 40,
  }

  const defaults = placeMetalNodes({
    ...base,
    occurrenceWeights: { copper: 100, silver: 10, gold: 1, diamond: 0 },
  })
  const diamondRich = placeMetalNodes({
    ...base,
    occurrenceWeights: { copper: 100, silver: 10, gold: 1, diamond: 100 },
  })

  assert.strictEqual(defaults.length, diamondRich.length)
  const defaultDiamonds = defaults.filter((node) => node.kind === 'diamond').length
  const richDiamonds = diamondRich.filter((node) => node.kind === 'diamond').length
  assert.strictEqual(defaultDiamonds, 0)
  assert.ok(richDiamonds > 0)
})
