# Dungeon Runner v1 Release Notes

## Acceptance Status

- Route + portfolio integration: complete.
- Deterministic engine setup, legal actions, and transition contracts: complete.
- Current match persistence and resume/start-new flow: complete.
- Randombot and NN action paths with legality/fallback safety: complete.
- Localhost-gated debug mode and replay envelope workflow: complete.

## Known Risks

- NN model quality and action confidence vary by model version and browser backend.
- Worker inference scheduling is deterministic but intentionally serialized, which can reduce peak throughput.
- Replay import is strict and rejects envelopes with invalid turn-boundary history metadata.

## Out-of-Scope Carryovers

- User-facing god mode/debug toggles in production.
- Multi-human networked play.
- Telemetry upload pipeline and consent UX.
- ONNX runtime path.
- Service-worker caching expansion beyond current behavior.
