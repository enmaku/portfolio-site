/** Help copy for colonization colonist settings (matches terrain-control tooltip pattern). */

export const THREE_DAY_HAUL_DISTANCE_TOOLTIP =
  'How far a settlement can haul bulk goods in about three days of travel (1–100 cells). Calibrates map scale: larger values mean each cell covers more ground and the haul-shed reach preview grows. When movement cost exists, reach follows terrain; otherwise the preview is a circle.'

export const STARTING_POPULATION_TOOLTIP =
  'Headcount of the founding wave at begin colonization. Later survival accounting may clamp this to what local food, water, and shelter can support.'

export const YIELD_MODIFIER_TOOLTIP =
  'How generously arable land is read for food production: marginal (poor yields), typical, or bountiful (rich yields). Affects population ceiling and growth once survival ticks run.'

export const EPOCH_BATCH_TOOLTIP =
  'In-world years advanced each time you step the simulation. 1 steps year by year; higher values jump decades or a century per click. Editable during a run. Time controls activate with the first colonization increment.'

export const LAND_EXPEDITION_RANGE_TOOLTIP =
  'Multiplier on three-day haul distance for how far a land expedition may march before ending (1×–4×). Locked after begin colonization.'

export const SAIL_EXPEDITION_RANGE_TOOLTIP =
  'Multiplier on three-day haul distance for how far a sail expedition may travel before ending (2×–6×). Locked after begin colonization.'
