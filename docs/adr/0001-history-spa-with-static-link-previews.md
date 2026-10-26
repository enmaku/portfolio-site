# History SPA routing with static HTML for link previews

The app is a client-rendered single-page bundle deployed to static hosting. It uses **history mode** URLs (`/projects/game-timer`), not hash URLs. Crawlers and chat unfurlers do not reliably execute client-side routing, so the build emits additional HTML entry points for key routes with correct Open Graph fields. GitHub Pages serves those as real `200 OK` responses rather than redirecting into a fragment.

## Why history mode replaced hash mode

Hash routing keeps every document at `/`, so an installed web app can only declare `scope: "/"`. Scopes determine which URLs a browser considers already owned by an installed app: with a site-wide scope, installing one app suppressed the install prompt for all the others on the same origin, and Chrome offered "Open in <App>" instead of installing. History mode gives each app its own document path, so each manifest declares a narrow, non-overlapping scope like `/projects/game-timer/` and every app installs on its own.

The trade-off is that static hosting cannot rewrite arbitrary paths to the shell. That is handled by emitting per-route HTML at build time plus a `404.html` copy of the shell, which GitHub Pages serves for routes that cannot be pre-generated (dynamic parameters such as `/projects/time-tracker/c/:secret`, and unknown paths).

## Consequences

- Canonical path URLs and in-app router URLs are the same shape; there is no fragment trampoline on generated pages.
- Legacy `#/projects/...` links and bookmarks are rewritten to path URLs on boot so old join links keep working.
- `dist/spa` contains duplicate shell pages, and every asset reference must be absolute against `publicPath` because documents now live at varying depths.
- Manifest `id`, `start_url`, and `scope` are relative to the manifest URL under `/manifests/`, so each needs a `../projects/<slug>/` prefix to resolve to the app root. A mismatch there makes Chrome treat the app identity as invalid and report the app as uninstallable.
- Deployment still requires no server: GitHub Pages' `404.html` convention supplies the fallback.
