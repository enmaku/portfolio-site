<script setup>
/**
 * REFERENCE PROTOTYPE (dev-only route) — wayfinder ticket "Prototype: mobile layout and bottom navigation".
 * Four layouts of the CritCrafter character viewer, switchable via `?variant=A|B|C|D` on
 * /projects/critcrafter-prototype. **D is the chosen design**; A–C are kept for comparison.
 * Hard-coded Lithrei Woeborn data (hand-derived numbers, illustrative rules text and costs/traits).
 * Not production code: the real viewer renders a server-built CritCrafter sheet and does no math.
 * See docs/prototypes/critcrafter-viewer-layout.md.
 */
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import CostIcons from './CritcrafterCostIcons.vue'
import RankPips from './CritcrafterRankPips.vue'
import TraitChips from './CritcrafterTraitChips.vue'

const route = useRoute()
const VARIANTS = [
  { key: 'A', name: 'Fixed header, flat screens' },
  { key: 'B', name: 'Accordion density' },
  { key: 'C', name: 'Cards + bottom sheet' },
  { key: 'D', name: 'CHOSEN: C + pinned vitals, 1-col skills, right-aligned meta' },
]
const variant = computed(() =>
  VARIANTS.some((v) => v.key === route.query.variant) ? route.query.variant : 'D',
)

const TABS = [
  { key: 'stats', label: 'Stats', icon: 'monitor_heart' },
  { key: 'skills', label: 'Skills', icon: 'psychology' },
  { key: 'gear', label: 'Gear', icon: 'backpack' },
  { key: 'spells', label: 'Spells', icon: 'auto_awesome' },
  { key: 'actions', label: 'Actions', icon: 'bolt' },
]
const tab = ref('stats')

const hero = {
  name: 'Lithrei Woeborn',
  line: 'Human Oracle / Investigator · Level 2',
  hp: 26, ac: 15, perception: 9, speed: 25,
  saves: [['Fortitude', 5, 'T'], ['Reflex', 6, 'E'], ['Will', 9, 'E']],
  abilities: [['STR', 0], ['DEX', 0], ['CON', 1], ['INT', 3], ['WIS', 3], ['CHA', 3]],
  dcs: [['Class DC', 17], ['Spell DC', 17], ['Spell attack', 7]],
}
const skills = [
  ['Acrobatics', 0, 'U'], ['Arcana', 7, 'T'], ['Athletics', 0, 'U'], ['Crafting', 3, 'U'],
  ['Deception', 7, 'T'], ['Diplomacy', 7, 'T'], ['Intimidation', 7, 'T'], ['Medicine', 7, 'T'],
  ['Nature', 7, 'T'], ['Occultism', 9, 'E'], ['Performance', 7, 'T'], ['Religion', 7, 'T'],
  ['Society', 7, 'T'], ['Stealth', 4, 'T'], ['Survival', 7, 'T'], ['Thievery', 4, 'T'],
  ['Academia Lore', 7, 'T'],
]
const GEAR_TRAITS = {"Bladed Scarf": ["Finesse", "Reach", "Sweep"], "Branch Implement": ["Implement", "Versatile P"], "Dagger": ["Agile", "Finesse", "Thrown 10 ft", "Versatile S"], "Armored Cloak": ["Light", "Comfort"], "Chain Shirt": ["Flexible", "Noisy"], "Armored Skirt": ["Flexible"], "Steel Shield": ["Shield"], "Rations": ["Consumable"], "Torch": ["Consumable", "Fire"], "Chalk": ["Consumable"], "Bloodsalt folio": ["Uncommon", "Implement"]}
const gi = (name, sub, text, qty = 0, extra = {}) => ({ name, sub, text, qty, used: 0, traits: GEAR_TRAITS[name] ?? [], ...extra })
const gearGroups = reactive([
  { label: 'Weapons', list: [
    gi('Bladed Scarf', '+4 · 1d6 S', 'Martial. Reach, sweep, finesse. Two hands. (illustrative text)', 0, { kind: 'weapon', on: true, hands: 2, grip: 2 }),
    gi('Branch Implement', '+4 · 1d8 S', 'Simple. Doubles as an implement; versatile grip: 1 or 2 hands. (illustrative text)', 0, { kind: 'weapon', on: false, hands: 1, grip: 1, versatile: true }),
    gi('Dagger', '+4 · 1d4 P', 'Simple. Agile, finesse, thrown. One hand. (illustrative text)', 0, { kind: 'weapon', on: false, hands: 1, grip: 1 }),
  ] },
  { label: 'Armor & Shields', list: [
    gi('Armored Cloak', 'Light · AC +1', 'Light armor. Dex cap +2, check penalty 0. (illustrative)', 0, { kind: 'armor', on: true, ac: 1, trained: true }),
    gi('Chain Shirt', 'Medium · AC +2', 'Medium armor; you are untrained in it, so no proficiency bonus. (illustrative)', 0, { kind: 'armor', on: false, ac: 2, trained: false }),
    gi('Armored Skirt', 'Layers · AC +0', 'Worn alongside other armor, so it does not replace it. (illustrative)', 0, { kind: 'armor', on: false, ac: 0, over: true, trained: true }),
    gi('Steel Shield', 'Hardness 5 · HP 20', 'Raise a Shield: +2 circumstance AC until your next turn. (illustrative)', 0, { kind: 'shield', on: false, raised: false, ac: 2, hardness: 5, hp: 20, bt: 10 }),
    gi('Buckler', 'Hardness 3 · HP 20', 'Raise a Shield: +1 circumstance AC until your next turn. (illustrative)', 0, { kind: 'shield', on: false, raised: false, ac: 1, hardness: 3, hp: 20, bt: 10 }),
  ] },
  { label: 'Consumables', list: [
    gi('Rations', '×2', 'One person for a day.', 2), gi('Torch', '×5', 'Bright light 20 ft, 1 hour.', 5), gi('Chalk', '×10', 'Marks surfaces.', 10),
  ] },
  { label: 'Gear', list: [
    gi('Backpack', 'Invested', 'Holds 4 Bulk. (illustrative)'), gi('Bloodsalt folio', 'Invested', 'Oracle implement. (illustrative)'),
    gi('Bedroll', '×1', 'Sleeping gear.'), gi('Flint and Steel', '×1', 'Light a fire in 1 minute.'),
    gi('Rope', '×1', '50 feet.'), gi('Waterskin', '×1', 'A day of water.'), gi('Soap', '×1', 'Wash up.'),
  ] },
])
// cost: icon keys (single/two/three/reaction/free, 'to' between). Costs are illustrative.
const SPELL_TRAITS = {"Bullhorn": ["Cantrip", "Auditory"], "Wash Your Luck": ["Cantrip", "Fortune"], "Message": ["Cantrip", "Auditory", "Linguistic", "Mental"], "Glamorize": ["Cantrip", "Illusion", "Visual"], "Read the Air": ["Cantrip", "Detection", "Mental"], "Vitality Lash": ["Cantrip", "Vitality"], "Spirit Ward": ["Spirit"], "Defended by Spirits": ["Spirit"], "Command": ["Auditory", "Linguistic", "Mental"], "Sanctuary": ["Mental"], "Soothe": ["Healing", "Mental"], "Life Link": ["Focus", "Healing", "Vitality"], "Eject Soul": ["Focus", "Spirit"]}
const sp = (n, c) => ({ name: n, cost: c, traits: SPELL_TRAITS[n] ?? [] })
const spellLevels = reactive([
  { label: 'Cantrips', max: 0, used: 0, list: [sp('Bullhorn', ['two']), sp('Wash Your Luck', ['single']), sp('Message', ['two']), sp('Glamorize', ['two']), sp('Read the Air', ['single']), sp('Vitality Lash', ['two'])] },
  { label: '1st level', max: 4, used: 0, list: [sp('Spirit Ward', ['two']), sp('Defended by Spirits', ['two']), sp('Command', ['two']), sp('Sanctuary', ['two']), sp('Soothe', ['two'])] },
  { label: 'Focus (2 pts)', max: 2, used: 0, list: [sp('Life Link', ['single']), sp('Eject Soul', ['reaction'])] },
])
function cycleUsed(l) {
  const max = l.max ?? l.qty
  l.used = l.used >= max ? 0 : l.used + 1
}

