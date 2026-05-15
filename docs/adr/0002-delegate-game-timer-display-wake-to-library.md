# Game Timer display wake delegated to Nosleep.js

Keeping the tabletop visible during long turns is a product invariant (**keep display on** whenever the roster has players). Owning Wake Lock APIs plus bespoke hidden-video fallback in app code duplicated browser quirks outside core timer logic.

We delegate that behavior to **`nosleep.js`** (NoSleep.js) exposed as a small **`useNoSleep`** composable: enable when the roster is non-empty, disable on teardown, and re-arm through minimal document lifecycle hooks when QA shows mobile browsers dropped wake—still by calling the library’s API rather than rebuilding a parallel implementation.
