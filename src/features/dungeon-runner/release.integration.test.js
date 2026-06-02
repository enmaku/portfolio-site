import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import routes from '../../router/routes.js'
import { getShareEntryForPath, PASTE_UNFURL_ROUTES } from '../../share-metadata.js'

test('dungeon runner route is integrated with share metadata contract', () => {
  const route = routes.find((entry) => entry.path === '/projects/dungeon-runner')
  assert.ok(route)
  const page = route.children?.[0]
  assert.ok(page)
  assert.equal(page.meta, undefined)
  const catalogEntry = getShareEntryForPath('/projects/dungeon-runner')
  assert.ok(catalogEntry)
  assert.equal(catalogEntry.pasteUnfurl, true)
  assert.equal(PASTE_UNFURL_ROUTES.some((entry) => entry.routePath === '/projects/dungeon-runner'), true)
})

test('main layout project menu links to dungeon runner', () => {
  const mainLayout = readFileSync(new URL('../../layouts/MainLayout.vue', import.meta.url), 'utf8')
  assert.equal(mainLayout.includes("'/projects/dungeon-runner'"), true)
})

test('release notes include known risks and out-of-scope sections', () => {
  const notes = readFileSync(new URL('./RELEASE_NOTES.md', import.meta.url), 'utf8')
  assert.equal(notes.includes('## Known Risks'), true)
  assert.equal(notes.includes('## Out-of-Scope Carryovers'), true)
})

test('release checklist includes manual debug replay smoke check', () => {
  const checklist = readFileSync(new URL('./RELEASE_CHECKLIST.md', import.meta.url), 'utf8')
  assert.equal(checklist.includes('manual debug/replay smoke checks'), true)
})

test('release checklist codifies npm test and lint gates', () => {
  const checklist = readFileSync(new URL('./RELEASE_CHECKLIST.md', import.meta.url), 'utf8')
  assert.equal(checklist.includes('`npm test`'), true)
  assert.equal(checklist.includes('`npm run lint`'), true)
})

test('release checklist documents TF.js sync and release smoke', () => {
  const checklist = readFileSync(new URL('./RELEASE_CHECKLIST.md', import.meta.url), 'utf8')
  assert.equal(checklist.includes('TF.js model sync'), true)
  assert.equal(checklist.includes('release smoke'), true)
  assert.equal(checklist.includes('MODEL_RELEASE.md'), true)
})

test('MODEL_RELEASE.md documents sync commands semver vs latest and release smoke', () => {
  const doc = readFileSync(new URL('../../../scripts/MODEL_RELEASE.md', import.meta.url), 'utf8')
  assert.equal(doc.includes('sync-dungeon-runner-model'), true)
  assert.equal(doc.includes('web deployed latest'), true)
  assert.equal(doc.includes('Release smoke'), true)
})

test('dungeon runner CONTEXT links TF.js model sync to MODEL_RELEASE.md', () => {
  const context = readFileSync(new URL('./CONTEXT.md', import.meta.url), 'utf8')
  assert.equal(context.includes('TF.js model sync'), true)
  assert.equal(context.includes('scripts/MODEL_RELEASE.md'), true)
  assert.equal(context.includes('web deployed latest'), true)
})

test('.env.example documents DUNGEON_RUNNER_ROOT for model sync and outcome derive parity', () => {
  const envExample = readFileSync(new URL('../../../.env.example', import.meta.url), 'utf8')
  assert.equal(envExample.includes('DUNGEON_RUNNER_ROOT'), true)
  assert.equal(envExample.includes('sync-dungeon-runner-model'), true)
  assert.equal(envExample.includes('matchOutcomeDeriveParity'), true)
})

test('dungeon runner page header gates on dungeon outcome dialog', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('aria-label="Start new match"'), true)
  assert.ok(
    page.indexOf(':disable="dungeonOutcomeDialogOpen"', page.indexOf('aria-label="Start new match"')) > -1,
    'start-new should be disabled when outcome dialog is open',
  )
  assert.ok(
    page.includes('aria-label="Dungeon Runner settings"') &&
      page.indexOf(
        ':disable="Boolean(match) && dungeonOutcomeDialogOpen"',
        page.indexOf('aria-label="Dungeon Runner settings"'),
      ) > -1,
    'settings should be disabled when outcome dialog is open',
  )
})

