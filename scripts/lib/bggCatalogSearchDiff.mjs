/**
 * Diff Model A catalog docs derived from two ranks CSV snapshots.
 */
import { createReadStream } from 'node:fs'
import readline from 'node:readline'
import {
  catalogSearchDocFromRankRow,
  csvRowToObject,
} from './bggCatalogSearchIndex.mjs'

/**
 * @param {object} doc
 * @returns {object}
 */
export function comparableCatalogFields(doc) {
  return {
    bggId: doc.bggId,
    name: doc.name,
    yearPublished: doc.yearPublished ?? null,
    rank: doc.rank ?? null,
    bayesAverage: doc.bayesAverage ?? null,
    average: doc.average ?? null,
    usersRated: doc.usersRated ?? null,
    searchPrefixes: doc.searchPrefixes ?? [],
  }
}

/**
 * @param {object} a
 * @param {object} b
 */
export function catalogDocsEqual(a, b) {
  return JSON.stringify(comparableCatalogFields(a)) === JSON.stringify(comparableCatalogFields(b))
}

/**
 * @param {string} csvPath
 * @returns {Promise<Map<string, object>>}
 */
export async function loadCatalogDocMapFromRanksCsv(csvPath) {
  /** @type {Map<string, object>} */
  const map = new Map()
  const rl = readline.createInterface({
    input: createReadStream(csvPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })
  let header = null
  for await (const line of rl) {
    if (!line) continue
    if (header === null) {
      header = line
      continue
    }
    const row = csvRowToObject(header, line)
    const doc = catalogSearchDocFromRankRow(row)
    if (!doc) continue
    map.set(doc.bggId, doc)
  }
  return map
}

/**
 * @param {Map<string, object>} previousById
 * @param {Map<string, object>} nextById
 * @returns {{ added: object[], changed: object[], deleted: string[], summary: object }}
 */
export function diffCatalogDocMaps(previousById, nextById) {
  /** @type {object[]} */
  const added = []
  /** @type {object[]} */
  const changed = []
  /** @type {string[]} */
  const deleted = []

  for (const [id, nextDoc] of nextById) {
    const prev = previousById.get(id)
    if (!prev) {
      added.push(nextDoc)
      continue
    }
    if (!catalogDocsEqual(prev, nextDoc)) {
      changed.push(nextDoc)
    }
  }

  for (const id of previousById.keys()) {
    if (!nextById.has(id)) {
      deleted.push(id)
    }
  }

  return {
    added,
    changed,
    deleted,
    summary: {
      previousCount: previousById.size,
      nextCount: nextById.size,
      added: added.length,
      changed: changed.length,
      deleted: deleted.length,
    },
  }
}
