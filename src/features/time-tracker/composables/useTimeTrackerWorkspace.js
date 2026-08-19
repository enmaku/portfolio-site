import { reactive } from 'vue'
import { createClientInvoiceSecret } from '../domain/clientInvoiceLink.js'
import * as trackerStore from '../firebase/trackerStore.js'
import { createTimeTrackerWorkspace } from '../workspace/createTimeTrackerWorkspace.js'

/**
 * Live Time Tracker workspace used by the signed-in surfaces.
 */
export function useTimeTrackerWorkspace() {
  const state = reactive({
    uid: null,
    clients: [],
    projects: [],
    timeEntries: [],
    invoices: [],
    settings: { issuerName: '', nextInvoiceNumber: 1 },
    runningTimer: null,
    selectedProjectId: null,
    description: '',
    activeSurface: 'timer',
  })
  return createTimeTrackerWorkspace({
    state,
    store: trackerStore,
    storage: window.localStorage,
    now: () => Date.now(),
    randomId: () => crypto.randomUUID(),
    randomSecret: () => createClientInvoiceSecret(),
  })
}