test('dungeon runner page exposes match presentation speed in settings menu', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('aria-label="Dungeon Runner settings"'), true)
  const settingsAriaIdx = page.indexOf('aria-label="Dungeon Runner settings"')
  const settingsBtnStart = page.lastIndexOf('<q-btn', settingsAriaIdx)
  assert.equal(page.slice(settingsBtnStart, settingsAriaIdx).includes('v-if="match"'), false)
  assert.equal(page.includes('<q-menu anchor="bottom right" self="top right"'), true)
  assert.equal(page.includes('presentationSpeedProfile'), true)
  assert.equal(page.includes('setSpeedProfile'), true)
  assert.equal(page.includes('presentationSpeedProfile: pace'), true)
})

test('dungeon runner page places memory aid toggle in match settings menu', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  const menuIdx = page.indexOf('<q-menu anchor="bottom right" self="top right"')
  const toggleIdx = page.indexOf('aria-label="Toggle memory aid"')
  assert.ok(menuIdx >= 0 && toggleIdx > menuIdx, 'memory aid toggle should live inside settings menu')
})

test('dungeon runner page wires fullscreen toggle through scoped fullscreen composable', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('useScopedFullscreen'), true)
  assert.equal(page.includes('setFullscreenEnabled'), true)
})

test('dungeon runner route record still imports layout and page modules', () => {
  const routesSource = readFileSync(new URL('../../router/routes.js', import.meta.url), 'utf8')
  const drIdx = routesSource.indexOf("path: '/projects/dungeon-runner'")
  assert.ok(drIdx >= 0)
  const window = routesSource.slice(drIdx, drIdx + 900)
  assert.equal(window.includes("import('layouts/projects/ProjectShellLayout.vue')"), true)
  assert.equal(window.includes("import('pages/projects/DungeonRunnerPage.vue')"), true)
})

test('dungeon runner contract documents lint and core test gate commands', () => {
  const contract = readFileSync(new URL('./CONTRACT.md', import.meta.url), 'utf8')
  assert.equal(contract.includes('npm run lint'), true)
  assert.equal(contract.includes('node --test'), true)
})

test('dungeon runner setup uses slider for total player count', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('aria-label="Total players"'), true)
  assert.equal(page.includes('v-model="setup.totalSeats"'), true)
  assert.equal(page.includes('totalSeatSlider'), true)
})

test('dungeon runner page syncs presentation speed ref into orchestrator', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  const watchIdx = page.indexOf('watch(presentationSpeedProfile')
  assert.ok(watchIdx >= 0)
  const watchBlock = page.slice(watchIdx, watchIdx + 550)
  assert.equal(watchBlock.includes('presentationOrchestrator.setSpeedProfile(next)'), true)
  assert.equal(watchBlock.includes('syncPresentationLabel()'), true)
  assert.equal(watchBlock.includes('triggerRef(activePresentation)'), true)
})

test('dungeon stage render wiring binds resolution view and stage animation class', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes("'dr-dungeon-stage': showDungeonStage"), true)
  assert.equal(page.includes('[dungeonStageAnimationClass]'), true)
  assert.equal(page.includes('const showDungeonStage = computed(() => {'), true)
  assert.equal(page.includes('dungeonStageClassForKind(activePresentation.value?.kind ?? null)'), true)
  assert.equal(page.includes('ref="dungeonCardMotionWrap"'), true)
  assert.equal(page.includes('dungeonCardWrap: dungeonCardMotionWrap.value'), true)
  assert.equal(
    page.includes('dungeonCardFlipAxis: unwrapMotionDom(dungeonCardFaceRef.value?.dungeonCardFlipAxis)'),
    true,
  )
  assert.equal(page.includes('dr-dungeon-hit'), false)
  assert.equal(page.includes('dr-dungeon-stage--strike'), false)
  assert.equal(page.includes('dr-dungeon-stage--consume'), false)
  assert.equal(page.includes('@keyframes dr-dungeon-reveal'), false)
  assert.equal(page.includes('dr-dungeon-reveal'), false)
  const registryPath = new URL('./ui/presentationMotionRegistry.js', import.meta.url)
  const registrySrc = readFileSync(registryPath, 'utf8')
  assert.equal(registrySrc.includes('createDungeonDamagePresentationMotionTimeline'), true)
  assert.equal(registrySrc.includes('createDungeonNeutralizePresentationMotionTimeline'), true)
  assert.equal(registrySrc.includes('createDungeonContinuePresentationMotionTimeline'), true)
  assert.equal(registrySrc.includes('createDungeonOutcomePresentationMotionTimeline'), true)
  assert.equal(page.includes('dungeonStageView.monster.frontFaceSpecies'), true)
  assert.equal(page.includes('dungeonStageView.monster.visibility === \'face-down\''), true)
})

