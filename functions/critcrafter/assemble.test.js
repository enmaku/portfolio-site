'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { entry, memoryStore } = require('./test/memoryStore')
const { syntheticBuild, loadBuild, EXPORT_NAMES } = require('./test/builds')
const { syntheticCorpus } = require('./test/syntheticCorpus')
const { assertValidSheet, assertSumInvariant } = require('./test/schemaHelpers')
const { createResolver } = require('./resolve')
const { buildSheetFor } = require('./assemble')

const NOW = () => new Date('2026-01-02T03:04:05.000Z')

async function sheetFor(build, docs) {
  const resolver = createResolver({ store: memoryStore(docs) })
  return buildSheetFor(build, { resolver, now: NOW })
}

const spellDoc = (name, rank, over = {}) =>
  entry('spell', name, {
    level: rank,
    spell: { rank, defense: { statistic: 'reflex', basic: true }, duration: '1 minute', area: { type: 'burst', value: 20 }, range: '500 feet', time: '2', traditions: [], ritual: false },
    ...over,
  })
const itemDoc = (name, item, over = {}) =>
  entry('equipment', name, { item: { itemType: 'equipment', category: null, group: null, usage: null, range: null, acBonus: null, dexCap: null, hardness: null, hp: null, ...item }, ...over })
const actionDoc = (name, actionType, actions, over = {}) => entry('action', name, { actionType, actions, ...over })

// ---- header and envelope -------------------------------------------------------

test('envelope: version, injected clock, corpus sha and header with placeholders normalised away', async () => {
  const sheet = await sheetFor(
    syntheticBuild({ name: 'Ayla', class: 'Oracle', dualClass: 'Investigator', level: 3, deity: 'Not set', languages: ['Common', 'None selected'], heritage: 'Custom Mixed Heritage' }),
    [],
  )
  assert.equal(sheet.schemaVersion, 1)
  assert.equal(sheet.generatedAt, '2026-01-02T03:04:05.000Z')
  assert.equal(sheet.corpus.sha, 'a'.repeat(40))
  assert.equal(sheet.header.name, 'Ayla')
  assert.equal(sheet.header.classLine, 'Oracle / Investigator')
  assert.equal(sheet.header.deity, null)
  assert.deepEqual(sheet.header.languages, ['Common'])
  assert.equal(sheet.header.size, 'Medium')
  assert.equal(sheet.header.level, 3)
  assertValidSheet(sheet)
})

test('a placeholder dual class is not shown', async () => {
  const sheet = await sheetFor(syntheticBuild({ dualClass: 'Not set' }), [])
  assert.equal(sheet.header.classLine, 'Fighter')
})

// ---- skills ---------------------------------------------------------------------

test('core skills carry their corpus actions with full rules text; lores carry none', async () => {
  const sheet = await sheetFor(syntheticBuild({ lores: [['Warfare', 2]] }), [actionDoc('Grapple', 'action', 1), actionDoc('Trip', 'action', 1), actionDoc('Lie', 'action', 1)])
  const athletics = sheet.skills.find((s) => s.name === 'Athletics')
  assert.deepEqual(athletics.bonus.actions.map((a) => a.name), ['Grapple', 'Trip'])
  assert.deepEqual(athletics.bonus.actions[0].cost, { kind: 'actions', min: 1 })
  assert.equal(athletics.bonus.actions[0].rules.html, '<p>Grapple text.</p>')
  assert.equal(sheet.skills.find((s) => s.name === 'Warfare Lore').bonus.actions, undefined)
  assert.equal(sheet.skills.find((s) => s.name === 'Stealth').bonus.actions, undefined)
})

// ---- gear -----------------------------------------------------------------------

