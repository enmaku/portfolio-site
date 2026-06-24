import { formatPrevailingWindDisplay } from './formatPrevailingWind.js'

/** @type {string} */
export const GEOGRAPHY_SEED_TOOLTIP =
  'Deterministic input to landmass generation. The same seed and settings always produce the same terrain; changing the seed picks a different world layout without altering the other controls.'

/**
 * Sidebar control metadata for world generation parameters, ordered by typical impact.
 * @type {ReadonlyArray<{
 *   section: string,
 *   controls: ReadonlyArray<{
 *     key: string,
 *     label: string,
 *     tooltip: string,
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
        tooltip:
          'Height cutoff between ocean and land. Lower values expose more land; higher values flood coasts and shrink continents.',
        kind: 'slider',
        min: 0.22,
        max: 0.52,
        step: 0.01,
        testId: 'world-builder-control-sea-level',
      },
      {
        key: 'elevationScale',
        label: 'Elevation scale',
        tooltip:
          'Stretches height above and below sea level without moving the shoreline. Higher values create taller mountains and deeper basins.',
        kind: 'slider',
        min: 0.25,
        max: 2.5,
        step: 0.05,
        testId: 'world-builder-control-elevation-scale',
      },
      {
        key: 'elevationFrequencyScale',
        label: 'Terrain scale',
        tooltip:
          'Size of terrain features on the map. Lower values produce broad continents and smooth hills; higher values create smaller, bumpier landforms.',
        kind: 'slider',
        min: 0.4,
        max: 2.5,
        step: 0.05,
        testId: 'world-builder-control-elevation-frequency',
      },
      {
        key: 'elevationOctaves',
        label: 'Terrain detail (octaves)',
        tooltip:
          'Layers of noise detail stacked on the base terrain. More octaves add fine texture; fewer produce simpler, smoother shapes.',
        kind: 'slider',
        min: 2,
        max: 8,
        step: 1,
        testId: 'world-builder-control-elevation-octaves',
      },
      {
        key: 'elevationPersistence',
        label: 'Terrain roughness',
        tooltip:
          'How much each detail layer contributes to total roughness. Higher values yield jagged, varied terrain; lower values soften rolling land.',
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
        tooltip:
          'Bends the noise field so contours meander instead of running in straight bands. Helps drainage paths look natural and less grid-aligned.',
        kind: 'slider',
        min: 0,
        max: 28,
        step: 1,
        testId: 'world-builder-control-elevation-domain-warp',
      },
      {
        key: 'elevationCoastBiasStrength',
        label: 'Coastal lowland bias',
        tooltip:
          'Pulls coastal land down and lifts inland plateaus. Creates low coastal plains with headroom for rivers to reach the sea.',
        kind: 'slider',
        min: 0,
        max: 0.2,
        step: 0.005,
        testId: 'world-builder-control-elevation-coast-bias',
      },
      {
        key: 'elevationMidSmoothingStrength',
        label: 'Mid-elevation smoothing',
        tooltip:
          'Smooths mid-height terrain while keeping high peaks sharp. Reduces noisy plateaus that confuse river routing.',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.02,
        testId: 'world-builder-control-elevation-mid-smoothing',
      },
      {
        key: 'elevationSlopeRoughnessStrength',
        label: 'Steep-slope roughness',
        tooltip:
          'Adds high-frequency detail on steep slopes only. Makes cliffs and mountainsides look craggy without roughening flat lowlands.',
        kind: 'slider',
        min: 0,
        max: 0.15,
        step: 0.005,
        testId: 'world-builder-control-elevation-slope-roughness',
      },
      {
        key: 'elevationGentleSlopePersistenceScale',
        label: 'Lowland detail',
        tooltip:
          'Controls fine detail on gentle slopes. Lower values smooth fields and floodplains; higher values add textured rolling lowlands.',
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
        tooltip:
          'Direction moisture crosses the landmass before rain-shadow drying. Rotating wind shifts which mountain ranges stay wet versus dry.',
        kind: 'slider',
        min: 0,
        max: 359,
        step: 1,
        testId: 'world-builder-wind-slider',
      },
      {
        key: 'rainShadowStrength',
        label: 'Rain shadow strength',
        tooltip:
          'How strongly leeward terrain dries behind upwind mountains. Higher values sharpen wet and dry belts flanking major ranges.',
        kind: 'slider',
        min: 0,
        max: 2,
        step: 0.05,
        testId: 'world-builder-control-rain-shadow',
      },
      {
        key: 'moistureAdvectionStrength',
        label: 'Ocean moisture transport',
        tooltip:
          'How strongly prevailing wind carries ocean moisture inland. Higher values soak windward coasts and dry deep interiors; zero leaves rainfall driven only by the base climate field.',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.05,
        testId: 'world-builder-control-moisture-advection',
      },
      {
        key: 'rainfallAmountScale',
        label: 'Rainfall amount',
        tooltip:
          'Overall moisture across the landmass. Lower values dry out biomes and shrink rivers; higher values increase rainfall everywhere without changing wet-dry patch size.',
        kind: 'slider',
        min: 0.25,
        max: 2.5,
        step: 0.05,
        testId: 'world-builder-control-rainfall-amount',
      },
      {
        key: 'temperatureLapseRate',
        label: 'Elevation cooling',
        tooltip:
          'How much temperature drops with elevation. Higher cooling puts snow caps and tundra on lower peaks and pushes biomes downhill.',
        kind: 'slider',
        min: 0.2,
        max: 0.9,
        step: 0.01,
        testId: 'world-builder-control-temperature-lapse',
      },
      {
        key: 'rainfallFrequencyScale',
        label: 'Rainfall variation scale',
        tooltip:
          'Size of wet and dry patches in the base rainfall field. Lower values yield continent-scale climate bands; higher values add patchier local variation.',
        kind: 'slider',
        min: 0.4,
        max: 2.5,
        step: 0.05,
        testId: 'world-builder-control-rainfall-frequency',
      },
    ],
  },
  {
    section: 'Seasonal hydrology',
    controls: [
      {
        key: 'enableSeasonalHydrology',
        label: 'Seasonal hydrology',
        tooltip:
          'Run dry/wet/cold/melt cycles over multiple years so lakes fill, dry, and occasionally overtop into outlet rivers. Off uses the legacy steady rainfall snapshot.',
        kind: 'toggle',
        testId: 'world-builder-control-seasonal-hydrology',
      },
      {
        key: 'seasonalBiomeInfluenceScale',
        label: 'Land biome influence',
        tooltip:
          'How much seasonal rainfall and temperature patterns shift land biome labels away from the refreshed physical terrain fields. Zero keeps continental biomes unchanged by season weights; one applies the full season-weighted annual mean.',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.05,
        testId: 'world-builder-control-seasonal-biome-influence',
      },
      {
        key: 'seasonalYearCount',
        label: 'Simulation years',
        tooltip:
          'How many annual cycles to run before routing rivers. More years increase overflow chances and cost slightly more compute.',
        kind: 'slider',
        min: 1,
        max: 30,
        step: 1,
        testId: 'world-builder-control-seasonal-years',
      },
      {
        key: 'dryRainMult',
        label: 'Dry-season rain',
        tooltip:
          'Rainfall fraction during the dry season. Lower values dry lakes faster and shrink ephemeral streams.',
        kind: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
        testId: 'world-builder-control-dry-rain',
      },
      {
        key: 'wetRainMult',
        label: 'Wet-season rain',
        tooltip:
          'Rainfall fraction during the wet season. Higher values fill basins and push more lakes over their spill saddles.',
        kind: 'slider',
        min: 0.5,
        max: 3,
        step: 0.05,
        testId: 'world-builder-control-wet-rain',
      },
      {
        key: 'yearlyClimateNoiseScale',
        label: 'Year-to-year variability',
        tooltip:
          'How much wet and melt seasons differ between years. Zero gives identical years; higher values create occasional flood years.',
        kind: 'slider',
        min: 0,
        max: 0.6,
        step: 0.02,
        testId: 'world-builder-control-yearly-noise',
      },
      {
        key: 'lakeEvaporationScale',
        label: 'Lake evaporation',
        tooltip:
          'How aggressively lakes lose water during dry seasons. Higher values shrink lakes and favor endorheic basins.',
        kind: 'slider',
        min: 0,
        max: 2.5,
        step: 0.05,
        testId: 'world-builder-control-lake-evaporation',
      },
      {
        key: 'snowAccumRate',
        label: 'Snow accumulation',
        tooltip:
          'How fast snow pack builds on high cold terrain during the cold season.',
        kind: 'slider',
        min: 0,
        max: 2.5,
        step: 0.05,
        testId: 'world-builder-control-snow-accum',
      },
      {
        key: 'meltReleaseScale',
        label: 'Snow melt release',
        tooltip:
          'How much stored snow becomes runoff during the melt season. Drives spring pulse rivers from mountain catchments.',
        kind: 'slider',
        min: 0,
        max: 2.5,
        step: 0.05,
        testId: 'world-builder-control-melt-release',
      },
      {
        key: 'lakeBankCrumblePerYear',
        label: 'Lake bank collapses / year',
        tooltip:
          'Each simulation year, this many of the largest still-closed lakes lose their lowest bank segment and gain a new downhill outlet. Zero disables bank collapse.',
        kind: 'slider',
        min: 0,
        max: 5,
        step: 1,
        testId: 'world-builder-control-lake-bank-crumble',
      },
    ],
  },
  {
    section: 'Erosion & hydrology',
    controls: [
      {
        key: 'erosionStepCount',
        label: 'Erosion passes',
        tooltip:
          'Number of iterative erosion steps that carve channels toward the sea and wear peaks. More passes deepen valleys and sharpen drainage.',
        kind: 'slider',
        min: 0,
        max: 48,
        step: 1,
        testId: 'world-builder-control-erosion-steps',
      },
      {
        key: 'erosionChannelWear',
        label: 'River carving strength',
        tooltip:
          'How aggressively each erosion pass cuts river channels downhill. Higher values incise deeper valleys and steepen channel profiles.',
        kind: 'slider',
        min: 0.001,
        max: 0.024,
        step: 0.0005,
        testId: 'world-builder-control-erosion-channel-wear',
      },
      {
        key: 'erosionPeakWear',
        label: 'Peak smoothing',
        tooltip:
          'How much erosion rounds high summits each pass. Higher values lower and smooth mountain tops.',
        kind: 'slider',
        min: 0,
        max: 0.008,
        step: 0.0005,
        testId: 'world-builder-control-erosion-peak-wear',
      },
      {
        key: 'inciseIterations',
        label: 'Stream-power passes',
        tooltip:
          'Passes of stream-power incision after erosion. Carves elevation using discharge and slope; zero disables this stage.',
        kind: 'slider',
        min: 0,
        max: 12,
        step: 1,
        testId: 'world-builder-control-incise-iterations',
      },
      {
        key: 'streamPowerK',
        label: 'Stream-power rate (K)',
        tooltip:
          'Overall rate of stream-power erosion. Higher K incises channels faster and deepens river valleys.',
        kind: 'slider',
        min: 0,
        max: 0.008,
        step: 0.00025,
        testId: 'world-builder-control-stream-power-k',
      },
      {
        key: 'streamPowerM',
        label: 'Drainage exponent (m)',
        tooltip:
          'How strongly upstream drainage area drives incision. Higher m widens the influence of large catchments on channel depth.',
        kind: 'slider',
        min: 0.2,
        max: 0.8,
        step: 0.05,
        testId: 'world-builder-control-stream-power-m',
      },
      {
        key: 'streamPowerN',
        label: 'Slope exponent (n)',
        tooltip:
          'How strongly local slope drives incision. Higher n steepens channels and favors cutting on gradients.',
        kind: 'slider',
        min: 0.5,
        max: 2,
        step: 0.05,
        testId: 'world-builder-control-stream-power-n',
      },
      {
        key: 'channelInitiationThreshold',
        label: 'Channel initiation',
        tooltip:
          'Minimum slope×drainage product before stream-power erosion incises a carved corridor cell. Does not control painted river width.',
        kind: 'slider',
        min: 0.005,
        max: 0.06,
        step: 0.001,
        testId: 'world-builder-control-channel-initiation',
      },
      {
        key: 'navigableFlowCutoffScale',
        label: 'River size threshold',
        tooltip:
          'Flow threshold for marking rivers as navigable. Lower values classify more segments as navigable; higher values restrict navigation to the largest rivers.',
        kind: 'slider',
        min: 0.3,
        max: 2.5,
        step: 0.05,
        testId: 'world-builder-control-flow-cutoff',
      },
      {
        key: 'riverAttractionRadiusScale',
        label: 'River attraction radius',
        tooltip:
          'Legacy corridor-bridging radius. When enabled, nudges disconnected river paths toward each other; zero disables.',
        kind: 'slider',
        min: 0,
        max: 15,
        step: 0.5,
        testId: 'world-builder-control-river-attraction',
      },
      {
        key: 'enableMeanderRefine',
        label: 'Meander refine',
        tooltip:
          'Runs an optional hydrology refine pass that smooths river geometry for display. Does not change underlying drainage physics.',
        kind: 'toggle',
        testId: 'world-builder-control-meander-refine',
      },
      {
        key: 'riverMeanderStrength',
        label: 'River meandering',
        tooltip:
          'How much the meander refine pass bends river corridors. Only applies when meander refine is enabled.',
        kind: 'slider',
        min: 0,
        max: 2,
        step: 0.05,
        testId: 'world-builder-control-river-meander',
      },
      {
        key: 'riverSettlementSteps',
        label: 'River valley settling',
        tooltip:
          'Channel-carving iterations during meander refine. Lowers elevation along the refined river mask when meander refine is enabled; zero disables.',
        kind: 'slider',
        min: 0,
        max: 16,
        step: 1,
        testId: 'world-builder-control-river-settlement',
      },
      {
        key: 'riverMergeStrength',
        label: 'River tributary merge',
        tooltip:
          'How strongly tributaries merge during meander refine. Higher values produce cleaner confluences on the map.',
        kind: 'slider',
        min: 0,
        max: 2,
        step: 0.05,
        testId: 'world-builder-control-river-merge',
      },
      {
        key: 'soilDrainageScale',
        label: 'Soil drainage',
        tooltip:
          'Scales soil permeability in the drainage field. Lower values yield wetter soils and swamps; higher values speed runoff and dry ground.',
        kind: 'slider',
        min: 0.2,
        max: 4,
        step: 0.05,
        testId: 'world-builder-control-soil-drainage',
      },
      {
        key: 'minLakeAreaScale',
        label: 'Minimum lake size',
        tooltip:
          'Minimum lake area relative to default. Lower values keep more small ponds; higher values filter out tiny lakes.',
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
        tooltip:
          'Maximum number of strategic salt resource sites placed on the map. Higher values add more candidates along coasts and endorheic basins.',
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
    return formatPrevailingWindDisplay(value)
  }
  if (key === 'enableMeanderRefine') {
    return value ? 'On' : 'Off'
  }
  if (key === 'enableSeasonalHydrology') {
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
  if (key === 'lakeBankCrumblePerYear' && value <= 0) {
    return 'Off'
  }
  if (key === 'seasonalBiomeInfluenceScale' && value <= 0) {
    return 'Off'
  }
  if (key === 'streamPowerK' && value <= 0) {
    return 'Off'
  }
  if (key === 'elevationDomainWarpStrength' && value <= 0) {
    return 'Off'
  }
  if (key === 'moistureAdvectionStrength' && value <= 0) {
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
    key === 'seasonalYearCount' ||
    key === 'lakeBankCrumblePerYear' ||
    key === 'riverSettlementSteps' ||
    key === 'maxSaltNodes' ||
    key === 'elevationDomainWarpStrength'
  ) {
    return String(Math.round(value))
  }
  if (key === 'erosionChannelWear') {
    return value.toFixed(3)
  }
  if (
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
