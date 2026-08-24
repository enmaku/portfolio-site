import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyThumbnailsToDocs,
  chunkIds,
  fetchThumbnailUrlsForIds,
  idsMissingThumbnail,
  parseThingThumbnailsXml,
  THING_BATCH_SIZE,
} from './lib/bggCatalogThumbnails.mjs'
import { formatDurationMs, formatThumbProgress } from './bgg-fetch-catalog-thumbnails.mjs'

test('idsMissingThumbnail skips docs that already have a url', () => {
  const ids = idsMissingThumbnail(
    [
      { bggId: '1', thumbnailUrl: 'https://cdn/a.jpg' },
      { bggId: '2' },
      { bggId: '3', thumbnailUrl: '' },
      { bggId: '2' },
    ],
    ['3'],
  )
  assert.deepEqual(ids, ['2'])
})

test('chunkIds uses batches of 20', () => {
  const ids = Array.from({ length: 45 }, (_, i) => String(i + 1))
  const chunks = chunkIds(ids)
  assert.equal(THING_BATCH_SIZE, 20)
  assert.equal(chunks.length, 3)
  assert.equal(chunks[0].length, 20)
  assert.equal(chunks[2].length, 5)
})

test('parseThingThumbnailsXml maps item id to thumbnail', () => {
  const xml = `<?xml version="1.0"?>
    <items>
      <item type="boardgame" id="13">
        <thumbnail>https://cf.geekdo-images.com/catan.jpg</thumbnail>
      </item>
      <item type="boardgame" id="9209">
        <name value="No Art" />
      </item>
    </items>`
  const map = parseThingThumbnailsXml(xml)
  assert.equal(map.get('13'), 'https://cf.geekdo-images.com/catan.jpg')
  assert.equal(map.get('9209'), null)
})

test('applyThumbnailsToDocs writes urls and leaves existing', () => {
  const docs = [
    { bggId: '13', thumbnailUrl: 'https://old.jpg' },
    { bggId: '266192' },
  ]
  const urlById = new Map([
    ['13', 'https://new.jpg'],
    ['266192', 'https://cdn/wing.jpg'],
  ])
  applyThumbnailsToDocs(docs, urlById)
  assert.equal(docs[0].thumbnailUrl, 'https://new.jpg')
  assert.equal(docs[1].thumbnailUrl, 'https://cdn/wing.jpg')
})

test('fetchThumbnailUrlsForIds batches 20 ids and omits stats', async () => {
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(url)
    const idParam = new URL(url).searchParams.get('id') || ''
    const ids = idParam.split(',').filter(Boolean)
    const xml = `<items>${ids
      .map((id) => `<item type="boardgame" id="${id}"><thumbnail>https://cdn/${id}.jpg</thumbnail></item>`)
      .join('')}</items>`
    return { ok: true, status: 200, text: async () => xml }
  }
  const ids = Array.from({ length: 25 }, (_, i) => String(i + 1))
  const map = await fetchThumbnailUrlsForIds('test-key', ids, {
    fetchImpl,
    sleep: async () => {},
    gapMs: 0,
  })
  assert.equal(calls.length, 2)
  assert.ok(!calls[0].includes('stats'))
  assert.equal((new URL(calls[0]).searchParams.get('id') || '').split(',').length, 20)
  assert.equal(map.get('1'), 'https://cdn/1.jpg')
  assert.equal(map.get('25'), 'https://cdn/25.jpg')
})

test('formatDurationMs uses compact h/m/s', () => {
  assert.equal(formatDurationMs(0), '0s')
  assert.equal(formatDurationMs(12_400), '12s')
  assert.equal(formatDurationMs(65_000), '1m 05s')
  assert.equal(formatDurationMs(3_780_000), '1h 03m')
})

test('formatThumbProgress includes percent elapsed and eta', () => {
  const line = formatThumbProgress({ fetched: 40, total: 200, elapsedMs: 10_000 })
  assert.equal(line, '20.0%  40/200  elapsed 10s  eta 40s')
})
