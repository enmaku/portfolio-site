import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CAMPAIGN_KIT_EXPORT_STEPS,
  campaignKitExportPercent,
  createCampaignKitExportStepStatuses,
} from './campaignKitExportProgress.js'

test('createCampaignKitExportStepStatuses marks active and completed steps', () => {
  const steps = createCampaignKitExportStepStatuses(1, 0)
  assert.equal(steps.length, 5)
  assert.equal(CAMPAIGN_KIT_EXPORT_STEPS.map((s) => s.id).join(','), 'prepare,settlementsMap,resourcesMap,model,pdf')
  assert.equal(steps[0].status, 'done')
  assert.equal(steps[1].status, 'active')
  assert.equal(steps[2].status, 'pending')
  assert.equal(steps[3].id, 'model')
  assert.equal(steps[4].id, 'pdf')
})

test('campaignKitExportPercent advances with completed steps', () => {
  assert.ok(campaignKitExportPercent(0, -1) > 0)
  assert.equal(campaignKitExportPercent(3, 2), Math.min(99, Math.round(((3 + 0.5) / 5) * 100)))
  assert.ok(campaignKitExportPercent(-1, CAMPAIGN_KIT_EXPORT_STEPS.length - 1) === 100)
})