test('gear: weapons, shields, armor, consumables and plain gear with qty, bulk and price', async () => {
  const build = syntheticBuild({
    weapons: [{ name: 'Longbow', qty: 1, prof: 'martial', die: 'd8', pot: 0, str: '', damageType: 'P', attack: 5, damageBonus: 0 }, { name: 'Mystery Blade', qty: 2, prof: 'martial', die: 'd6', pot: 0, str: '', damageType: 'S', attack: 4, damageBonus: 0 }],
    armor: [
      { name: 'Leaf Weave', qty: 1, prof: 'light', worn: true },
      { name: "Caster's Targe", qty: 1, prof: 'shield', worn: false },
    ],
    equipment: [['Healing Potion', 3, ''], ['Rope', 1, '']],
    acTotal: { acProfBonus: 3, acAbilityBonus: 0, acItemBonus: 1, acTotal: 14, shieldBonus: null },
    proficiencies: { light: 2 },
  })
  const sheet = await sheetFor(build, [
    itemDoc('Longbow', { itemType: 'weapon', range: 100, usage: 'held-in-two-hands' }, { bulk: 2, price: { gp: 6 }, traits: ['propulsive', 'volley-30'] }),
    itemDoc('Leaf Weave', { itemType: 'armor', acBonus: 1, dexCap: 4 }, { bulk: 1, price: { gp: 4 } }),
    itemDoc("Caster's Targe", { itemType: 'shield', acBonus: 1, hardness: 3, hp: 12 }, { bulk: 1, price: { gp: 2 } }),
    itemDoc('Healing Potion', { itemType: 'consumable' }, { bulk: 0.1, price: { gp: 4, sp: 5 } }),
    itemDoc('Rope', {}, { bulk: 0.1 }),
  ])
  const bow = sheet.gear.weapons[0]
  assert.deepEqual([bow.key, bow.kind, bow.qty, bow.bulk, bow.price, bow.hands, bow.versatile, bow.range, bow.reach], ['weapons:longbow#1', 'weapon', 1, 2, '6 gp', 2, null, 100, null])
  const miss = sheet.gear.weapons[1]
  assert.equal(miss.qty, 2)
  assert.equal(miss.rules, null)
  assert.match(miss.aonUrl, /Search\.aspx\?q=Mystery%20Blade$/)
  assert.equal(sheet.gear.armor[0].wornInExport, true)
  assert.equal(sheet.gear.armor[0].acTotal.value, 14)
  const targe = sheet.gear.shields[0]
  assert.deepEqual([targe.hardness, targe.hp, targe.bt, targe.hands, targe.buckler, targe.acBonus.value], [3, 12, 6, 1, false, 1])
  assert.deepEqual(sheet.gear.consumables.map((c) => [c.name, c.qty, c.bulk, c.price]), [['Healing Potion', 3, 'L', '4 gp 5 sp']])
  assert.deepEqual(sheet.gear.gear.map((g) => g.name), ['Rope'])
  assert.equal(sheet.gear.bulk.value, 2 + 1 + 1 + 0, 'bow 2, armor 1, targe 1, 3 potions + rope are light (0.4 rounds down)')
  assertValidSheet(sheet)
  assertSumInvariant(sheet)
})

test('a thrown trait gives a range and a melee reach; the reach trait gives 10', async () => {
  const build = syntheticBuild({ weapons: [{ name: 'Spear', qty: 1, prof: 'simple', die: 'd6', pot: 0, str: '', damageType: 'P', attack: 3, damageBonus: 0 }, { name: 'Halberd', qty: 1, prof: 'martial', die: 'd10', pot: 0, str: '', damageType: 'P', attack: 3, damageBonus: 0 }] })
  const sheet = await sheetFor(build, [
    itemDoc('Spear', { itemType: 'weapon', usage: 'held-in-one-hand' }, { traits: ['thrown-20', 'two-hand-d8'] }),
    itemDoc('Halberd', { itemType: 'weapon', usage: 'held-in-two-hands' }, { traits: ['reach', 'versatile-s'] }),
  ])
  const [spear, halberd] = sheet.gear.weapons
  assert.deepEqual([spear.hands, spear.versatile, spear.range, spear.reach], [1, 2, 20, 5])
  assert.deepEqual([halberd.hands, halberd.versatile, halberd.range, halberd.reach], [2, null, null, 10])
})

test('unmatched armor and shields carry null instead of fabricated numbers, and the sheet stays valid', async () => {
  const sheet = await sheetFor(
    syntheticBuild({
      armor: [
        { name: 'Homebrew Plate', qty: 1, prof: 'heavy', worn: false },
        { name: 'Homebrew Shield', qty: 1, prof: 'shield', worn: false },
      ],
    }),
    [],
  )
  assert.equal(sheet.gear.armor[0].acTotal, null)
  const s = sheet.gear.shields[0]
  assert.deepEqual([s.acBonus, s.hardness, s.hp, s.bt], [null, null, null, null])
  assert.ok(sheet.warnings.some((w) => w.code === 'armor_ac_unknown'))
  assert.ok(sheet.warnings.some((w) => w.code === 'shield_bonus_unknown'))
  assertValidSheet(sheet)
  assertSumInvariant(sheet)
})

