import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertTimeEntryMutable,
  createTimeEntry,
  durationMs,
  isTimeEntryMutable,
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
  assert.equal(durationMs(entry), 3_000)
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
