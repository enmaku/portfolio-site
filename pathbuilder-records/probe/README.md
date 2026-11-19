# `probe/` — reverse-engineering toolkit

Everything here was used to analyse Pathbuilder 2e. It is **not** part of the clone;
it is the tooling that produced [`../docs/`](../docs/).

> **`assets/` is not included.** The beautified bundle, the decoded CDN data files,
> the 245-table SQLite mirror, and the derived text dumps are third-party artifacts
> and are deliberately absent. The recipes below regenerate them locally; every
> `assets/…` path in this file and in `../docs/` refers to that local rebuild.

## Requirements

* Google Chrome started with `--remote-debugging-port=9222` and Pathbuilder open.
* Node 18+ (`fetch`, `WebSocket` built in).

## The CDP bridge

Chrome's `/json/*` HTTP endpoints are unusable here (they return 404 for this Chrome
build), so the browser WebSocket URL is read from
`~/Library/Application Support/Google/Chrome/DevToolsActivePort` and a **single**
persistent WebSocket is opened. That connection is kept alive and re-exposed as a
local HTTP API so later scripts never re-connect.

```bash
# start (leave running)
node cdp-bridge.mjs 'ws://127.0.0.1:9222/devtools/browser/<id>' 9333

# or read the endpoint from DevToolsActivePort
WS=$(sed -n '2p' "$HOME/Library/Application Support/Google/Chrome/DevToolsActivePort")
node cdp-bridge.mjs "ws://127.0.0.1:9222$WS" 9333
```

Endpoints:

| Path | Body | Effect |
| --- | --- | --- |
| `/status` | — | connection state, attached targets, event count |
| `/targets` | — | list all Chrome targets |
| `/attach` | `{targetId}` | attach and get a session id |
| `/cmd` | `{targetId, method, params}` | raw CDP |
| `/eval` | `{targetId, expression}` | evaluate JS, return by value |
| `/nav` | `{targetId, url}` | navigate |
| `/new` `/close` | `{url}` / `{targetId}` | create/close tabs |
| `/events` | `{since, limit}` | ring buffer of CDP events |
| `/screenshot` | `{targetId, path, full}` | write a PNG to disk |
| `/mouse` `/key` | — | synthetic input |
| `/quit` | — | shut the bridge down |

## Driver

`capture.mjs` wraps the bridge:

```js
import * as C from './capture.mjs';
await C.ev('document.title');          // evaluate in the Pathbuilder tab
await C.clickId('menu');               // click by element id
await C.clickText('.div-button', 'Rest');
await C.closeAll();                    // remove every open modal
await C.shot('my-screenshot');         // -> ../docs/img/my-screenshot.png
console.log(await C.modalInfo());      // title / size / footer buttons / tabs
```

`pbui.mjs` is the older driver (same idea, no screenshot helper).

## Screenshot capture

The `cap-*.mjs` scripts each capture one region of the UI into `../docs/img/`:

| Script | Captures |
| --- | --- |
| `cap-run.mjs` | full app |
| `cap-tabs.mjs` | the 8 main tabs |
| `cap-sidebar.mjs` | sidebar open |
| `cap-sidenav4.mjs`, `cap-sidenav5.mjs` | every sidebar dialog |
| `cap-build2.mjs`, `cap-cogs2.mjs`, `cap-featdialog.mjs` | build-column and feat dialogs |
| `cap-topbar5.mjs` | level / XP / name / rest / conditions / buffs |
| `cap-tabmenus.mjs` | Add Weapon / Add Gear / Add Container |
| `cap-extras.mjs` | dice tray |

Run them in order with the bridge up; they are idempotent.

## Data tooling

```bash
# decode the shipped rules data (needs `lz-string`)
npm i lz-string
node -e "
const LZ=require('lz-string'),fs=require('fs');
fs.writeFileSync('assets/data.json',
  LZ.decompressFromBase64(fs.readFileSync('assets/data_remastered80.txt','utf8')));
"

# query the local mirror
sqlite3 assets/pb_remastered.db 'select count(*) from feats_general;'
```

## Gotchas (learned the hard way)

* IndexedDB `saves` values are **JSON strings** — parse twice.
* Modals are appended to `<body>`; the topmost is `.modal:last-of-type`.
* The footer button `Finished` commits; `Cancel` discards silently.
* `#divBuild` and `.div-listview-scroller` are the scroll containers.
* Some click handlers resolve their target by walking `parentElement` against a
  reverse map, so `elementFromPoint`-based clicking can miss. Prefer `el.click()`.
* Chrome reloads wipe app state — always re-navigate with `/nav` and wait for
  `#divBuildLevels`.