test('an unmatched weapon warns that its hands were assumed', async () => {
  const sheet = await sheetFor(
    syntheticBuild({ weapons: [{ name: 'Homebrew Maul', qty: 1, prof: 'martial', die: 'd10', pot: 0, str: '', damageType: 'B', attack: 5, damageBonus: 0 }] }),
    [],
  )
  assert.equal(sheet.gear.weapons[0].hands, 1)
  assert.ok(sheet.warnings.some((w) => w.code === 'weapon_hands_assumed' && w.path === 'gear.weapons[0].hands'))
})

test('a buckler is flagged by name', async () => {
  const sheet = await sheetFor(syntheticBuild({ armor: [{ name: 'Steel Buckler', qty: 1, prof: 'shield', worn: false }] }), [itemDoc('Steel Buckler', { itemType: 'shield', acBonus: 1, hardness: 3, hp: 20 })])
  assert.equal(sheet.gear.shields[0].buckler, true)
})

test('Scroll of <Spell> is a consumable carrying the spell in linked[], separate from the item text', async () => {
  const sheet = await sheetFor(syntheticBuild({ equipment: [['Scroll of Fireball', 1, '']] }), [
    spellDoc('Fireball', 3),
    itemDoc('Scroll of 3rd-rank Spell', { itemType: 'consumable' }, { description: '<p>Generic scroll.</p>', bulk: 0.1 }),
  ])
  const scroll = sheet.gear.consumables[0]
  assert.equal(scroll.name, 'Scroll of Fireball')
  assert.equal(scroll.rules.html, '<p>Generic scroll.</p>')
  assert.equal(scroll.linked[0].role, 'spell')
  assert.equal(scroll.linked[0].name, 'Fireball')
  assert.equal(scroll.linked[0].rank, 3)
  assert.deepEqual(scroll.linked[0].cost, { kind: 'actions', min: 2 })
  assert.equal(scroll.linked[0].rules.html, '<p>Fireball text.</p>')
  assertValidSheet(sheet)
})

test('a scroll of an unknown spell is a miss, not a half-filled item', async () => {
  const sheet = await sheetFor(syntheticBuild({ equipment: [['Scroll of Nonexistent', 1, '']] }), [itemDoc('Scroll of 1st-rank Spell', { itemType: 'consumable' })])
  const item = sheet.gear.gear[0]
  assert.equal(item.rules, null)
  assert.equal(item.linked, undefined)
  assert.ok(sheet.warnings.some((w) => w.code === 'name_unmatched'))
})

// ---- spells ---------------------------------------------------------------------

