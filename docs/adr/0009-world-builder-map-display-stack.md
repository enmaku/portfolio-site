# World Builder map display stack

The **World Builder** viewport must render **scalar field** rasters and simulation overlays (rivers, **settlements**, **trade routes**, **factions**, resource layers), animate **landmass pipeline** stages such as erosion, and run in both a **desktop shell** and the static GitHub Pages SPA. Geography is a custom grid—not Earth CRS—so GIS map libraries are a poor primary fit.

Research: [map display notes](../../world-builder/research/map-display-research.md). Epic: [#293](https://github.com/enmaku/portfolio-site/issues/293).

## Decision

### Architecture (Azgaar pattern)

Separate four layers; renderer is pure view:

```
settings → generators → world document → renderer
UI → editors → world document → renderer
```

Package layout under `world-builder/`:

| Package | Responsibility |
| --- | --- |
| `core/` | Pipeline, **world document**, pure TS—no DOM |
| `renderer/` | Map viewport, layer compositing—no generation logic |
| `app/` | Vue 3 + Quasar UI: panels, timeline, export |

Generators and editors mutate **world document** state only. Renderers read state; they never mutate it.

### Primary viewport: PixiJS 8 + pixi-viewport

- **PixiJS 8** for WebGL2 (Canvas2D fallback) raster and vector compositing.
- **pixi-viewport** for pan, zoom, pinch, wheel, deceleration.
- Mount imperatively in a host element inside Quasar layout; lazy-load `pixi.js` on the world-builder route.
- **vue3-pixi** is optional; prefer a composable-wrapped `Application` unless declarative Pixi components prove cleaner for a specific layer.

### Layer model

Grid coordinates `(x, y)` throughout—not lat/lng. Composable containers:

1. **TerrainLayer** — elevation + biome tint as a `Sprite` texture uploaded from raster buffers.
2. **HydrologyLayer** — river polylines (`Graphics`).
3. **LogisticsLayer** — movement-cost tint, haul corridors (optional).
4. **SettlementLayer** — tier-scaled marker sprites.
5. **RouteLayer** — **trade route** polylines.
6. **FactionLayer** — border fills and strokes.
7. **LabelLayer** — settlement and **named region** labels; declutter by zoom.

Layer visibility toggles are renderer concerns driven by UI state.

### Erosion and pipeline animation

Simulation stays **CPU-side and deterministic** (same **geography seed** → same fields). Display uses **pipeline frame replay**:

1. Generators emit stage **snapshots** (e.g. `{ elevation, stepIndex }`) during erosion/hydrology.
2. Renderer re-uploads each snapshot to the terrain texture and plays back via `requestAnimationFrame` or a scrubbable timeline.
3. **Dual resolution:** animate on a preview grid (256²–512²) during generation; upload full resolution once when the stage completes.

Do not run a parallel GPU erosion sim for visuals unless a future ADR explicitly accepts visual/sim divergence.

### Overlays and inspect

- Markers and routes: Pixi `Graphics` / sprites with pointer hit areas.
- Raster inspect (cell field values): reverse-project pointer to grid cell; sample arrays in CPU—no GPU readback.
- Resource rasters (salt, arable, etc.): second texture, alpha-blended, toggleable.

### Deployment targets

| Target | Approach |
| --- | --- |
| **Desktop** | **Tauri 2** wraps the same Vite `dist/` as web |
| **GitHub Pages SPA** | Lazy-loaded route/chunk in the Quasar app; all generation and rendering client-side |
| **Offline persistence** | Tauri FS plugins on desktop; IndexedDB in browser |

### Optional (not v1 default)

- **Three.js** — optional 3D heightmap relief / erosion showcase mode; not the primary top-down GM map.
- **Canvas 2D spike** — acceptable for the first heightmap vertical slice only; migrate to Pixi before overlay-heavy UI.
- **Leaflet / MapLibre** — rejected as primary (wrong coordinate model); may revisit for read-only static-map embeds only.
- **Export renderers** — separate PNG/SVG backends reading the same **world document**; need not depend on Pixi.

## Considered options

| Option | Why not primary |
| --- | --- |
| Leaflet / MapLibre GL | WGS84/tile model; awkward for live procedural raster regen on a fantasy grid |
| D3 / SVG whole-map | Strong for export and static politics; poor for per-frame raster animation |
| Three.js default | Larger bundle; 2D political map UX is awkward as the only view |
| Hand-rolled Canvas 2D | Fine for spike; layer compositing, hit-testing, and zoom polish cost grows quickly |
| regl / raw WebGL2 | Maximum control but high implementation cost; escape hatch only |

## Consequences

- New dependencies when implemented: `pixi.js`, `pixi-viewport` (lazy-loaded on world-builder routes).
- Renderer and pipeline communicate through **world document** snapshots and typed layer IDs—not shared DOM or generator callbacks into Pixi.
- Unit tests cover snapshot contracts, grid projection, and layer toggle wiring; not pixel-perfect render output.
- Bundle size: monitor lazy chunk weight on GitHub Pages; tree-shake Pixi imports.
- Still open for separate ADRs or spikes: portfolio route vs standalone deploy, export pipeline (PNG vs SVG), grid cell-center vs corner convention, preview grid size in schema.
