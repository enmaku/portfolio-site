/**
 * Sidebar control metadata for world generation parameters, ordered by typical impact.
 * @type {ReadonlyArray<{
 *   section: string,
 *   controls: ReadonlyArray<{
 *     key: string,
 *     label: string,
 *     kind: 'slider' | 'toggle' | 'number',
 *     min?: number,
 *     max?: number,
 *     step?: number,
 *     testId: string,
 *   }>,
 * }>}
 */
export const WORLD_BUILDER_GENERATION_CONTROL_SECTIONS = [
  {
    section: 'Land & sea',
    controls: [
      {
        key: 'seaLevel',
        label: 'Sea level',
        kind: 'slider',
        min: 0.22,
        max: 0.52,
        step: 0.01,
        testId: 'world-builder-control-sea-level',
      },
      {
        key: 'elevationScale',
        label: 'Elevation scale',
        kind: 'slider',
        min: 0.25,
        max: 2.5,
        step: 0.05,
        testId: 'world-builder-control-elevation-scale',
      },
      {
        key: 'elevationFrequencyScale',
        label: 'Terrain scale',
        kind: 'slider',
        min: 0.4,
        max: 2.5,
        step: 0.05,
        testId: 'world-builder-control-elevation-frequency',
      },
      {
        key: 'elevationOctaves',
        label: 'Terrain detail (octaves)',
        kind: 'slider',
        min: 2,
        max: 8,
        step: 1,
        testId: 'world-builder-control-elevation-octaves',
      },
      {
        key: 'elevationPersistence',
        label: 'Terrain roughness',
        kind: 'slider',
        min: 0.3,
        max: 0.75,
        step: 0.01,
        testId: 'world-builder-control-elevation-persistence',
      },
    ],
  },
  {
    section: 'River-friendly terrain',
    controls: [
      {
        key: 'elevationDomainWarpStrength',
        label: 'Terrain domain warp',
        kind: 'slider',
        min: 0,
        max: 28,
        step: 1,
        testId: 'world-builder-control-elevation-domain-warp',
      },
      {
        key: 'elevationCoastBiasStrength',
        label: 'Coastal lowland bias',
        kind: 'slider',
        min: 0,
        max: 0.2,
        step: 0.005,
        testId: 'world-builder-control-elevation-coast-bias',
      },
      {
        key: 'elevationMidSmoothingStrength',
        label: 'Mid-elevation smoothing',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.02,
        testId: 'world-builder-control-elevation-mid-smoothing',
      },
      {
        key: 'elevationSlopeRoughnessStrength',
        label: 'Steep-slope roughness',
        kind: 'slider',
        min: 0,
        max: 0.15,
        step: 0.005,
        testId: 'world-builder-control-elevation-slope-roughness',
      },
      {
        key: 'elevationGentleSlopePersistenceScale',
        label: 'Lowland detail',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.02,
        testId: 'world-builder-control-elevation-gentle-persistence',
      },
    ],
  },
  {
    section: 'Climate',
    controls: [
      {
        key: 'prevailingWindDegrees',
        label: 'Prevailing wind',
        kind: 'slider',
        min: 0,
        max: 359,
        step: 1,
        testId: 'world-builder-wind-slider',
      },
      {
        key: 'rainShadowStrength',
        label: 'Rain shadow strength',
        kind: 'slider',
        min: 0,
        max: 2,
        step: 0.05,
        testId: 'world-builder-control-rain-shadow',
      },
      {
        key: 'temperatureLapseRate',
        label: 'Elevation cooling',
        kind: 'slider',
        min: 0.2,
        max: 0.9,
        step: 0.01,
        testId: 'world-builder-control-temperature-lapse',
      },
      {
        key: 'rainfallFrequencyScale',
        label: 'Rainfall variation scale',
        kind: 'slider',
        min: 0.4,
        max: 2.5,
        step: 0.05,
        testId: 'world-builder-control-rainfall-frequency',
      },
    ],
  },
  {
    section: 'Erosion & hydrology',
    controls: [
      {
        key: 'erosionStepCount',
        label: 'Erosion passes',
        kind: 'slider',
        min: 0,
        max: 48,
        step: 1,
        testId: 'world-builder-control-erosion-steps',
      },
      {
        key: 'erosionChannelWear',
        label: 'River carving strength',
        kind: 'slider',
        min: 0.001,
        max: 0.012,
        step: 0.0005,
        testId: 'world-builder-control-erosion-channel-wear',
      },
      {
        key: 'erosionPeakWear',
        label: 'Peak smoothing',
        kind: 'slider',
        min: 0,
        max: 0.008,
        step: 0.0005,
        testId: 'world-builder-control-erosion-peak-wear',
      },
      {
        key: 'inciseIterations',
        label: 'Stream-power passes',
        kind: 'slider',
        min: 0,
        max: 12,
        step: 1,
        testId: 'world-builder-control-incise-iterations',
      },
      {
        key: 'streamPowerK',
        label: 'Stream-power rate (K)',
        kind: 'slider',
        min: 0,
        max: 0.008,
        step: 0.00025,
        testId: 'world-builder-control-stream-power-k',
      },
      {
        key: 'streamPowerM',
        label: 'Drainage exponent (m)',
        kind: 'slider',
        min: 0.2,
        max: 0.8,
        step: 0.05,
        testId: 'world-builder-control-stream-power-m',
      },
      {
        key: 'streamPowerN',
        label: 'Slope exponent (n)',
        kind: 'slider',
        min: 0.5,
        max: 2,
        step: 0.05,
        testId: 'world-builder-control-stream-power-n',
      },
      {
        key: 'channelInitiationThreshold',
        label: 'Channel initiation',
        kind: 'slider',
        min: 0.005,
        max: 0.06,
        step: 0.001,
        testId: 'world-builder-control-channel-initiation',
      },
      {
        key: 'navigableFlowCutoffScale',
        label: 'River size threshold',
        kind: 'slider',
        min: 0.3,
        max: 2.5,
        step: 0.05,
        testId: 'world-builder-control-flow-cutoff',
      },
      {
        key: 'riverAttractionRadiusScale',
        label: 'River attraction radius',
        kind: 'slider',
        min: 0,
        max: 24,
        step: 0.5,
        testId: 'world-builder-control-river-attraction',
      },
      {
        key: 'enableMeanderRefine',
        label: 'Meander refine',
        kind: 'toggle',
        testId: 'world-builder-control-meander-refine',
      },
      {
        key: 'riverMeanderStrength',
        label: 'River meandering',
        kind: 'slider',
        min: 0,
        max: 2,
        step: 0.05,
        testId: 'world-builder-control-river-meander',
      },
      {
        key: 'riverSettlementSteps',
        label: 'River valley settling',
        kind: 'slider',
        min: 0,
        max: 16,
        step: 1,
        testId: 'world-builder-control-river-settlement',
      },
      {
        key: 'riverMergeStrength',
        label: 'River tributary merge',
        kind: 'slider',
        min: 0,
        max: 2,
        step: 0.05,
        testId: 'world-builder-control-river-merge',
      },
      {
        key: 'soilDrainageScale',
        label: 'Soil drainage',
        kind: 'slider',
        min: 0.2,
        max: 2,
        step: 0.05,
        testId: 'world-builder-control-soil-drainage',
      },
      {
        key: 'minLakeAreaScale',
        label: 'Minimum lake size',
        kind: 'slider',
        min: 0.25,
        max: 3,
        step: 0.05,
        testId: 'world-builder-control-min-lake-area',
      },
    ],
  },
  {
    section: 'Resources',
    controls: [
      {
        key: 'maxSaltNodes',
        label: 'Salt node cap',
        kind: 'slider',
        min: 0,
        max: 32,
        step: 1,
        testId: 'world-builder-control-max-salt-nodes',
      },
    ],
  },
]

