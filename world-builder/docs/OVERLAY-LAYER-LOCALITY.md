# Overlay layer locality

> **Issue:** [#362](https://github.com/enmaku/portfolio-site/issues/362) — per-family vector map layer refresh  
> **Current state:** monolithic `vectorOverlays` MapLayerId  
> **Target state:** independent `coastalNodes`, `metalNodes`, `saltNodes` layer IDs

This document specifies how coastal and strategic resource node overlays must map to discrete map layer IDs so toggling one family does not redraw unrelated vector markers.

---

## Table of contents

1. [Problem statement](#problem-statement)
2. [Current monolithic behavior](#current-monolithic-behavior)
3. [Target layer IDs](#target-layer-ids)
4. [WorldDocument node fields](#worlddocument-node-fields)
5. [Diff locality rules](#diff-locality-rules)
6. [Viewport draw handlers](#viewport-draw-handlers)
7. [Resource overlay visibility](#resource-overlay-visibility)
8. [Map layer refresh runner](#map-layer-refresh-runner)
9. [Migration steps 362.1–362.9](#migration-steps-36213629)
10. [Invariants after migration](#invariants-after-migration)
11. [Forbidden patterns](#forbidden-patterns)
12. [Test expectations](#test-expectations)

---

## Problem statement

Vector overlays on the World Builder map currently composite three unrelated node families into a single Pixi `Graphics` layer refreshed under one MapLayerId: `vectorOverlays`.

When any of these change, all three families redraw:

- **Coastal nodes** — mouths, straits, anchorages, extraction points
- **Metal nodes** — strategic resource markers from `metalNodes`
- **Salt nodes** — strategic resource markers from `saltNodes`

Toggling salt visibility currently may invoke coastal redraw logic. Issue #362 splits these into independent layer IDs with localized diff and refresh handlers.

---

## Current monolithic behavior

### MapLayerId (today)

From `world-builder/renderer/mapLayerRefresh.js`:

```javascript
/** @typedef {'terrain' | 'contours' | 'arable' | 'timber' | 'metals' | 'rivers' | 'lakes' | 'vectorOverlays'} MapLayerId */
```

### World document diff (today)

From `diffWorldDocumentMapLayers.js`:

```javascript
if (
  nodeListChanged(previous.coastalNodes, next.coastalNodes) ||
  nodeListChanged(previous.metalNodes, next.metalNodes) ||
  nodeListChanged(previous.saltNodes, next.saltNodes)
) {
  changedLayers.push('vectorOverlays')
}
```

Any node list change triggers full vector overlay refresh.

### Resource overlay diff (today)

From `diffResourceOverlayMapLayers.js`:

```javascript
if (definition.kind === 'nodes' || definition.kind === 'rasterAndNodes') {
  changed.add('vectorOverlays')
}
```

Metal/salt visibility toggles add `vectorOverlays` — not `metals` raster layer alone.

### Viewport draw (today)

From `createWorldBuilderMapViewport.js`:

```javascript
vectorOverlays: () =>
  drawVectorOverlays(overlay, currentWorldDocument, resourceOverlayVisibility),
```

`drawVectorOverlays` clears the shared overlay and draws all three families:

1. Coastal nodes — always when `coastalNodes?.length`
2. Metal nodes — when `resolveMetalsOverlayDrawn(...).nodesVisible`
3. Salt nodes — when `resolveSaltNodeOverlayDrawn(...)`

---

## Target layer IDs

After #362, extend MapLayerId:

```javascript
/** @typedef {
 *   'terrain' | 'contours' | 'arable' | 'timber' | 'metals' | 'rivers' | 'lakes'
 *   | 'coastalNodes' | 'metalNodes' | 'saltNodes'
 * } MapLayerId */
```

Remove `vectorOverlays` from production paths (362.7 grep gate).

### Layer ownership

| MapLayerId | WorldDocument source | Visibility gate |
| --- | --- | --- |
| `coastalNodes` | `worldDocument.coastalNodes` | always drawn when nodes exist |
| `metalNodes` | `worldDocument.metalNodes` | `resolveMetalsOverlayDrawn` |
| `saltNodes` | `worldDocument.saltNodes` | `resolveSaltNodeOverlayDrawn` |

Raster layers (`metals`, `arable`, `timber`) remain separate — metal **raster** ≠ metal **nodes**.

---

## WorldDocument node fields

From `world-builder/core/types.js`:

### CoastalNode

```javascript
/**
 * @typedef {'mouth' | 'strait' | 'anchorage' | 'extraction'} CoastalNodeKind
 * @typedef {Object} CoastalNode
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {CoastalNodeKind} kind
 */
```

Derived in `derivedGeographyPipeline.js` via `deriveCoastalNodes` after hydrology completes. Not mutated during hydrology substeps — hydrology state has `coastalNodes: null`.

### SaltNode

```javascript
/**
 * @typedef {Object} SaltNode
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {number} score
 */
```

Placed by `placeSaltNodes`. Validated for land proximity when enforcement enabled.

### MetalNode

```javascript
/**
 * @typedef {Object} MetalNode
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {number} score
 */
```

Placed by `placeMetalNodes`. Spacing validated against salt nodes.

### Pipeline stage availability

| Stage | coastalNodes | saltNodes | metalNodes |
| --- | --- | --- | --- |
| After hydrology | null | null | null |
| After full derived geography | populated | populated | populated |

`landmassPipelineStageContracts.js` clears these to null until post-hydrology resource placement.

---

## Diff locality rules

### Target: `diffWorldDocumentMapLayers`

Replace monolithic block with per-family pushes:

```javascript
if (nodeListChanged(previous.coastalNodes, next.coastalNodes)) {
  changedLayers.push('coastalNodes')
}
if (nodeListChanged(previous.metalNodes, next.metalNodes)) {
  changedLayers.push('metalNodes')
}
if (nodeListChanged(previous.saltNodes, next.saltNodes)) {
  changedLayers.push('saltNodes')
}
```

Changing salt nodes must **not** include `coastalNodes` in changed set.

### Target: `diffResourceOverlayMapLayers`

Add `vectorLayerId` to resource overlay definitions (362.2):

| Resource definition | raster layer | node layer |
| --- | --- | --- |
| metals | `metals` | `metalNodes` |
| salt | — | `saltNodes` |

Visibility toggle for salt adds `saltNodes` only — not `coastalNodes`.

---

## Viewport draw handlers

Split `drawVectorOverlays` into three handlers (362.5):

```javascript
coastalNodes: () => drawCoastalNodes(coastalOverlay, currentWorldDocument),
metalNodes: () => drawMetalNodes(metalOverlay, currentWorldDocument, resourceOverlayVisibility),
saltNodes: () => drawSaltNodes(saltOverlay, currentWorldDocument, resourceOverlayVisibility),
```

Each family gets an independent Pixi display object (or scoped clear region) so `hideMapLayer('saltNodes')` does not clear coastal graphics.

### Coastal draw details

Colors by kind (`coastalNodeColor`):

| kind | color |
| --- | --- |
| mouth | `0x4fc3f7` |
| strait | `0xffb74d` |
| anchorage | `0x81c784` |
| extraction | `0xce93d8` |

Marker: circle radius 2 at `(x + 0.5, y + 0.5)`.

### Metal / salt draw details

Uses `STRATEGIC_RESOURCE_NODE_MARKER_RADIUS` with resource-specific colors (`METAL_NODE_OVERLAY_COLOR`, `SALT_NODE_OVERLAY_COLOR`).

Visibility from `worldBuilderMapViewportModel.js`:

- `resolveMetalsOverlayDrawn(visibility, doc).nodesVisible`
- `resolveSaltNodeOverlayDrawn(visibility, doc)`

---

## Resource overlay visibility

From `resourceOverlays.js` definitions — kinds:

- `raster` — raster layer only
- `nodes` — node markers only
- `rasterAndNodes` — both

After #362, node kinds map to `metalNodes` / `saltNodes` layer IDs instead of `vectorOverlays`.

Coastal nodes are **not** part of resource overlay visibility state — they draw when document includes coastal nodes (generation output).

---

## Map layer refresh runner

Register handlers in `createMapLayerRefreshRunner` (362.6):

```javascript
const mapLayerRefresh = createMapLayerRefreshRunner({
  terrain: refreshTerrain,
  contours: () => refreshContours(currentWorldDocument),
  arable: () => refreshResourceRasterOverlay('arable', currentWorldDocument),
  timber: () => refreshResourceRasterOverlay('timber', currentWorldDocument),
  metals: () => refreshResourceRasterOverlay('metals', currentWorldDocument),
  rivers: () => refreshRiverOverlay(currentWorldDocument),
  lakes: () => refreshLakeOverlay(currentWorldDocument),
  coastalNodes: () => drawCoastalNodes(...),
  metalNodes: () => drawMetalNodes(...),
  saltNodes: () => drawSaltNodes(...),
}, { hideLayer: hideMapLayer })
```

Update `ALL_MAP_LAYER_IDS` array to include three new ids and exclude `vectorOverlays`.

### hideMapLayer

Per-layer hide instead of `overlay.clear()` for all vectors:

```javascript
case 'coastalNodes':
  coastalOverlay.clear()
  break
case 'metalNodes':
  metalOverlay.clear()
  break
case 'saltNodes':
  saltOverlay.clear()
  break
```

---

## Migration steps 362.1–362.9

| Step | Action |
| --- | --- |
| 362.1 | Extend `MapLayerId`: `coastalNodes`, `metalNodes`, `saltNodes` |
| 362.2 | Add `vectorLayerId` to resource overlay definitions |
| 362.3 | Rewrite `diffResourceOverlayMapLayers` — no monolithic `vectorOverlays` |
| 362.4 | Rewrite `diffWorldDocumentMapLayers` — coastal → `coastalNodes` only |
| 362.5 | Split viewport draw: independent groups per vector layer family |
| 362.6 | Register handlers in `mapLayerRefresh.js` per vector layer |
| 362.7 | Migration: remove `vectorOverlays` from production paths (grep gate) |
| 362.8 | Raster regression: existing overlay sync tests still pass |
| 362.9 | Mini thermo: toggling salt must not call coastal draw handler |

---

## Invariants after migration

1. **Locality:** diff of `saltNodes` produces `changedLayers` containing at most `{ saltNodes }` (+ any co-changed rasters if visibility also toggled).
2. **Independence:** coastal draw handler invocation count unchanged when only metal nodes update.
3. **Full refresh:** `changedLayers === null` still refreshes all layers including three node families.
4. **Hide semantics:** partial refresh with `hideUnrefreshedLayers` hides only untouched node layers.
5. **No core/renderer inversion:** overlay layer IDs live in renderer; WorldDocument schema unchanged.

---

## Forbidden patterns

Post-#362 production code must not reference `vectorOverlays`:

```bash
rg 'vectorOverlays' world-builder/renderer/ --glob '*.js' | rg -v test | rg -v '\.test\.'
```

Expected: zero hits.

Other forbiddens:

- Routing coastal changes through `saltNodes` layer id
- Combining node families in one clear-and-redraw without locality
- Adding `vectorOverlays` in new renderer code

---

## Test expectations

### diffWorldDocumentMapLayers.test.js

Update assertions:

```javascript
// metal node score change only
assert.deepStrictEqual(diffWorldDocumentMapLayers(previous, next), ['metalNodes'])
// not ['vectorOverlays']
```

### mapLayerRefresh.test.js (362.9)

When `changedLayers = ['saltNodes']`:

- `handlers.saltNodes` called once
- `handlers.coastalNodes` **not** called

### createWorldBuilderMapViewport.overlaySync.test.js

Existing raster overlay sync tests must pass (362.8) — metal/salt raster toggles independent of node layer split.

---

## Related documents

- [ARCHITECTURE-SEAMS.md](./ARCHITECTURE-SEAMS.md) — renderer seam boundaries
- [SEAM-TEST-CATALOG.md](./SEAM-TEST-CATALOG.md) — overlay locality test matrix
- [HYDROLOGY-TYPED-STAGES.md](./HYDROLOGY-TYPED-STAGES.md) — hydrology does not produce node overlays

---

## Appendix: current vs target diff matrix

| Document change | Current changedLayers | Target changedLayers |
| --- | --- | --- |
| coastalNodes edit | vectorOverlays | coastalNodes |
| metalNodes edit | vectorOverlays | metalNodes |
| saltNodes edit | vectorOverlays | saltNodes |
| salt visibility toggle | vectorOverlays (+ maybe arable) | saltNodes |
| metals visibility toggle (nodes) | vectorOverlays, metals | metalNodes, metals |

This locality table is the acceptance oracle for #362.9 mini thermo review.
