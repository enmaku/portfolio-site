import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  buildAliasPairs,
  buildEntries,
  checkGuard,
  cleanDescriptionHtml,
  diffCorpus,
  nameKey,
  parseArgs,
  applyAliases,
  countByType,
  aliasReportLines,
} from './critcrafter-ingest-lib.mjs'

// ---- nameKey ----------------------------------------------------------------

test('nameKey lowercases, drops apostrophes and accents, and collapses punctuation', () => {
  assert.equal(nameKey("Explorer’s Clothing"), 'explorers clothing')
  assert.equal(nameKey("Smuggler's Sack (Type II)"), 'smugglers sack type ii')
  assert.equal(nameKey('  Fléchette -- Dart  '), 'flechette dart')
})

// ---- cleanDescriptionHtml ---------------------------------------------------

test('UUID links with a label become inert data-ref anchors', () => {
  const out = cleanDescriptionHtml(
    '<p>It is @UUID[Compendium.pf2e.conditionitems.Item.Frightened]{Frightened 1}.</p>',
  )
  assert.equal(
    out,
    '<p>It is <a data-ref="Compendium.pf2e.conditionitems.Item.Frightened">Frightened 1</a>.</p>',
  )
})

test('UUID links without a label use the target name', () => {
  assert.equal(
    cleanDescriptionHtml('@UUID[Compendium.pf2e.conditionitems.Item.Hidden]'),
    '<a data-ref="Compendium.pf2e.conditionitems.Item.Hidden">Hidden</a>',
  )
})

test('damage, check and template enrichers flatten to plain text', () => {
  assert.equal(cleanDescriptionHtml('deals @Damage[6d6[fire]] damage'), 'deals 6d6 fire damage')
  assert.equal(
    cleanDescriptionHtml('deals @Damage[(2d6+4)[persistent,fire]]{persistent fire damage}'),
    'deals persistent fire damage',
  )
  assert.equal(
    cleanDescriptionHtml('a @Check[reflex|dc:20|basic] save'),
    'a DC 20 basic Reflex save',
  )
  assert.equal(cleanDescriptionHtml('@Check[type:will|dc:resolve(18)]{Will save}'), 'Will save')
  assert.equal(cleanDescriptionHtml('a @Template[type:burst|distance:20]'), 'a 20-foot burst')
})

test('inline roll and action macros flatten to their label or content', () => {
  assert.equal(cleanDescriptionHtml('[[/act hide]]{Stealth} check'), 'Stealth check')
  assert.equal(cleanDescriptionHtml('roll [[/r 1d6 #bleed]]'), 'roll 1d6')
  assert.equal(cleanDescriptionHtml('[[/act recall-knowledge skill=arcana]]'), 'Recall Knowledge')
})

test('script tags and event handler attributes are removed', () => {
  assert.equal(
    cleanDescriptionHtml('<p onclick="x()">hi</p><script>alert(1)</script>'),
    '<p>hi</p>',
  )
})

// ---- buildEntries -----------------------------------------------------------

const feat = (over = {}) => ({
  pack: 'feats',
  slug: 'toughness',
  json: {
    name: 'Toughness',
    type: 'feat',
    system: {
      level: { value: 1 },
      actionType: { value: 'passive' },
      actions: { value: null },
      description: { value: '<p>Hardy.</p>' },
      publication: { license: 'ORC', remaster: true, title: 'Pathfinder Player Core' },
      traits: { rarity: 'common', value: ['general'] },
    },
  },
  ...over,
})

test('a feat becomes a doc keyed type:slug with licence data', () => {
  const { entries, skipped } = buildEntries([feat()])
  assert.equal(skipped, 0)
  assert.deepEqual(entries, [
    {
      id: 'feat:toughness',
      data: {
        name: 'Toughness',
        nameKey: 'toughness',
        type: 'feat',
        level: 1,
        traits: ['general'],
        rarity: 'common',
        actionType: 'passive',
        actions: null,
        bulk: null,
        price: null,
        spell: null,
        description: '<p>Hardy.</p>',
        aliases: [],
        license: 'ORC',
        remaster: true,
        title: 'Pathfinder Player Core',
      },
    },
  ])
})