/**
 * @param {string} key
 * @param {number | boolean} value
 * @returns {string}
 */
export function formatGenerationControlValue(key, value) {
  if (key === 'prevailingWindDegrees') {
    return `${Math.round(value)}°`
  }
  if (key === 'enableMeanderRefine') {
    return value ? 'On' : 'Off'
  }
  if (key === 'riverAttractionRadiusScale' && value <= 0) {
    return 'Off'
  }
  if (key === 'riverMeanderStrength' && value <= 0) {
    return 'Off'
  }
  if (key === 'riverSettlementSteps' && value <= 0) {
    return 'Off'
  }
  if (key === 'riverMergeStrength' && value <= 0) {
    return 'Off'
  }
  if (key === 'inciseIterations' && value <= 0) {
    return 'Off'
  }
  if (key === 'streamPowerK' && value <= 0) {
    return 'Off'
  }
  if (key === 'elevationDomainWarpStrength' && value <= 0) {
    return 'Off'
  }
  if (key === 'elevationCoastBiasStrength' && value <= 0) {
    return 'Off'
  }
  if (key === 'elevationMidSmoothingStrength' && value <= 0) {
    return 'Off'
  }
  if (key === 'elevationSlopeRoughnessStrength' && value <= 0) {
    return 'Off'
  }
  if (
    key === 'elevationOctaves' ||
    key === 'erosionStepCount' ||
    key === 'inciseIterations' ||
    key === 'riverSettlementSteps' ||
    key === 'maxSaltNodes' ||
    key === 'elevationDomainWarpStrength'
  ) {
    return String(Math.round(value))
  }
  if (
    key === 'erosionChannelWear' ||
    key === 'erosionPeakWear' ||
    key === 'streamPowerK' ||
    key === 'channelInitiationThreshold' ||
    key === 'seaLevel' ||
    key === 'elevationPersistence' ||
    key === 'temperatureLapseRate'
  ) {
    return value.toFixed(2)
  }
  return value.toFixed(2)
}