test('bot bidding motion uses GSAP registry wiring without legacy CSS storytelling classes', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('dr-board-primary--bot'), false)
  assert.equal(page.includes('dr-pile-badge--bot'), false)
  assert.equal(page.includes('@keyframes dr-bot'), false)
  assert.equal(page.includes('usePresentationMotion('), true)
  assert.equal(page.includes("'BIDDING_SACRIFICE'"), true)
  const registryPath = new URL('./ui/presentationMotionRegistry.js', import.meta.url)
  const registrySrc = readFileSync(registryPath, 'utf8')
  assert.equal(registrySrc.includes('createBiddingDrawPresentationMotionTimeline'), true)
  assert.equal(registrySrc.includes('createBiddingAddPresentationMotionTimeline'), true)
  assert.equal(registrySrc.includes('createBiddingSacrificePresentationMotionTimeline'), true)
})

test('dungeon stage feeds MonsterCardFace from frontFaceSpecies so flip shows engine-authored monster', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('dungeonStageView.monster.frontFaceSpecies'), true)
  assert.equal(
    page.match(/dungeonStageView\.monster\.species\b/g) === null ||
      page.match(/dungeonStageView\.monster\.species\b/g).length === 0,
    true,
    'page should no longer feed gated monster.species into the card front face',
  )
})

test('dungeon auto-resolve timeout callback re-validates readiness before action', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  const timerIdx = page.indexOf('autoResolveTimerId = window.setTimeout(() => {')
  assert.ok(timerIdx >= 0)
  const timerBlock = page.slice(timerIdx, timerIdx + 1100)
  assert.equal(timerBlock.includes('shouldExecuteScheduledAutoResolve'), true)
  assert.equal(timerBlock.includes('equipmentModalOpen: equipmentModalOpen.value'), true)
  assert.equal(timerBlock.includes('takeHumanAction(action)'), true)
})

test('dungeon preventable-damage flow no longer force-opens equipment modal', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('pickPreventableDamageTokenToAutoOpen'), false)
  assert.equal(page.includes('hasPreventableDamageWindow'), false)
  assert.equal(page.includes('if (equipmentModalOpen.value || selectedEquipmentTokenId.value) return'), false)
  assert.equal(page.includes('selectedEquipmentTokenId.value = tokenId'), false)
})

test('dungeon runner page replaces last-run card with persistent outcome dialog', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('dungeonOutcomeDialogOpen'), true)
  assert.equal(page.includes('<q-dialog v-model="dungeonOutcomeDialogOpen" persistent'), true)
  assert.equal(page.includes('dungeonOutcomeSummary?.runnerLabel'), true)
  assert.equal(page.includes('dungeonOutcomeSummary?.resultLabel'), true)
  assert.equal(page.includes('dungeonOutcomeMessage'), true)
})

test('dungeon outcome dialog waits for presentation queue to settle', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('!gameplayInputLocked.value &&'), true)
  assert.equal(page.includes('isDungeonOutcomeDialogOpen({'), true)
})

test('dungeon outcome dialog tracks last-run identity instead of summary content keys', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('isDungeonOutcomeDialogOpen'), true)
  assert.equal(page.includes('buildDungeonOutcomeSummary'), true)
  assert.equal(page.includes('dismissedDungeonRun'), true)
  assert.equal(page.includes('dungeonOutcomeDismissedKey'), false)
  assert.equal(page.includes('runKey'), false)
})

test('dungeon outcome dialog snapshots equipment-remaining count at run resolution', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('equipmentRemainingAtResolution'), true)
  const watchIdx = page.indexOf('() => match.value?.state?.lastDungeonRun ?? null')
  assert.ok(watchIdx >= 0, 'expected watcher on lastDungeonRun reference')
  const watchBlock = page.slice(watchIdx, watchIdx + 600)
  assert.equal(watchBlock.includes('match.value?.state?.centerEquipment'), true)
  assert.equal(watchBlock.includes('equipmentRemainingAtResolution.value = Array.isArray(center) ? center.length : 0'), true)
  assert.equal(watchBlock.includes('dismissedDungeonRun.value = null'), true)
})

