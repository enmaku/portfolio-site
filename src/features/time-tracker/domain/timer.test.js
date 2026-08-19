import assert from 'node:assert/strict'
import test from 'node:test'
import { completeRunningTimer, startRunningTimer, switchRunningTimerProject } from './timer.js'

test('play starts a running timer on the selected project', () => {
  const running = startRunningTimer({
    projectId: 'proj-1',
    startedAt: 1_000,
    description: 'standup',
  })
  assert.deepEqual(running, {
    projectId: 'proj-1',
    startedAt: 1_000,
    description: 'standup',
  })
})

test('play is rejected when a running timer already exists', () => {
  const existing = startRunningTimer({ projectId: 'proj-1', startedAt: 1_000 })
  assert.throws(
    () => startRunningTimer({ projectId: 'proj-1', startedAt: 2_000, existing }),
    /already/,
  )
})

test('pause shorter than one second discards the run', () => {
  const running = startRunningTimer({ projectId: 'proj-1', startedAt: 1_000 })
  const result = completeRunningTimer(running, { endedAt: 1_999 })
  assert.equal(result.discarded, true)
  assert.equal(result.timeEntry, null)
})

test('pause of one second or more files a time entry', () => {
  const running = startRunningTimer({
    projectId: 'proj-1',
    startedAt: 1_000,
    description: 'pairing',
  })
  const result = completeRunningTimer(running, { endedAt: 2_000 })
  assert.equal(result.discarded, false)
  assert.deepEqual(result.timeEntry, {
    projectId: 'proj-1',
    startedAt: 1_000,
    endedAt: 2_000,
    description: 'pairing',
  })
})

test('changing project while running completes the current entry and starts a new one', () => {
  const running = startRunningTimer({
    projectId: 'proj-1',
    startedAt: 1_000,
    description: 'first',
  })
  const { completed, nextRunning } = switchRunningTimerProject(running, {
    projectId: 'proj-2',
    at: 5_000,
  })
  assert.equal(completed.discarded, false)
  assert.equal(completed.timeEntry.projectId, 'proj-1')
  assert.equal(completed.timeEntry.endedAt, 5_000)
  assert.equal(completed.timeEntry.description, 'first')
  assert.deepEqual(nextRunning, {
    projectId: 'proj-2',
    startedAt: 5_000,
    description: '',
  })
})