test('spells: casters with slots, rank groups, merged duplicates, focus and rituals', async () => {
  const build = syntheticBuild({
    focusPoints: 1,
    focus: { divine: { cha: { abilityBonus: 3, proficiency: 2, itemBonus: 0, focusCantrips: ['Light Burst'], focusSpells: ['Life Link'] } } },
    rituals: ['Planar Binding'],
    spellCasters: [
      { name: 'Oracle', magicTradition: 'divine', spellcastingType: 'spontaneous', ability: 'cha', proficiency: 2, innate: false, perDay: [5, 4], spells: [{ spellLevel: 0, list: ['Message', 'Message'] }, { spellLevel: 1, list: ['Command', 'Unknown Spell'] }], prepared: [] },
      { name: 'Cleric Font', magicTradition: 'divine', spellcastingType: 'prepared', ability: 'wis', proficiency: 2, innate: false, perDay: [0, 0], spells: [], prepared: [] },
    ],
  })
  const sheet = await sheetFor(build, [spellDoc('Message', 0), spellDoc('Command', 1), spellDoc('Light Burst', 0), spellDoc('Life Link', 1), spellDoc('Planar Binding', 5, { spell: { rank: 5, defense: null, duration: null, area: null, range: null, time: '1 day', traditions: [], ritual: true } })])
  assert.equal(sheet.spells.casters.length, 1, 'the empty Cleric Font is dropped')
  assert.ok(sheet.warnings.some((w) => w.code === 'caster_dropped'))
  const oracle = sheet.spells.casters[0]
  assert.equal(oracle.key, 'caster:oracle#1')
  assert.deepEqual(oracle.slots, { 1: 4 })
  assert.deepEqual(oracle.ranks.map((r) => [r.rank, r.entries.map((e) => [e.name, e.count || 1])]), [[0, [['Message', 2]]], [1, [['Command', 1], ['Unknown Spell', 1]]]])
  const command = oracle.ranks[1].entries[0]
  assert.equal(command.defense, 'basic Reflex')
  assert.equal(command.area, '20-foot burst')
  assert.equal(command.rank, 1)
  assert.equal(oracle.ranks[1].entries[1].rules, null)
  assert.equal(sheet.spells.focus.pool, 1)
  assert.deepEqual(sheet.spells.focus.cantrips.map((s) => [s.name, s.rank]), [['Light Burst', 0]])
  assert.deepEqual(sheet.spells.focus.spells.map((s) => [s.name, s.rank]), [['Life Link', 1]])
  assert.deepEqual(sheet.spells.rituals.map((r) => [r.name, r.kind, r.rank, r.cost]), [['Planar Binding', 'ritual', 5, { kind: 'time', label: '1 day' }]])
  assertValidSheet(sheet)
})

test('no casters, focus or rituals leaves the spells section empty for the viewer to hide', async () => {
  const sheet = await sheetFor(syntheticBuild(), [])
  assert.deepEqual(sheet.spells, { casters: [], focus: null, rituals: [] })
})

// ---- actions and features -------------------------------------------------------

const featTuple = (name, type, level, option = null) => [name, option, type, level, 'x', 'standardChoice', null]

test('actions and features: source groups, costs, ordering, passives to Features', async () => {
  const build = syntheticBuild({
    feats: [
      featTuple('Power Attack', 'Class Feat', 1),
      featTuple('Reactive Strike', 'Class Feat', 1),
      featTuple('Sudden Charge', 'Class Feat', 1),
      featTuple('Toughness', 'General Feat', 1),
      featTuple('Burrow Trick', 'Ancestry Feat', 1),
      featTuple('Dedication', 'Archetype Feat', 2),
    ],
    specials: ['Rage', 'Unmatched Token', 'Not Selected'],
  })
  const sheet = await sheetFor(build, [
    entry('feat', 'Power Attack', { level: 1, actionType: 'action', actions: 1 }),
    entry('feat', 'Reactive Strike', { level: 1, actionType: 'reaction' }),
    entry('feat', 'Sudden Charge', { level: 1, actionType: 'action', actions: 2 }),
    entry('feat', 'Toughness', { level: 1, actionType: 'passive', traits: ['general'] }),
    entry('feat', 'Burrow Trick', { level: 1, actionType: 'free' }),
    entry('feat', 'Dedication', { level: 2, actionType: 'passive' }),
    entry('classFeature', 'Rage', { level: 1, actionType: 'action', actions: 1 }),
  ])
  const actions = Object.fromEntries(sheet.actions.groups.map((g) => [g.id, g.entries.map((e) => e.name)]))
  assert.deepEqual(actions.class, ['Power Attack', 'Rage', 'Sudden Charge', 'Reactive Strike'])
  assert.deepEqual(actions.ancestry, ['Burrow Trick'])
  const features = Object.fromEntries(sheet.features.groups.map((g) => [g.id, g.entries.map((e) => e.name)]))
  assert.deepEqual(features.general, ['Toughness'])
  assert.deepEqual(features.archetype, ['Dedication'])
  assert.equal(features.class, undefined, 'a group with nothing in it is omitted')
  for (const g of sheet.features.groups) for (const e of g.entries) assert.equal(e.cost, null)
  const ids = sheet.actions.groups.map((g) => g.id)
  assert.deepEqual(ids, [...ids].sort((a, b) => ['class', 'ancestry', 'general', 'archetype', 'familiar', 'basic', 'exploration', 'skill'].indexOf(a) - ['class', 'ancestry', 'general', 'archetype', 'familiar', 'basic', 'exploration', 'skill'].indexOf(b)))
  assert.ok(!JSON.stringify(sheet).includes('Unmatched Token'), 'unmatched specials are dropped')
  assertValidSheet(sheet)
})