test('entries without publication data are skipped and counted', () => {
  const noPub = feat()
  delete noPub.json.system.publication
  const { entries, skipped } = buildEntries([noPub])
  assert.deepEqual(entries, [])
  assert.equal(skipped, 1)
})

test('class-features pack docs are typed classFeature regardless of the foundry type', () => {
  const cf = feat({ pack: 'class-features', slug: 'esoteric-lore' })
  const { entries } = buildEntries([cf])
  assert.equal(entries[0].id, 'classFeature:esoteric-lore')
  assert.equal(entries[0].data.type, 'classFeature')
})

test('slug collisions get the pack suffix and stay unique', () => {
  const a = feat({ pack: 'feats', slug: 'dup' })
  const b = feat({ pack: 'class-features', slug: 'dup' })
  b.json = { ...b.json, name: 'Dup B' }
  const c = feat({ pack: 'feats', slug: 'dup', relPath: 'feats/z/dup.json' })
  a.relPath = 'feats/a/dup.json'
  b.relPath = 'class-features/dup.json'
  const { entries } = buildEntries([a, b, c])
  const ids = entries.map((e) => e.id).sort()
  assert.deepEqual(ids, ['classFeature:dup', 'feat:dup-feats', 'feat:dup-feats-2'])
})

test('spells carry rank, defense, duration and area; equipment carries bulk and price', () => {
  const spell = {
    pack: 'spells',
    slug: 'fireball',
    json: {
      name: 'Fireball',
      type: 'spell',
      system: {
        level: { value: 3 },
        area: { type: 'burst', value: 20 },
        defense: { save: { basic: true, statistic: 'reflex' } },
        duration: { sustained: false, value: '' },
        range: { value: '500 feet' },
        time: { value: '2' },
        description: { value: '<p>Boom.</p>' },
        publication: { license: 'ORC', remaster: true, title: 'Pathfinder Player Core' },
        traits: { rarity: 'common', value: ['fire'], traditions: ['arcane'] },
      },
    },
  }
  const sword = {
    pack: 'equipment',
    slug: 'longsword',
    json: {
      name: 'Longsword',
      type: 'weapon',
      system: {
        level: { value: 0 },
        bulk: { value: 1 },
        price: { value: { gp: 1 } },
        description: { value: '<p>Sword.</p>' },
        publication: { license: 'ORC', remaster: true, title: 'Pathfinder Player Core' },
        traits: { rarity: 'common', value: ['versatile-p'] },
      },
    },
  }
  const { entries } = buildEntries([spell, sword])
  const byId = Object.fromEntries(entries.map((e) => [e.id, e.data]))
  assert.deepEqual(byId['spell:fireball'].spell, {
    rank: 3,
    defense: { statistic: 'reflex', basic: true },
    duration: null,
    area: { type: 'burst', value: 20 },
    range: '500 feet',
    time: '2',
    traditions: ['arcane'],
    ritual: false,
  })
  assert.equal(byId['spell:fireball'].level, 3)
  assert.equal(byId['equipment:longsword'].bulk, 1)
  assert.deepEqual(byId['equipment:longsword'].price, { gp: 1 })
})

