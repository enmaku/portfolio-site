import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from './core/worldGenerationOptions.js'
import {
  MEANDER_REFINE_DEPENDENT_CONTROL_KEYS,
  WORLD_BUILDER_GENERATION_CONTROL_SECTIONS,
  isGenerationControlDisabled,
} from './worldBuilderGenerationControls.js'

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
