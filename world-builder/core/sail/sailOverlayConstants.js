/** Fixed v1 sail overlay pipeline constants — not user-adjustable or persisted. */

/** High-pass boost after soft blur (unsharp amount). */
export const SAIL_OVERLAY_UNSHARP_AMOUNT = 1.75

/** Smoothstep band on sharpened strength before binary threshold. */
export const SAIL_OVERLAY_SMOOTHSTEP_LOW = 0.06
export const SAIL_OVERLAY_SMOOTHSTEP_HIGH = 0.24

/** Cells at or above this derived strength count as traversable in the sail overlay. */
export const SAIL_OVERLAY_STRENGTH_THRESHOLD = 0.5

/** Extra blur passes widen connectivity between nearby waterways. */
export const SAIL_OVERLAY_BLUR_PASSES = 2
