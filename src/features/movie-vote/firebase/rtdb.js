import { createRoomRtdbApi } from '../../p2p/firebase/createRoomRtdbApi.js'

const {
  getDatabase,
  roomPath,
  roomRef,
  sanitizeForRtdb,
  setRtdb,
} = createRoomRtdbApi({
  roomsRoot: 'movieVoteRooms',
  label: 'Movie Vote Firebase RTDB',
})

export const getMovieVoteDatabase = getDatabase
export const movieVoteRoomPath = roomPath
export const movieVoteRoomRef = roomRef
export { sanitizeForRtdb, setRtdb }
