import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CAMPAIGN_KIT_EXPORT_STEPS,
  campaignKitExportPercent,
  createCampaignKitExportStepStatuses,
} from './campaignKitExportProgress.js'

test('createCampaignKitExportStepStatuses marks active and completed steps', () => {
  const steps = createCampaignKitExportStepStatuses(1, 0)
  assert.equal(steps.length, CAMPAIGN_KIT_EXPORT_STEPS.length)
  assert.equal(steps[0].status, 'done')
  assert.equal(steps[1].status, 'active')
  assert.equal(steps[2].status, 'pending')
})

test('campaignKitExportPercent advances with completed steps', () => {
  assert.ok(campaignKitExportPercent(0, -1) > 0)
  assert.ok(campaignKitExportPercent(-1, CAMPAIGN_KIT_EXPORT_STEPS.length - 1) === 100)
})
