import assert from 'node:assert/strict'
import test from 'node:test'
import { REFERENCE_GRID_SIZE } from './types.js'
import {
  coastalProximityMaxDistanceForGrid,
  REFERENCE_COASTAL_PROXIMITY_MAX_DISTANCE,
  REFERENCE_SALT_LAND_PROXIMITY_RADIUS,
  REFERENCE_STRATEGIC_RESOURCE_NODE_SPACING,
  saltLandProximityRadiusForGrid,
  strategicResourceNodeSpacingForGrid,
} from './resourcePlacementScaling.js'

test('strategicResourceNodeSpacingForGrid matches reference spacing at 256²', () => {
  assert.strictEqual(
    strategicResourceNodeSpacingForGrid(REFERENCE_GRID_SIZE),
    REFERENCE_STRATEGIC_RESOURCE_NODE_SPACING,
  )
})

test('strategicResourceNodeSpacingForGrid scales linearly to 1024²', () => {
  assert.strictEqual(strategicResourceNodeSpacingForGrid(1024), 64)
})

test('saltLandProximityRadiusForGrid matches reference radius at 256²', () => {
  assert.strictEqual(
    saltLandProximityRadiusForGrid(REFERENCE_GRID_SIZE),
    REFERENCE_SALT_LAND_PROXIMITY_RADIUS,
  )
})

test('saltLandProximityRadiusForGrid scales linearly to 1024²', () => {
  assert.strictEqual(saltLandProximityRadiusForGrid(1024), 40)
})

test('coastalProximityMaxDistanceForGrid matches reference distance at 256²', () => {
  assert.strictEqual(
    coastalProximityMaxDistanceForGrid(REFERENCE_GRID_SIZE),
    REFERENCE_COASTAL_PROXIMITY_MAX_DISTANCE,
  )
})

test('coastalProximityMaxDistanceForGrid scales linearly to 1024²', () => {
  assert.strictEqual(coastalProximityMaxDistanceForGrid(1024), 40)
})
