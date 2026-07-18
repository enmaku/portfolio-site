/** Help copy for colonization colonist settings (matches terrain-control tooltip pattern). */

export const THREE_DAY_HAUL_DISTANCE_TOOLTIP =
  'How far a settlement can haul bulk goods in about three days of travel (1–300 cells). Calibrates map scale: larger values mean each cell covers more ground and the haul-shed reach preview (a circle around the pin) grows.'

export const STARTING_POPULATION_TOOLTIP =
  'Headcount of the founding wave at begin colonization. Later survival accounting may clamp this to what local food, water, and shelter can support.'

export const PEOPLE_PER_HABITABLE_CELL_TOOLTIP =
  'How many people can live on one dry claimed cell (1–50, default 10). Caps settlement size by habitable land mass even when food or imports could feed more. Scaled further by population density. Locked after begin colonization.'

export const POPULATION_DENSITY_TOOLTIP =
  'Global scale on how densely people pack and how much food a productivity unit yields (0.5×–2×, default 1). Multiplies feeding capacity, people per habitable cell, and matching grain/fish lb production together. Locked after begin colonization.'

export const YIELD_MODIFIER_TOOLTIP =
  'How generously arable land is read for food production: marginal (poor yields), typical, or bountiful (rich yields). Affects population ceiling and growth once survival ticks run.'

export const LAND_EXPEDITION_RANGE_TOOLTIP =
  'Multiplier on three-day haul distance for how far a land expedition may march before ending (1×–4×). Locked after begin colonization.'

export const INLAND_SAIL_EXPEDITION_RANGE_TOOLTIP =
  'Multiplier on three-day haul distance for how far an inland sail expedition may travel before ending (2×–6×). Locked after begin colonization.'

export const OPEN_SEA_EXPEDITION_RANGE_TOOLTIP =
  'Multiplier on three-day haul distance for how far an open-sea expedition may sail before ending (4×–12×). Locked after begin colonization.'

export const OFF_MAP_SHIPPING_COST_TOOLTIP =
  'How much distance to the unseen world inflates off-map trade (1×–4×). Ports pay this multiple of reference price on imports and receive the reciprocal fraction on exports. Locked after begin colonization.'
