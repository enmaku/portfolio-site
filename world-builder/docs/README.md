# World Builder — architecture docs

Durable design notes for the **landmass pipeline**, hydrology seams, renderer locality, and page controller boundaries. Domain vocabulary lives in [`../CONTEXT.md`](../CONTEXT.md); research sources in [`../research/README.md`](../research/README.md); map stack decision in [ADR-0009](../../docs/adr/0009-world-builder-map-display-stack.md).

## Start here

| Document | Topic |
| --- | --- |
| [ARCHITECTURE-SEAMS.md](./ARCHITECTURE-SEAMS.md) | Package seams and forbidden imports |
| [ADR-0009-COMPLIANCE-CHECKLIST.md](./ADR-0009-COMPLIANCE-CHECKLIST.md) | Behavioral ADR audit |
| [SIMULATION-VS-PRESENTATION-HYDROLOGY.md](./SIMULATION-VS-PRESENTATION-HYDROLOGY.md) | River mask field map |
| [FILE-SIZE-BUDGET.md](./FILE-SIZE-BUDGET.md) | Production file line limits (CI-enforced) |

## Hydrology

| Document | Topic |
| --- | --- |
| [HYDROLOGY-TYPED-STAGES.md](./HYDROLOGY-TYPED-STAGES.md) | Typed stage chain |
| [HYDROLOGY-SUBSTEP-FILE-MAP.md](./HYDROLOGY-SUBSTEP-FILE-MAP.md) | Module layout |
| [RIVER-MASK-LIFECYCLE.md](./RIVER-MASK-LIFECYCLE.md) | Mask stages |
| [FLOW-FIELD-INVARIANTS.md](./FLOW-FIELD-INVARIANTS.md) | Flow solve invariants |
| [hydrology/substep-specs/](./hydrology/substep-specs/) | Per-substep contracts |

## Landmass pipeline

| Document | Topic |
| --- | --- |
| [LANDMASS-STAGE-MODULES.md](./LANDMASS-STAGE-MODULES.md) | Stage module registry |
| [ORCHESTRATOR-DECOMPOSITION.md](./ORCHESTRATOR-DECOMPOSITION.md) | Pipeline runner layout |
| [landmass/stage-specs/](./landmass/stage-specs/) | Per-stage contracts |

## UI and tests

| Document | Topic |
| --- | --- |
| [OVERLAY-LAYER-LOCALITY.md](./OVERLAY-LAYER-LOCALITY.md) | Vector overlay refresh seams |
| [PAGE-CONTROLLER-INTERFACE.md](./PAGE-CONTROLLER-INTERFACE.md) | Page controller contract |
| [SEAM-TEST-CATALOG.md](./SEAM-TEST-CATALOG.md) | Test file → seam index |
