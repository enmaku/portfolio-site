import assert from 'node:assert/strict'
import test from 'node:test'
import { setProjectBillable, createProject } from './projects.js'
import {
  assertTimeEntryMutable,
  createTimeEntry,
  durationMs,
  earningsUsdCentsForProjectReassign,
  earningsUsdCentsForSave,
  isTimeEntryMutable,
  normalizeEarningsUsdCents,
  recordedEarningsCents,
} from './timeEntries.js'

test('manual time entry duration is derived from start and end', () => {
  const entry = createTimeEntry({
    id: 'e1',
    projectId: 'p1',
    startedAt: 1_000,
    endedAt: 4_000,
    description: 'notes',
  })
  assert.equal(entry.projectId, 'p1')
  assert.equal(entry.startedAt, 1_000)
  assert.equal(entry.endedAt, 4_000)
  assert.equal(entry.description, 'notes')
  assert.equal(entry.invoiceId, null)
  assert.equal(entry.earningsUsdCents, null)
  assert.equal(durationMs(entry), 3_000)
})

test('explicit zero earnings are stored separately from blank', () => {
  const entry = createTimeEntry({
    id: 'e1',
    projectId: 'p1',
    startedAt: 1_000,
    endedAt: 2_000,
    earningsUsdCents: 0,
  })
  assert.equal(entry.earningsUsdCents, 0)
  assert.equal(recordedEarningsCents(entry), 0)
  assert.equal(recordedEarningsCents({ earningsUsdCents: null }), 0)
})

test('negative earnings are rejected', () => {
  assert.throws(() => normalizeEarningsUsdCents(-1), /negative/)
})

test('earningsUsdCentsForSave strips earnings on hourly projects', () => {
  const hourly = setProjectBillable(createProject({ id: 'p1', name: 'A' }), {
    billable: true,
    hourlyRateUsd: 50,
  })
  assert.equal(earningsUsdCentsForSave({ project: hourly, requested: 500 }), null)
  const perJob = setProjectBillable(createProject({ id: 'p2', name: 'B' }), {
    billable: true,
    perJobBillable: true,
  })
  assert.equal(earningsUsdCentsForSave({ project: perJob, requested: 500 }), 500)
})

test('earningsUsdCentsForProjectReassign keeps earnings on per-job to per-job', () => {
  const perJob = setProjectBillable(createProject({ id: 'p1', name: 'A' }), {
    billable: true,
    perJobBillable: true,
  })
  assert.equal(
    earningsUsdCentsForProjectReassign({
      fromProject: perJob,
      toProject: perJob,
      previous: 1_200,
    }),
    1_200,
  )
})

test('earningsUsdCentsForProjectReassign clears when leaving per-job', () => {
  const perJob = setProjectBillable(createProject({ id: 'p1', name: 'A' }), {
    billable: true,
    perJobBillable: true,
  })
  const hourly = setProjectBillable(createProject({ id: 'p2', name: 'B' }), {
    billable: true,
    hourlyRateUsd: 50,
  })
  assert.equal(
    earningsUsdCentsForProjectReassign({
      fromProject: perJob,
      toProject: hourly,
      previous: 1_200,
    }),
    null,
  )
})

test('earningsUsdCentsForProjectReassign starts blank when entering per-job from hourly', () => {
  const hourly = setProjectBillable(createProject({ id: 'p1', name: 'A' }), {
    billable: true,
    hourlyRateUsd: 50,
  })
  const perJob = setProjectBillable(createProject({ id: 'p2', name: 'B' }), {
    billable: true,
    perJobBillable: true,
  })
  assert.equal(
    earningsUsdCentsForProjectReassign({
      fromProject: hourly,
      toProject: perJob,
      previous: 1_200,
    }),
    null,
  )
})

test('start must be before end', () => {
  assert.throws(
    () =>
      createTimeEntry({
        id: 'e1',
        projectId: 'p1',
        startedAt: 5_000,
        endedAt: 5_000,
      }),
    /before/,
  )
})

test('overlapping time entries are allowed', () => {
  const a = createTimeEntry({
    id: 'e1',
    projectId: 'p1',
    startedAt: 1_000,
    endedAt: 5_000,
  })
  const b = createTimeEntry({
    id: 'e2',
    projectId: 'p1',
    startedAt: 2_000,
    endedAt: 3_000,
  })
  assert.ok(a.startedAt < b.endedAt && b.startedAt < a.endedAt)
})

test('invoiced time entries are not editable or deletable', () => {
  const entry = createTimeEntry({
    id: 'e1',
    projectId: 'p1',
    startedAt: 1_000,
    endedAt: 2_000,
    invoiceId: 'inv1',
  })
  assert.equal(isTimeEntryMutable(entry), false)
  assert.throws(() => assertTimeEntryMutable(entry), /invoice/)
})

test('uninvoiced time entries are mutable', () => {
  const entry = createTimeEntry({
    id: 'e1',
    projectId: 'p1',
    startedAt: 1_000,
    endedAt: 2_000,
  })
  assert.equal(isTimeEntryMutable(entry), true)
  assert.doesNotThrow(() => assertTimeEntryMutable(entry))
})