test('continueFromDungeonOutcome dismisses by run reference', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  const fnIdx = page.indexOf('function continueFromDungeonOutcome()')
  assert.ok(fnIdx >= 0)
  const fnBlock = page.slice(fnIdx, fnIdx + 220)
  assert.equal(fnBlock.includes('match.value?.state?.lastDungeonRun'), true)
  assert.equal(fnBlock.includes('dismissedDungeonRun.value = run'), true)
})

test('persistent dungeon outcome dialog locks all background interactions while open', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.ok(
    page.includes('aria-label="Dungeon Runner settings"') &&
      page.indexOf(
        ':disable="Boolean(match) && dungeonOutcomeDialogOpen"',
        page.indexOf('aria-label="Dungeon Runner settings"'),
      ) > -1,
    'settings button should be disabled when outcome dialog is open',
  )
  assert.ok(
    page.includes('aria-label="Start new match"') &&
      page.indexOf(':disable="dungeonOutcomeDialogOpen"', page.indexOf('aria-label="Start new match"')) > -1,
    'start-new should be disabled when outcome dialog is open',
  )
  const disabledActionBindings = page.match(/:disable="humanGameplayBlocked"/g) ?? []
  assert.ok(
    disabledActionBindings.length >= 4,
    `expected gameplay action buttons to gate on humanGameplayBlocked (found ${disabledActionBindings.length})`,
  )
  assert.equal(page.includes('if (!token?.hasModal || humanGameplayBlocked.value) return'), true)
  assert.equal(page.includes('equipmentModalActionsDisabled'), true)
  assert.equal(page.includes('z-index: 10100 !important'), true)
})

test('outcome dialog reopens when match resets last-run state to null between runs', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  const watchIdx = page.indexOf('() => match.value?.state?.lastDungeonRun ?? null')
  assert.ok(watchIdx >= 0)
  const watchBlock = page.slice(watchIdx, watchIdx + 600)
  assert.equal(watchBlock.includes('if (!run) {'), true)
  assert.equal(watchBlock.includes('dismissedDungeonRun.value = null'), true)
  assert.equal(watchBlock.includes('equipmentRemainingAtResolution.value = null'), true)
})

test('dungeon runner page uploads completed match replay on match-over phase', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('createCompletedMatchReplayUploadTracker'), true)
  assert.equal(page.includes('completedMatchReplayUpload.maybeUpload(match.value)'), true)
  const watchIdx = page.indexOf('() => match.value?.state?.phase')
  assert.ok(watchIdx >= 0, 'expected phase watcher for completed match replay')
  const watchBlock = page.slice(watchIdx, watchIdx + 320)
  assert.equal(watchBlock.includes('MATCH_PHASES.MATCH_OVER'), true)
  assert.equal(watchBlock.includes('{ immediate: true }'), true)
})

test('completed match replay upload is not deferred to rematch or back to setup', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  const rematchIdx = page.indexOf('function rematch()')
  const backIdx = page.indexOf('function backToSetup()')
  assert.ok(rematchIdx >= 0 && backIdx >= 0)
  const rematchBlock = page.slice(rematchIdx, rematchIdx + 700)
  const backBlock = page.slice(backIdx, backIdx + 500)
  assert.equal(rematchBlock.includes('maybeUpload'), false)
  assert.equal(rematchBlock.includes('uploadCompletedMatchReplay'), false)
  assert.equal(backBlock.includes('maybeUpload'), false)
  assert.equal(backBlock.includes('uploadCompletedMatchReplay'), false)
})

test('completed match replay resume relies on phase watch not onMounted upload', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  const mountedIdx = page.indexOf('onMounted(() => {')
  assert.ok(mountedIdx >= 0)
  const mountedBlock = page.slice(mountedIdx, mountedIdx + 1200)
  assert.equal(mountedBlock.includes('maybeUpload'), false)
  assert.equal(mountedBlock.includes('uploadCompletedMatchReplay'), false)
})

