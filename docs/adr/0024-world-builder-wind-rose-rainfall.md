# World Builder wind rose for rainfall, not snow

A single **prevailing wind** bearing stacked rain-shadow and moisture-advection rays into wind-aligned biome “ruler” stripes. Averaging many bearings softens those stripes but costs compute and changes what “wind” means for authors.

Glossary: [`world-builder/CONTEXT.md`](../../world-builder/CONTEXT.md) (**Wind rose**, **Prevailing wind**, **Secondary maximum**, **Rain shadow**, **Geography seed**).

## Decision

Rainfall and **rain shadow** use a **wind rose** composition for each **landmass** generation: dominant **prevailing wind**, linked-by-default **secondary maximum**, and seed-deterministic scatter. Relative lobe weights and sample count are internal constants—not author knobs. Wind-blown snow deposition stays on the **prevailing wind** lobe alone (rose averaging barely moved snow bias on the problem seed and would dilute the aimed highland story for little gain).

Authors aim wind in a dedicated **Wind** section. Link **secondary maximum** to **prevailing wind** with a compact centered link/link-off icon between those sliders (not a labeled checkbox)—behavior otherwise as locked in the sidebar mockup. **Climate** strength knobs may still say **prevailing wind** as the aim metaphor. Slower terrain regen is accepted; there is no fast single-bearing preview path that reintroduces stripes during authoring. Success is killing ruler/stripe biomes while keeping directional wet/dry contrast from the prevailing lobe.

## Consequences

Implementers must not treat `prevailingWindDegrees` as the sole rainfall transport bearing, apply the rose to snow accumulation, expose mix/N as author controls, or persist scatter bearings as authored data (re-derive from **geography seed** + prevailing frame). Persist absolute **secondary maximum** plus link state with generation settings.
