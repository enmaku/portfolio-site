import {
  runFullDerivedGeographyPipeline,
} from './derivedGeographyPipeline.js'

/**
 * @param {import('./types.js').DerivedGeographyParams} params
 * @returns {import('./types.js').WorldDocument}
 */
export function generateDerivedGeography(params) {
  return runFullDerivedGeographyPipeline(params)
}