test('completed match replay upload has no debug or host gate on page', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  const uploadIdx = page.indexOf('completedMatchReplayUpload.maybeUpload')
  assert.ok(uploadIdx >= 0)
  const uploadBlock = page.slice(Math.max(0, uploadIdx - 400), uploadIdx + 120)
  assert.equal(uploadBlock.includes('debugMode'), false)
  assert.equal(uploadBlock.includes('localhost'), false)
  assert.equal(uploadBlock.includes('shouldEnableDebugOnBoot'), false)
})

test('dungeon runner page wires headless match completion after human elimination', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('runMaybeHeadlessMatchCompletionFromState'), true)
  assert.equal(page.includes('createLivePlayActionChooser'), true)
  assert.equal(page.includes('maybeRunHeadlessMatchCompletion'), true)
  assert.equal(page.includes('teardownForHeadlessMatchCompletion'), true)
  assert.equal(page.includes('abandonScheduledInferenceQueue'), true)
  assert.equal(page.includes('data-testid="finishing-match-overlay"'), true)
  assert.equal(page.includes('headlessCompletionInFlight'), true)
  assert.equal(page.includes('attachNeuralRecoverySnapshotToMatch'), true)
  assert.equal(page.includes('surfacePersistedNeuralRecoveryTerminal'), true)
  assert.equal(page.includes('shouldRunHeadlessMatchCompletion'), true)
})

test('headless nn terminal failure persists refresh snapshot for resume', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  const fnIdx = page.indexOf('async function maybeRunHeadlessMatchCompletion()')
  assert.ok(fnIdx >= 0)
  const fnBlock = page.slice(fnIdx, fnIdx + 2000)
  assert.equal(fnBlock.includes('shouldRunHeadlessMatchCompletion'), true)
  assert.equal(fnBlock.includes("ux.action === 'refresh-dialog'"), true)
  assert.equal(fnBlock.includes('attachNeuralRecoverySnapshotToMatch'), true)
  assert.equal(fnBlock.includes('persistCurrentMatch'), true)
  assert.equal(fnBlock.includes('chooseRandombotAction'), false)
})

test('continueFromDungeonOutcome triggers headless completion when policy requires it', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  const fnIdx = page.indexOf('async function continueFromDungeonOutcome()')
  assert.ok(fnIdx >= 0)
  const fnBlock = page.slice(fnIdx, fnIdx + 520)
  assert.equal(fnBlock.includes('await maybeRunHeadlessMatchCompletion()'), true)
})

test('resume on mount may run headless completion without spectator scheduling', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  const bootstrapIdx = page.indexOf('async function bootstrapDungeonRunnerPage()')
  assert.ok(bootstrapIdx >= 0)
  const bootstrapBlock = page.slice(bootstrapIdx, bootstrapIdx + 1600)
  assert.equal(bootstrapBlock.includes('runMatchNeuralLoadGate'), true)
  assert.equal(bootstrapBlock.includes('void maybeRunHeadlessMatchCompletion()'), true)
  assert.equal(bootstrapBlock.includes('scheduleAiTurnIfReady'), false)
})

test('match neural load gate blocks match entry and clears persisted match on hard load failure', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('runMatchNeuralLoadGate'), true)
  assert.equal(page.includes('applyNeuralLoadGateSetupTerminal'), true)
  assert.equal(page.includes('handleNeuralRecoveryTerminalError'), true)
  assert.equal(page.includes('data-testid="neural-load-gate-terminal"'), true)
  assert.equal(page.includes('handleNnModelFailure'), false)
  assert.equal(page.includes('getDowngradeModelId'), false)
  assert.equal(page.includes("logAiTurnScheduleSkip('neural-load-gate')"), true)
})

test('live neural recovery surfaces seat spinner and refresh terminal without clearing match', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('buildSeatRecoveryIndicators'), true)
  assert.equal(page.includes('recoveryTestId'), true)
  assert.equal(page.includes('data-testid="neural-refresh-terminal"'), true)
  assert.equal(page.includes('neuralRefreshTerminalOpen'), true)
  assert.equal(page.includes('reloadPageForNeuralRefreshTerminal'), true)
  assert.equal(page.includes('resolveNeuralRecoveryTerminalUx'), true)
  assert.equal(page.includes("logAiTurnScheduleSkip('model-recovering'"), true)
  assert.equal(page.includes('chooseNnActionWithFallback'), false)
  const refreshHandlerIdx = page.indexOf('function handleNeuralRecoveryTerminalError(error)')
  assert.ok(refreshHandlerIdx >= 0)
  const refreshHandlerBlock = page.slice(refreshHandlerIdx, refreshHandlerIdx + 520)
  assert.equal(refreshHandlerBlock.includes("'refresh-dialog'"), true)
  assert.equal(refreshHandlerBlock.includes('neuralRefreshTerminalOpen.value = true'), true)
  assert.equal(refreshHandlerBlock.includes('clearCurrentMatch'), false)
})

