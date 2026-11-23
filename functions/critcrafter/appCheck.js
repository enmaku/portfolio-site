'use strict'
// App Check for an onRequest function: `enforceAppCheck` only exists for callables, so the token the viewer
// sends in X-Firebase-AppCheck is verified here with the Admin SDK.

async function verifyAppCheckToken(req, admin) {
  const token = req.header('X-Firebase-AppCheck')
  if (!token) return false
  try {
    await admin.appCheck().verifyToken(token)
    return true
  } catch {
    return false
  }
}

module.exports = { verifyAppCheckToken }