const SWORD_ICON =
  'img:data:image/svg+xml;utf8,' +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'><g transform='rotate(45 12 12)'><polygon points='10.8,13 10.8,3 12,0.8 13.2,3 13.2,13'/><rect x='7.5' y='13.2' width='9' height='1.8' rx='.6'/><rect x='11' y='15' width='2' height='4'/><circle cx='12' cy='20.6' r='1.4'/></g></svg>",
  )
const SHIRT_ICON =
  'img:data:image/svg+xml;utf8,' +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'><path d='M16 3l5 3-2 4-3-1v11H8V9l-3 1-2-4 5-3a4 3 0 0 0 8 0z'/></svg>",
  )
const RAISE_ICON =
  'img:data:image/svg+xml;utf8,' +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'><circle cx='9.5' cy='5.5' r='2.6'/><path d='M3.5 21v-6.5a4.5 4.5 0 0 1 4.5-4.5h3a4.5 4.5 0 0 1 4.5 4.5V21z'/><path d='M14 11.5 19 4' stroke='white' stroke-width='2.6' stroke-linecap='round' fill='none'/><circle cx='19.3' cy='3.6' r='1.9'/></svg>",
  )
const EQUIP_ICON = { weapon: SWORD_ICON, armor: SHIRT_ICON, shield: 'shield' }
const allGear = computed(() => gearGroups.flatMap((g) => g.list))
const shield = computed(() => allGear.value.find((g) => g.kind === 'shield' && g.on))
const MAX_HANDS = 2
const heldWeapons = computed(() => allGear.value.filter((g) => g.kind === 'weapon' && g.on))
const handsInUse = computed(() => heldWeapons.value.reduce((n, g) => n + g.grip, 0))
// Keep total hands <= 2: drop other held weapons (earliest in list first) until `g` fits.
function enforceHands(g) {
  const others = heldWeapons.value.filter((w) => w !== g)
  let total = g.grip + others.reduce((n, w) => n + w.grip, 0)
  for (const w of others) {
    if (total <= MAX_HANDS) break
    w.on = false
    total -= w.grip
  }
}
function toggleGrip(g) {
  g.grip = g.grip === 1 ? 2 : 1
  if (g.on) enforceHands(g)
}
function groupCaption(l) {
  if (l.label === 'Weapons') return `Hands ${handsInUse.value}/${MAX_HANDS}`
  return l.list.length + (l.list.length === 1 ? ' item' : ' items')
}
function toggleEquip(g) {
  if (g.kind === 'weapon') {
    g.on = !g.on
    if (g.on) enforceHands(g)
    return
  }
  if (g.kind === 'armor' && !g.on && !g.over) {
    // one body armor at a time; layered pieces (e.g. armored skirt) coexist
    allGear.value.filter((a) => a.kind === 'armor' && !a.over).forEach((a) => (a.on = false))
  }
  if (g.kind === 'shield') {
    // one shield at a time; equipping swaps, unequipping always lowers
    const wasOn = g.on
    allGear.value.filter((a) => a.kind === 'shield').forEach((a) => { a.on = false; a.raised = false })
    g.on = !wasOn
    return
  }
  g.on = !g.on
}
function toggleRaise(g) {
  if (g.on) g.raised = !g.raised
}
// AC = 10 + Dex (0, cap ignored) + proficiency (unarmored/light trained = 4, untrained armor = 0) + best item bonus + raised shield
const ac = computed(() => {
  const worn = allGear.value.filter((g) => g.kind === 'armor' && g.on)
  const body = worn.find((g) => !g.over)
  const prof = body && !body.trained ? 0 : 4
  const item = Math.max(0, ...worn.map((g) => g.ac))
  const sh = shield.value?.raised ? shield.value.ac : 0
  return 10 + 0 + prof + item + sh
})
const actions = [
  { name: 'Strike', traits: ['Attack'], cost: ['single'], sub: '', text: 'Attack with a weapon. MAP −5 / −10. (illustrative)' },
  { name: 'Cast a Spell', traits: ['Concentrate', 'Manipulate'], cost: ['single', 'to', 'three'], sub: '', text: 'Cast a spell from your repertoire. (illustrative)' },
  { name: 'Devise a Stratagem', traits: ['Fortune', 'Investigator'], cost: ['single'], sub: 'Fortune', text: 'Roll d20 now; use it for your next Strike this turn. (illustrative)' },
  { name: 'Pursue a Lead', traits: ['Investigator'], cost: ['free'], sub: 'Investigator', text: 'Choose a creature or clue to investigate. (illustrative)' },
  { name: 'Clue In', traits: ['Investigator', 'Concentrate'], cost: ['reaction'], sub: '', text: 'Share your lead with an ally. (illustrative)' },
  { name: 'Pointed Question', traits: ['Concentrate'], cost: ['single'], sub: 'Skill feat', text: 'Ask pointed questions of a subject. (illustrative)' },
]

