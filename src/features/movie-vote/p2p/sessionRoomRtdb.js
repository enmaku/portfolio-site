/** RTDB room children removed when a new host claims an idle suffix (not on resume/reconnect). */
export const ROOM_CLAIM_RESET_PATHS = Object.freeze([
  'inbox',
  'welcome',
  'guestOnline',
  'state',
  'ended',
  'hostVisible',
  // Vote generation survives host store loss, so stale guest drafts stay rejectable.
  'resetEpoch',
])
