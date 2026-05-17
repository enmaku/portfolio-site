# Hash SPA routing with static HTML for link previews

The app is a client-rendered single-page bundle deployed to static hosting (hash URLs for in-browser navigation). Crawlers and chat unfurlers do not reliably execute that routing, so the build emits additional HTML entry points for key routes with correct Open Graph fields and an immediate redirect into the hash URL. We accept duplicate shell pages and two URL shapes (canonical path vs `#` route) so paste previews stay accurate without adopting server rendering or a separate preview service.
