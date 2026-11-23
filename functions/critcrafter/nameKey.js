'use strict'
// Must stay identical to nameKey() in scripts/critcrafter-ingest-lib.mjs (a parity test checks it):
// lowercase, accents and apostrophes removed, every other run of non-alphanumerics collapsed to a space.
function nameKey(name) {
  return String(name == null ? '' : name)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['‘’ʼ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

module.exports = { nameKey }
