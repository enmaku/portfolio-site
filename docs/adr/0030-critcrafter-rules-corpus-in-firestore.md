# CritCrafter rules text comes from our own Firestore corpus via a sheet function

The CritCrafter viewer never looks up rules itself. The browser fetches the **Pathbuilder export** and posts it to a Firebase **sheet function**, which resolves names against the **rules corpus**, a Firestore collection built from the Foundry pf2e packs with a manually run, pinned-commit ingest script, and returns a filled **CritCrafter sheet**. Chosen because Archives of Nethys cannot be called from a browser (CORS allowlist), its own licence does not pass to us, and Foundry entries carry a machine-readable ORC/OGL tag we can surface per entry. The function cannot fetch `json.php` itself (Cloudflare), hence the browser relay.

**Considered:** hotlinking or scraping AoN; shipping a static index to the client (about 26 MB raw, 6 MB gzip, too heavy for phones and pointless next to Firestore); committing a Foundry module to git; client-side lookup and derived-stat math.

Schema, ingest, alias and miss-handling details live in the resolution of the rules-corpus ticket on the CritCrafter map (#476), not here.