const open = reactive({ saves: true, abilities: false, defenses: true, skills: true, gear: true, spells: true, strikes: true, actions: true })
const sheet = ref(null)
const sheetOpen = computed({ get: () => !!sheet.value, set: (v) => { if (!v) sheet.value = null } })
const pick = (item) => { sheet.value = item }
</script>

<template>
  <q-page class="cc column no-wrap" style="height: 100dvh; background: var(--q-dark-page); color: rgba(255,255,255,.87)">
    <!-- ================= VARIANT A: fixed header + flat screens ================= -->
    <template v-if="variant === 'A'">
      <header class="cc-head q-pa-sm">
        <div class="text-subtitle1 text-weight-bold">{{ hero.name }}</div>
        <div class="text-caption text-grey-5">{{ hero.line }}</div>
        <div class="row q-gutter-xs q-mt-xs">
          <q-chip dense color="accent" text-color="white">HP {{ hero.hp }}</q-chip>
          <q-chip dense color="primary" text-color="white">AC {{ ac }}</q-chip>
          <q-chip dense color="primary" text-color="white">Perc +{{ hero.perception }}</q-chip>
          <q-chip dense color="secondary" text-color="white">Spd {{ hero.speed }}</q-chip>
        </div>
        <div v-if="shield" class="cc-shield text-caption" :class="{ 'cc-shield--off': !shield.raised }"><q-icon name="shield" size="14px" /> {{ shield.name }} · {{ shield.raised ? 'raised, +' + shield.ac + ' AC' : 'lowered' }} · Hardness {{ shield.hardness }} · HP {{ shield.hp }} · BT {{ shield.bt }}</div>
      </header>
      <div class="col scroll q-pa-sm">
        <template v-if="tab === 'stats'">
          <div class="cc-label">Saves</div>
          <div class="row q-col-gutter-sm">
            <div v-for="s in hero.saves" :key="s[0]" class="col-4"><div class="cc-box text-center"><div class="text-caption">{{ s[0] }}</div><div class="text-h6">+{{ s[1] }}</div><div class="text-caption text-grey-5">{{ s[2] }}</div></div></div>
          </div>
          <q-separator dark class="cc-sep" />
          <div class="cc-label">Abilities</div>
          <div class="row q-col-gutter-sm">
            <div v-for="a in hero.abilities" :key="a[0]" class="col-4"><div class="cc-box text-center"><div class="text-caption">{{ a[0] }}</div><div class="text-h6">{{ a[1] >= 0 ? '+' : '' }}{{ a[1] }}</div></div></div>
          </div>
          <q-separator dark class="cc-sep" />
          <div class="cc-label">DC &amp; attack</div>
          <div class="row q-col-gutter-sm">
            <div v-for="d in hero.dcs" :key="d[0]" class="col-4"><div class="cc-box text-center"><div class="text-caption">{{ d[0] }}</div><div class="text-h6">{{ d[1] }}</div></div></div>
          </div>
        </template>
        <template v-else-if="tab === 'skills'">
          <div v-for="s in skills" :key="s[0]" class="cc-row row items-center">
            <span class="col ellipsis">{{ s[0] }}</span><RankPips :rank="s[2]" /><b class="cc-bonus">{{ s[1] >= 0 ? '+' : '' }}{{ s[1] }}</b>
          </div>
        </template>
        <template v-else-if="tab === 'gear'">
          <q-expansion-item v-for="l in gearGroups" :key="l.label" default-opened dark expand-separator class="cc-exp" header-class="cc-exp-head" :label="l.label" :caption="groupCaption(l)">
            <div v-for="g in l.list" :key="g.name" class="cc-row row no-wrap items-center" ><div class="col" style="min-width: 0"><div class="ellipsis">{{ g.name }}</div><div v-if="g.sub && !g.qty" class="text-grey-5 text-caption">{{ g.sub }}</div><TraitChips :traits="g.traits" /></div><span v-if="g.qty" class="cc-pips row no-wrap items-center" @click.stop="cycleUsed(g)">
              <template v-if="g.qty <= 5"><q-icon v-for="i in g.qty" :key="i" :name="i <= g.used ? 'check_box' : 'check_box_outline_blank'" size="32px" :color="i <= g.used ? 'white' : 'grey-6'" /></template>
              <span v-else class="text-body1"><q-icon :name="g.used ? 'check_box' : 'check_box_outline_blank'" size="32px" :color="g.used ? 'white' : 'grey-6'" /> {{ g.used }} / {{ g.qty }} used</span>
            </span><span v-if="g.kind === 'weapon'" class="cc-hands row no-wrap items-center" :class="{ 'cc-hands--tap': g.versatile }" @click.stop="g.versatile && toggleGrip(g)"><q-icon v-for="i in g.grip" :key="i" name="pan_tool" size="20px" /><q-icon v-if="g.versatile" name="swap_horiz" size="16px" class="q-ml-xs" /></span><span v-if="g.kind === 'shield'" class="cc-equip row items-center justify-center" :class="{ 'cc-equip--on': g.raised, 'cc-equip--locked': !g.on }" @click.stop="toggleRaise(g)"><q-icon :name="RAISE_ICON" size="30px" /></span><span v-if="g.kind" class="cc-equip row items-center justify-center" :class="{ 'cc-equip--on': g.on }" @click.stop="toggleEquip(g)"><q-icon :name="EQUIP_ICON[g.kind]" size="30px" /></span></div>
          </q-expansion-item>
        </template>
        <template v-else-if="tab === 'spells'">
          <q-expansion-item v-for="l in spellLevels" :key="l.label" default-opened dark expand-separator class="cc-exp" header-class="cc-exp-head" >
            <template #header>
              <q-item-section>{{ l.label }}</q-item-section>
              <q-item-section side>
                <span v-if="!l.max" class="text-caption text-grey-5">at will</span>
                <span v-else class="cc-pips row no-wrap items-center" @click.stop="cycleUsed(l)">
                  <q-icon v-for="i in l.max" :key="i" :name="i <= l.used ? 'check_box' : 'check_box_outline_blank'" size="32px" :color="i <= l.used ? 'white' : 'grey-6'" />
                </span>
              </q-item-section>
            </template>
            <div v-for="s in l.list" :key="s.name" class="cc-row row no-wrap items-center" ><div class="col"><div>{{ s.name }}</div><TraitChips :traits="s.traits" /></div><CostIcons :cost="s.cost" /></div>
          </q-expansion-item>
        </template>
        <template v-else>
          <div v-for="g in actions" :key="g.name" class="cc-row"><div class="row no-wrap items-center"><b class="col">{{ g.name }}</b><span class="text-grey-5 text-caption q-mr-sm">{{ g.sub }}</span><CostIcons :cost="g.cost" /></div><div class="text-caption text-grey-5">{{ g.text }}</div><TraitChips :traits="g.traits" /></div>
        </template>
      </div>
    </template>

    <!-- ================= VARIANT B: accordion density ================= -->
    <template v-else-if="variant === 'B'">
      <div class="cc-strip row no-wrap items-center q-px-sm">
        <span class="col ellipsis text-weight-bold">{{ hero.name }}</span>
        <span class="q-ml-sm">❤ {{ hero.hp }}</span><span class="q-ml-sm">🛡 {{ ac }}</span><span class="q-ml-sm">👁 +{{ hero.perception }}</span>
      </div>
      <div class="q-px-sm"><div v-if="shield" class="cc-shield text-caption" :class="{ 'cc-shield--off': !shield.raised }"><q-icon name="shield" size="14px" /> {{ shield.name }} · {{ shield.raised ? 'raised, +' + shield.ac + ' AC' : 'lowered' }} · Hardness {{ shield.hardness }} · HP {{ shield.hp }} · BT {{ shield.bt }}</div></div>
      <div class="col scroll">
        <template v-if="tab === 'stats'">
          <div class="cc-acc" @click="open.saves = !open.saves">Saves & DCs <q-icon :name="open.saves ? 'expand_less' : 'expand_more'" /></div>
          <div v-if="open.saves" class="q-pa-sm">
            <div v-for="s in hero.saves" :key="s[0]" class="cc-row row"><span class="col">{{ s[0] }} ({{ s[2] }})</span><b>+{{ s[1] }}</b></div>
            <div v-for="d in hero.dcs" :key="d[0]" class="cc-row row"><span class="col">{{ d[0] }}</span><b>{{ d[1] }}</b></div>
          </div>
          <div class="cc-acc" @click="open.abilities = !open.abilities">Abilities <q-icon :name="open.abilities ? 'expand_less' : 'expand_more'" /></div>
          <div v-if="open.abilities" class="q-pa-sm row">
            <div v-for="a in hero.abilities" :key="a[0]" class="col-4 text-center q-py-xs">{{ a[0] }} <b>{{ a[1] >= 0 ? '+' : '' }}{{ a[1] }}</b></div>
          </div>
          <div class="cc-acc" @click="open.defenses = !open.defenses">Class features <q-icon :name="open.defenses ? 'expand_less' : 'expand_more'" /></div>
          <div v-if="open.defenses" class="q-pa-sm text-caption text-grey-4">Life Mystery · Curse of Outpouring Life · Revelation Spells · Oracular Curse · Strategic Strike · Interrogation Methodology</div>
        </template>
        <template v-else-if="tab === 'skills'">
          <div class="q-pa-sm row">
            <div v-for="s in skills" :key="s[0]" class="col-12 cc-row row no-wrap items-center"><span class="col ellipsis">{{ s[0] }}</span><RankPips :rank="s[2]" /><b class="cc-bonus">{{ s[1] >= 0 ? '+' : '' }}{{ s[1] }}</b></div>
          </div>
        </template>
        <template v-else-if="tab === 'gear'">
          <q-expansion-item v-for="l in gearGroups" :key="l.label" default-opened dark expand-separator class="cc-exp" header-class="cc-exp-head" :label="l.label" :caption="groupCaption(l)">
            <div v-for="g in l.list" :key="g.name" class="cc-row row no-wrap items-center" ><div class="col" style="min-width: 0"><div class="ellipsis">{{ g.name }}</div><div v-if="g.sub && !g.qty" class="text-grey-5 text-caption">{{ g.sub }}</div><TraitChips :traits="g.traits" /></div><span v-if="g.qty" class="cc-pips row no-wrap items-center" @click.stop="cycleUsed(g)">
              <template v-if="g.qty <= 5"><q-icon v-for="i in g.qty" :key="i" :name="i <= g.used ? 'check_box' : 'check_box_outline_blank'" size="32px" :color="i <= g.used ? 'white' : 'grey-6'" /></template>
              <span v-else class="text-body1"><q-icon :name="g.used ? 'check_box' : 'check_box_outline_blank'" size="32px" :color="g.used ? 'white' : 'grey-6'" /> {{ g.used }} / {{ g.qty }} used</span>
            </span><span v-if="g.kind === 'weapon'" class="cc-hands row no-wrap items-center" :class="{ 'cc-hands--tap': g.versatile }" @click.stop="g.versatile && toggleGrip(g)"><q-icon v-for="i in g.grip" :key="i" name="pan_tool" size="20px" /><q-icon v-if="g.versatile" name="swap_horiz" size="16px" class="q-ml-xs" /></span><span v-if="g.kind === 'shield'" class="cc-equip row items-center justify-center" :class="{ 'cc-equip--on': g.raised, 'cc-equip--locked': !g.on }" @click.stop="toggleRaise(g)"><q-icon :name="RAISE_ICON" size="30px" /></span><span v-if="g.kind" class="cc-equip row items-center justify-center" :class="{ 'cc-equip--on': g.on }" @click.stop="toggleEquip(g)"><q-icon :name="EQUIP_ICON[g.kind]" size="30px" /></span></div>
          </q-expansion-item>
        </template>
        <template v-else-if="tab === 'spells'">
          <q-expansion-item v-for="l in spellLevels" :key="l.label" default-opened dark expand-separator class="cc-exp" header-class="cc-exp-head" >
            <template #header>
              <q-item-section>{{ l.label }}</q-item-section>
              <q-item-section side>
                <span v-if="!l.max" class="text-caption text-grey-5">at will</span>
                <span v-else class="cc-pips row no-wrap items-center" @click.stop="cycleUsed(l)">
                  <q-icon v-for="i in l.max" :key="i" :name="i <= l.used ? 'check_box' : 'check_box_outline_blank'" size="32px" :color="i <= l.used ? 'white' : 'grey-6'" />
                </span>
              </q-item-section>
            </template>
            <div v-for="s in l.list" :key="s.name" class="cc-row row no-wrap items-center" ><div class="col"><div>{{ s.name }}</div><TraitChips :traits="s.traits" /></div><CostIcons :cost="s.cost" /></div>
          </q-expansion-item>
        </template>
        <template v-else>
          <div class="q-pa-sm"><div v-for="g in actions" :key="g.name" class="cc-row"><div class="row no-wrap items-center"><span class="col">{{ g.name }}</span><span class="text-grey-5 text-caption q-mr-sm">{{ g.sub }}</span><CostIcons :cost="g.cost" /></div><TraitChips :traits="g.traits" /></div></div>
        </template>
      </div>
    </template>

    <!-- ================= VARIANT D: C + pinned vitals + single-column skills + right-aligned meta ================= -->
    <template v-else-if="variant === 'D'">
      <div class="cc-hero q-pa-md q-ma-sm" style="flex: none">
        <div class="row items-baseline no-wrap">
          <div class="text-h6 col ellipsis">{{ hero.name }}</div>
          <div class="text-caption text-grey-4">Lv 2</div>
        </div>
        <div class="text-caption text-grey-4 q-mb-sm">{{ hero.line }}</div>
        <div class="row text-center">
          <div class="col"><div class="text-h5">{{ hero.hp }}</div><div class="text-caption">HP</div></div>
          <div class="col"><div class="text-h5">{{ ac }}</div><div class="text-caption">AC</div></div>
          <div class="col"><div class="text-h5">+{{ hero.perception }}</div><div class="text-caption">Perc</div></div>
          <div class="col"><div class="text-h5">{{ hero.speed }}</div><div class="text-caption">Speed</div></div>
        </div>
      <div v-if="shield" class="cc-shield text-caption" :class="{ 'cc-shield--off': !shield.raised }"><q-icon name="shield" size="14px" /> {{ shield.name }} · {{ shield.raised ? 'raised, +' + shield.ac + ' AC' : 'lowered' }} · Hardness {{ shield.hardness }} · HP {{ shield.hp }} · BT {{ shield.bt }}</div>
      </div>
      <div class="col scroll q-px-sm q-pb-sm">
        <template v-if="tab === 'stats'">
          <div class="cc-label">Saves</div>
          <div class="row q-col-gutter-sm">
            <div v-for="s in hero.saves" :key="s[0]" class="col-4"><div class="cc-card text-center"><div class="text-caption">{{ s[0] }}</div><div class="text-h6">+{{ s[1] }}</div></div></div>
          </div>
          <q-separator dark class="cc-sep" />
          <div class="cc-label">Abilities</div>
          <div class="row q-col-gutter-sm">
            <div v-for="a in hero.abilities" :key="a[0]" class="col-4"><div class="cc-card text-center"><div class="text-caption">{{ a[0] }}</div><div class="text-h6">{{ a[1] >= 0 ? '+' : '' }}{{ a[1] }}</div></div></div>
          </div>
          <q-separator dark class="cc-sep" />
          <div class="cc-label">DC &amp; attack</div>
          <div class="row q-col-gutter-sm">
            <div v-for="d in hero.dcs" :key="d[0]" class="col-4"><div class="cc-card text-center"><div class="text-caption">{{ d[0] }}</div><div class="text-h6">{{ d[1] }}</div></div></div>
          </div>
        </template>
        <template v-else-if="tab === 'skills'">
          <div v-for="s in skills" :key="s[0]" class="cc-card q-mb-xs row no-wrap items-center">
            <span class="col ellipsis">{{ s[0] }}</span><RankPips :rank="s[2]" /><b class="cc-bonus">{{ s[1] >= 0 ? '+' : '' }}{{ s[1] }}</b>
          </div>
        </template>
        <template v-else-if="tab === 'gear'">
          <q-expansion-item v-for="l in gearGroups" :key="l.label" default-opened dark expand-separator class="cc-exp" header-class="cc-exp-head" :label="l.label" :caption="groupCaption(l)">
            <div v-for="g in l.list" :key="g.name" class="cc-card q-mb-xs row no-wrap items-center" @click="pick(g)"><div class="col" style="min-width: 0"><div class="ellipsis">{{ g.name }}</div><div v-if="g.sub && !g.qty" class="text-grey-5 text-caption">{{ g.sub }}</div><TraitChips :traits="g.traits" /></div><span v-if="g.qty" class="cc-pips row no-wrap items-center" @click.stop="cycleUsed(g)">
              <template v-if="g.qty <= 5"><q-icon v-for="i in g.qty" :key="i" :name="i <= g.used ? 'check_box' : 'check_box_outline_blank'" size="32px" :color="i <= g.used ? 'white' : 'grey-6'" /></template>
              <span v-else class="text-body1"><q-icon :name="g.used ? 'check_box' : 'check_box_outline_blank'" size="32px" :color="g.used ? 'white' : 'grey-6'" /> {{ g.used }} / {{ g.qty }} used</span>
            </span><span v-if="g.kind === 'weapon'" class="cc-hands row no-wrap items-center" :class="{ 'cc-hands--tap': g.versatile }" @click.stop="g.versatile && toggleGrip(g)"><q-icon v-for="i in g.grip" :key="i" name="pan_tool" size="20px" /><q-icon v-if="g.versatile" name="swap_horiz" size="16px" class="q-ml-xs" /></span><span v-if="g.kind === 'shield'" class="cc-equip row items-center justify-center" :class="{ 'cc-equip--on': g.raised, 'cc-equip--locked': !g.on }" @click.stop="toggleRaise(g)"><q-icon :name="RAISE_ICON" size="30px" /></span><span v-if="g.kind" class="cc-equip row items-center justify-center" :class="{ 'cc-equip--on': g.on }" @click.stop="toggleEquip(g)"><q-icon :name="EQUIP_ICON[g.kind]" size="30px" /></span></div>
          </q-expansion-item>
        </template>
        <template v-else-if="tab === 'spells'">
          <q-expansion-item v-for="l in spellLevels" :key="l.label" default-opened dark expand-separator class="cc-exp" header-class="cc-exp-head" >
            <template #header>
              <q-item-section>{{ l.label }}</q-item-section>
              <q-item-section side>
                <span v-if="!l.max" class="text-caption text-grey-5">at will</span>
                <span v-else class="cc-pips row no-wrap items-center" @click.stop="cycleUsed(l)">
                  <q-icon v-for="i in l.max" :key="i" :name="i <= l.used ? 'check_box' : 'check_box_outline_blank'" size="32px" :color="i <= l.used ? 'white' : 'grey-6'" />
                </span>
              </q-item-section>
            </template>
            <div v-for="s in l.list" :key="s.name" class="cc-card q-mb-xs row no-wrap items-center" @click="pick({ name: s.name, sub: l.label, cost: s.cost, traits: s.traits, text: 'Spell card: range, targets, duration, heightened effects and full AoN text appear here. (illustrative)' })"><div class="col"><div>{{ s.name }}</div><TraitChips :traits="s.traits" /></div><CostIcons :cost="s.cost" /></div>
          </q-expansion-item>
        </template>
        <template v-else>
          <div v-for="g in actions" :key="g.name" class="cc-card q-mb-xs row no-wrap items-center" @click="pick(g)"><div class="col" style="min-width: 0"><div class="text-weight-bold ellipsis">{{ g.name }}</div><TraitChips :traits="g.traits" /></div><span class="text-grey-5 text-caption q-mr-sm">{{ g.sub }}</span><CostIcons :cost="g.cost" /></div>
        </template>
      </div>
      <q-dialog v-model="sheetOpen" position="bottom">
        <q-card class="cc-sheet" v-if="sheet">
          <q-card-section><div class="row items-baseline no-wrap"><div class="text-h6 col">{{ sheet.name }}</div><div class="text-caption text-grey-5 text-right q-mr-sm">{{ sheet.sub }}</div><CostIcons :cost="sheet.cost" /></div><TraitChips :traits="sheet.traits" /><div class="q-mt-sm">{{ sheet.text }}</div></q-card-section>
        </q-card>
      </q-dialog>
    </template>

    <!-- ================= VARIANT C: cards + bottom sheet ================= -->
    <template v-else>
      <div class="col scroll q-pa-sm">
        <div class="cc-hero q-pa-md q-mb-sm">
          <div class="text-h6">{{ hero.name }}</div>
          <div class="text-caption text-grey-4 q-mb-sm">{{ hero.line }}</div>
          <div class="row text-center">
            <div class="col"><div class="text-h5">{{ hero.hp }}</div><div class="text-caption">HP</div></div>
            <div class="col"><div class="text-h5">{{ ac }}</div><div class="text-caption">AC</div></div>
            <div class="col"><div class="text-h5">+{{ hero.perception }}</div><div class="text-caption">Perc</div></div>
            <div class="col"><div class="text-h5">{{ hero.speed }}</div><div class="text-caption">Speed</div></div>
          </div>
        <div v-if="shield" class="cc-shield text-caption" :class="{ 'cc-shield--off': !shield.raised }"><q-icon name="shield" size="14px" /> {{ shield.name }} · {{ shield.raised ? 'raised, +' + shield.ac + ' AC' : 'lowered' }} · Hardness {{ shield.hardness }} · HP {{ shield.hp }} · BT {{ shield.bt }}</div>
        </div>
        <template v-if="tab === 'stats'">
          <div class="cc-label">Saves</div>
          <div class="row q-col-gutter-sm">
            <div v-for="s in hero.saves" :key="s[0]" class="col-4"><div class="cc-card text-center"><div class="text-caption">{{ s[0] }}</div><div class="text-h6">+{{ s[1] }}</div></div></div>
          </div>
          <q-separator dark class="cc-sep" />
          <div class="cc-label">Abilities</div>
          <div class="row q-col-gutter-sm">
            <div v-for="a in hero.abilities" :key="a[0]" class="col-4"><div class="cc-card text-center"><div class="text-caption">{{ a[0] }}</div><div class="text-h6">{{ a[1] >= 0 ? '+' : '' }}{{ a[1] }}</div></div></div>
          </div>
          <q-separator dark class="cc-sep" />
          <div class="cc-label">DC &amp; attack</div>
          <div class="row q-col-gutter-sm">
            <div v-for="d in hero.dcs" :key="d[0]" class="col-4"><div class="cc-card text-center"><div class="text-caption">{{ d[0] }}</div><div class="text-h6">{{ d[1] }}</div></div></div>
          </div>
        </template>
        <template v-else-if="tab === 'skills'">
          <div class="row q-col-gutter-xs">
            <div v-for="s in skills" :key="s[0]" class="col-12"><div class="cc-card row no-wrap items-center"><span class="col ellipsis">{{ s[0] }}</span><RankPips :rank="s[2]" /><b class="cc-bonus">{{ s[1] >= 0 ? '+' : '' }}{{ s[1] }}</b></div></div>
          </div>
        </template>
        <template v-else-if="tab === 'gear'">
          <q-expansion-item v-for="l in gearGroups" :key="l.label" default-opened dark expand-separator class="cc-exp" header-class="cc-exp-head" :label="l.label" :caption="groupCaption(l)">
            <div v-for="g in l.list" :key="g.name" class="cc-card q-mb-xs row no-wrap items-center" @click="pick(g)"><div class="col" style="min-width: 0"><div class="ellipsis">{{ g.name }}</div><div v-if="g.sub && !g.qty" class="text-grey-5 text-caption">{{ g.sub }}</div><TraitChips :traits="g.traits" /></div><span v-if="g.qty" class="cc-pips row no-wrap items-center" @click.stop="cycleUsed(g)">
              <template v-if="g.qty <= 5"><q-icon v-for="i in g.qty" :key="i" :name="i <= g.used ? 'check_box' : 'check_box_outline_blank'" size="32px" :color="i <= g.used ? 'white' : 'grey-6'" /></template>
              <span v-else class="text-body1"><q-icon :name="g.used ? 'check_box' : 'check_box_outline_blank'" size="32px" :color="g.used ? 'white' : 'grey-6'" /> {{ g.used }} / {{ g.qty }} used</span>
            </span><span v-if="g.kind === 'weapon'" class="cc-hands row no-wrap items-center" :class="{ 'cc-hands--tap': g.versatile }" @click.stop="g.versatile && toggleGrip(g)"><q-icon v-for="i in g.grip" :key="i" name="pan_tool" size="20px" /><q-icon v-if="g.versatile" name="swap_horiz" size="16px" class="q-ml-xs" /></span><span v-if="g.kind === 'shield'" class="cc-equip row items-center justify-center" :class="{ 'cc-equip--on': g.raised, 'cc-equip--locked': !g.on }" @click.stop="toggleRaise(g)"><q-icon :name="RAISE_ICON" size="30px" /></span><span v-if="g.kind" class="cc-equip row items-center justify-center" :class="{ 'cc-equip--on': g.on }" @click.stop="toggleEquip(g)"><q-icon :name="EQUIP_ICON[g.kind]" size="30px" /></span></div>
          </q-expansion-item>
        </template>
        <template v-else-if="tab === 'spells'">
          <q-expansion-item v-for="l in spellLevels" :key="l.label" default-opened dark expand-separator class="cc-exp" header-class="cc-exp-head" >
            <template #header>
              <q-item-section>{{ l.label }}</q-item-section>
              <q-item-section side>
                <span v-if="!l.max" class="text-caption text-grey-5">at will</span>
                <span v-else class="cc-pips row no-wrap items-center" @click.stop="cycleUsed(l)">
                  <q-icon v-for="i in l.max" :key="i" :name="i <= l.used ? 'check_box' : 'check_box_outline_blank'" size="32px" :color="i <= l.used ? 'white' : 'grey-6'" />
                </span>
              </q-item-section>
            </template>
            <div v-for="s in l.list" :key="s.name" class="cc-card q-mb-xs row no-wrap items-center" @click="pick({ name: s.name, sub: l.label, cost: s.cost, traits: s.traits, text: 'Spell card: range, targets, duration, heightened effects and full AoN text appear here. (illustrative)' })"><div class="col"><div>{{ s.name }}</div><TraitChips :traits="s.traits" /></div><CostIcons :cost="s.cost" /></div>
          </q-expansion-item>
        </template>
        <template v-else>
          <div v-for="g in actions" :key="g.name" class="cc-card q-mb-xs row no-wrap items-center" @click="pick(g)"><div class="col" style="min-width: 0"><div class="text-weight-bold ellipsis">{{ g.name }}</div><TraitChips :traits="g.traits" /></div><span class="text-grey-5 text-caption q-mr-sm">{{ g.sub }}</span><CostIcons :cost="g.cost" /></div>
        </template>
      </div>
      <q-dialog v-model="sheetOpen" position="bottom">
        <q-card class="cc-sheet" v-if="sheet">
          <q-card-section><div class="text-h6">{{ sheet.name }}</div><div class="text-caption text-grey-5">{{ sheet.sub }}</div><CostIcons :cost="sheet.cost" /><TraitChips :traits="sheet.traits" /><div class="q-mt-sm">{{ sheet.text }}</div></q-card-section>
        </q-card>
      </q-dialog>
    </template>

    <!-- shared bottom bar: the thing being tested -->
    <nav class="cc-bar row no-wrap" :class="{ 'cc-bar--float': variant === 'C' || variant === 'D' }">
      <button v-for="t in TABS" :key="t.key" class="cc-tab col column items-center justify-center" :class="{ active: tab === t.key }" @click="tab = t.key">
        <q-icon :name="t.icon" size="24px" /><span>{{ t.label }}</span>
      </button>
    </nav>
  </q-page>
