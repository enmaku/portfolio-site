# Dungeon Runner Release Checklist

- Route is live at `/projects/dungeon-runner` and linked from project navigation.
- Setup blocks invalid zero-opponent starts.
- Seat randomization is deterministic for same setup+seed.
- Bidding and dungeon transitions run without crashes.
- Current-match resume/start-new behavior is functional.
- Randombot/NN action paths only submit legal engine actions.
- Debug mode is gated to localhost/127.0.0.1 with `?debug=true`.
- Replay export/import envelope validates correctly.
- Final manual debug/replay smoke checks complete (export payload, import payload, post-import gameplay continuity).
- `npm test` and `npm run lint` pass.
- Release notes document known risks and out-of-scope carryovers (`RELEASE_NOTES.md`).
