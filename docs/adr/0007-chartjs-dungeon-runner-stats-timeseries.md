# Chart.js for Dungeon Runner stats time-series tiles

The **match outcome dashboard** needs a line chart for **rolling human win rate** over **match sequence**. Quasar has no first-party chart primitive; hand-rolled canvas would duplicate axis scaling, ticks, and resize behavior we only need once.

**Decision:** Add **Chart.js** with **vue-chartjs** for time-series **dashboard tiles** on `/projects/dungeon-runner/stats`. Keep Quasar for layout (`q-page`, grid, `q-slider`, tile shell). Chart rendering stays in a dedicated presentational component; Firestore and rolling-window math stay in plain JS loaders and pure helpers (no Chart.js in loaders or tests).

**Considered options:** Quasar-only custom SVG/canvas (rejected: high maintenance for one chart). A heavier dashboard library (rejected: scope is a single line series). Server-side chart images (rejected: needs refetch or Cloud Functions; slider must recompute client-side).

**Consequences:** `chart.js` and `vue-chartjs` are app dependencies; future stats charts should reuse the same stack or document a new ADR if we switch. Unit tests assert loader/chart data contracts, not Chart.js markup.