test('equipment carries the item facts the function needs (type, usage, AC, shield stats, range)', () => {
  const mk = (slug, name, type, system) => ({
    pack: 'equipment',
    slug,
    json: {
      name,
      type,
      system: {
        description: { value: '' },
        publication: { license: 'ORC', remaster: true, title: 'Core' },
        traits: { rarity: 'common', value: [] },
        ...system,
      },
    },
  })
  const { entries } = buildEntries([
    mk('longbow', 'Longbow', 'weapon', { range: 100, usage: { value: 'held-in-two-hands' }, category: 'martial', group: 'bow' }),
    mk('leaf-weave', 'Leaf Weave', 'armor', { acBonus: 1, dexCap: 4, category: 'light' }),
    mk('casters-targe', "Caster's Targe", 'shield', { acBonus: 1, hardness: 3, hp: { max: 12, value: 12 } }),
    mk('rope', 'Rope', 'equipment', {}),
  ])
  const byId = Object.fromEntries(entries.map((e) => [e.id, e.data.item]))
  assert.deepEqual(byId['equipment:longbow'], {
    itemType: 'weapon', category: 'martial', group: 'bow', usage: 'held-in-two-hands', range: 100,
    acBonus: null, dexCap: null, hardness: null, hp: null,
  })
  assert.deepEqual(byId['equipment:leaf-weave'], {
    itemType: 'armor', category: 'light', group: null, usage: null, range: null,
    acBonus: 1, dexCap: 4, hardness: null, hp: null,
  })
  assert.equal(byId['equipment:casters-targe'].hardness, 3)
  assert.equal(byId['equipment:casters-targe'].hp, 12)
  assert.equal(byId['equipment:rope'].itemType, 'equipment')
})

test('a ritual spell is flagged on the spell data', () => {
  const { entries } = buildEntries([
    {
      pack: 'spells',
      slug: 'planar-binding',
      json: {
        name: 'Planar Binding',
        type: 'spell',
        system: {
          level: { value: 5 },
          ritual: { primary: { check: 'Religion' } },
          description: { value: '' },
          publication: { license: 'ORC', remaster: true, title: 'Core' },
          traits: { rarity: 'common', value: [], traditions: [] },
        },
      },
    },
  ])
  assert.equal(entries[0].data.spell.ritual, true)
})

// ---- aliases ----------------------------------------------------------------

test('alias pairs join legacy docs to remaster docs in the same category with distinct names', () => {
  const legacy = [
    { id: 'spell-2', name: 'Acid Arrow', category: 'spell', remaster_id: ['spell-9'] },
    { id: 'spell-3', name: 'Same Name', category: 'spell', remaster_id: ['spell-10'] },
    { id: 'feat-1', name: 'Old Feat', category: 'feat', remaster_id: ['spell-9'] },
  ]
  const remaster = [
    { id: 'spell-9', name: 'Acid Grip', category: 'spell' },
    { id: 'spell-10', name: 'same name', category: 'spell' },
  ]
  assert.deepEqual(buildAliasPairs(legacy, remaster), [
    { category: 'spell', legacyName: 'Acid Arrow', remasterName: 'Acid Grip' },
  ])
})

test('applyAliases adds legacy and Pathbuilder labels as nameKeys on the matching entry', () => {
  const { entries } = buildEntries([
    feat({ pack: 'spells', slug: 'acid-grip', json: { ...feat().json, name: 'Acid Grip', type: 'spell' } }),
    feat({
      pack: 'equipment',
      slug: 'repair-toolkit',
      json: { ...feat().json, name: 'Repair Toolkit', type: 'equipment' },
    }),
  ])
  const res = applyAliases(
    entries,
    [{ category: 'spell', legacyName: 'Acid Arrow', remasterName: 'Acid Grip' }],
    { 'Repair Kit': { type: 'equipment', name: 'Repair Toolkit' }, Ghost: { type: 'feat', name: 'Nope' } },
  )
  const byId = Object.fromEntries(entries.map((e) => [e.id, e.data.aliases]))
  assert.deepEqual(byId['spell:acid-grip'], ['acid arrow'])
  assert.deepEqual(byId['equipment:repair-toolkit'], ['repair kit'])
  assert.deepEqual(res.unresolvedLabels, ['Ghost'])
})

// ---- diff and guard ---------------------------------------------------------

test('diffCorpus reports added, changed and deleted ids', () => {
  const existing = new Map([
    ['feat:a', { name: 'A' }],
    ['feat:b', { name: 'B' }],
    ['feat:c', { name: 'C' }],
  ])
  const next = [
    { id: 'feat:a', data: { name: 'A' } },
    { id: 'feat:b', data: { name: 'B2' } },
    { id: 'feat:d', data: { name: 'D' } },
  ]
  assert.deepEqual(diffCorpus(existing, next), {
    added: ['feat:d'],
    changed: ['feat:b'],
    deleted: ['feat:c'],
    unchanged: 1,
  })
})