</template>

<style scoped>
.cc { --cc-line: rgba(142, 141, 139, 0.3); }
.cc-head { background: var(--q-dark); border-bottom: 1px solid var(--cc-line); }
.cc-strip { height: 36px; background: var(--q-dark); font-size: 13px; }
.cc-label { text-transform: uppercase; letter-spacing: .08em; font-size: 11px; color: var(--q-secondary); margin-bottom: 4px; }
.cc-box, .cc-card { background: var(--q-dark); border: 1px solid var(--cc-line); border-radius: 10px; padding: 14px 14px; min-height: 56px; font-size: 16px; }
.cc-row { padding: 14px 6px; min-height: 52px; font-size: 16px; border-bottom: 1px solid var(--cc-line); }
.cc-acc { padding: 16px 14px; min-height: 56px; font-size: 16px; background: #3d484d; border-bottom: 1px solid var(--cc-line); display: flex; justify-content: space-between; font-weight: 600; }
.cc-pill { background: var(--q-primary); border-radius: 22px; padding: 12px 18px; margin: 4px; font-size: 16px; }
.cc-hero { background: var(--q-primary); border-radius: 12px; }
.cc-sheet { width: 100%; background: #3d484d; color: rgba(255,255,255,.87); border-radius: 16px 16px 0 0; min-height: 30vh; }
.cc-bar { background: var(--q-dark); border-top: 1px solid var(--cc-line); height: 64px; flex: none; padding-bottom: env(safe-area-inset-bottom); }
.cc-bar--float { margin: 0 8px 8px; border-radius: 18px; border: 1px solid var(--cc-line); }
.cc-tab { background: none; border: 0; color: var(--q-secondary); font-size: 11px; }
.cc-tab.active { color: #fff; }
.cc-tab.active .q-icon { background: var(--q-primary); border-radius: 12px; padding: 2px 14px; box-sizing: content-box; }
.cc-exp { margin-bottom: 8px; }
.cc-exp :deep(.cc-exp-head) { min-height: 56px; font-weight: 600; font-size: 15px; }
.cc-exp :deep(.q-item__label--caption) { text-align: right; }
.cc-pips { min-height: 48px; padding: 0 4px; cursor: pointer; user-select: none; }
.cc-shield { font-size: 11px; margin-top: 6px; display: flex; align-items: center; justify-content: center; gap: 4px; opacity: 1; }
.cc-shield--off { opacity: 0.45; }
.cc-equip { min-width: 48px; min-height: 48px; margin-left: 6px; opacity: 0.3; cursor: pointer; user-select: none; }
.cc-equip--on { opacity: 1; color: #fff; }
.cc-hands { margin-left: 6px; color: var(--q-secondary); min-height: 40px; padding: 0 4px; }
.cc-hands--tap { color: #fff; background: rgba(255, 255, 255, 0.1); border: 1px solid var(--q-secondary); border-radius: 20px; padding: 0 10px; cursor: pointer; user-select: none; }
.cc-sep { margin: 20px 0 16px; background: var(--cc-line); }
.cc-bonus { min-width: 40px; text-align: right; margin-left: 8px; font-size: 17px; }
.cc-equip--locked { pointer-events: none; opacity: 0.12; }
</style>
