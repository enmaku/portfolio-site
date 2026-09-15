import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_TIMER_COLOR } from './timerAccent.js'
import {
  defaultOwnerPrefs,
  normalizeActiveSurface,
  normalizeOwnerPrefs,
  resolveIssuerName,
  resolveSelectedProjectId,
} from './sessionPrefs.js'

test('normalizeActiveSurface falls back to timer', () => {
  assert.equal(normalizeActiveSurface('history'), 'history')
  assert.equal(normalizeActiveSurface('statistics'), 'statistics')
  assert.equal(normalizeActiveSurface('nope'), 'timer')
})

test('normalizeOwnerPrefs forces includeUninvoiced off when unpaid toggle is off', () => {
  const prefs = normalizeOwnerPrefs({
    showUnpaidInvoicesInStatistics: false,
    includeUninvoicedInStatistics: true,
  })
  assert.equal(prefs.showUnpaidInvoicesInStatistics, false)
  assert.equal(prefs.includeUninvoicedInStatistics, false)
})

test('default owner prefs keep statistics revenue toggles off', () => {
  const prefs = defaultOwnerPrefs()
  assert.equal(prefs.showUnpaidInvoicesInStatistics, false)
  assert.equal(prefs.includeUninvoicedInStatistics, false)
})

test('resolveIssuerName prefers a persisted session including empty', () => {
  assert.equal(
    resolveIssuerName({ hasSession: true, sessionName: '  Jane  ', storeName: 'Ada' }),
    'Jane',
  )
  assert.equal(
    resolveIssuerName({ hasSession: true, sessionName: '', storeName: 'Ada' }),
    '',
  )
  assert.equal(
    resolveIssuerName({ hasSession: false, sessionName: '', storeName: 'Ada', defaultName: 'Pat' }),
    'Ada',
  )
  assert.equal(
    resolveIssuerName({ hasSession: false, storeName: '', defaultName: 'Pat' }),
    'Pat',
  )
})

test('resolveSelectedProjectId prefers a still-valid selection', () => {
  assert.equal(
    resolveSelectedProjectId({
      preferredId: 'b',
      fallbackId: 'a',
      projectIds: ['a', 'b'],
    }),
    'b',
  )
  assert.equal(
    resolveSelectedProjectId({
      preferredId: 'gone',
      fallbackId: 'a',
      projectIds: ['a', 'b'],
    }),
    'a',
  )
})

test('normalizeOwnerPrefs fills defaults and keeps a valid timer color', () => {
  const prefs = normalizeOwnerPrefs({
    issuerName: 'Jane',
    activeSurface: 'clients',
    selectedProjectId: 'p1',
    description: 'notes',
    timerColor: '#5C6BC0',
  })
  assert.equal(prefs.issuerName, 'Jane')
  assert.equal(prefs.activeSurface, 'clients')
  assert.equal(prefs.timerColor, '#5c6bc0')
  assert.equal(normalizeOwnerPrefs({ timerColor: 'nope' }).timerColor, DEFAULT_TIMER_COLOR)
})
