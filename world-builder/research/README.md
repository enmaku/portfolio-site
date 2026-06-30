# World Builder — research sources

Index for material that informs [`../CONTEXT.md`](../CONTEXT.md). Conceptual and domain language only—implementation lives elsewhere.

## Map display & viewport

How to render **world document** rasters and overlays in desktop + browser (GitHub Pages SPA).

- **Decision:** [ADR 0009 — map display stack](../../docs/adr/0009-world-builder-map-display-stack.md) (PixiJS 8 + pixi-viewport, Tauri + SPA, Azgaar-style layers)
- Research: [`map-display-research.md`](./map-display-research.md)

## Dwarf Fortress — terrain generation

Comparison reference for **landmass pipeline** design (fields-first geography, hydrology, rejection sampling, history-as-simulation). Not a code port.

- Notes: [`dwarf-fortress-terrain-notes.md`](./dwarf-fortress-terrain-notes.md)
- Public config mirror: [Qartar/dwarf-fortress](https://github.com/Qartar/dwarf-fortress) (`data/init/world_gen.txt` on `legacy` branch)
- Wiki: [Advanced world generation](https://dwarffortresswiki.org/Advanced_world_generation)

**Takeaway:** Adopt DF’s geographic engine (scalar fields → biomes → erosion/rivers → named regions → reject until valid). World Builder adds the playlist’s **logistics pass** (ox paradox, haul-shed, population ceiling, strategic resources) on top.

## Worldbuilding Insights (YouTube playlist)

Primary reference for the **culture engine** and logistics-first map thinking.

- Playlist: [Worldbuilding Insights](https://www.youtube.com/watch?v=56OgvPJIi5s&list=PLph_A8rBjLxXCs3Gc4-qQVVgN7nEsDIzg)
- Local transcripts: `youtube-subtitles/*.en.txt` (human-readable, **gitignored** — not part of landmass runtime PRs)
- Raw YouTube rolling captions: `youtube-subtitles/raw/*.en.srt` (gitignored)

Transcripts are research-only reference material. Clone the repo, run the refresh commands below from this directory (`world-builder/research/`), and the files appear locally without committing bulk caption text.

### Refresh subtitles

```bash
yt-dlp --skip-download --write-auto-sub --write-sub --sub-lang en \
  --sub-format vtt --convert-subs srt \
  --output "%(playlist_index)02d-%(title)s.%(ext)s" \
  --yes-playlist \
  "https://www.youtube.com/watch?v=56OgvPJIi5s&list=PLph_A8rBjLxXCs3Gc4-qQVVgN7nEsDIzg" \
  -P "$(pwd)/youtube-subtitles/raw"
```

Then convert to readable transcripts:

```bash
node scripts/srt-to-transcript.mjs
```

The script deduplicates YouTube's rolling-caption overlap, strips `[music]` markers, and writes `*.en.txt` beside `raw/*.en.srt`.

### Video index (playlist order)

| # | File prefix | Topics extracted for CONTEXT |
| --- | --- | --- |
| 01 | Your Fantasy Politics Need This Middle Layer | **Vassal middle layer**, conditional **loyalty** |
| 02 | 7 Strategies Houses Use to Control Vassals | **Great house** control levers, trade access |
| 03 | Your Worldbuilding Cultures Are Disconnected | Disconnected **culture** traits |
| 04 | Your Fantasy Politics Aren't Boring—They're Built Wrong | **Conflict engine** framing |
| 05 | Stop Drawing Maps. Start Building Worlds. | When geography matters; **travel time** |
| 06 | Your Fantasy Society is Too Fair | Rigged **power** structures |
| 07–08 | Boring politics / one-dimensional characters | **Power center** depth |
| 09 | The 5 Forces That Make Cultures Believable | **Five forces**, **WAAC cycle**, **six culture layers** |
| 10 | Fix Your Fantasy Cultures | Culture engine application |
| 11 | Every Political System in History Runs on This One Engine | **Political skeleton**, **power centers** |
| 12 | The King's Fatal Mistake: Adding A Middle Class | **Legacy** / class pressure |
| 13 | I Stopped Designing Cultures | **Environmental pressure** stack, **reverse-engineering culture** |
| 14 | Are Your Fantasy Races Just Humans With Costumes? | Species vs **culture** (out of v1 scope) |
| 15 | The Ox That's Breaking Your Fantasy Map | **Ox paradox**, **grain circle**, **supply-chain feudalism** |
| 16 | The Parasite City on Your Fantasy Map | **Drain city**, sea vs land **haul cost** |
| 17 | Your Fantasy Capital Is Mathematically Impossible | **Population ceiling**, **arable envelope** |
| 18 | Your Fantasy Map Has a Salt Problem | **Strategic resource**, preservation logistics |

## How sources combine

| Layer | Primary source |
| --- | --- |
| **Map viewport**, layers, erosion animation, overlays | Map display research |
| **Scalar fields**, hydrology, rejection, history-as-log | Dwarf Fortress research |
| **Logistics pass**, settlement nodes, culture/conflict causality | Worldbuilding Insights playlist |
| Canonical terms and pipeline order | [`../CONTEXT.md`](../CONTEXT.md) |