test('human gameplay is not blocked by nn recovery coordinator state', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  const blockIdx = page.indexOf('const humanGameplayBlocked = computed(')
  assert.ok(blockIdx >= 0)
  const block = page.slice(blockIdx, blockIdx + 320)
  assert.equal(block.includes('headlessCompletionInFlight.value'), true)
  assert.equal(block.includes('neuralRefreshTerminalOpen.value'), true)
  assert.equal(block.includes('nnRecovery'), false)
  assert.equal(block.includes('shouldBlockAiTurnScheduleForRecovery'), false)
})

test('mid-match neural load exhaustion restores setup through recovery handler', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  const handlerIdx = page.indexOf('function handleNeuralRecoveryTerminalError(error)')
  assert.ok(handlerIdx >= 0)
  const handlerBlock = page.slice(handlerIdx, handlerIdx + 520)
  assert.equal(handlerBlock.includes("'setup-restore'"), true)
  assert.equal(handlerBlock.includes('applyNeuralLoadGateSetupTerminal'), true)
})

test('live play prefetch primes nn actions through recovery-aware chooser', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  const fnIdx = page.indexOf('function primeAiTurnPrefetch()')
  assert.ok(fnIdx >= 0)
  const fnBlock = page.slice(fnIdx, fnIdx + 2000)
  assert.equal(fnBlock.includes('chooseNnActionWithRecovery'), true)
  assert.equal(fnBlock.includes('chooseNnActionWithFallback'), false)
  assert.equal(fnBlock.includes("logAiTurnPrimeSkip('model-recovering'"), true)
})

test('refresh terminal blocks live ai scheduling while open', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes("logAiTurnScheduleSkip('neural-refresh-terminal'"), true)
  const scheduleIdx = page.indexOf('function scheduleAiTurnIfReady()')
  assert.ok(scheduleIdx >= 0)
  const scheduleBlock = page.slice(scheduleIdx, scheduleIdx + 400)
  assert.equal(scheduleBlock.includes('neuralRefreshTerminalOpen.value'), true)
})

test('active nn recovery watch resumes ai scheduling after recovery settles', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('const activeNnRecoveryBlocking = computed('), true)
  const watchIdx = page.indexOf('watch(activeNnRecoveryBlocking')
  assert.ok(watchIdx >= 0)
  const watchBlock = page.slice(watchIdx, watchIdx + 200)
  assert.equal(watchBlock.includes('scheduleAiTurnIfReady()'), true)
})

test('live AI scheduling is gated while headless completion runs', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes("logAiTurnScheduleSkip('headless-completion')"), true)
  assert.equal(page.includes("trace('run.skip', { reason: 'headless-completion' })"), true)
  assert.equal(page.includes("logAiTurnPrimeSkip('headless-completion')"), true)
})

test('human gameplay is blocked while headless completion runs', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('const humanGameplayBlocked = computed('), true)
  assert.equal(page.includes('headlessCompletionInFlight.value'), true)
  const takeHumanIdx = page.indexOf('function takeHumanAction(action)')
  assert.ok(takeHumanIdx >= 0)
  const takeHumanBlock = page.slice(takeHumanIdx, takeHumanIdx + 280)
  assert.equal(takeHumanBlock.includes('humanGameplayBlocked.value'), true)
  assert.equal(page.includes(':disable="humanGameplayBlocked"'), true)
})

test('runAiTurn delegates action choice to createLivePlayActionChooser', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  const fnIdx = page.indexOf('async function runAiTurn()')
  assert.ok(fnIdx >= 0)
  const fnBlock = page.slice(fnIdx, fnIdx + 2200)
  assert.equal(fnBlock.includes('createLivePlayActionChooser'), true)
  assert.equal(fnBlock.includes('tryConsumePrefetch'), true)
  assert.equal(fnBlock.includes('chooseNnActionWithFallback'), false)
  assert.equal(fnBlock.includes('chooseRandombotAction'), false)
})
