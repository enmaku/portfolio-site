# Shared Firebase RTDB core (star-room and replay archive)

After #116, Game Timer and Movie Vote share `createRoomRtdbApi` for **app-scoped room paths**. Dungeon Runner still duplicated Firebase config read, RTDB sanitization, and `setRtdb` for the **completed match replay archive** (`dungeonRunnerCompletedMatches/`). #131 dedupes that without changing archive paths, **replay envelope** shape, or upload opt-out when Firebase is unset.

We introduce `createRtdbCore({ configuredBehavior, label? })` in the star-room P2P feature: one app-wide RTDB `Database` singleton, shared `sanitizeForRtdb` / `setRtdb`, and `configuredBehavior: 'throw' | 'null'` on `getDatabase()`. Star-room **projects** bind `'throw'` with a product `label` for missing-env errors; Dungeon Runner binds `'null'` (optional `label`) so **match over** upload stays a no-op when env is incomplete. `createRoomRtdbApi` and `dungeon-runner/firebase/rtdb.js` remain thin wrappers—the latter keeps its frozen export surface so `completedMatchReplayUpload` does not change import paths.

**Considered options:** Extend `createRoomRtdbApi` with `roomsRoot` for the archive (rejected: “room” API and **room suffix** semantics do not fit match-id keys). Import only sanitize from shared code while keeping separate DB init in Dungeon Runner (rejected: leaves duplicate singleton and config read).

**Consequences:** Tests move shared behavior to `createRtdbCore.test.js`; Dungeon Runner tests cover nullable config, archive paths, and re-export wiring only. Acceptance: scenarios in #131 (no upload without config, unchanged write path/envelope, star-room throw on miss, one Firebase app per session, one sanitization fix for rooms and archive).
