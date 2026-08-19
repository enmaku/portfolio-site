import assert from 'node:assert/strict'
import test from 'node:test'
import { createProject } from '../domain/projects.js'
import {
  dirtyProjectEditorPatch,
  projectEditorFieldLocks,
  saveProjectEditor,
} from './projectEditor.js'

const billed = {
  ...createProject({ id: 'p1', name: 'Aether', clientId: 'c1' }),
  billable: true,
  hourlyRateUsd: 12,
}

test('project editor locks client and billable when time entries are on an invoice', () => {
  const invoiced = [{ invoiceId: 'inv1' }]
  assert.deepEqual(projectEditorFieldLocks({ billable: true, timeEntries: invoiced }), {
    client: true,
    billable: true,
  })
  assert.deepEqual(projectEditorFieldLocks({ billable: false, timeEntries: invoiced }), {
    client: true,
    billable: false,
  })
  assert.deepEqual(projectEditorFieldLocks({ billable: true, timeEntries: [] }), {
    client: false,
    billable: false,
  })
})

test('dirty project editor patch omits unchanged client and billing', () => {
  const patch = dirtyProjectEditorPatch(billed, {
    name: 'Aether',
    clientId: 'c1',
    billable: true,
    hourlyRateUsd: 15,
  })
  assert.deepEqual(patch, { billing: { billable: true, hourlyRateUsd: 15 } })
})

test('dirty project editor patch includes only the fields that changed', () => {
  assert.deepEqual(
    dirtyProjectEditorPatch(billed, {
      name: 'Aether Prime',
      clientId: 'c1',
      billable: true,
      hourlyRateUsd: 12,
    }),
    { name: 'Aether Prime' },
  )
  assert.deepEqual(
    dirtyProjectEditorPatch(billed, {
      name: 'Aether',
      clientId: null,
      billable: true,
      hourlyRateUsd: 12,
    }),
    { clientId: null },
  )
  assert.deepEqual(
    dirtyProjectEditorPatch(null, {
      name: 'New',
      clientId: 'c1',
      billable: true,
      hourlyRateUsd: 20,
    }),
    {
      name: 'New',
      clientId: 'c1',
      billing: { billable: true, hourlyRateUsd: 20 },
    },
  )
})

test('saveProjectEditor updates hourly rate without writing the unchanged client', async () => {
  const calls = []
  const workspace = {
    async renameProject(...args) {
      calls.push(['rename', ...args])
    },
    async updateProjectClient(...args) {
      calls.push(['client', ...args])
    },
    async updateProjectBilling(...args) {
      calls.push(['billing', ...args])
    },
  }
  await saveProjectEditor(workspace, {
    projectId: 'p1',
    baseline: billed,
    draft: {
      name: 'Aether',
      clientId: 'c1',
      billable: true,
      hourlyRateUsd: 15,
    },
  })
  assert.deepEqual(calls, [['billing', 'p1', { billable: true, hourlyRateUsd: 15 }]])
})
