import assert from 'node:assert/strict'
import test from 'node:test'
import {
  TIME_TRACKER_INVOICE_LINKS_COLLECTION,
  TIME_TRACKER_OWNERS_COLLECTION,
  timeTrackerClientPath,
  timeTrackerInvoiceLinkPath,
  timeTrackerInvoicePath,
  timeTrackerOwnerPath,
  timeTrackerProjectPath,
  timeTrackerTimeEntryPath,
} from './trackerStore.js'

test('tracker store paths nest under timeTrackerOwners/{uid}', () => {
  assert.equal(timeTrackerOwnerPath('uid-1'), `${TIME_TRACKER_OWNERS_COLLECTION}/uid-1`)
  assert.equal(
    timeTrackerClientPath('uid-1', 'c1'),
    `${TIME_TRACKER_OWNERS_COLLECTION}/uid-1/clients/c1`,
  )
  assert.equal(
    timeTrackerProjectPath('uid-1', 'p1'),
    `${TIME_TRACKER_OWNERS_COLLECTION}/uid-1/projects/p1`,
  )
  assert.equal(
    timeTrackerTimeEntryPath('uid-1', 'e1'),
    `${TIME_TRACKER_OWNERS_COLLECTION}/uid-1/timeEntries/e1`,
  )
  assert.equal(
    timeTrackerInvoicePath('uid-1', 'inv1'),
    `${TIME_TRACKER_OWNERS_COLLECTION}/uid-1/invoices/inv1`,
  )
})

test('capability lookup paths are not nested under an owner uid', () => {
  assert.equal(
    timeTrackerInvoiceLinkPath('secret-1'),
    `${TIME_TRACKER_INVOICE_LINKS_COLLECTION}/secret-1`,
  )
})
