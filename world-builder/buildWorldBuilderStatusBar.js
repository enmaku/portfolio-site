/**
 * @typedef {'hidden' | 'generation' | 'begin' | 'epoch' | 'rehydration' | 'overlays'} StatusBarMode
 * @typedef {{ id: string, label: string, status: string, testId: string }} StatusBarStep
 * @typedef {{ id: string, label: string, testId: string }} StatusBarOverlayDef
 * @typedef {{
 *   mode: StatusBarMode,
 *   percent: number,
 *   color: string,
 *   indeterminate: boolean,
 *   panelTestId: string,
 *   steps: StatusBarStep[],
 *   nestedByParentId: Record<string, StatusBarStep[]>,
 *   overlayDefs: StatusBarOverlayDef[],
 * }} StatusBarViewModel
 */

/** @type {StatusBarViewModel} */
export const HIDDEN_STATUS_BAR = Object.freeze({
  mode: 'hidden',
  percent: 0,
  color: '',
  indeterminate: false,
  panelTestId: '',
  steps: [],
  nestedByParentId: {},
  overlayDefs: [],
})

const PANEL_TEST_ID = Object.freeze({
  generation: 'world-builder-generation-progress',
  begin: 'world-builder-begin-colonization-progress',
  epoch: 'world-builder-epoch-step-progress',
  rehydration: 'world-builder-rehydration-progress',
  overlays: 'world-builder-resource-overlay-bar',
})

/**
 * @param {ReadonlyArray<{ id: string, label: string, status: string }>} steps
 * @param {string} prefix
 * @returns {StatusBarStep[]}
 */
function withTestIds(steps, prefix) {
  return steps.map((step) => ({
    id: step.id,
    label: step.label,
    status: step.status,
    testId: `${prefix}${step.id}`,
  }))
}

/**
 * @param {{
 *   percent: number,
 *   steps: ReadonlyArray<{ id: string, label: string, status: string }>,
 *   hydrologySubsteps: ReadonlyArray<{ id: string, label: string, status: string }>,
 * }} input
 * @returns {StatusBarViewModel}
 */
export function buildGenerationStatusSection({ percent, steps, hydrologySubsteps }) {
  return {
    mode: 'generation',
    percent,
    color: 'primary',
    indeterminate: false,
    panelTestId: PANEL_TEST_ID.generation,
    steps: withTestIds(steps, 'world-builder-generation-step-'),
    nestedByParentId: {
      hydrology: withTestIds(hydrologySubsteps, 'world-builder-hydrology-substep-'),
    },
    overlayDefs: [],
  }
}

/**
 * @param {{
 *   percent: number,
 *   steps: ReadonlyArray<{ id: string, label: string, status: string }>,
 * }} input
 * @returns {StatusBarViewModel}
 */
export function buildBeginStatusSection({ percent, steps }) {
  return {
    mode: 'begin',
    percent,
    color: 'positive',
    indeterminate: false,
    panelTestId: PANEL_TEST_ID.begin,
    steps: withTestIds(steps, 'world-builder-begin-colonization-step-'),
    nestedByParentId: {},
    overlayDefs: [],
  }
}

/**
 * @param {{
 *   percent: number,
 *   phaseSteps: ReadonlyArray<{ id: string, label: string, status: string }>,
 *   finalizeSteps: ReadonlyArray<{ id: string, label: string, status: string }>,
 *   networkSubsteps: ReadonlyArray<{ id: string, label: string, status: string }>,
 *   collapseSubsteps: ReadonlyArray<{ id: string, label: string, status: string }>,
 *   mapSubsteps: ReadonlyArray<{ id: string, label: string, status: string }>,
 * }} input
 * @returns {StatusBarViewModel}
 */
export function buildEpochStatusSection({
  percent,
  phaseSteps,
  finalizeSteps,
  networkSubsteps,
  collapseSubsteps,
  mapSubsteps,
}) {
  return {
    mode: 'epoch',
    percent,
    color: 'secondary',
    indeterminate: false,
    panelTestId: PANEL_TEST_ID.epoch,
    steps: [
      ...withTestIds(phaseSteps, 'world-builder-epoch-step-phase-'),
      ...withTestIds(finalizeSteps, 'world-builder-epoch-step-finalize-'),
    ],
    nestedByParentId: {
      network: withTestIds(networkSubsteps, 'world-builder-epoch-step-network-substep-'),
      collapse: withTestIds(collapseSubsteps, 'world-builder-epoch-step-collapse-substep-'),
      map: withTestIds(mapSubsteps, 'world-builder-epoch-step-map-substep-'),
    },
    overlayDefs: [],
  }
}

/**
 * @param {{
 *   percent: number,
 *   indeterminate: boolean,
 *   steps: ReadonlyArray<{ id: string, label: string, status: string }>,
 *   sessionSubsteps: ReadonlyArray<{ id: string, label: string, status: string }>,
 *   visitedSubsteps: ReadonlyArray<{ id: string, label: string, status: string }>,
 *   collapseSubsteps: ReadonlyArray<{ id: string, label: string, status: string }>,
 * }} input
 * @returns {StatusBarViewModel}
 */
export function buildRehydrationStatusSection({
  percent,
  indeterminate,
  steps,
  sessionSubsteps,
  visitedSubsteps,
  collapseSubsteps,
}) {
  return {
    mode: 'rehydration',
    percent,
    color: 'info',
    indeterminate,
    panelTestId: PANEL_TEST_ID.rehydration,
    steps: withTestIds(steps, 'world-builder-rehydration-step-'),
    nestedByParentId: {
      session: withTestIds(sessionSubsteps, 'world-builder-rehydration-session-substep-'),
      visited: withTestIds(visitedSubsteps, 'world-builder-rehydration-visited-substep-'),
      collapse: withTestIds(collapseSubsteps, 'world-builder-rehydration-collapse-substep-'),
    },
    overlayDefs: [],
  }
}

/**
 * @param {{
 *   definitions: ReadonlyArray<{ id: string, label: string }>,
 * }} input
 * @returns {StatusBarViewModel}
 */
export function buildOverlaysStatusSection({ definitions }) {
  return {
    mode: 'overlays',
    percent: 0,
    color: '',
    indeterminate: false,
    panelTestId: PANEL_TEST_ID.overlays,
    steps: [],
    nestedByParentId: {},
    overlayDefs: definitions.map((definition) => ({
      id: definition.id,
      label: definition.label,
      testId: `world-builder-overlay-toggle-${definition.id}`,
    })),
  }
}

/**
 * Mutually-exclusive selection with priority
 * generation > begin > epoch > rehydration > overlays > hidden.
 *
 * @param {{
 *   generation: StatusBarViewModel | null,
 *   colonization: StatusBarViewModel | null,
 *   overlays: StatusBarViewModel | null,
 * }} sections
 * @returns {StatusBarViewModel}
 */
export function buildWorldBuilderStatusBar({ generation, colonization, overlays }) {
  return generation ?? colonization ?? overlays ?? HIDDEN_STATUS_BAR
}