test('the first five action groups open, basic, exploration and skill collapsed', async () => {
  const build = syntheticBuild({ feats: [featTuple('A', 'Class Feat', 1), featTuple('B', 'Ancestry Feat', 1), featTuple('C', 'General Feat', 1), featTuple('D', 'Archetype Feat', 1)], familiars: [{ name: 'Fam', abilities: ['Speech'] }] })
  const sheet = await sheetFor(build, [
    ...['A', 'B', 'C', 'D'].map((n) => entry('feat', n, { actionType: 'action', actions: 1 })),
    entry('action', 'Speech', { actionType: 'passive' }),
    actionDoc('Aid', 'reaction', null), actionDoc('Search', 'action', 1, { actionType: null, actions: null }), actionDoc('Hide', 'action', 1),
  ])
  assert.deepEqual(sheet.actions.groups.map((g) => [g.id, g.defaultOpen]), [['class', true], ['ancestry', true], ['general', true], ['archetype', true], ['familiar', true], ['basic', false], ['exploration', false], ['skill', false]])
})

test('duplicates with the same name and option merge into one row with a count; a different option stays apart', async () => {
  const build = syntheticBuild({ feats: [featTuple('Skill Training', 'Class Feat', 1, 'Intimidation'), featTuple('Skill Training', 'Class Feat', 3, 'Intimidation'), featTuple('Skill Training', 'Class Feat', 5, 'Stealth')] })
  const sheet = await sheetFor(build, [entry('feat', 'Skill Training', { actionType: 'passive' })])
  const entries = sheet.features.groups.find((g) => g.id === 'class').entries
  assert.deepEqual(entries.map((e) => [e.name, e.option, e.count]), [['Skill Training', 'Intimidation', 2], ['Skill Training', 'Stealth', undefined]])
  assert.deepEqual(entries.map((e) => e.key), ['feats:skill-training#1', 'feats:skill-training#2'])
})

test('a cost-less class feature stays in Features and its embedded action appears once on Actions', async () => {
  const build = syntheticBuild({ specials: ['Spellstrike'] })
  const sheet = await sheetFor(build, [
    entry('classFeature', 'Spellstrike', { actionType: 'passive', description: '<p><a data-ref="Compendium.pf2e.actionspf2e.Item.Spellstrike">Spellstrike</a> and <a data-ref="Compendium.pf2e.actionspf2e.Item.Strike">Strike</a></p>' }),
    actionDoc('Spellstrike', 'action', 2, { id: 'action:spellstrike' }),
    actionDoc('Strike', 'action', 1),
  ])
  assert.deepEqual(sheet.features.groups.find((g) => g.id === 'class').entries.map((e) => e.name), ['Spellstrike'])
  const classActions = sheet.actions.groups.find((g) => g.id === 'class').entries
  assert.deepEqual(classActions.map((e) => [e.name, e.cost]), [['Spellstrike', { kind: 'actions', min: 2 }]])
  const all = sheet.actions.groups.flatMap((g) => g.entries.map((e) => e.name))
  assert.equal(all.filter((n) => n === 'Strike').length, 1, 'the basic Strike is not duplicated into the class group')
})

test('a feat miss keeps its name with rules null, an AoN search URL and a warning; custom content has no URL', async () => {
  const build = syntheticBuild({ feats: [featTuple('Totally Unknown', 'General Feat', 1), featTuple('Custom Boon', 'General Feat', 1)] })
  const sheet = await sheetFor(build, [])
  const entries = sheet.features.groups.find((g) => g.id === 'general').entries
  assert.equal(entries[0].rules, null)
  assert.equal(entries[0].aonUrl, 'https://2e.aonprd.com/Search.aspx?q=Totally%20Unknown')
  assert.equal(entries[1].aonUrl, null)
  assert.equal(sheet.warnings.filter((w) => w.code === 'name_unmatched').length, 2)
})

