import { createRoomRtdbApi } from '../../p2p/firebase/createRoomRtdbApi.js'

const {
  getDatabase,
  roomPath,
  roomRef,
  sanitizeForRtdb,
  setRtdb,
} = createRoomRtdbApi({
  roomsRoot: 'gameTimerRooms',
  label: 'Game Timer Firebase RTDB',
})

export const getGameTimerDatabase = getDatabase
export const gameTimerRoomPath = roomPath
export const gameTimerRoomRef = roomRef
export { sanitizeForRtdb, setRtdb }
