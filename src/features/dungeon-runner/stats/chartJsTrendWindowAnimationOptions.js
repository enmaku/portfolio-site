const zeroAxisAnimations = { x: { duration: 0 }, y: { duration: 0 } }

const sharedTransitions = {
  active: { animation: { duration: 0 } },
  show: { animations: zeroAxisAnimations },
  hide: { animations: zeroAxisAnimations },
}

/** Chart.js dataset options while the trend-window slider is active. */
export const CHART_JS_TREND_WINDOW_DATASET_ANIMATION_OPTIONS = {
  animations: zeroAxisAnimations,
  transitions: sharedTransitions,
}

/** Chart.js root options while the trend-window slider is active. */
export const CHART_JS_TREND_WINDOW_CHART_ANIMATION_OPTIONS = {
  animation: false,
  transitions: {
    ...sharedTransitions,
    resize: { animation: { duration: 0 } },
  },
}