test('checkGuard trips on more than 10% deleted or a total drop of more than 10%', () => {
  assert.equal(checkGuard({ existingCount: 100, deleted: 10, nextCount: 100 }).ok, true)
  assert.equal(checkGuard({ existingCount: 100, deleted: 11, nextCount: 100 }).ok, false)
  assert.equal(checkGuard({ existingCount: 100, deleted: 0, nextCount: 89 }).ok, false)
  assert.equal(checkGuard({ existingCount: 100, deleted: 0, nextCount: 90 }).ok, true)
  assert.equal(checkGuard({ existingCount: 0, deleted: 0, nextCount: 50 }).ok, true)
})

test('countByType tallies entries per type', () => {
  assert.deepEqual(
    countByType([
      { id: 'a', data: { type: 'feat' } },
      { id: 'b', data: { type: 'feat' } },
      { id: 'c', data: { type: 'spell' } },
    ]),
    { feat: 2, spell: 1 },
  )
})

// ---- args -------------------------------------------------------------------

test('parseArgs defaults to a dry run and reads flags', () => {
  assert.deepEqual(parseArgs([]), { apply: false, force: false, packs: null, sha: null })
  assert.deepEqual(parseArgs(['--packs', '/x', '--sha', 'abc', '--apply', '--force']), {
    apply: true,
    force: true,
    packs: '/x',
    sha: 'abc',
  })
  assert.throws(() => parseArgs(['--bogus']), /Unknown argument/)
})

// ---- alias report -------------------------------------------------------------

test('aliasReportLines prints counts and a WARNING line naming every unresolved label', () => {
  const lines = aliasReportLines(
    { pairAliases: 3, labelAliases: 2, unresolvedLabels: ['Detective Dedication', 'Ghost'] },
    5,
  )
  assert.equal(lines[0], '  5 AoN pairs -> 3 aliases; 2 Pathbuilder label aliases')
  assert.equal(lines.length, 2)
  assert.match(lines[1], /^  WARNING: .*Detective Dedication, Ghost/)
})

test('applyAliases tells a label that an AoN pair already aliased apart from an unresolved one', () => {
  const { entries } = buildEntries([
    feat({ pack: 'equipment', slug: 'repair-toolkit', json: { ...feat().json, name: 'Repair Toolkit', type: 'equipment' } }),
  ])
  const res = applyAliases(
    entries,
    [{ category: 'equipment', legacyName: 'Repair Kit', remasterName: 'Repair Toolkit' }],
    { 'Repair Kit': { type: 'equipment', name: 'Repair Toolkit' } },
  )
  assert.deepEqual(res.unresolvedLabels, [])
  assert.deepEqual(res.alreadyAliasedLabels, ['Repair Kit'])
  assert.equal(res.labelAliases, 0)
  const lines = aliasReportLines(res, 1)
  assert.match(lines.join('\n'), /already covered by AoN pairs: Repair Kit/)
})

test('aliasReportLines prints no warning when every label resolved', () => {
  const lines = aliasReportLines({ pairAliases: 1, labelAliases: 4, unresolvedLabels: [] }, 1)
  assert.equal(lines.length, 1)
})

test('the committed Pathbuilder label table resolves against a corpus that holds its targets', () => {
  const labels = JSON.parse(
    readFileSync(new URL('./critcrafter-pathbuilder-aliases.json', import.meta.url), 'utf8'),
  )
  const docs = Object.values(labels).map((t, i) => ({
    pack: t.type === 'feat' ? 'feats' : 'equipment',
    slug: `x-${i}`,
    json: {
      name: t.name,
      type: t.type,
      system: {
        description: { value: '' },
        publication: { license: 'ORC', remaster: true, title: 'Core' },
        traits: { rarity: 'common', value: [] },
      },
    },
  }))
  const { entries } = buildEntries(docs)
  const res = applyAliases(entries, [], labels)
  assert.deepEqual(res.unresolvedLabels, [])
  assert.equal(res.labelAliases, Object.keys(labels).length)
})

