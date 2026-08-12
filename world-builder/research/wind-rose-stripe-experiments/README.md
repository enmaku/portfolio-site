# Wind-rose stripe experiments

Research archive from the terrain authoring wind-stripe investigation (2026-08). Product decisions: [ADR 0024](../../../docs/adr/0024-world-builder-wind-rose-rainfall.md), glossary terms in [`../CONTEXT.md`](../../CONTEXT.md) (**Wind rose**, **Prevailing wind**, **Secondary maximum**).

Conceptual only for this folder—runtime implementation belongs in `world-builder/core` and the World Builder page. Port prototypes; do not import this path from production.

## Problem

Fixed single-bearing **prevailing wind** stacked moisture advection and rain-shadow rays into wind-aligned biome “ruler” stripes on seeds such as geography seed `1370491305` / prevailing `295°`.

## Locked product choices (from grill + mockup)

- Rainfall / rain shadow use a **wind rose** composition; snow deposition stays on **prevailing wind** alone.
- Internal mix ≈ **35% prevailing / 20% secondary maximum / 45% seed scatter**, **N ≈ 20** samples (not author knobs).
- Schedule seed: `geographySeed ^ (yearCount * 101)`.
- UI: **Wind** section under seed / reset; centered **link / link_off** icon between prevailing and secondary sliders; rose preview; single primary chrome color.
- Slower regen accepted; no fast single-bearing preview path.

## What’s in this folder

| Path | Why keep it |
| --- | --- |
| `prototypes/buildWeightedSchedule.js` | Largest-remainder lobe counts + Fisher–Yates shuffle (port target) |
| `prototypes/seededRandom.js` | `mulberry32` / degree normalize used by the schedule |
| `prototypes/stripeDetect.js` | Research cliff/stripe metric along downwind rays (not a product test) |
| `prototypes/userSettings.js` | Pinia dump of the problem-seed generation options |
| `ui-mockup/wind-rose.html` | Locked sidebar UI mock (Chart.js rose, seed roller, link icon, arrows) |
| `summaries/*.json` | Metric snapshots: repro, weighted mix, wind rose, snow-vs-rose |

Open the mockup locally:

```bash
open world-builder/research/wind-rose-stripe-experiments/ui-mockup/wind-rose.html
```

## Experiment takeaways (short)

- Small Gaussian wind jitter does not kill stripes; multimodal / large-angle mix does.
- More cycles of the same three fixed lobes do not improve past the mean of those lobes.
- Best cost/look balance among tried mixes: **35/20/45** at **N=20**.
- Opposite lobe as a heavy fixed secondary keeps a corridor; orthogonal (+90°) + random works better.
- Averaging the rose into `computeSnowWindAccumFactor` barely moved snow bias on the problem seed (mean \|Δ\| ≈ 0.03)—hence snow stays prevailing-only.

## Not archived

Full PNG thumbnails and one-off HTML report pages (~8MB+) were left in the original system temp harness; recreate from prototypes + live `generateRainfall` if needed.
