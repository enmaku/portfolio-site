import { buildStateFromReplayEnvelope as defaultBuildStateFromReplayEnvelope } from '../../debug/replaySession.js'
import {
  exportReplayEnvelope as defaultExportReplayEnvelope,
  importReplayEnvelope as defaultImportReplayEnvelope,
} from '../../debug/replay.js'
import { CURRENT_MATCH_SCHEMA_VERSION } from '../../persistence/currentMatch.js'

/**
 * Maintainer debug concern for **live match shell**: replay import/export and NN trace wiring.
 *
 * @param {{
 *   debugMode: import('vue').Ref<boolean>
 *   match: import('vue').Ref<object | null>
 *   replayImportText: import('vue').Ref<string>
 *   replayExportText: import('vue').Ref<string>
 *   nnDebugTraceText: import('vue').Ref<string>
 *   nnDebugTraceHistory: import('vue').Ref<unknown[]>
 *   dungeonRunnerSettingsStore: { setAnimationPace: (pace: string) => void }
 *   deferredPostDungeonState: import('vue').Ref<object | null>
 *   applyImportedPresentationPace: (pace: string) => void
 *   notify: (opts: { type: string, message: string }) => void
 *   exportReplayEnvelope?: typeof defaultExportReplayEnvelope
 *   importReplayEnvelope?: typeof defaultImportReplayEnvelope
 *   buildStateFromReplayEnvelope?: typeof defaultBuildStateFromReplayEnvelope
 * }} deps
 */
export function createLiveMatchShellMaintainerDebug(deps) {
  const exportReplayEnvelope = deps.exportReplayEnvelope ?? defaultExportReplayEnvelope
  const importReplayEnvelope = deps.importReplayEnvelope ?? defaultImportReplayEnvelope
  const buildStateFromReplayEnvelope =
    deps.buildStateFromReplayEnvelope ?? defaultBuildStateFromReplayEnvelope

  function exportReplay() {
    if (!deps.match.value) return
    const payload = exportReplayEnvelope({
      seed: deps.match.value.state.rng.seed,
      setup: deps.match.value.setup,
      history: deps.match.value.state.history,
      presentationSpeedProfile: deps.match.value.presentationSpeedProfile,
    })
    deps.replayExportText.value = JSON.stringify(payload, null, 2)
  }

  function importReplay() {
    if (!deps.replayImportText.value.trim()) return
    try {
      const parsed = JSON.parse(deps.replayImportText.value)
      const imported = importReplayEnvelope(parsed)
      if (!imported.ok) {
        deps.notify({ type: 'negative', message: 'Replay payload is invalid.' })
        return
      }
      const replayResult = buildStateFromReplayEnvelope(imported.replay)
      if (!replayResult.ok) {
        deps.notify({
          type: 'negative',
          message: 'Replay actions are invalid for this seed/setup.',
        })
        return
      }
      const pace =
        imported.replay.presentationSpeedProfile === 'brisk' ||
        imported.replay.presentationSpeedProfile === 'cinematic'
          ? imported.replay.presentationSpeedProfile
          : 'cinematic'
      deps.dungeonRunnerSettingsStore.setAnimationPace(pace)
      deps.match.value = {
        schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
        id: `match-${Date.now()}`,
        setup: imported.replay.setup,
        state: replayResult.state,
        history: [],
        presentationSpeedProfile: pace,
      }
      deps.deferredPostDungeonState.value = null
      deps.applyImportedPresentationPace(pace)
    } catch {
      deps.notify({ type: 'negative', message: 'Replay payload must be valid JSON.' })
    }
  }

  function nnRuntimeOptions(modelId) {
    if (!deps.debugMode.value) return { modelId }
    return {
      modelId,
      pipelineTrace: true,
      debugTrace: true,
      debugLogger(trace) {
        const payload = {
          at: new Date().toISOString(),
          modelId,
          seatId: deps.match.value?.state?.turn?.activeSeatId ?? null,
          trace,
        }
        deps.nnDebugTraceHistory.value = [payload, ...deps.nnDebugTraceHistory.value].slice(0, 20)
        deps.nnDebugTraceText.value = JSON.stringify(payload, null, 2)
      },
    }
  }

  return {
    debugMode: deps.debugMode,
    nnDebugTraceHistory: deps.nnDebugTraceHistory,
    nnDebugTraceText: deps.nnDebugTraceText,
    replayExportText: deps.replayExportText,
    replayImportText: deps.replayImportText,
    exportReplay,
    importReplay,
    nnRuntimeOptions,
  }
}
