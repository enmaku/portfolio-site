import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import routes from '../../router/routes.js'
import { SHARE_METADATA, SHAREABLE_ROUTES } from '../../share-metadata.js'

test('dungeon runner route is integrated with share metadata contract', () => {
  const route = routes.find((entry) => entry.path === '/projects/dungeon-runner')
  assert.ok(route)
  const page = route.children?.[0]
  assert.ok(page)
  assert.equal(page.meta?.title, SHARE_METADATA.dungeonRunner.title)
  assert.equal(page.meta?.shareKey, 'dungeonRunner')
  assert.equal(page.meta?.favicon, SHARE_METADATA.dungeonRunner.favicon)
  assert.equal(SHAREABLE_ROUTES.some((entry) => entry.routePath === '/projects/dungeon-runner'), true)
})

test('main layout project menu links to dungeon runner', () => {
  const mainLayout = readFileSync(new URL('../../layouts/MainLayout.vue', import.meta.url), 'utf8')
  assert.equal(mainLayout.includes("'/projects/dungeon-runner'"), true)
  assert.equal(mainLayout.includes('Dungeon Runner'), true)
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

test('dungeon runner page uses default-hidden full-screen history drawer', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('const historyDrawerOpen = ref(false)'), true)
  assert.equal(page.includes('aria-label="Open match history"'), true)
  assert.equal(page.includes('<q-dialog v-model="historyDrawerOpen" position="bottom" maximized>'), true)
  assert.equal(page.includes('aria-label="Close match history"'), true)
  assert.equal(page.includes('v-if="showHistory"'), false)
})

test('dungeon runner page exposes match presentation speed in settings menu', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('aria-label="Match settings"'), true)
  assert.equal(page.includes('<q-menu anchor="bottom right" self="top right"'), true)
  assert.equal(page.includes('presentationSpeedProfile'), true)
  assert.equal(page.includes('setSpeedProfile'), true)
  assert.equal(page.includes('presentationSpeedProfile: pace'), true)
  assert.equal(page.includes('z-index: 30'), true)
  assert.equal(page.includes('z-index: 20'), true)
})

test('dungeon runner page places memory aid toggle in match settings menu', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  const menuIdx = page.indexOf('<q-menu anchor="bottom right" self="top right"')
  const toggleIdx = page.indexOf('aria-label="Toggle memory aid"')
  assert.ok(menuIdx >= 0 && toggleIdx > menuIdx, 'memory aid toggle should live inside settings menu')
})

test('dungeon runner route record still imports layout and page modules', () => {
  const routesSource = readFileSync(new URL('../../router/routes.js', import.meta.url), 'utf8')
  const drIdx = routesSource.indexOf("path: '/projects/dungeon-runner'")
  assert.ok(drIdx >= 0)
  const window = routesSource.slice(drIdx, drIdx + 900)
  assert.equal(window.includes("import('layouts/projects/DungeonRunnerLayout.vue')"), true)
  assert.equal(window.includes("import('pages/projects/DungeonRunnerPage.vue')"), true)
})

test('dungeon runner contract documents lint and core test gate commands', () => {
  const contract = readFileSync(new URL('./CONTRACT.md', import.meta.url), 'utf8')
  assert.equal(contract.includes('npm run lint'), true)
  assert.equal(contract.includes('node --test'), true)
})

test('dungeon runner page exposes settings menu section copy and pace options', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('Match presentation'), true)
  assert.equal(page.includes('Match recall'), true)
  assert.equal(page.includes("{ label: 'Cinematic', value: 'cinematic' }"), true)
  assert.equal(page.includes("{ label: 'Brisk', value: 'brisk' }"), true)
})

test('dungeon runner page syncs presentation speed ref into orchestrator', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  const watchIdx = page.indexOf('watch(presentationSpeedProfile')
  assert.ok(watchIdx >= 0)
  const watchBlock = page.slice(watchIdx, watchIdx + 450)
  assert.equal(watchBlock.includes('presentationOrchestrator.setSpeedProfile(next)'), true)
})

test('dungeon stage render wiring binds resolution view and stage animation class', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes("'dr-dungeon-stage': showDungeonStage"), true)
  assert.equal(page.includes('[dungeonStageAnimationClass]'), true)
  assert.equal(page.includes('const showDungeonStage = computed(() => {'), true)
  assert.equal(page.includes('dungeonStageClassForKind(activePresentation.value?.kind ?? null)'), true)
  assert.equal(page.includes('.dr-dungeon-stage--reveal .dr-hero-card-control'), true)
  assert.equal(page.includes('.dr-dungeon-stage--hit .dr-hero-card-control'), true)
  assert.equal(page.includes('.dr-dungeon-stage--consume .dr-hero-card-control'), true)
  assert.equal(page.includes('.dr-dungeon-stage--strike .dr-hero-card-control'), true)
  assert.equal(page.includes('dungeonStageView.monster.species'), true)
  assert.equal(page.includes('dungeonStageView.monster.visibility !== \'revealed\''), true)
})

test('dungeon equipment token class affordances are bound on board badges', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes("'dr-token-glow': token.glow"), true)
  assert.equal(page.includes("'dr-token-pulse': token.pulse"), true)
  assert.equal(page.includes("'dr-equip-badge--deemphasized': token.deemphasized"), true)
  assert.equal(page.includes("'dr-equip-badge--interactive': token.hasModal"), true)
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
  assert.equal(page.includes('Last dungeon run'), false)
  assert.equal(page.includes('dungeonOutcomeDialogOpen'), true)
  assert.equal(page.includes('<q-dialog v-model="dungeonOutcomeDialogOpen" persistent'), true)
  assert.equal(page.includes('class="q-pa-md dr-dungeon-outcome-dialog"'), true)
  assert.equal(page.includes('dungeonOutcomeSummary?.runnerLabel'), true)
  assert.equal(page.includes('dungeonOutcomeSummary?.resultLabel'), true)
  assert.equal(page.includes('dungeonOutcomeSummary?.monstersLabel'), true)
  assert.equal(page.includes('dungeonOutcomeSummary?.equipmentSpentLabel'), true)
  assert.equal(page.includes('Continue'), true)
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
    page.includes('aria-label="Match settings"') &&
      page.indexOf(':disable="dungeonOutcomeDialogOpen"', page.indexOf('aria-label="Match settings"')) > -1,
    'settings button should be disabled when outcome dialog is open',
  )
  assert.ok(
    page.includes('aria-label="Open match history"') &&
      page.indexOf(':disable="dungeonOutcomeDialogOpen"', page.indexOf('aria-label="Open match history"')) > -1,
    'history button should be disabled when outcome dialog is open',
  )
  const disabledActionBindings = page.match(/:disable="gameplayInputLocked \|\| dungeonOutcomeDialogOpen"/g) ?? []
  assert.ok(
    disabledActionBindings.length >= 4,
    `expected gameplay action buttons to gate on dungeonOutcomeDialogOpen (found ${disabledActionBindings.length})`,
  )
  assert.equal(
    page.includes('if (!token?.hasModal || gameplayInputLocked.value || !isHumanTurn.value || dungeonOutcomeDialogOpen.value) return'),
    true,
  )
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
