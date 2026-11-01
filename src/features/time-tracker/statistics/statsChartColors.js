/**
 * ColorBrewer qualitative Set3 (12 classes), sharing the palette family used by the
 * World Builder faction territory overlay. The lightest Set3 entries are darkened so
 * fills stay legible on the Time Tracker's dark surface.
 *
 * Source: https://colorbrewer2.org/?type=qualitative&scheme=Set3&n=12
 */
export const STATS_CHART_COLORS = [
  '#8dd3c7',
  '#b5a642',
  '#bebada',
  '#fb8072',
  '#80b1d3',
  '#fdb462',
  '#b3de69',
  '#d98fc0',
  '#d9d9d9',
  '#bc80bd',
  '#8dbf76',
  '#c9a227',
]

/** Segment for project ranks past the palette, in the stacked bar chart only. */
export const STATS_OTHER_COLOR = '#9e9e9e'

export const MAX_STACKED_SERIES = STATS_CHART_COLORS.length
