/**
 * Paste the IIFE below into the browser devtools console on the Game Timer page
 * (/projects/game-timer) in each tab (host + guest). Edit CONFIG per tab, then Enter.
 *
 * Both tabs fire at the next wall-clock minute (:00 seconds), so you can paste at
 * different times (e.g. :32 and :48) and still race at :00.
 *
 * Cancel in either tab: window.__gtRaceCancel?.()
 * Re-check state: window.__gtRaceStatus?.()
 */

// ——— copy from (function () { through })(); ———

;(function () {
  /** @type {{ action: 'selectPlayer' | 'endTurnNext', playerIndex: number, anchor: 'nextMinute' }} */
  const CONFIG = {
    action: 'selectPlayer',
    playerIndex: 0,
    anchor: 'nextMinute',
  }

  function getPinia() {
    const root =
      document.querySelector('#q-app') ??
      document.querySelector('[data-v-app]') ??
      document.body.firstElementChild
    const app = root?.__vue_app__
    if (!app) return null
    const provides = app._context?.provides
    if (!provides) return null
    if (provides.pinia) return provides.pinia
    for (const sym of Object.getOwnPropertySymbols(provides)) {
      const v = provides[sym]
      if (v && typeof v._s?.get === 'function') return v
    }
    return app.config?.globalProperties?.$pinia ?? null
  }

  function getStore(id) {
    const pinia = getPinia()
    if (!pinia) throw new Error('Pinia not found — open /projects/game-timer first')
    const store = pinia._s.get(id)
    if (!store) throw new Error(`store "${id}" not found`)
    return store
  }

  function targetMs(anchor) {
    if (anchor === 'nextMinute') {
      const t = new Date()
      t.setSeconds(0, 0)
      t.setMinutes(t.getMinutes() + 1)
      return t.getTime()
    }
    throw new Error(`unknown anchor: ${anchor}`)
  }

  function status() {
    const gt = getStore('gameTimer')
    const room = getStore('gameTimerRoomSession')
    const players = gt.players.map((p, i) => ({
      index: i,
      id: p.id,
      name: p.name,
      isActive: p.id === gt.activePlayerId,
    }))
    const out = {
      role: room.role,
      roomSuffix: room.suffix,
      activePlayerId: gt.activePlayerId,
      clockRunning: gt.turnStartedAt != null,
      round: gt.round,
      players,
    }
    console.log('[gt-race] status', out)
    return out
  }

  function cancel() {
    if (window.__gtRaceTimer != null) {
      clearTimeout(window.__gtRaceTimer)
      window.__gtRaceTimer = null
      console.log('[gt-race] cancelled')
    }
  }

  function arm() {
    cancel()
    const when = targetMs(CONFIG.anchor)
    const delay = when - Date.now()
    if (delay < 50) {
      throw new Error('next minute already passed — wait and paste again')
    }
    const gt = getStore('gameTimer')
    const players = gt.players
    if (players.length < 2 && CONFIG.action === 'selectPlayer') {
      throw new Error('need at least 2 players on the roster before racing selectPlayer')
    }

    let label = CONFIG.action
    const run = () => {
      const firedAt = new Date()
      console.log(`[gt-race] FIRE ${label} @ ${firedAt.toLocaleTimeString()}.${String(firedAt.getMilliseconds()).padStart(3, '0')}`)
      if (CONFIG.action === 'selectPlayer') {
        const p = players[CONFIG.playerIndex]
        if (!p) throw new Error(`no player at index ${CONFIG.playerIndex}`)
        label = `selectPlayer(${p.name})`
        gt.selectPlayer(p.id)
      } else if (CONFIG.action === 'endTurnNext') {
        gt.endTurnNext()
      }
      status()
    }

    const p = players[CONFIG.playerIndex]
    const detail =
      CONFIG.action === 'selectPlayer' && p
        ? `selectPlayer → ${p.name} [index ${CONFIG.playerIndex}]`
        : CONFIG.action

    console.log(
      `[gt-race] armed: ${detail}\n` +
        `  fires at ${new Date(when).toLocaleTimeString()} (in ${(delay / 1000).toFixed(1)}s)\n` +
        `  cancel: window.__gtRaceCancel()`,
    )
    status()
    window.__gtRaceTimer = setTimeout(run, delay)
  }

  window.__gtRaceCancel = cancel
  window.__gtRaceStatus = status
  window.__gtRaceArm = arm

  arm()
})()