test('an alias resolves a Pathbuilder label to the corpus entry text and licence', async () => {
  const build = syntheticBuild({ feats: [featTuple('Detective Dedication', 'Archetype Feat', 2)] })
  const sheet = await sheetFor(build, [entry('feat', 'Edgewatch Detective Dedication', { aliases: ['Detective Dedication'], license: 'OGL', remaster: false, title: 'Pathfinder #157', level: 2 })])
  const e = sheet.features.groups.find((g) => g.id === 'archetype').entries[0]
  assert.equal(e.name, 'Detective Dedication')
  assert.deepEqual(e.rules, { html: '<p>Edgewatch Detective Dedication text.</p>', license: 'OGL', remaster: false, source: 'Pathfinder #157' })
  assert.equal(sheet.warnings.filter((w) => w.code === 'name_unmatched').length, 0)
})

test('a heritage that is also listed as a Heritage feat tuple appears once', async () => {
  const build = syntheticBuild({ heritage: 'Rock Dwarf', feats: [featTuple('Rock Dwarf', 'Heritage', 1)] })
  const sheet = await sheetFor(build, [entry('heritage', 'Rock Dwarf', { actionType: 'passive' })])
  const names = sheet.features.groups.flatMap((g) => g.entries.map((e) => e.name))
  assert.deepEqual(names.filter((n) => n === 'Rock Dwarf'), ['Rock Dwarf'])
})

test('familiar abilities appear only as actions in the familiar group', async () => {
  const build = syntheticBuild({ familiars: [{ name: 'Wisp', abilities: ['Speech', 'Tough'] }] })
  const sheet = await sheetFor(build, [entry('action', 'Speech', { actionType: 'passive' })])
  assert.deepEqual(sheet.actions.groups.find((g) => g.id === 'familiar').entries.map((e) => [e.name, e.rules === null]), [['Speech', false], ['Tough', true]])
  assert.equal(sheet.features.groups.find((g) => g.id === 'familiar'), undefined)
})

test('the fixed basic, exploration and skill action groups are built from the corpus', async () => {
  const sheet = await sheetFor(syntheticBuild(), [actionDoc('Stride', 'action', 1), actionDoc('Aid', 'reaction', null), actionDoc('Drop Prone', 'free', null), actionDoc('Hustle', null, null, { actionType: null }), actionDoc('Hide', 'action', 1)])
  const group = (id) => sheet.actions.groups.find((g) => g.id === id).entries.map((e) => e.name)
  assert.deepEqual(group('basic'), ['Drop Prone', 'Stride', 'Aid'])
  assert.deepEqual(group('exploration'), ['Hustle'])
  assert.deepEqual(group('skill'), ['Hide'])
})

// ---- keys, determinism, fixtures --------------------------------------------------

test('same input, same bytes: two runs give identical JSON', async () => {
  const build = loadBuild('taraan-skyseeker')
  const docs = syntheticCorpus([build])
  const a = JSON.stringify(await sheetFor(build, docs))
  const b = JSON.stringify(await sheetFor(build, docs))
  assert.equal(a, b)
})

for (const name of EXPORT_NAMES) {
  test(`${name}: output validates, keeps the sum invariant, has unique deterministic keys`, async () => {
    const build = loadBuild(name)
    const docs = syntheticCorpus([build])
    const sheet = await sheetFor(build, docs)
    assertValidSheet(sheet)
    assertSumInvariant(sheet)
    const keys = []
    const walk = (n) => {
      if (Array.isArray(n)) n.forEach(walk)
      else if (n && typeof n === 'object') {
        if (typeof n.key === 'string' && n.kind) keys.push(n.key)
        Object.values(n).forEach(walk)
      }
    }
    walk(sheet)
    const sectionKeys = keys.filter((k) => !k.startsWith('skillactions:'))
    assert.equal(new Set(sectionKeys).size, sectionKeys.length, 'entry keys are unique')
    for (const k of keys) assert.match(k, /^[a-z]+(:[a-z0-9-]+)+#\d+$/, k)
    const again = await sheetFor(loadBuild(name), syntheticCorpus([loadBuild(name)]))
    assert.equal(JSON.stringify(again), JSON.stringify(sheet))
  })
}

test('the corpus sha never enters a key', async () => {
  const build = loadBuild('anya')
  const sheet = await sheetFor(build, syntheticCorpus([build]))
  assert.ok(!/key":"[^"]*aaaaaaaa/.test(JSON.stringify(sheet)))
})