// ---- cleanDescriptionHtml: allowlist sanitiser --------------------------------

test('allowlisted markup passes through unchanged', () => {
  const html = '<p class="x">a <strong>b</strong> <em>c</em></p><ul><li>d</li></ul><table><tr><td colspan="2">e</td></tr></table><hr><p>f<br>g</p>'
  assert.equal(cleanDescriptionHtml(html), html)
})

test('unknown tags are unwrapped, dangerous elements are dropped with their content', () => {
  assert.equal(cleanDescriptionHtml('<p>a<blink>b</blink></p>'), '<p>ab</p>')
  for (const tag of ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template', 'noscript', 'textarea']) {
    assert.equal(cleanDescriptionHtml(`<p>a</p><${tag}>evil()</${tag}><p>b</p>`), '<p>a</p><p>b</p>', tag)
  }
  assert.equal(cleanDescriptionHtml('<p>a</p><SCRIPT>evil()'), '<p>a</p>')
  assert.equal(cleanDescriptionHtml('<svg><svg></svg><script>x</script></svg>ok'), 'ok')
})

test('event handlers and unknown attributes are stripped in every quoting style', () => {
  for (const attrs of ['onclick="x()"', "onclick='x()'", 'onclick=x()', 'ONCLICK = "x()"', 'onerror=alert(1)', 'style="x:y"', 'id=a']) {
    assert.equal(cleanDescriptionHtml(`<p ${attrs}>hi</p>`), '<p>hi</p>', attrs)
  }
  assert.equal(cleanDescriptionHtml('<p/onclick=alert(1)>hi</p>'), '<p>hi</p>')
  assert.equal(cleanDescriptionHtml('<p title="a>b" onclick="x()">hi</p>'), '<p>hi</p>')
})

test('links keep only http(s) hrefs, whatever the quoting, case or entity encoding', () => {
  assert.equal(
    cleanDescriptionHtml('<a href="https://2e.aonprd.com/x?a=1&b=2" onclick="x()">x</a>'),
    '<a href="https://2e.aonprd.com/x?a=1&amp;b=2">x</a>',
  )
  const bad = [
    'javascript:alert(1)',
    '"JaVaScRiPt:alert(1)"',
    "'javascript:alert(1)'",
    '" javascript:alert(1)"',
    '"java\tscript:alert(1)"',
    '"&#106;avascript:alert(1)"',
    '"&#x6A;avascript:alert(1)"',
    '"javascript&colon;alert(1)"',
    '"data:text/html;base64,PHNjcmlwdD4="',
    'data:text/html,x',
    '"vbscript:x"',
    '"//evil.example/x"',
    '"/relative"',
  ]
  for (const href of bad) assert.equal(cleanDescriptionHtml(`<a href=${href}>x</a>`), '<a>x</a>', href)
})

test('a stray < or an unterminated tag is escaped, never emitted as markup', () => {
  assert.equal(cleanDescriptionHtml('1 < 2'), '1 &lt; 2')
  assert.equal(cleanDescriptionHtml('<img src=x onerror=alert(1)'), '&lt;img src=x onerror=alert(1)')
  assert.equal(cleanDescriptionHtml('<img src=x onerror=alert(1)>'), '')
  assert.equal(cleanDescriptionHtml('<!-- <script>x</script> -->ok'), 'ok')
  assert.equal(cleanDescriptionHtml('<?php x ?>ok'), 'ok')
})

test('a tag assembled from fragments of dropped tags does not survive', () => {
  const out = cleanDescriptionHtml('<scr<script></script>ipt>alert(1)</scr<script></script>ipt>')
  assert.doesNotMatch(out, /<[a-zA-Z/]/)
})
