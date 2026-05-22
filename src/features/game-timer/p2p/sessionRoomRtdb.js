/** RTDB room children removed when a new host claims an idle suffix (not on resume/reconnect). */
export const ROOM_CLAIM_RESET_PATHS = Object.freeze([
  'inbox',
  'state',
  'ended',
  'hostVisible',
])
