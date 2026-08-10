import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeBggSearchXml, normalizeBggThingListXml, normalizeBggThingXml } from './normalizeBgg.js'

const SEARCH_FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<items total="2" termsofuse="https://boardgamegeek.com/xmlapi/public#termsofuse">
  <item type="boardgame" id="295947">
    <name type="primary" value="Cascadia"/>
    <yearpublished value="2021"/>
  </item>
  <item type="boardgame" id="13">
    <name type="primary" value="CATAN"/>
    <yearpublished value="1995"/>
  </item>
</items>`

const THING_FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<items termsofuse="https://boardgamegeek.com/xmlapi/public#termsofuse">
  <item type="boardgame" id="295947">
    <name type="primary" value="Cascadia"/>
    <name type="alternate" value="カスカディア"/>
    <yearpublished value="2021"/>
    <minplayers value="1"/>
    <maxplayers value="4"/>
    <playingtime value="30"/>
    <minplaytime value="30"/>
    <maxplaytime value="45"/>
    <thumbnail>https://cf.geekdo-images.com/thumb.jpg</thumbnail>
    <image>https://cf.geekdo-images.com/image.jpg</image>
    <description>&amp;ldquo;Build&amp;rdquo; a habitat mosaic.&amp;nbsp;Score&amp;mdash;then win.&lt;br/&gt;Next line.</description>
    <statistics page="1">
      <ratings>
        <usersrated value="42000"/>
        <average value="7.90"/>
        <bayesaverage value="7.60"/>
        <ranks>
          <rank type="subtype" id="1" name="boardgame" friendlyname="Board Game Rank" value="120" bayesaverage="7.60"/>
        </ranks>
      </ratings>
    </statistics>
  </item>
</items>`

test('normalizeBggSearchXml maps search hits to catalog search rows', () => {
  const results = normalizeBggSearchXml(SEARCH_FIXTURE)
  assert.equal(results.length, 2)
  assert.deepEqual(results[0], {
    catalogEntryId: '295947',
    title: 'Cascadia',
    yearPublished: 2021,
    type: 'boardgame',
  })
  assert.equal(results[1].catalogEntryId, '13')
  assert.equal(results[1].title, 'CATAN')
})

test('normalizeBggSearchXml returns empty array for blank input', () => {
  assert.deepEqual(normalizeBggSearchXml(''), [])
  assert.deepEqual(normalizeBggSearchXml('   '), [])
})

const THING_MULTI_FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<items termsofuse="https://boardgamegeek.com/xmlapi/public#termsofuse">
  <item type="boardgame" id="13">
    <name type="primary" value="Catan"/>
    <yearpublished value="1995"/>
    <thumbnail>https://cf.geekdo-images.com/catan-thumb.jpg</thumbnail>
  </item>
  <item type="boardgame" id="295947">
    <name type="primary" value="Aeronautica Imperialis: Wings of Vengeance – Emperor&#039;s Blessing Card"/>
    <yearpublished value="2021"/>
    <thumbnail>https://cf.geekdo-images.com/aero-thumb.jpg</thumbnail>
  </item>
</items>`

test('normalizeBggThingXml maps thing payload to catalog entry detail', () => {
  const entry = normalizeBggThingXml(THING_FIXTURE)
  assert.ok(entry)
  assert.equal(entry.catalogEntryId, '295947')
  assert.equal(entry.title, 'Cascadia')
  assert.equal(entry.yearPublished, 2021)
  assert.equal(entry.minPlayers, 1)
  assert.equal(entry.maxPlayers, 4)
  assert.equal(entry.playingTime, 30)
  assert.equal(entry.minPlayTime, 30)
  assert.equal(entry.maxPlayTime, 45)
  assert.equal(entry.thumbnailUrl, 'https://cf.geekdo-images.com/thumb.jpg')
  assert.equal(entry.imageUrl, 'https://cf.geekdo-images.com/image.jpg')
  assert.equal(entry.description, '“Build” a habitat mosaic. Score—then win.\nNext line.')
  assert.equal(entry.thingType, 'boardgame')
  assert.equal(entry.usersRated, 42000)
  assert.equal(entry.bayesAverage, 7.6)
  assert.equal(entry.boardGameRank, 120)
})

test('normalizeBggThingXml returns null when item is missing', () => {
  assert.equal(normalizeBggThingXml('<items></items>'), null)
})

test('normalizeBggThingListXml returns all items and decodes numeric entities', () => {
  const entries = normalizeBggThingListXml(THING_MULTI_FIXTURE)
  assert.equal(entries.length, 2)
  assert.equal(entries[0].catalogEntryId, '13')
  assert.equal(entries[0].thumbnailUrl, 'https://cf.geekdo-images.com/catan-thumb.jpg')
  assert.equal(entries[1].title, "Aeronautica Imperialis: Wings of Vengeance – Emperor's Blessing Card")
})
